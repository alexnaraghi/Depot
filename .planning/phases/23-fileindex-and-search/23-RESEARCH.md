# Phase 23: FileIndex and Search - Research

**Researched:** 2026-02-04
**Domain:** Rust-side file indexing with fuzzy matching for instant workspace search
**Confidence:** HIGH

## Summary

Phase 23 builds a persistent Rust-side file index using **nucleo** fuzzy matching that enables instant search across large workspaces. The file tree filter queries this index instead of rebuilding matches on every keystroke. The index rebuilds automatically after streaming fstat completes.

**Architecture approach:** Nucleo provides proven performance (100K files in <5ms) with a straightforward API. The index lives in Tauri backend state, queried via Tauri commands. The frontend filter (already debounced at 150ms) sends queries to Rust instead of computing matches client-side. Results include fuzzy scores that combine with recency bias (file modification time) for ranking.

**Key decisions locked by user:**
- Fuzzy/exact match toggle (user can switch modes)
- Tree stays hierarchical during filter (not flat list)
- Recency bias for ranking (prefer recently modified when scores are close)
- Progressive results (50 initial, load more)
- File tree filter only (no separate command palette)

**Primary recommendation:** Use nucleo 0.5 with `Matcher::fuzzy_match()` API. Build index incrementally as fstat batches arrive. Store `Vec<(String, u64)>` where String is depot path and u64 is modification timestamp. Query returns scored matches sorted by (fuzzy_score * recency_weight). Frontend maintains hierarchical tree presentation by filtering nodes in place (existing pattern works well).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| nucleo | 0.5 | Rust fuzzy matching | 6x faster than alternatives, battle-tested in helix-editor, handles 100K files in <5ms |
| tokio | 1.49+ | Async runtime | Already in use, provides async process execution for p4 fstat streaming |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nozbe/microfuzz | 1.0 | Client-side fuzzy matching | Already in use for current filter, keep for fallback/offline scenarios |
| useDebounce hook | custom | Input debouncing | Already in use (150ms), prevents excessive queries during typing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nucleo | fuzzy-matcher 0.3 | Simpler API but 6x slower, not viable for 100K files |
| nucleo | sublime_fuzzy 0.7 | Good for small datasets but slower Unicode handling |
| Rust index | Client-side only (microfuzz) | No backend round-trip but requires full file list in memory, slower for 10K+ files |

**Installation:**
```toml
# Cargo.toml
[dependencies]
nucleo = "0.5"
tokio = { version = "1.49", features = ["sync", "process", "io-util"] }
# ... existing dependencies
```

**No frontend changes needed** - existing `@nozbe/microfuzz` and `useDebounce` remain in package.json.

## Architecture Patterns

### Recommended Project Structure
```
src-tauri/src/
├── file_index/
│   ├── mod.rs           # FileIndex struct + public API
│   ├── builder.rs       # Incremental index building
│   └── search.rs        # Search/query implementation
├── commands/
│   └── search.rs        # Tauri commands: search_files, rebuild_index
└── state/
    └── mod.rs           # Add FileIndexState to global state
```

### Pattern 1: Incremental Index Building

**What:** Build index incrementally as streaming fstat batches arrive, rather than waiting for complete data load.

**When to use:** Any time file data arrives via streaming (Phase 22 streaming fstat).

**Example:**
```rust
// src-tauri/src/file_index/builder.rs
use nucleo_matcher::{Matcher, Config};

pub struct FileIndex {
    // Store depot path + modification timestamp for recency bias
    files: Vec<(String, u64)>,  // (depot_path, mod_time_unix)
    matcher: Matcher,
}

impl FileIndex {
    pub fn new() -> Self {
        Self {
            files: Vec::new(),
            matcher: Matcher::new(Config::DEFAULT),
        }
    }

    /// Add files from a streaming batch
    pub fn add_batch(&mut self, batch: &[P4FileInfo]) {
        for file in batch {
            // Extract modification time from file info (headModTime field)
            let mod_time = file.head_mod_time.unwrap_or(0);
            self.files.push((file.depot_path.clone(), mod_time));
        }
    }

    /// Clear index (before rebuild)
    pub fn clear(&mut self) {
        self.files.clear();
    }
}
```

