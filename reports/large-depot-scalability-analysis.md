# Large Depot Scalability Analysis: P4Now

**Date:** 2026-02-03
**Scope:** Complete codebase audit for >10,000 file depot scalability
**Audience:** Developer (implementation reference)
**Priority areas:** Search (critical), File Tree, Changelist Panel, Backend Commands

---

## Executive Summary

P4Now was built for typical developer workspaces (hundreds to low thousands of files). When connected to a large depot with >10,000 files, **seven distinct bottlenecks** will cause the application to degrade significantly or become unusable. The most severe issues are in the initial data load (fetching all file metadata in a single blocking call), the file tree filtering (rebuilding the entire tree on every keystroke), and search (no scalable search architecture exists).

This report catalogs every scalability issue found, ranks them by severity, and provides implementable solutions for each. The search section includes a complete architecture design suitable for 100,000+ file depots.

**Severity scale:**
- **P0 (App-breaking):** Application hangs or crashes
- **P1 (Major degradation):** Feature becomes too slow to use (>3 second response)
- **P2 (Minor degradation):** Noticeable sluggishness (<3 seconds) but functional
- **P3 (Theoretical):** Only a concern at extreme scale (>100,000 files)

---

## Issue Catalog

### 1. [P0] Full Workspace `p4 fstat` on Every Load

**Location:** `src/components/FileTree/useFileTree.ts:107-129`, `src-tauri/src/commands/p4.rs:178-212`

**Current behavior:** On connection and every 30-second refetch, `useFileTree` calls `invokeP4Fstat([], depotPath)` which executes `p4 -ztag fstat //stream/main/...` and waits for the entire result set. The Rust backend buffers the full stdout into a single `String`, parses every record, and returns the entire array to the frontend.

**Impact at 10,000 files:**
- P4 server query time: 3-10 seconds (network + server processing)
- Rust parsing time: 500ms-2s (parsing ~100 lines per file = 1M+ lines)
- IPC transfer: 2-5MB JSON payload, 200-500ms serialization
- Frontend: `mapP4FileInfo` + `setFiles` + `buildFileTree` on 10K items = 500ms-1s
- **Total: 5-15 seconds of blocking load time with frozen UI**

**At 50,000 files:** Application will appear hung for 30-60 seconds. The `cmd.output()` call in Rust blocks the async executor, starving other Tauri commands.

**Why it's P0:** The `staleTime: 30000` setting means this entire pipeline re-executes every 30 seconds when the window is focused (`refetchOnWindowFocus: true`). At scale, the app would be in a permanent loading state.

**Solution:**
1. **Incremental fstat:** Change `p4_fstat` to stream results via Tauri Channel (like `p4_sync` already does). Parse and emit records as they arrive.
2. **Delta refresh:** After initial load, use `p4 fstat -Ro //...` (opened files only) and `p4 fstat -Rs //...` (shelved files only) for subsequent refreshes instead of querying the entire workspace. Merge deltas into the existing file map.
3. **Background refresh:** Move the 30-second auto-refresh to a background task that doesn't block the main query. Use `staleTime: Infinity` and manual invalidation after mutations.
4. **Rust: streaming parser:** Replace `cmd.output()` with `cmd.stdout(Stdio::piped())` + `BufReader` line-by-line parsing, emitting batches of 100 files at a time via Channel.

**Estimated effort:** 3-4 days (backend streaming + frontend incremental merge)

---

### 2. [P0] File Tree Rebuild on Every Filter Keystroke

**Location:** `src/components/FileTree/FileTree.tsx:91-172`

**Current behavior:** The `filterResults` function runs on every keystroke (via `useDeferredValue`, which still runs on every value change). For each filter operation, it:
1. `collectFiles()` - Recursively walks the entire tree to flatten all file nodes into an array (O(n) where n = total files)
2. `createFuzzySearch(allFiles, ...)` - Builds a new fuzzy search index from scratch (O(n))
3. `fuzzySearch(term)` - Searches the index (O(n))
4. `applyFilter()` - Walks the entire tree again to mark dimmed/highlighted nodes (O(n))

