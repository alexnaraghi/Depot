# Architecture Integration: Large Depot Scalability Fixes

**Project:** P4Now Large Depot Milestone
**Researched:** 2026-02-04
**Confidence:** HIGH

## Executive Summary

This document maps the 7 scalability fixes identified in the analysis to the existing P4Now architecture, providing specific integration points, file paths, data flow changes, and build order recommendations. The architecture is well-suited for incremental enhancement: the existing streaming pattern (p4_sync), TanStack Query infrastructure, and Zustand stores provide solid foundations for the scalability improvements.

**Key architectural strengths to leverage:**
- Tauri Channel streaming already proven in `p4_sync` command
- TanStack Query handles caching, refetch, and invalidation
- Zustand stores provide Map-based O(1) file lookups
- react-arborist provides virtualized tree rendering
- ProcessManager tracks cancellable operations

**Key architectural gaps to address:**
- All commands use blocking `std::process::Command` (except p4_sync)
- No Rust state management beyond ProcessManager
- File tree rebuilds completely on every data change
- No debounce/throttle utilities in codebase
- Search has three separate mechanisms with no unified architecture

---

## Integration Map: 7 Fixes × Existing Architecture

### 1. Streaming fstat Integration with TanStack Query

**Question:** How should streaming fstat integrate with TanStack Query (replace the query, or merge alongside)?

**Answer:** **MERGE ALONGSIDE** with incremental accumulation pattern.

**Current Architecture:**
```
useFileTree.ts (line 105-129)
  ↓ TanStack Query (single shot)
  ↓ invokeP4Fstat([], depotPath)
  ↓ src-tauri/src/commands/p4/p4handlers.rs:42-76 (blocking cmd.output())
  ↓ Returns Vec<P4FileInfo> (entire dataset)
  ↓ Frontend: mapP4FileInfo + setFiles + buildFileTree
```

**New Architecture:**
```
useFileTree.ts
  ↓ TanStack Query (manages cache/staleness)
  ↓ invokeP4FstatStream(depotPath, onProgress: Channel)
  ↓ src-tauri/src/commands/p4/p4handlers.rs:p4_fstat_stream
      ├─ Uses cmd.stdout(Stdio::piped())
      ├─ BufReader + line-by-line parsing
      ├─ Emits batches of 100 files via Channel
      └─ Background thread (like p4_sync pattern)
  ↓ Frontend: Accumulates batches in useState
  ↓ On complete: setFiles once + buildFileTree once
```

**Integration Strategy:**

1. **Keep existing `p4_fstat` command** for single-file queries (backwards compatibility)
2. **Add new `p4_fstat_stream` command** modeled on `p4_sync` (lines 545-623 in p4handlers.rs)
3. **TanStack Query manages the query lifecycle**, but queryFn uses streaming internally
4. **Use `useState` to accumulate** batches during streaming, then `useEffect` to merge into store when complete

**Modified Files:**

```typescript
// src/components/FileTree/useFileTree.ts
export function useFileTree() {
  const [streamingFiles, setStreamingFiles] = useState<P4File[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Query for workspace files (now uses streaming internally)
  const { data: files = [], isLoading: filesLoading, refetch } = useQuery({
    queryKey: ['fileTree', rootPath, depotPath],
    queryFn: async () => {
      setIsStreaming(true);
      setStreamingFiles([]);

      const accumulated: P4FileInfo[] = [];

      await invokeP4FstatStream(
        depotPath,
        (batch: P4FileInfo[]) => {
          // Accumulate in closure
          accumulated.push(...batch);
          // Show incremental progress in UI
          setStreamingFiles(accumulated.map(mapP4FileInfo));
        }
      );

      setIsStreaming(false);
      const mapped = accumulated
        .filter(f => f.head_action !== 'delete')
        .map(mapP4FileInfo);
      setFiles(mapped);
      return mapped;
    },
    enabled: rootPath !== null,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  // Use streamingFiles during load, files when complete
  const displayFiles = isStreaming ? streamingFiles : files;
  const tree = useMemo(() => {
    if (!rootPath || displayFiles.length === 0) return [];
    return buildFileTree(displayFiles, rootPath);
  }, [displayFiles, rootPath, isStreaming]);

  return { tree, files: displayFiles, isLoading: filesLoading || isStreaming, refetch };
}
```

```rust
// src-tauri/src/commands/p4/p4handlers.rs (add after p4_fstat)
#[tauri::command]
pub async fn p4_fstat_stream(
    depot_path: Option<String>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
    on_batch: Channel<Vec<P4FileInfo>>,
    state: State<'_, ProcessManager>,
) -> Result<String, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["-ztag", "fstat"]);
    cmd.arg(depot_path.unwrap_or_else(|| "//...".to_string()));
    cmd.stdout(Stdio::piped());

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn p4 fstat: {}", e))?;

    let stdout = child.stdout.take();
    let process_id = state.register(child).await;
    let process_id_clone = process_id.clone();

    // Stream in background thread (pattern from p4_sync lines 588-595)
    if let Some(stdout) = stdout {
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            let mut batch = Vec::new();
            let mut current_record = String::new();

            for line in reader.lines().map_while(Result::ok) {
                if line.is_empty() && !current_record.is_empty() {
                    // End of record, parse and batch
                    if let Ok(file_info) = parse_ztag_fstat_record(&current_record) {
                        batch.push(file_info);
                        if batch.len() >= 100 {
                            let _ = on_batch.send(std::mem::take(&mut batch));
                        }
                    }
                    current_record.clear();
                } else {
                    current_record.push_str(&line);
                    current_record.push('\n');
                }
            }

            // Send remaining
            if !batch.is_empty() {
                let _ = on_batch.send(batch);
            }
        });
    }

    Ok(process_id_clone)
}
```

**Data Flow Change:**