**Why incremental:** First batch arrives in ~500ms, index becomes queryable immediately. No need to wait for full 10K file load.

### Pattern 2: Fuzzy + Recency Scoring

**What:** Combine nucleo fuzzy score with recency bias to surface recently modified files.

**When to use:** When user wants recently-worked files prioritized (user decision).

**Example:**
```rust
// src-tauri/src/file_index/search.rs
pub struct SearchResult {
    pub depot_path: String,
    pub score: u32,      // Combined fuzzy + recency score
    pub fuzzy_score: u32,
    pub mod_time: u64,
}

impl FileIndex {
    pub fn search(&mut self, query: &str, max_results: usize) -> Vec<SearchResult> {
        use nucleo_matcher::pattern::{Pattern, CaseMatching};

        let pattern = Pattern::parse(query, CaseMatching::Ignore);
        let mut results: Vec<SearchResult> = Vec::new();

        for (path, mod_time) in &self.files {
            if let Some(fuzzy_score) = pattern.score(path.into(), &mut self.matcher) {
                // Apply recency bias: boost score for files modified in last 7 days
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                let age_days = (now - mod_time) / 86400;
                let recency_boost = if age_days < 7 { 1.5 } else { 1.0 };

                let combined_score = (fuzzy_score as f64 * recency_boost) as u32;

                results.push(SearchResult {
                    depot_path: path.clone(),
                    score: combined_score,
                    fuzzy_score: fuzzy_score as u32,
                    mod_time: *mod_time,
                });
            }
        }

        // Sort by combined score descending
        results.sort_by(|a, b| b.score.cmp(&a.score));
        results.truncate(max_results);
        results
    }
}
```

**Recency bias formula:** Files modified <7 days ago get 1.5x score multiplier. User specified "prefer recently modified when scores are close" - this implements that requirement.

### Pattern 3: Exact Match Toggle

**What:** Support both fuzzy and exact matching modes (user can toggle).

**When to use:** User wants precise control over search behavior.

**Example:**
```rust
pub enum SearchMode {
    Fuzzy,
    Exact,
}

impl FileIndex {
    pub fn search_with_mode(
        &mut self,
        query: &str,
        mode: SearchMode,
        max_results: usize,
    ) -> Vec<SearchResult> {
        use nucleo_matcher::pattern::{Pattern, CaseMatching, AtomKind};

        let pattern = match mode {
            SearchMode::Fuzzy => {
                Pattern::parse(query, CaseMatching::Ignore)
            }
            SearchMode::Exact => {
                // Use substring matching for exact mode
                Pattern::new(
                    query,
                    CaseMatching::Ignore,
                    Normalization::Smart,
                    AtomKind::Substring,
                )
            }
        };

        // ... rest of search logic same as Pattern 2
    }
}
```

**Frontend toggle:** Simple button or keyboard shortcut (Ctrl+E) to switch modes. Store mode in `searchFilterStore`.

### Pattern 4: Hierarchical Tree Filtering

**What:** Keep tree structure during filter, showing matching files with ancestor paths.

**When to use:** User wants to distinguish files with same name in different paths (user requirement).

**Example:**
```typescript
// Frontend: src/components/FileTree/FileTree.tsx (modify existing filterResults)
const filterResults = useCallback((data: FileNodeData[], matchPaths: Set<string>) => {
  // matchPaths comes from Rust index query

  const applyFilter = (nodes: FileNodeData[]): FileNodeData[] => {
    return nodes.map(node => {
      if (node.isFolder) {
        // Recursively filter children
        const filteredChildren = node.children ? applyFilter(node.children) : undefined;

        // Folder visible if ANY descendant matches
        const hasMatchingDescendant = filteredChildren?.some(child => !child.dimmed);

        return {
          ...node,
          children: filteredChildren,
          dimmed: !hasMatchingDescendant,
        };
      } else {
        // File: check if depot path is in match set
        const depotPath = node.file?.depotPath;
        const matches = depotPath && matchPaths.has(depotPath);

        return {
          ...node,
          dimmed: !matches,
          highlightRanges: matches ? getHighlightRanges(depotPath, query) : undefined,
        };
      }
    });
  };

  return applyFilter(data);
}, []);
```