**Impact at 10,000 files:**
- 4 full tree traversals per keystroke = ~40,000 node visits
- `createFuzzySearch` allocates a new index object each time
- Typing "foo" triggers 3 filter operations: "f", "fo", "foo"
- Each operation takes 50-200ms at 10K files = noticeable input lag
- At 50K files: 500ms+ per keystroke = unusable

**Why it's P0:** Search/filter is the primary navigation mechanism. Input lag makes the core UX feel broken.

**Solution:**
1. **Persistent fuzzy index:** Build the microfuzz index once when tree data changes (in a `useMemo`), not on every keystroke. The `filterResults` callback currently creates a new index every time -- move `createFuzzySearch` to a `useMemo` dependent on `tree`.
2. **Debounce the filter:** Add a 150ms debounce to the filter term (in addition to `useDeferredValue`). This prevents index lookups during rapid typing.
3. **Avoid full tree walks:** Maintain a flat file array alongside the tree (already available from `useFileTree().files`). Use it directly for fuzzy matching instead of `collectFiles()`.
4. **Incremental dimming:** Instead of rebuilding the entire tree with `applyFilter()`, pass match results down via React context and let individual `FileNode` components check their own dimmed status. This leverages React's own diffing.

**Estimated effort:** 1-2 days

---

### 3. [P0] Search Architecture is Not Scalable

**Location:** `src/components/DetailPane/SearchResultsView.tsx`, `src/components/SearchBar.tsx`, `src/stores/searchFilterStore.ts`, `src-tauri/src/commands/p4.rs:2054-2131` (p4_files)

**Current search architecture has three separate mechanisms, none of which scale:**