**BEFORE:**
```
Query starts → 10s blocking call → Full dataset arrives → Build tree → Render
User sees: Loading spinner for 10s, then instant tree
```

**AFTER:**
```
Query starts → Stream begins → Batch 1 (100 files) → Incremental tree → Render
              → Batch 2 → Update tree → Render
              → Batch N → Final tree → Complete
User sees: Tree builds progressively, files appear as they load
```

**Build Order:**
1. Add `p4_fstat_stream` Rust command (model on p4_sync)
2. Add `parse_ztag_fstat_record` helper in parsing.rs
3. Update `lib/tauri.ts` to expose `invokeP4FstatStream`
4. Modify `useFileTree.ts` to use streaming
5. Test with 10K file depot, verify memory stays flat

**Estimated Effort:** 2 days

---

### 2. tokio::process::Command Migration Pattern

**Question:** What's the right pattern for tokio::process::Command migration (global replace, or per-command)?

**Answer:** **HYBRID** - Global replace for read-only queries, selective async for long-running operations.

**Current Architecture:**

All 30+ Tauri commands use `std::process::Command`:
```rust
// Pattern used everywhere (except p4_sync which uses spawn + threads)
#[tauri::command]
pub async fn p4_info(...) -> Result<P4ClientInfo, String> {
    let mut cmd = Command::new("p4");  // std::process::Command
    cmd.args(["-ztag", "info"]);
    let output = cmd.output()          // BLOCKS tokio thread
        .map_err(|e| format!("Failed: {}", e))?;
    parse_ztag_info(&String::from_utf8_lossy(&output.stdout))
}
```

**Problem:** Tauri's async runtime (tokio) has a limited thread pool (4-8 threads). Blocking calls exhaust threads, queuing other commands.

**New Architecture - Three Patterns:**

**Pattern A: Short Commands (< 1 second) - Use spawn_blocking**
```rust
use tokio::task::spawn_blocking;

#[tauri::command]
pub async fn p4_info(...) -> Result<P4ClientInfo, String> {
    let server_clone = server.clone();
    // ... clone all args

    spawn_blocking(move || {
        let mut cmd = std::process::Command::new("p4");
        apply_connection_args(&mut cmd, &server_clone, &user_clone, &client_clone);
        cmd.args(["-ztag", "info"]);
        let output = cmd.output()
            .map_err(|e| format!("Failed: {}", e))?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        parse_ztag_info(&stdout)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
```

**Applies to:** p4_info, p4_describe, p4_changes, p4_opened (fast queries)

**Pattern B: Streaming Commands - Use tokio::process + spawn threads**
```rust
use tokio::process::Command as TokioCommand;

#[tauri::command]
pub async fn p4_fstat_stream(..., on_batch: Channel) -> Result<String, String> {
    let mut cmd = TokioCommand::new("p4");  // tokio::process::Command
    apply_connection_args_tokio(&mut cmd, &server, &user, &client);
    cmd.args(["-ztag", "fstat", "//..."]);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn: {}", e))?;

    let stdout = child.stdout.take();
    let process_id = state.register_tokio(child).await;  // Need ProcessManager update

    // Spawn background task (not thread) to read stdout
    if let Some(stdout) = stdout {
        tokio::task::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut batch = Vec::new();
            let mut line = String::new();

            while reader.read_line(&mut line).await.is_ok() && !line.is_empty() {
                // ... parse and batch
                line.clear();
            }
        });
    }

    Ok(process_id)
}
```

**Applies to:** p4_fstat_stream (new), p4_sync (refactor existing)

**Pattern C: Long-Running Blocking Commands - Use spawn_blocking + streaming**
```rust
#[tauri::command]
pub async fn p4_reconcile_preview(..., on_progress: Channel) -> Result<String, String> {
    let depot_path_clone = depot_path.clone();
    // ... clone all args

    spawn_blocking(move || {
        let mut cmd = std::process::Command::new("p4");
        cmd.args(["reconcile", "-n", &depot_path_clone]);
        cmd.stdout(Stdio::piped());

        let mut child = cmd.spawn()?;
        let stdout = child.stdout.take();

        // Read and stream in this blocking context
        if let Some(stdout) = stdout {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                let _ = on_progress.send(line);
            }
        }

        Ok("complete".to_string())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}
```

**Applies to:** p4_reconcile_preview, p4_annotate (long-running but not worth full async refactor)

**Migration Strategy:**

1. **Phase 1 (High Impact):** Convert streaming commands (p4_fstat, p4_sync) to tokio::process
2. **Phase 2 (Medium Impact):** Wrap long queries (p4_changes, p4_opened) in spawn_blocking
3. **Phase 3 (Low Impact):** Wrap fast queries (p4_info, p4_describe) in spawn_blocking
4. **Don't migrate:** Single-shot mutation commands (p4_edit, p4_revert) - already fast

**Modified Files:**

```rust
// src-tauri/src/commands/p4/p4handlers.rs
// Add at top:
use std::process::Command as StdCommand;
use tokio::process::Command as TokioCommand;
use tokio::task::spawn_blocking;

// Update apply_connection_args to be generic over command type
fn apply_connection_args<C: CommandExt>(cmd: &mut C, server: &Option<String>, ...) {
    // Works with both std and tokio Command
}

trait CommandExt {
    fn arg(&mut self, arg: &str) -> &mut Self;
    fn args(&mut self, args: &[&str]) -> &mut Self;
    // ... etc
}

impl CommandExt for StdCommand { /* ... */ }
impl CommandExt for TokioCommand { /* ... */ }
```