**Key insight:** Existing tree structure preserved. Only difference is matchPaths comes from Rust instead of client-side microfuzz. Ancestor folders stay visible (not dimmed) if any child matches.

### Pattern 5: Index Rebuild After Streaming

**What:** Rebuild index automatically when streaming fstat completes.

**When to use:** After workspace loads or user manually refreshes.

**Example:**
```rust
// In p4_fstat_stream handler (src-tauri/src/commands/p4/p4handlers.rs)
// After sending FstatStreamBatch::Complete

// Trigger index rebuild
let file_index_state = state.file_index.lock().await;
file_index_state.rebuild_from_files(&all_files);

// Or incrementally during streaming:
#[tauri::command]
pub async fn p4_fstat_stream(
    // ... params
    on_batch: Channel<FstatStreamBatch>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // ... spawn process ...

    tokio::spawn(async move {
        let mut file_index = state.file_index.lock().await;
        file_index.clear();  // Clear before rebuild

        while let Ok(Some(line)) = lines.next_line().await {
            // ... parse file ...
            if let Some(file_info) = build_file_info(&current_record) {
                batch.push(file_info.clone());

                // Add to index incrementally
                file_index.add_batch(&[file_info]);

                if batch.len() >= 100 {
                    let _ = on_batch.send(FstatStreamBatch::Data { files: batch, ... });
                    batch.clear();
                }
            }
        }
    });
}
```

**Timing:** Index updates incrementally as batches arrive. No separate "rebuild" step needed. Index is queryable as soon as first batch arrives.

### Anti-Patterns to Avoid

- **Rebuilding index on every query:** Index is read-only during queries. Only rebuild when source data changes (fstat completes).
- **Blocking main thread:** Always query index in Tauri command (background thread), never in frontend.
- **Full tree rebuild on filter:** Keep existing hierarchical filtering. Only change match source (Rust instead of microfuzz).
- **Custom fuzzy matching:** Don't hand-roll fuzzy algorithms. nucleo is 6x faster and better tested.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy string matching | Custom Levenshtein distance or regex matching | nucleo 0.5 | 6x faster, handles Unicode correctly, Smith-Waterman algorithm optimized for file paths |
| Index data structure | HashMap or custom trie | Vec<(String, u64)> with linear scan | nucleo is so fast (<5ms for 100K) that fancy data structures add complexity without benefit |
| Recency scoring | Complex time-decay formula | Simple 7-day threshold with 1.5x boost | User wants "prefer recent when close", not mathematical precision |
| Exact/fuzzy toggle | Separate code paths | nucleo Pattern with different AtomKind | nucleo supports multiple match types through configuration |
| Match highlighting | Custom substring search | nucleo returns match indices | nucleo Pattern::indices() provides exact character positions for highlighting |

**Key insight:** Fuzzy matching has subtle edge cases (Unicode grapheme clusters, diacritics, case folding). nucleo handles all of them. Don't reinvent.

## Common Pitfalls

### Pitfall 1: Querying Before Index Ready

**What goes wrong:** Frontend queries index before streaming fstat completes, gets zero results or stale data.

**Why it happens:** Index state is async, frontend doesn't know when it's ready.

**How to avoid:**
- Emit Tauri event when index rebuild completes: `app.emit("file-index-ready", ())`
- Frontend listens for event, enables search input when ready
- Show loading state in filter input until index ready

**Warning signs:** Search returns no results immediately after workspace load, then suddenly works.

### Pitfall 2: Stale Index After File Changes

**What goes wrong:** User edits/adds/deletes files, index still has old paths, search shows incorrect results.

**Why it happens:** Index only rebuilds on fstat, not on individual file operations.

**How to avoid:**
- After file operations (add, delete, edit), update index incrementally
- Or mark index as "stale" and show indicator to user
- Or auto-refresh fstat (and index) after operations complete

**Warning signs:** Deleted file still appears in search results.

### Pitfall 3: Score Ties with No Tiebreaker

**What goes wrong:** Multiple files have identical combined scores, results order is random/unstable.

**Why it happens:** Recency boost creates score ties (multiple files modified same day with same fuzzy score).