#### 3a. Toolbar Filter (SearchBar + searchFilterStore)
- **Mechanism:** Zustand store holds `filterTerm`. FileTree and ChangelistPanel both subscribe and filter their already-loaded data client-side.
- **Scaling issue:** At 10K files, every keystroke triggers full fuzzy search of the file tree (Issue #2 above) AND full text search of all changelist file names.
- **No depot-wide search:** Only searches files already loaded in the workspace view. Cannot search across the depot.

#### 3b. Submitted CL Search (SearchResultsView, submitted mode)
- **Mechanism:** Prefetches 500 submitted CLs via `invokeP4ChangesSubmitted(500)`, then filters client-side with string `.includes()`.
- **Scaling issue:** Hard-capped at 500 CLs. A large active depot may have thousands of CLs per day. No way to search older history. The 500-CL fetch itself takes 2-5 seconds on busy servers.

#### 3c. Depot Path Search (SearchResultsView, depot mode)
- **Mechanism:** Passes user's pattern directly to `p4 files <pattern>` with `max_results: 100`.
- **Scaling issue:** Requires exact P4 wildcard syntax (`//depot/.../*.cpp`). Not fuzzy. Hard-capped at 100 results. No streaming -- blocks until all results return. No pagination. Users must know depot structure to construct patterns.

**Combined scaling failures:**
- No unified search interface (three separate UI paths)
- No server-side text search (everything is client-side filtering of limited datasets)
- No search across file contents (grep/content search)
- No incremental/streaming results
- No search history or saved searches

**This is the #1 concern area per the task specification. Full solution in the Search at Scale section below.**

---

### 4. [P1] Tree Builder Creates Full Copy on Every Render

**Location:** `src/utils/treeBuilder.ts:40-120`

**Current behavior:** `buildFileTree()` is called in a `useMemo` inside `useFileTree`, but the memo dependency is `[files, rootPath]`. Since `files` is a new array reference every time the query returns (even if unchanged), the tree is rebuilt from scratch. The function:
1. Sorts the entire file array: `[...files].sort()` -- O(n log n)
2. Iterates every file, splitting paths and creating folder nodes
3. Uses a `Map<string, FileTreeNode>` for lookups (good), but creates it fresh each time
4. Runs `aggregateSyncStatus()` which recursively walks the entire tree bottom-up

**Impact at 10,000 files:**
- Sort: ~50ms
- Path splitting + node creation: ~100ms
- aggregateSyncStatus: ~20ms
- Total: ~170ms, but happens on every data refresh (every 30 seconds)
- At 50K files: ~800ms per rebuild, causes visible frame drops

**Solution:**
1. **Structural sharing:** Compare incoming files with existing files by depot path. Only rebuild subtrees that actually changed.
2. **Stable references:** Use `useQuery`'s `structuralSharing` option to preserve reference identity when data hasn't changed.
3. **Incremental tree updates:** When a single file changes (e.g., after checkout), update just that node in the tree instead of rebuilding.

**Estimated effort:** 2-3 days

---

### 5. [P1] Changelist Panel N+1 Shelved File Queries

**Location:** `src/components/ChangelistPanel/useChangelists.ts:154-172`

**Current behavior:** For every numbered pending changelist, a separate `useQuery` is created to fetch shelved files via `invokeP4DescribeShelved(clId)`. Each query spawns a `p4 -ztag describe -S <clId>` command.

**Impact at scale:**
- Developer with 20 pending CLs = 20 concurrent `p4 describe` commands
- Each command spawns a new p4.exe process
- At 30-second refetch interval, this is 20 processes every 30 seconds
- P4 server load: 20 concurrent describe commands may trigger rate limiting
- ProcessManager mutex contention (all registrations go through the same `Arc<Mutex<HashMap>>`)

**Solution:**
1. **Batch query:** Create a single backend command `p4_describe_shelved_batch` that takes an array of CL IDs and executes them sequentially in Rust, returning a map.
2. **Lazy loading:** Only fetch shelved files for changelists that are expanded in the tree, not all of them.
3. **Stale time increase:** Shelved files change infrequently. Increase staleTime from 30s to 5 minutes.

**Estimated effort:** 1 day

---

### 6. [P1] Backend Commands Block Async Runtime

**Location:** `src-tauri/src/commands/p4.rs` (all `#[tauri::command]` functions using `cmd.output()`)

**Current behavior:** Every Tauri command handler is `async` but calls `cmd.output()` which is a synchronous blocking call. This blocks the Tokio thread pool worker executing the command. With Tauri's default thread pool (typically 4-8 threads), just a few concurrent P4 operations can exhaust the pool.

**Impact at 10,000 files:**
- `p4_fstat` for 10K files blocks a thread for 5-15 seconds
- During that time, other commands (p4 info, p4 changes, p4 opened) queue up
- If auto-refresh triggers while a long fstat is running, the queue grows
- UI appears frozen because no queries complete until threads free up

**Solution:**
1. **Use `tokio::process::Command`:** Replace `std::process::Command` with Tokio's async process implementation. This yields the thread while waiting for the child process, allowing other commands to execute concurrently.
2. **Alternatively, use `spawn_blocking`:** Wrap synchronous `cmd.output()` calls in `tokio::task::spawn_blocking()` to move them off the async executor.

**Estimated effort:** 1-2 days (mechanical refactor -- change `Command` import and add `.await`)

---

### 7. [P1] FileTreeStore Creates New Map on Every Update

**Location:** `src/stores/fileTreeStore.ts:35-44`

**Current behavior:** `updateFile()` creates a brand-new `Map` copy (`new Map(currentFiles)`) for every single file update. During sync, this is called per-file as progress events arrive (see `useSync.ts:144-147`).

**Impact at 10,000 files:**
- Syncing 500 files triggers 500 Map copies
- Each copy duplicates all 10,000 Map entries
- Total: 5,000,000 Map operations during a single sync
- Memory churn: 500 Map objects of 10K entries each (garbage collector pressure)
- Each `set({ files: newFiles })` triggers Zustand subscribers, causing potential re-renders

**Solution:**
1. **Batch updates:** Accumulate file updates during sync and apply them in a single `set()` call (e.g., every 100ms or every 50 files).
2. **Immer integration:** Use Zustand's Immer middleware to allow mutable updates within `set()`, avoiding Map copies.
3. **Separate sync-time update path:** During sync operations, skip individual `updateFile` calls entirely. Instead, re-fetch the file tree once sync completes (which already happens via query invalidation).

**Estimated effort:** 0.5 days

---

### 8. [P2] DepotBrowser Lazy Loading is Correct but Unbounded

**Location:** `src/components/DepotBrowser/useDepotTree.ts`, `src-tauri/src/commands/p4.rs:2382-2427`

**Current behavior:** The depot browser correctly uses lazy loading -- it fetches children only when a folder is expanded via `p4 dirs` and `p4 files`. However, `p4 files` at a directory level has no pagination or result limit. A directory with 5,000 files will load all of them at once.

**Impact:** A single directory with many files (e.g., a generated code directory) will cause a slow expand operation. Not app-breaking because it's user-triggered and per-directory.

**Solution:** Add `max_results` parameter to `p4_dirs` and paginate large directories. Show "Load more..." at the bottom when results are truncated.

**Estimated effort:** 0.5 days

---

### 9. [P2] SyntaxHighlightedContent Renders Entire File

**Location:** `src/components/DetailPane/SyntaxHighlightedContent.tsx`

**Current behavior:** When viewing file content, the entire file is syntax-highlighted and rendered as a single DOM tree. For large files (1,000+ lines), this creates thousands of `<span>` elements.

**Impact:** Files with 5,000+ lines cause noticeable rendering delay (1-2 seconds). The 10MB file size guard in the backend prevents the worst case, but files just under the limit (e.g., a 9MB log file with 200K lines) would still be problematic.

**Solution:**
1. **Virtualized code viewer:** Only render visible lines (like VS Code). Libraries: `@monaco-editor/react` (heavy but battle-tested) or custom virtualized list with syntax highlighting per-line.
2. **Line limit:** Show first 2,000 lines by default with "Show all" option.

**Estimated effort:** 1-2 days

---

### 10. [P2] Annotation View Scales Linearly with File Length

**Location:** `src/components/DetailPane/AnnotationGutter.tsx`, `src/hooks/useFileAnnotations.ts`

**Current behavior:** `p4 annotate` returns one annotation per line. For a 10,000-line file, this creates 10,000 annotation objects, each rendered as a gutter row. The `groupAnnotationBlocks` function in `annotationParser.ts` processes all lines to create block groups.

**Impact:** Files with >5,000 lines will show noticeable rendering lag in the annotation view. Not a depot-size issue but a file-size issue that compounds at scale (large depots tend to have larger files).

**Solution:** Virtualize the annotation gutter in sync with the code viewer virtualization from Issue #9.

**Estimated effort:** Bundled with Issue #9

---

### 11. [P2] Reconcile Preview Scans Entire Workspace

**Location:** `src/hooks/useReconcile.ts:45-53`, `src-tauri/src/commands/p4.rs:1853-1885`

**Current behavior:** `reconcilePreview` runs `p4 reconcile -n //stream/main/...` which scans the entire workspace filesystem. This is inherently slow for large workspaces (it stat()s every file on disk).

**Impact at 10,000 files:** 10-30 seconds for the reconcile preview to complete. At 50K files: 1-2 minutes.

**Solution:**
1. **Scoped reconcile:** Allow users to reconcile a specific directory instead of the entire workspace.
2. **Progress streaming:** Convert to a streaming operation (like sync) to show progress during the scan.
3. **Background execution:** Run reconcile in background with cancellation support.

**Estimated effort:** 1 day

---

### 12. [P3] Submitted CL History is Hard-Capped

**Location:** `src/lib/tauri.ts:295-299`, `src-tauri/src/commands/p4.rs:1504-1532`

**Current behavior:** `p4_changes_submitted` has a hardcoded `max_changes.unwrap_or(500)` limit. There is no pagination mechanism to load older changelists.

**Impact:** Users working on large projects with active history cannot browse beyond the most recent 500 submitted changelists. This is a functional limitation, not a performance issue.

**Solution:** Add cursor-based pagination using `p4 changes -m 50 @<last_change_number>` to load older pages.

**Estimated effort:** 0.5 days

---

## Search at Scale: Complete Solution Design

This section provides an implementable architecture for search that works at 100,000+ file depot scale. Search needs to serve three distinct use cases:

### Use Case Analysis

| Use Case | Current Implementation | Scaling Limit |
|---|---|---|
| **Quick filter** (find file in workspace) | Client-side microfuzz on loaded files | O(n) per keystroke on full file set |
| **Depot path search** (find file anywhere) | `p4 files <pattern>`, 100 result cap | Requires exact wildcard syntax, no fuzzy |
| **CL search** (find changelist by desc/author/number) | Client-side filter of 500 prefetched CLs | Hard cap at 500, no server-side search |

### Proposed Architecture: Three-Tier Search

```
+-------------------+     +--------------------+     +-------------------+
|   SearchBar       |     |  Rust Backend      |     |  P4 Server        |
|   (React)         | --> |  (Search Service)  | --> |  (p4 commands)    |
+-------------------+     +--------------------+     +-------------------+
       |                        |                          |
  Quick filter            In-memory index             p4 files
  (client-side,           for workspace files         p4 changes
   microfuzz)             + P4 server proxy           p4 describe
```

### Tier 1: Client-Side Quick Filter (fix existing)

**What it does:** Instant filter of files and CLs already visible in the side panels.

**Changes needed (fix Issues #2):**
- Build microfuzz index ONCE when file data changes (in `useMemo`), not per keystroke
- Use the flat `files` array from `useFileTree()` directly instead of walking the tree
- Add 100ms debounce on the filter term propagation
- Pass match results to tree via React context to avoid full tree reconstruction

**Performance target:** <10ms per keystroke at 10K files.

**Implementation:**

```typescript
// In FileTree.tsx - replace current filterResults
const fuzzyIndex = useMemo(() => {
  // Flatten files once
  const flatFiles = files.map(f => ({
    depotPath: f.depotPath,
    name: f.depotPath.split('/').pop() || '',
  }));
  return createFuzzySearch(flatFiles, { getText: (item) => [item.name] });
}, [files]); // Only rebuild when files change

// Debounced search
const debouncedTerm = useDebounce(filterTerm, 100);
const matchSet = useMemo(() => {
  if (!debouncedTerm) return null;
  const results = fuzzyIndex(debouncedTerm);
  return new Map(results.map(r => [r.item.depotPath, r.matches[0]]));
}, [fuzzyIndex, debouncedTerm]);
```

### Tier 2: Backend Workspace Index (new)

**What it does:** Maintains an in-memory index of all workspace file paths in the Rust backend. Supports instant fuzzy search without calling `p4` commands.

**New Rust module:** `src-tauri/src/state/file_index.rs`

```rust
use std::sync::Arc;
use tokio::sync::RwLock;

/// In-memory index of workspace file paths for instant search.
/// Populated from p4 fstat results. Updated incrementally.
pub struct FileIndex {
    /// All depot paths in the workspace, sorted for binary search
    paths: Arc<RwLock<Vec<String>>>,
    /// Pre-computed lowercase paths for case-insensitive matching
    paths_lower: Arc<RwLock<Vec<String>>>,
}

impl FileIndex {
    pub fn new() -> Self { /* ... */ }

    /// Rebuild index from full file list (called on initial load)
    pub async fn rebuild(&self, depot_paths: Vec<String>) { /* ... */ }

    /// Fuzzy search using subsequence matching
    /// Returns top N matches with match quality scores
    pub async fn search(&self, query: &str, max_results: usize) -> Vec<SearchResult> {
        let paths = self.paths_lower.read().await;
        let query_lower = query.to_lowercase();

        let mut results: Vec<SearchResult> = paths.iter()
            .enumerate()
            .filter_map(|(idx, path)| {
                // Subsequence match with scoring
                let score = fuzzy_score(path, &query_lower)?;
                Some(SearchResult {
                    depot_path: self.paths.blocking_read()[idx].clone(),
                    score,
                })
            })
            .collect();

        // Sort by score descending, take top N
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        results.truncate(max_results);
        results
    }
}
```

**New Tauri command:** `search_workspace_files`

```rust
#[tauri::command]
pub async fn search_workspace_files(
    query: String,
    max_results: Option<usize>,
    state: State<'_, FileIndex>,
) -> Result<Vec<SearchResult>, String> {
    let max = max_results.unwrap_or(50);
    Ok(state.search(&query, max).await)
}
```

**Frontend integration:**
```typescript
// New hook: useWorkspaceSearch
export function useWorkspaceSearch(query: string) {
  return useQuery({
    queryKey: ['workspace-search', query],
    queryFn: () => invoke('search_workspace_files', { query, maxResults: 50 }),
    enabled: query.length >= 2,
    staleTime: 5000,
    keepPreviousData: true, // Show previous results while new ones load
  });
}
```

**Performance target:** <5ms for 100K files (in-memory string matching in Rust).

### Tier 3: Server-Proxied Search (enhanced existing)

**What it does:** Searches across the entire depot (not just workspace) and submitted CL history using P4 server commands, with streaming results and proper pagination.

**Changes to existing commands:**

1. **`p4_files` enhancement:** Add streaming support and increase result limit.

```rust
#[tauri::command]
pub async fn p4_files_search(
    pattern: String,
    max_results: u32,
    on_results: Channel<Vec<P4FileResult>>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<u32, String> {
    // Use streaming output instead of buffering
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["files", &pattern]);
    cmd.stdout(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("{}", e))?;
    let stdout = child.stdout.take().unwrap();
    let reader = BufReader::new(stdout);

    let mut batch = Vec::new();
    let mut total = 0u32;

    for line in reader.lines().map_while(Result::ok) {
        if let Some(result) = parse_file_line(&line) {
            batch.push(result);
            total += 1;
            if batch.len() >= 50 {
                let _ = on_results.send(std::mem::take(&mut batch));
            }
            if total >= max_results {
                break;
            }
        }
    }
    if !batch.is_empty() {
        let _ = on_results.send(batch);
    }
    Ok(total)
}
```

2. **CL search with server-side filtering:**

```rust
#[tauri::command]
pub async fn p4_search_changes(
    query: String,
    max_results: u32,
    offset_change: Option<i32>, // For pagination: changes older than this
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4Changelist>, String> {
    // If query is a number, search by CL number directly
    if let Ok(cl_num) = query.parse::<i32>() {
        // Direct CL lookup
        // p4 describe -s <cl_num>
    }

    // If query looks like a username, filter by user
    // p4 changes -u <query> -m <max> -l

    // Otherwise, fetch recent CLs and filter descriptions server-side
    // p4 changes -l -m <max * 3> | filter by description containing query
}
```

### Unified Search UI

Replace the current three-path search with a single unified search interface:

```
+---------------------------------------------+
| [Search icon] Search files, CLs, depot...   |
+---------------------------------------------+
| WORKSPACE FILES                              |
|   src/components/FileTree.tsx         95%    |
|   src/components/FileNode.tsx         88%    |
|                                              |
| DEPOT FILES                                  |
|   //depot/main/src/FileTree.tsx       92%    |
|   //depot/main/src/FileNode.tsx       85%    |
|                                              |
| CHANGELISTS                                  |
|   #12345 - Fix file tree rendering           |
|   #12340 - Add FileTree component            |
+---------------------------------------------+
```

**Implementation approach:**
1. Single search input in the toolbar (replaces current SearchBar)
2. Results categorized by source: Workspace (Tier 1/2), Depot (Tier 3), Changelists (Tier 3)
3. Workspace results appear instantly (client-side fuzzy)
4. Depot and CL results stream in asynchronously (backend queries)
5. Results rendered in a virtualized list in the detail pane
6. Keyboard navigation: up/down to select, Enter to open, Tab to switch categories

**Estimated effort for full search overhaul:** 5-7 days
- Tier 1 fix (client-side performance): 1-2 days
- Tier 2 (Rust file index): 2 days
- Tier 3 (streaming server search): 1-2 days
- Unified UI: 1 day

---

## Priority Matrix

| # | Issue | Severity | Effort | Impact | Priority |
|---|---|---|---|---|---|
| 1 | Full workspace fstat on load | P0 | 3-4 days | App hangs at 10K files | 1st |
| 2 | Tree filter rebuild per keystroke | P0 | 1-2 days | Search unusable at 10K files | 2nd |
| 3 | Search architecture | P0 | 5-7 days | No scalable search exists | 3rd |
| 6 | Backend blocks async runtime | P1 | 1-2 days | All commands queue up | 4th |
| 7 | FileTreeStore Map copy per update | P1 | 0.5 days | Sync causes memory churn | 5th |
| 4 | Tree builder full rebuild | P1 | 2-3 days | 30s refresh causes jank | 6th |
| 5 | N+1 shelved file queries | P1 | 1 day | Server load from polling | 7th |
| 11 | Reconcile scans entire workspace | P2 | 1 day | Slow reconcile preview | 8th |
| 9 | Non-virtualized code viewer | P2 | 1-2 days | Large files slow to render | 9th |
| 10 | Non-virtualized annotation view | P2 | (bundled) | Large files slow annotations | 9th |
| 8 | Unbounded depot browser | P2 | 0.5 days | Large directories slow | 10th |
| 12 | CL history hard cap | P3 | 0.5 days | Can't browse old CLs | 11th |

---

## Recommended Implementation Order

### Phase A: Unblock 10K Files (P0 fixes) -- ~7 days

1. **Fix filter performance (Issue #2):** Persistent fuzzy index + debounce. Immediate win, low risk.
2. **Streaming fstat (Issue #1):** Convert `p4_fstat` to streaming with incremental frontend merge. Highest impact.
3. **Batch Map updates (Issue #7):** Quick fix, prevents sync from thrashing memory.

### Phase B: Scalable Search (Issue #3) -- ~5-7 days

4. **Tier 1 search fix:** Already done in Phase A with Issue #2 fix.
5. **Tier 2 Rust file index:** Build in-memory index for instant workspace search.
6. **Tier 3 streaming server search:** Enhanced p4 files and p4 changes commands.
7. **Unified search UI:** Single search bar with categorized streaming results.

### Phase C: Backend Hardening -- ~3 days

8. **Async process commands (Issue #6):** Convert to `tokio::process::Command` or `spawn_blocking`.
9. **Batch shelved queries (Issue #5):** Reduce N+1 to single batch.
10. **Incremental tree updates (Issue #4):** Structural sharing for tree builder.

### Phase D: Polish -- ~2 days

11. **Virtualized code/annotation viewer (Issues #9, #10)**
12. **Scoped reconcile (Issue #11)**
13. **CL pagination (Issue #12)**
14. **Depot browser pagination (Issue #8)**

**Total estimated effort: ~17-22 days**

---

## Appendix: Component-by-Component Analysis

### Components

| Component | File | Scalability Issues | Notes |
|---|---|---|---|
| FileTree | `FileTree.tsx` | P0: filter rebuild, P1: enhancedTree copies entire tree every render | Core bottleneck |
| FileNode | `FileNode.tsx` | OK: single node renderer, virtualized by react-arborist | `useUnresolvedFiles()` hook called per node -- query is shared |
| DepotBrowser | `DepotBrowser.tsx` | P2: no pagination per directory | Lazy load is correct |
| DepotNode | `DepotNode.tsx` | OK | Single node renderer |
| ChangelistPanel | `ChangelistPanel.tsx` | P1: N+1 shelved queries, minor: full tree walk in findFiles helpers | |
| ChangelistNode | `ChangelistNode.tsx` | OK | Single node renderer |
| SearchBar | `SearchBar.tsx` | P0: drives unscalable filter pipeline | Simple component, problem is in consumers |
| CommandPalette | `CommandPalette.tsx` | OK | Static command list, no data scaling |
| DetailPane | `DetailPane.tsx` | OK | Routing component |
| SearchResultsView | `SearchResultsView.tsx` | P0: unscalable search (all 3 modes) | See Issue #3 |
| FileContentViewer | `FileContentViewer.tsx` | P2: renders full file DOM | See Issue #9 |
| FileAnnotationViewer | `FileAnnotationViewer.tsx` | P2: renders full file annotations | See Issue #10 |
| SyntaxHighlightedContent | `SyntaxHighlightedContent.tsx` | P2: full DOM render | See Issue #9 |
| AnnotationGutter | `AnnotationGutter.tsx` | P2: full gutter render | See Issue #10 |
| ChangelistDetailView | `ChangelistDetailView.tsx` | OK: single CL view | |
| RevisionDetailView | `RevisionDetailView.tsx` | OK: single revision view | |
| WorkspaceSummaryView | `WorkspaceSummaryView.tsx` | OK | |
| StatusBar | `StatusBar.tsx` | OK | |
| SyncToolbar | `SyncToolbar.tsx` | OK | |
| WorkspaceSwitcher | `WorkspaceSwitcher.tsx` | OK | |
| StreamSwitcher | `StreamSwitcher.tsx` | OK | |
| MainLayout | `MainLayout.tsx` | OK | |
| ShelvedFilesSection | `ShelvedFilesSection.tsx` | OK | Per-CL, small N |

### Stores

| Store | File | Scalability Issues |
|---|---|---|
| fileTreeStore | `fileTreeStore.ts` | P1: `updateFile` creates new Map copy (Issue #7). `getFilesInFolder` iterates entire Map (O(n)). |
| changelistStore | `changelistStore.ts` | Minor: same Map-copy pattern. `addFileToChangelist` linear scan for duplicate check. |
| searchFilterStore | `searchFilterStore.ts` | OK: just holds filter term string |
| detailPaneStore | `detailPaneStore.ts` | OK: history capped at 3 items |
| connectionStore | `connectionStore.ts` | OK: static connection state |

### Hooks

| Hook | File | Scalability Issues |
|---|---|---|
| useFileTree (useFileTree.ts) | `useFileTree.ts` | P0: full fstat (Issue #1), P1: tree rebuild (Issue #4) |
| useChangelists | `useChangelists.ts` | P1: N+1 shelved queries (Issue #5) |
| useSync | `useSync.ts` | P1: per-file store updates (Issue #7) |
| useFileHistory | `useFileHistory.ts` | OK: paginated (50 at a time) |
| useFileContent | `useFileContent.ts` | OK: single file, 1-hour cache |
| useFileAnnotations | `useFileAnnotations.ts` | P2: large files (Issue #10) |
| useReconcile | `useReconcile.ts` | P2: full workspace scan (Issue #11) |
| useResolve | `useResolve.ts` | OK |
| useShelvedFiles | `useShelvedFiles.ts` | OK: per-CL operations |
| useChangelistFiles | `useChangelistFiles.ts` | OK: single CL describe |
| useFileInfo | `useFileInfo.ts` | OK: single file fstat |
| useFileOperations | `useFileOperations.ts` | OK |

### Backend (Rust)

| Command | File | Scalability Issues |
|---|---|---|
| p4_fstat | p4.rs:178-212 | P0: blocks thread, returns entire dataset (Issue #1, #6) |
| p4_opened | p4.rs:297-325 | P1: blocks thread (Issue #6), but dataset is typically small |
| p4_changes | p4.rs:329-371 | P1: blocks thread (Issue #6) |
| p4_sync | p4.rs:883-961 | OK: already streaming via Channel |
| p4_files | p4.rs:2054-2131 | P0: blocks thread, 100 result cap (Issue #3, #6) |
| p4_changes_submitted | p4.rs:1504-1532 | P1: blocks thread, 500 CL cap (Issue #6, #12) |
| p4_reconcile_preview | p4.rs:1853-1885 | P2: blocks thread, full scan (Issue #6, #11) |
| p4_filelog | p4.rs:1150-1181 | OK: paginated by max_revisions |
| p4_annotate | p4.rs:1342-1410 | P2: blocks thread, large files (Issue #6) |
| p4_print_content | p4.rs:1237-1327 | OK: 10MB size guard |
| p4_describe | p4.rs:1686-1708 | OK: single CL, -s flag suppresses diffs |
| ProcessManager | process_manager.rs | Minor: single Mutex for all process registration |
| All other commands | p4.rs | P1: all use blocking `cmd.output()` (Issue #6) |

### Data Layer

| Module | File | Scalability Issues |
|---|---|---|
| tauri.ts | `lib/tauri.ts` | OK: thin wrapper, no buffering |
| treeBuilder.ts | `utils/treeBuilder.ts` | P1: full rebuild, sort, aggregate (Issue #4) |
| p4.ts (types) | `types/p4.ts` | OK: type definitions only |