```rust
// src-tauri/src/state/process_manager.rs
// Add support for tokio Child processes
use tokio::process::Child as TokioChild;

pub struct ProcessManager {
    processes: Arc<Mutex<HashMap<String, ProcessHandle>>>,
}

enum ProcessHandle {
    Std(std::process::Child),
    Tokio(TokioChild),
}

impl ProcessManager {
    pub async fn register_std(&self, child: std::process::Child) -> String { /* ... */ }
    pub async fn register_tokio(&self, child: TokioChild) -> String { /* ... */ }

    pub async fn kill(&self, id: &str) -> Result<bool, String> {
        let mut processes = self.processes.lock().await;
        if let Some(handle) = processes.remove(id) {
            match handle {
                ProcessHandle::Std(mut child) => {
                    // Existing logic (lines 34-43)
                }
                ProcessHandle::Tokio(mut child) => {
                    #[cfg(target_os = "windows")]
                    {
                        let pid = child.id().expect("child has pid");
                        tokio::process::Command::new("taskkill")
                            .args(["/F", "/T", "/PID", &pid.to_string()])
                            .output().await.ok();
                    }
                    child.kill().await.map_err(|e| e.to_string())?;
                }
            }
            Ok(true)
        } else {
            Ok(false)
        }
    }
}
```