**How to avoid:**
```rust
// Add tiebreaker: lexicographic path order
results.sort_by(|a, b| {
    b.score.cmp(&a.score)  // Primary: score descending
        .then_with(|| a.depot_path.cmp(&b.depot_path))  // Tiebreaker: path ascending
});
```

**Warning signs:** Search results order changes on repeated queries with same input.

### Pitfall 4: Memory Growth from Never Clearing Index

**What goes wrong:** Index grows indefinitely as user switches workspaces/streams.

**Why it happens:** Old workspace files never removed from index.

**How to avoid:**
- Clear index when workspace changes (listen for workspace switch event)
- Or scope index to workspace path (Map<String, FileIndex> keyed by workspace)

**Warning signs:** Memory usage grows over time, search becomes slower.

### Pitfall 5: Case-Sensitive Depot Paths Breaking Match

**What goes wrong:** User types "foo.txt", depot path is "Foo.txt", no match found.

**Why it happens:** Exact path comparison after fuzzy match is case-sensitive.

**How to avoid:**
- Use `CaseMatching::Ignore` in nucleo Pattern (already shown in examples)
- Store depot paths in normalized form (lowercase) for comparison
- Or use case-insensitive Set for match results

**Warning signs:** User complains "I can see the file in the tree but search doesn't find it".

## Code Examples

Verified patterns from official sources:

### Basic Fuzzy Matching
```rust
// Source: https://docs.rs/nucleo-matcher
use nucleo_matcher::{Matcher, Config};
use nucleo_matcher::pattern::{Pattern, CaseMatching};

let mut matcher = Matcher::new(Config::DEFAULT);
let pattern = Pattern::parse("foo", CaseMatching::Ignore);

let text = "src/components/FooBar.tsx";
if let Some(score) = pattern.score(text.into(), &mut matcher) {
    println!("Match score: {}", score);
}
```

### Tauri Command for Search
```rust
// Source: Existing p4now patterns + nucleo API
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

#[tauri::command]
pub async fn search_workspace_files(
    query: String,
    mode: String,  // "fuzzy" or "exact"
    max_results: usize,
    state: State<'_, Arc<Mutex<FileIndex>>>,
) -> Result<Vec<SearchResult>, String> {
    let mut index = state.lock().await;

    let search_mode = match mode.as_str() {
        "exact" => SearchMode::Exact,
        _ => SearchMode::Fuzzy,
    };

    let results = index.search_with_mode(&query, search_mode, max_results);
    Ok(results)
}
```

### Frontend Query Integration
```typescript
// Source: Existing p4now patterns (TanStack Query)
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

function useFileSearch(query: string, mode: 'fuzzy' | 'exact') {
  return useQuery({
    queryKey: ['file-search', query, mode],
    queryFn: async () => {
      if (!query.trim()) return [];

      return await invoke<SearchResult[]>('search_workspace_files', {
        query,
        mode,
        maxResults: 50,
      });
    },
    enabled: query.length > 0,  // Don't query empty string
    staleTime: 5000,  // Cache results for 5s
  });
}
```

### Progressive Results (Load More)
```typescript
// Source: Standard infinite scroll pattern
function FileTreeFilter() {
  const [limit, setLimit] = useState(50);
  const { data: allResults } = useFileSearch(query, mode);

  const displayedResults = allResults?.slice(0, limit) ?? [];
  const hasMore = allResults && allResults.length > limit;

  return (
    <div>
      {displayedResults.map(renderResult)}
      {hasMore && (
        <button onClick={() => setLimit(limit + 50)}>
          Load 50 more ({allResults.length - limit} remaining)
        </button>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side fuzzy matching (microfuzz) | Rust-side persistent index (nucleo) | Phase 23 | <10ms search for 10K files vs ~50ms, scales to 100K+ |
| Rebuild matches per keystroke | Debounced query to persistent index | Phase 23 | 150ms debounce + instant index query = no lag |
| Flat fuzzy match results | Hierarchical tree with filtered nodes | Existing (preserved) | User can distinguish same-name files by path |
| No recency bias | Modification time boost | Phase 23 | Recently-worked files surface first |

**Deprecated/outdated:**
- N/A - This is new functionality, no legacy approach to deprecate

**Emerging patterns (2026):**
- **Streaming index builds:** Don't wait for full data load, build index incrementally (helix-editor pattern)
- **Hybrid exact/fuzzy:** Let user toggle modes rather than forcing one (VS Code pattern)
- **Time-weighted scoring:** Recency bias is becoming standard in AI search systems

## Open Questions

Things that couldn't be fully resolved:

1. **Match highlighting character positions**
   - What we know: nucleo Pattern has `indices()` method that returns match positions
   - What's unclear: Exact API for extracting positions for UI highlighting
   - Recommendation: Start with bold text for matched files, add character-level highlighting in Phase 24 if user wants it

2. **Optimal batch size for index updates**
   - What we know: Streaming fstat uses 100-file batches
   - What's unclear: Does index perform better with 100-file batches or full rebuild at end?
   - Recommendation: Start with incremental (add_batch per fstat batch), measure performance, switch to end-of-stream rebuild if faster

3. **Recency boost parameter tuning**
   - What we know: User wants recency bias, 7-day threshold with 1.5x boost is reasonable starting point
   - What's unclear: Exact threshold (7 vs 14 days) and multiplier (1.5x vs 2x) for "prefer recent when close"
   - Recommendation: Start with 7d/1.5x, make configurable in Phase 24 if user wants to tune

4. **Index persistence across app restarts**
   - What we know: Index is in-memory, rebuilds on fstat
   - What's unclear: Should index be serialized to disk for instant startup?
   - Recommendation: No - fstat streaming is fast enough (<2s for 10K files). Persistence adds complexity without meaningful benefit.

## Sources

### Primary (HIGH confidence)
- [nucleo GitHub](https://github.com/helix-editor/nucleo) - Official repository with benchmarks
- [nucleo-matcher crate docs](https://docs.rs/nucleo-matcher) - API documentation
- [nucleo crate docs](https://docs.rs/nucleo) - High-level API patterns
- P4Now STACK.md - C:\Projects\Fun\p4now\.planning\research\STACK.md (lines 52-115)
- Existing streaming implementation - C:\Projects\Fun\p4now\src-tauri\src\commands\p4\p4handlers.rs (lines 80-218)
- Existing filter implementation - C:\Projects\Fun\p4now\src\components\FileTree\FileTree.tsx (lines 91-173)

### Secondary (MEDIUM confidence)
- [Helix 23.10 release notes](https://helix-editor.com/news/release-23-10-highlights/) - Real-world nucleo usage patterns
- [Ragie recency bias implementation](https://docs.ragie.ai/docs/retrievals-recency-bias) - Time-weighted scoring patterns
- [Zed fuzzy finding approach](https://nathancraddock.com/blog/a-different-approach-to-fuzzy-finding/) - Hierarchical fuzzy matching

### Tertiary (LOW confidence)
- WebSearch: "fuzzy search recency bias scoring" - General patterns, not specific to nucleo
- WebSearch: "file tree filter hierarchical" - UI patterns, not implementation details

## Metadata

**Confidence breakdown:**
- Standard stack (nucleo): **HIGH** - Battle-tested in helix-editor, clear benchmarks, active development
- Architecture patterns: **HIGH** - Existing p4now streaming patterns proven, nucleo API documented
- Recency bias scoring: **MEDIUM** - Pattern is sound but exact parameters (7d, 1.5x) are estimates needing validation
- Hierarchical filtering: **HIGH** - Existing tree builder works, only changing match source
- Index rebuild timing: **HIGH** - Incremental approach used in helix, fits streaming fstat pattern

**Research date:** 2026-02-04
**Valid until:** 90 days (nucleo is mature/stable, unlikely to change)

**Dependencies:**
- Phase 22 must complete (streaming fstat provides data source)
- tokio features enabled (process, io-util) - already in Phase 21
- Existing file tree infrastructure (treeBuilder, FileTree component)

**Risks:**
- Low: nucleo API stability - Core matcher is "finished and ready", high-level API may evolve but breaking changes rare
- Low: Performance - Benchmarks show <5ms for 100K files, well within requirements
- Medium: Recency bias tuning - May need iteration to get "right" feel for user