**Build Order:**
1. Update ProcessManager to support both std and tokio Child types
2. Create `CommandExt` trait for generic connection args
3. Migrate p4_fstat_stream to tokio (already planned in Fix #1)
4. Refactor p4_sync to use tokio::process instead of spawn + threads
5. Wrap p4_changes and p4_opened in spawn_blocking
6. Progressively wrap remaining commands

**Estimated Effort:** 2 days (ProcessManager + trait) + 0.5 days per command category

---

### 3. Rust FileIndex State Integration with Tauri State

**Question:** How should a Rust FileIndex state integrate with Tauri's state management?

**Answer:** **ADD AS MANAGED STATE** alongside ProcessManager using Tauri's `.manage()`.

**Current Architecture:**

```rust
// src-tauri/src/lib.rs:8-14
pub fn run() {
    tauri::Builder::default()
        .plugin(...)
        .manage(ProcessManager::new())  // Only state is ProcessManager
        .invoke_handler(...)
        .setup(...)
        .run(...)
}
```

**State Access Pattern:**
```rust
// Commands access state via State<'_, T>
#[tauri::command]
pub async fn p4_sync(
    ...,
    state: State<'_, ProcessManager>,  // Tauri injects managed state
) -> Result<String, String> {
    let process_id = state.register(child).await;
    // ...
}
```

**New Architecture:**

**Create FileIndex as managed state:**

```rust
// src-tauri/src/state/file_index.rs (NEW FILE)
use std::sync::Arc;
use tokio::sync::RwLock;
use fuzzy_matcher::{FuzzyMatcher, skim::SkimMatcherV2};

/// In-memory index of workspace file paths for instant search.
/// Thread-safe via RwLock, allowing concurrent reads.
#[derive(Clone)]
pub struct FileIndex {
    paths: Arc<RwLock<Vec<FileEntry>>>,
    matcher: Arc<SkimMatcherV2>,
}

#[derive(Clone, Debug)]
struct FileEntry {
    depot_path: String,
    depot_path_lower: String,  // Pre-lowercased for matching
    file_name: String,          // Last segment for quick match
}

impl FileIndex {
    pub fn new() -> Self {
        Self {
            paths: Arc::new(RwLock::new(Vec::new())),
            matcher: Arc::new(SkimMatcherV2::default()),
        }
    }

    /// Rebuild entire index from depot paths
    /// Called after initial fstat completes
    pub async fn rebuild(&self, depot_paths: Vec<String>) {
        let entries: Vec<FileEntry> = depot_paths
            .into_iter()
            .map(|path| {
                let file_name = path.rsplit('/').next()
                    .unwrap_or(&path)
                    .to_string();
                FileEntry {
                    depot_path_lower: path.to_lowercase(),
                    depot_path: path,
                    file_name,
                }
            })
            .collect();

        let mut paths = self.paths.write().await;
        *paths = entries;
    }

    /// Incrementally add files (called during streaming fstat)
    pub async fn add_batch(&self, depot_paths: Vec<String>) {
        let mut paths = self.paths.write().await;
        for path in depot_paths {
            let file_name = path.rsplit('/').next().unwrap_or(&path).to_string();
            paths.push(FileEntry {
                depot_path_lower: path.to_lowercase(),
                depot_path: path,
                file_name,
            });
        }
    }

    /// Fuzzy search with scoring
    pub async fn search(&self, query: &str, max_results: usize) -> Vec<SearchResult> {
        let paths = self.paths.read().await;
        let query_lower = query.to_lowercase();

        let mut results: Vec<_> = paths
            .iter()
            .filter_map(|entry| {
                // Match against file name (most relevant)
                let score = self.matcher.fuzzy_match(&entry.file_name, query)?;
                Some(SearchResult {
                    depot_path: entry.depot_path.clone(),
                    score,
                })
            })
            .collect();

        results.sort_by(|a, b| b.score.cmp(&a.score));
        results.truncate(max_results);
        results
    }

    /// Clear the index (on disconnect)
    pub async fn clear(&self) {
        let mut paths = self.paths.write().await;
        paths.clear();
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct SearchResult {
    pub depot_path: String,
    pub score: i64,
}

impl Default for FileIndex {
    fn default() -> Self {
        Self::new()
    }
}
```

```rust
// src-tauri/src/state/mod.rs
mod process_manager;
mod file_index;  // NEW

pub use process_manager::ProcessManager;
pub use file_index::{FileIndex, SearchResult};  // NEW
```

```rust
// src-tauri/src/lib.rs
use state::{ProcessManager, FileIndex};  // Add FileIndex

pub fn run() {
    tauri::Builder::default()
        .plugin(...)
        .manage(ProcessManager::new())
        .manage(FileIndex::new())  // NEW: Add as managed state
        .invoke_handler(tauri::generate_handler![
            // ... existing commands
            commands::search_workspace_files,  // NEW
            commands::rebuild_file_index,      // NEW
        ])
        .setup(|app| {
            // ... existing setup
            Ok(())
        })
        .run(...)
}
```

**New Tauri Commands:**

```rust
// src-tauri/src/commands/p4/p4handlers.rs (add at end)

/// Rebuild the file index from a list of depot paths
/// Called by frontend after fstat completes
#[tauri::command]
pub async fn rebuild_file_index(
    depot_paths: Vec<String>,
    state: State<'_, FileIndex>,
) -> Result<usize, String> {
    let count = depot_paths.len();
    state.rebuild(depot_paths).await;
    Ok(count)
}

/// Search workspace files using in-memory fuzzy index
#[tauri::command]
pub async fn search_workspace_files(
    query: String,
    max_results: Option<usize>,
    state: State<'_, FileIndex>,
) -> Result<Vec<SearchResult>, String> {
    if query.len() < 2 {
        return Ok(Vec::new());
    }

    let max = max_results.unwrap_or(50);
    Ok(state.search(&query, max).await)
}
```

**Frontend Integration:**

```typescript
// src/lib/tauri.ts (add exports)
export async function rebuildFileIndex(depotPaths: string[]): Promise<number> {
  return invoke('rebuild_file_index', { depotPaths });
}

export interface SearchResult {
  depot_path: string;
  score: number;
}

export async function searchWorkspaceFiles(
  query: string,
  maxResults?: number
): Promise<SearchResult[]> {
  return invoke('search_workspace_files', { query, maxResults });
}
```

```typescript
// src/components/FileTree/useFileTree.ts
// After setFiles, rebuild index
useEffect(() => {
  if (files.length > 0) {
    const depotPaths = files.map(f => f.depotPath);
    rebuildFileIndex(depotPaths).catch(console.error);
  }
}, [files]);
```

```typescript
// src/hooks/useWorkspaceSearch.ts (NEW FILE)
import { useQuery } from '@tanstack/react-query';
import { searchWorkspaceFiles } from '@/lib/tauri';

export function useWorkspaceSearch(query: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['workspace-search', query],
    queryFn: () => searchWorkspaceFiles(query, 50),
    enabled: enabled && query.length >= 2,
    staleTime: 5000,
    keepPreviousData: true,
  });
}
```

**Lifecycle Integration:**

```
App Start → FileIndex::new() → Empty index
  ↓
Connection → p4_fstat_stream → Files load
  ↓
Batch 1-N arrive → Frontend accumulates
  ↓
Stream complete → rebuildFileIndex(allDepotPaths) → Index ready
  ↓
User searches → search_workspace_files → Returns results in <5ms
  ↓
Disconnect → clear() → Index cleared
```

**Build Order:**
1. Create `src-tauri/src/state/file_index.rs`
2. Add `fuzzy-matcher` crate to Cargo.toml
3. Export FileIndex in `state/mod.rs`
4. Add `.manage(FileIndex::new())` in lib.rs
5. Add `rebuild_file_index` and `search_workspace_files` commands
6. Create `useWorkspaceSearch` hook
7. Integrate index rebuild into `useFileTree`

**Estimated Effort:** 2 days

**Dependencies:** None (can be built independently)

---

### 4. Unified Search UI with Detail Pane & Command Palette

**Question:** How should the unified search UI interact with the existing detail pane and command palette?

**Answer:** **EXTEND EXISTING PATTERNS** - Add 'search' type to DetailSelection, integrate with command palette's existing search commands.

**Current Architecture:**

**Detail Pane (Discriminated Union):**
```typescript
// src/stores/detailPaneStore.ts:8-13
export type DetailSelection =
  | { type: 'none' }
  | { type: 'file'; depotPath: string; localPath: string; fromCl?: number }
  | { type: 'changelist'; changelist: P4Changelist }
  | { type: 'revision'; depotPath: string; localPath: string; revision: P4Revision }
  | { type: 'search'; searchType: 'submitted' | 'depot'; query: string };  // Already exists!
```

**Search Bar (Toolbar Filter):**
```typescript
// src/components/SearchBar.tsx:16-82
// Drives searchFilterStore (in-place filtering of FileTree + ChangelistPanel)
// Shows match count badge
```

**Search Results View:**
```typescript
// src/components/DetailPane/SearchResultsView.tsx
// Renders when detailPaneStore.selection.type === 'search'
// Currently has 'submitted' and 'depot' modes
```

**New Architecture - Unified Search:**

**Extend DetailSelection:**
```typescript
// src/stores/detailPaneStore.ts
export type DetailSelection =
  | { type: 'none' }
  | { type: 'file'; depotPath: string; localPath: string; fromCl?: number }
  | { type: 'changelist'; changelist: P4Changelist }
  | { type: 'revision'; depotPath: string; localPath: string; revision: P4Revision }
  | { type: 'search'; searchMode: SearchMode; query: string; results?: UnifiedSearchResults };

export type SearchMode =
  | 'workspace'      // In-memory Rust index (NEW)
  | 'depot'          // p4 files with wildcards (existing)
  | 'submitted'      // p4 changes submitted (existing)
  | 'unified';       // All three combined (NEW)

export interface UnifiedSearchResults {
  workspace: SearchResult[];  // From FileIndex
  depot: P4FileResult[];      // From p4 files
  changelists: P4Changelist[]; // From p4 changes
  isLoading: {
    workspace: boolean;
    depot: boolean;
    changelists: boolean;
  };
}
```

**Two Search Modes:**

**Mode 1: Quick Filter (Existing, Enhanced)**
- Triggered by SearchBar in toolbar
- Filters FileTree and ChangelistPanel in-place
- Uses searchFilterStore (existing)
- Enhancement: Use FileIndex for fuzzy matching instead of microfuzz in component

**Mode 2: Deep Search (New)**
- Triggered by Cmd+Shift+F or command palette "Search Depot..."
- Opens unified search results in detail pane
- Searches workspace (FileIndex), depot (p4 files), and CLs (p4 changes)
- Uses detailPaneStore with 'search' type

**Modified Integration Points:**

| Component | Current | Change | File Path |
|-----------|---------|--------|-----------|
| detailPaneStore.ts | `searchType: 'submitted' \| 'depot'` | Add `searchMode: SearchMode` with 'workspace' and 'unified' | `src/stores/detailPaneStore.ts:13` |
| SearchBar.tsx | Single mode (filter) | Add toggle between filter and search | `src/components/SearchBar.tsx` |
| DetailPane.tsx | Routes to SearchResultsView | Add route to UnifiedSearchView for 'unified' mode | `src/components/DetailPane/DetailPane.tsx` |
| FileTree.tsx | microfuzz in component | Query FileIndex via useWorkspaceSearch | `src/components/FileTree/FileTree.tsx:119` |

**Build Order:**
1. Extend DetailSelection to support 'unified' search mode
2. Create UnifiedSearchView component
3. Create useDepotSearch and useChangelistSearch hooks
4. Add mode toggle to SearchBar
5. Wire up command palette commands
6. Update DetailPane routing

**Estimated Effort:** 2 days

**Dependencies:** Requires FileIndex (Fix #3) for workspace search

---

### 5. Debounce/Throttle Location

**Question:** Where should debounce/throttle live (Zustand store, hook, component)?

**Answer:** **HOOK LEVEL** - Create reusable hooks, keep stores pure, avoid component-level complexity.

**Current Architecture:**

**No debounce utilities exist in codebase.** Current pattern:
```typescript
// src/components/FileTree/FileTree.tsx:46
const deferredFilterTerm = useDeferredValue(filterTerm);
```

**Problem with useDeferredValue alone:**
- Still runs on every value change (just deprioritized)
- No actual delay to skip intermediate values
- Doesn't prevent expensive operations during rapid typing

**New Architecture - Utility Hooks:**

```typescript
// src/hooks/useDebounce.ts (NEW FILE)
import { useEffect, useState } from 'react';

/**
 * Debounce a value with configurable delay.
 * Returns the debounced value that updates after delay of inactivity.
 *
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds (default: 300)
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

**Usage Pattern:**

```typescript
// src/components/FileTree/FileTree.tsx
export function FileTree() {
  const filterTerm = useSearchFilterStore(s => s.filterTerm);

  // BEFORE: const deferredFilterTerm = useDeferredValue(filterTerm);
  // AFTER:
  const debouncedFilterTerm = useDebounce(filterTerm, 150);  // 150ms quiet time

  // Build fuzzy index once
  const fuzzyIndex = useMemo(() => {
    const flatFiles = files.map(f => ({
      depotPath: f.depotPath,
      name: f.depotPath.split('/').pop() || '',
    }));
    return createFuzzySearch(flatFiles, { getText: (item) => [item.name] });
  }, [files]);  // Only rebuild when files change, NOT on every filter change

  // Apply filter using debounced term
  const matchSet = useMemo(() => {
    if (!debouncedFilterTerm) return null;
    const results = fuzzyIndex(debouncedFilterTerm);
    return new Map(results.map(r => [r.item.depotPath, r.matches[0]]));
  }, [fuzzyIndex, debouncedFilterTerm]);  // Only runs 150ms after user stops typing

  // ... rest of component
}
```

**Why NOT in Zustand stores:**

```typescript
// ❌ BAD: Debounce in store (violates single responsibility)
export const useSearchFilterStore = create((set) => ({
  filterTerm: '',
  debouncedFilterTerm: '',
  setFilterTerm: (term) => {
    set({ filterTerm: term });
    // Need to use setTimeout, but how to clean up?
    // Stores don't have lifecycle hooks
    setTimeout(() => {
      set({ debouncedFilterTerm: term });
    }, 300);
  },
}));

// ✅ GOOD: Store holds raw value, component debounces
export const useSearchFilterStore = create((set) => ({
  filterTerm: '',
  setFilterTerm: (term) => set({ filterTerm: term }),
}));

// Component:
const filterTerm = useSearchFilterStore(s => s.filterTerm);
const debouncedFilterTerm = useDebounce(filterTerm, 150);
```

**Integration Points:**

| Component | Current Issue | Apply Pattern | Delay |
|-----------|--------------|---------------|-------|
| FileTree.tsx | Filter on every keystroke | useDebounce(filterTerm) | 150ms |
| ChangelistPanel.tsx | Filter on every keystroke | useDebounce(filterTerm) | 150ms |
| SearchResultsView.tsx | Query on every keystroke | useDebounce(query) | 300ms |

**Build Order:**
1. Create `src/hooks/useDebounce.ts`
2. Update FileTree.tsx to use useDebounce
3. Update ChangelistPanel.tsx to use useDebounce
4. Update SearchResultsView.tsx to use useDebounce

**Estimated Effort:** 0.5 days

**Dependencies:** None (can be built immediately)

---

### 6. Incremental Tree Updates with react-arborist

**Question:** How should incremental tree updates work with react-arborist's data model?

**Answer:** **STRUCTURAL SHARING** - Compare new data with old, reuse unchanged subtrees, only rebuild affected paths.

**Current Architecture:**

```typescript
// src/components/FileTree/useFileTree.ts:135-140
const tree = useMemo(() => {
  if (!rootPath || files.length === 0) {
    return [];
  }
  return buildFileTree(files, rootPath);
}, [files, rootPath]);
```

**Problem:** `files` is a new array reference every time the query returns, even if data is identical. `buildFileTree` rebuilds the entire tree from scratch (O(n) where n = file count).

**New Architecture - TanStack Query Structural Sharing:**

```typescript
// Enable structural sharing in query config
const { data: files = [] } = useQuery({
  queryKey: ['fileTree', rootPath, depotPath],
  queryFn: async () => { /* ... */ },
  // This compares new data with old, only updates if different
  structuralSharing: true,  // Default is true, but making explicit
});
```

**Incremental Builder Approach:**

```typescript
// src/utils/treeBuilder.ts - Add cache-aware builder
let treeCache: {
  rootPath: string;
  files: Map<string, P4File>;  // depot path -> file
  tree: FileTreeNode[];
} | null = null;

export function buildFileTreeIncremental(
  files: P4File[],
  rootPath: string
): FileTreeNode[] {
  // Create file map for comparison
  const newFilesMap = new Map<string, P4File>();
  files.forEach(f => newFilesMap.set(f.depotPath, f));

  // If cache exists and rootPath matches, try incremental update
  if (treeCache && treeCache.rootPath === rootPath) {
    const changes = detectChanges(treeCache.files, newFilesMap);

    // If no changes, return cached tree (same references)
    if (changes.added.length === 0 &&
        changes.removed.length === 0 &&
        changes.modified.length === 0) {
      return treeCache.tree;
    }

    // If changes are small (<10% of tree), do incremental update
    const totalChanges = changes.added.length + changes.removed.length + changes.modified.length;
    if (totalChanges < files.length * 0.1) {
      const updatedTree = applyChangesIncrementally(
        treeCache.tree,
        changes,
        newFilesMap,
        rootPath
      );
      treeCache = { rootPath, files: newFilesMap, tree: updatedTree };
      return updatedTree;
    }
  }

  // Full rebuild for new root or major changes
  const tree = buildFileTree(files, rootPath);
  treeCache = { rootPath, files: newFilesMap, tree };
  return tree;
}

function detectChanges(
  oldFiles: Map<string, P4File>,
  newFiles: Map<string, P4File>
): { added: string[]; removed: string[]; modified: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  // Find added and modified
  newFiles.forEach((newFile, depotPath) => {
    const oldFile = oldFiles.get(depotPath);
    if (!oldFile) {
      added.push(depotPath);
    } else if (
      oldFile.status !== newFile.status ||
      oldFile.revision !== newFile.revision ||
      oldFile.headRevision !== newFile.headRevision
    ) {
      modified.push(depotPath);
    }
  });

  // Find removed
  oldFiles.forEach((_, depotPath) => {
    if (!newFiles.has(depotPath)) {
      removed.push(depotPath);
    }
  });

  return { added, removed, modified };
}
```

**Frontend Integration:**

```typescript
// src/components/FileTree/useFileTree.ts
const tree = useMemo(() => {
  if (!rootPath || files.length === 0) {
    return [];
  }
  return buildFileTreeIncremental(files, rootPath);
}, [files, rootPath]);
```

**Performance Impact:**

**BEFORE (10,000 files):**
- Query returns new array → useMemo triggers
- buildFileTree runs: sort (50ms) + build (100ms) + aggregate (20ms) = 170ms
- react-arborist receives entirely new tree → re-renders all 10,000 nodes

**AFTER (10,000 files, 10 files changed):**
- Query returns → structuralSharing compares data
- If data identical: Same array reference → useMemo skipped → 0ms
- If 10 files changed: buildFileTreeIncremental runs:
  - detectChanges: O(n) map comparison = 10ms
  - Apply 10 changes incrementally = 5ms
  - Total: ~15ms (11× faster)
- react-arborist: Only changed nodes re-render (instead of 10,000)

**Build Order:**
1. Enable structuralSharing in TanStack Query
2. Implement detectChanges in treeBuilder.ts
3. Implement incremental update logic
4. Add cache management
5. Test with large depot + single file checkout/revert

**Estimated Effort:** 2-3 days

**Dependencies:** None (improvement to existing flow)

---

### 7. Batching Pattern for Shelved File Queries

**Question:** What's the right batching pattern for shelved file queries?

**Answer:** **BATCH REQUEST** - Single backend command takes array of CL IDs, executes sequentially, returns map.

**Current Architecture:**

```typescript
// src/components/ChangelistPanel/useChangelists.ts:146-177
const numberedClIds = useMemo(() => {
  return Array.from(changelists.values())
    .filter(cl => cl.id > 0)
    .map(cl => cl.id);
}, [changelists]);

// N+1 query problem: One query per changelist
const shelvedQueries = useQueries({
  queries: numberedClIds.map(clId => ({
    queryKey: ['p4', 'shelved', clId],
    queryFn: async () => {
      // Each spawns separate p4 describe -S <clId> command
      const result = await invokeP4DescribeShelved(clId);
      return result;
    },
    enabled: isConnected,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchInterval: refetchIntervalValue,
  })),
});
```

**Problem:**
- 20 pending CLs = 20 concurrent p4.exe processes
- Each process registers in ProcessManager (mutex contention)
- P4 server receives 20 concurrent describe commands
- Every 30 seconds, this repeats (if auto-refresh enabled)

**New Architecture - Batched Backend:**

```rust
// src-tauri/src/commands/p4/p4handlers.rs (add new command)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize)]
pub struct ShelvedFilesMap {
    /// Map of changelist ID to shelved files
    pub shelved_files: HashMap<i32, Vec<P4ShelvedFile>>,
}

/// Get shelved files for multiple changelists in a single batch.
/// Executes p4 describe -S <clId> sequentially for each CL.
/// Returns a map of CL ID -> shelved files.
#[tauri::command]
pub async fn p4_describe_shelved_batch(
    changelist_ids: Vec<i32>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<ShelvedFilesMap, String> {
    let mut shelved_files = HashMap::new();

    // Execute describe commands sequentially (avoids server overload)
    for cl_id in changelist_ids {
        // Use existing p4_describe_shelved logic but inline
        let mut cmd = Command::new("p4");
        apply_connection_args(&mut cmd, &server, &user, &client);
        cmd.args(["-ztag", "describe", "-S", &cl_id.to_string()]);

        match cmd.output() {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                match parse_ztag_describe_shelved(&stdout) {
                    Ok(files) if !files.is_empty() => {
                        shelved_files.insert(cl_id, files);
                    }
                    _ => {
                        // CL has no shelved files, skip
                    }
                }
            }
            _ => {
                // CL describe failed, skip (don't fail entire batch)
            }
        }
    }

    Ok(ShelvedFilesMap { shelved_files })
}
```

**Frontend Integration:**

```typescript
// src/lib/tauri.ts (add export)
export interface ShelvedFilesMap {
  shelved_files: Record<number, P4ShelvedFile[]>;
}

export async function invokeP4DescribeShelvedBatch(
  changelistIds: number[]
): Promise<ShelvedFilesMap> {
  return invoke('p4_describe_shelved_batch', { changelistIds });
}
```

```typescript
// src/components/ChangelistPanel/useChangelists.ts
export function useChangelists() {
  // ... existing code

  const numberedClIds = useMemo(() => {
    return Array.from(changelists.values())
      .filter(cl => cl.id > 0)
      .map(cl => cl.id);
  }, [changelists]);

  // BEFORE: Multiple queries (N+1)
  // const shelvedQueries = useQueries({ queries: numberedClIds.map(...) });

  // AFTER: Single batched query
  const { data: shelvedBatch } = useQuery({
    queryKey: ['p4', 'shelved-batch', numberedClIds],
    queryFn: async () => {
      const { addOutputLine } = useOperationStore.getState();
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine(`p4 describe -S batch (${numberedClIds.length} CLs)`, false);

      const result = await invokeP4DescribeShelvedBatch(numberedClIds);

      if (verbose) {
        const totalFiles = Object.values(result.shelved_files)
          .reduce((sum, files) => sum + files.length, 0);
        addOutputLine(`... returned ${totalFiles} shelved files across ${Object.keys(result.shelved_files).length} CLs`, false);
      }

      return result;
    },
    enabled: isConnected && numberedClIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchInterval: refetchIntervalValue,
  });

  // Build shelved files map from batch result
  const shelvedFilesMap = useMemo(() => {
    if (!shelvedBatch) return new Map<number, P4ShelvedFile[]>();

    const map = new Map<number, P4ShelvedFile[]>();
    Object.entries(shelvedBatch.shelved_files).forEach(([clIdStr, files]) => {
      const clId = parseInt(clIdStr, 10);
      map.set(clId, files);
    });
    return map;
  }, [shelvedBatch]);

  // ... rest of hook (buildChangelistTree uses shelvedFilesMap)
}
```

**Comparison:**

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| **Batch Request** | Simple, predictable, reduces server load | All CLs queried even if not expanded | <50 CLs, most are relevant |
| **Lazy Load** | Only queries what user expands, scales to 100+ CLs | More complex, multiple server calls if user expands many | >50 CLs, sparse usage |

**Recommended:** **Batch Request** for P4Now because:
- Most developers have <20 pending CLs
- Shelved files are important context (want to load eagerly)
- Single query easier to debug and cache
- Can add lazy loading later if usage patterns show it's needed

**Build Order:**
1. Add `p4_describe_shelved_batch` Rust command
2. Export `invokeP4DescribeShelvedBatch` in tauri.ts
3. Replace `useQueries` with single `useQuery` in useChangelists.ts
4. Test with 20+ CLs, verify single batch call

**Estimated Effort:** 1 day

**Dependencies:** None (refactor of existing pattern)

---

## Component Integration Matrix

| Component/Module | Integrates With | How | Estimated Lines Changed |
|------------------|-----------------|-----|------------------------|
| **useFileTree.ts** | Fix #1 (streaming fstat) | Replace queryFn with streaming accumulator | ~40 lines |
| **useFileTree.ts** | Fix #6 (incremental tree) | Add cache-aware builder | ~30 lines |
| **treeBuilder.ts** | Fix #6 (incremental tree) | Add incremental builder functions | +200 lines |
| **FileTree.tsx** | Fix #5 (debounce) | Replace useDeferredValue with useDebounce | ~10 lines |
| **FileTree.tsx** | Fix #1 (streaming progress) | Show loading state during streaming | ~20 lines |
| **p4handlers.rs** | Fix #1 (streaming fstat) | Add p4_fstat_stream command (model on p4_sync) | +100 lines |
| **p4handlers.rs** | Fix #2 (tokio) | Wrap commands in spawn_blocking or use tokio::process | ~200 lines changed |
| **p4handlers.rs** | Fix #7 (batch shelved) | Add p4_describe_shelved_batch | +50 lines |
| **process_manager.rs** | Fix #2 (tokio) | Support both std and tokio Child | +40 lines |
| **file_index.rs** | Fix #3 (NEW FILE) | Create FileIndex state | +200 lines |
| **lib.rs** | Fix #3 (FileIndex state) | Add .manage(FileIndex::new()) | ~2 lines |
| **useChangelists.ts** | Fix #7 (batch shelved) | Replace useQueries with single batch query | ~30 lines changed |
| **SearchBar.tsx** | Fix #4 (unified search) | Add mode toggle (filter vs search) | ~40 lines |
| **detailPaneStore.ts** | Fix #4 (unified search) | Extend SearchMode type | ~5 lines |
| **DetailPane.tsx** | Fix #4 (unified search) | Route to UnifiedSearchView | ~10 lines |
| **UnifiedSearchView.tsx** | Fix #4 (NEW FILE) | Create unified search results view | +150 lines |
| **useWorkspaceSearch.ts** | Fix #3 (NEW FILE) | Hook for FileIndex search | +20 lines |
| **useDebounce.ts** | Fix #5 (NEW FILE) | Debounce utility hook | +20 lines |

**Total Estimated Changes:** ~1,400 lines (including new files)

---

## Build Order & Dependencies

**Phase 1: Foundation (No Dependencies)**
1. Create debounce hook (Fix #5) - 0.5 days
2. Update ProcessManager for tokio Child (Fix #2 prep) - 0.5 days
3. Create FileIndex state (Fix #3) - 2 days

**Phase 2: Backend Streaming (Depends on Phase 1.2)**
4. Add p4_fstat_stream command (Fix #1) - 1 day
5. Wrap blocking commands in spawn_blocking (Fix #2) - 1 day
6. Add p4_describe_shelved_batch (Fix #7) - 1 day

**Phase 3: Frontend Performance (Depends on Phase 1.1)**
7. Integrate streaming fstat in useFileTree (Fix #1) - 1 day
8. Apply debounce to FileTree filter (Fix #5) - 0.5 days
9. Implement incremental tree builder (Fix #6) - 2-3 days

**Phase 4: Search (Depends on Phase 1.3 + Phase 3)**
10. Integrate FileIndex rebuild in useFileTree (Fix #3) - 0.5 days
11. Create unified search UI (Fix #4) - 2 days

**Phase 5: Changelist Optimization (Depends on Phase 2.3)**
12. Replace useQueries with batch query (Fix #7) - 0.5 days

**Total Effort:** 13-14 days

**Critical Path:**
Phase 1.2 → Phase 2 (ProcessManager needed for streaming)
Phase 1.3 → Phase 4 (FileIndex needed for search)
Phase 1.1 → Phase 3 (Debounce needed for filter performance)

**Parallelization Opportunities:**
- Phase 1 can all be done in parallel by different developers
- Phase 2.2, 2.3 can be done in parallel
- Phase 3.2, 3.3 can be done in parallel

**With 2 developers:** ~7-8 days
**With 3 developers:** ~5-6 days

---

## Risk Areas & Mitigation

### Risk 1: Streaming fstat breaks existing functionality
**Area:** All file tree operations depend on fstat
**Mitigation:**
- Keep existing `p4_fstat` command intact
- Add `p4_fstat_stream` as new command
- Feature flag to toggle between old/new behavior during testing
- Comprehensive testing: checkout, revert, sync all trigger fstat invalidation

### Risk 2: Incremental tree builder has bugs with edge cases
**Area:** Empty folders, file renames, deep nesting
**Mitigation:**
- Extensive unit tests for incremental builder
- Fallback to full rebuild if detectChanges finds >50% changed
- Logging/telemetry to detect rebuilds vs incremental updates

### Risk 3: FileIndex memory usage with 100K+ files
**Area:** In-memory Vec<String> with 100K depot paths
**Estimation:** 100K paths × ~50 bytes avg = 5MB (acceptable)
**Mitigation:**
- Monitor memory in development
- Index is optional - if rebuild fails, search falls back to server queries

### Risk 4: tokio::process breaks ProcessManager kill behavior
**Area:** Process cancellation on Windows
**Mitigation:**
- Test kill functionality extensively on Windows
- Keep taskkill logic for both std and tokio Child
- Verify cleanup on app close

### Risk 5: Debounce breaks user experience (feels laggy)
**Area:** Search bar responsiveness
**Mitigation:**
- Use short delay (150ms) - feels instant
- Show loading indicator during debounce
- Keep instant visual feedback (text input updates immediately, results debounced)

### Risk 6: Batched shelved queries timeout with many CLs
**Area:** 50+ CLs in batch
**Mitigation:**
- Batch size limit (max 50 CLs per batch)
- Timeout per describe command (5s max)
- Skip failed describes without failing entire batch

---

## Testing Strategy

### Unit Tests (Rust)
- FileIndex::search with various query patterns
- FileIndex::rebuild with large datasets
- Incremental builder: detectChanges correctness
- p4_describe_shelved_batch with empty results
- Process manager with both std and tokio Child

### Integration Tests (Frontend)
- useFileTree with streaming: batches accumulate correctly
- useDebounce: skips intermediate values
- Incremental tree: unchanged subtrees preserve references
- Batched shelved query: map structure correct

### E2E Tests (Manual)
- Connect to 10K file depot, observe progressive tree rendering
- Type rapidly in search bar, verify no input lag
- Search for file in unified search, navigate to result
- Create 20 CLs with shelved files, verify single batch query
- Checkout file, verify tree updates incrementally

### Performance Tests
- p4_fstat_stream: 10K files completes in <15s
- FileTree filter: keystroke response <50ms @ 10K files
- FileIndex search: <10ms @ 100K files
- Incremental tree: single file update <20ms @ 10K files
- Batched shelved: 20 CLs complete in <5s

---

## Conclusion

The 7 scalability fixes integrate cleanly with P4Now's existing architecture by:

1. **Leveraging proven patterns:** Streaming (p4_sync), managed state (ProcessManager), TanStack Query caching
2. **Extending, not replacing:** Keep existing commands for compatibility, add streaming/batched variants
3. **Composing primitives:** Debounce hooks + incremental builder + FileIndex = scalable search
4. **Respecting boundaries:** Rust handles heavy lifting (index search, batching), React handles UI state
5. **Maintaining simplicity:** Each fix addresses one bottleneck, dependencies are minimal

The architecture already has the right foundations (virtualized trees, query caching, streaming support). The scalability milestone enhances these foundations without fundamental rewrites, making the 13-14 day estimate realistic and low-risk.
