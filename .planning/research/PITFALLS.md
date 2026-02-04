# Domain Pitfalls: Large Depot Scalability in Tauri + React

**Domain:** Adding scalability features (streaming, async processes, search indexing) to existing Tauri 2.0 + React 19 Perforce GUI
**Researched:** 2026-02-04
**Confidence:** MEDIUM (verified with official docs and community patterns)

This document focuses on pitfalls when **migrating an existing working application** to handle large depots (10K+ files). These are integration pitfalls, not greenfield application mistakes.

---

## Critical Pitfalls

Mistakes that cause data loss, crashes, or require rewrites.

### Pitfall 1: Holding std::sync::Mutex Across Await Points

**What goes wrong:** When migrating from `std::process::Command` to `tokio::process::Command`, code using `std::sync::Mutex` will fail to compile with "future is not `Send` as this value is used across an await" errors. Standard library `MutexGuard` is intentionally NOT `Send` to prevent deadlocks.

**Why it happens:** Tauri's tokio runtime is multi-threaded, meaning on every `.await` the Future could move across threads. The existing `ProcessManager` uses `std::sync::Mutex`, which doesn't support async operations.

**Consequences:**
- Compilation failure when adding async to existing code
- Silent deadlocks if using `block_on` workarounds
- Thread pool starvation

**Prevention:**
- Replace `std::sync::Mutex` with `tokio::sync::Mutex` **before** migrating to async commands
- Use `tokio::sync::RwLock` for read-heavy workloads (file tree)
- Never use `std::sync::Mutex::lock()` in async functions

**Detection:**
- Compiler error: "future cannot be sent between threads safely"
- Linter warning from clippy: `clippy::await_holding_lock`

**Phase:** Address in Phase 1 (Async Backend Migration) - blocking issue

**Severity:** CRITICAL - Prevents async migration, can cause production deadlocks

**Current codebase status:** ✓ ALREADY FIXED - `ProcessManager` uses `tokio::sync::Mutex` (see `src-tauri/src/state/process_manager.rs:4`)

---

### Pitfall 2: Zombie Process Accumulation

**What goes wrong:** When migrating from `std::process::Command` to `tokio::process::Command`, forgetting to `.await` child processes creates zombie processes that consume PIDs until system limits are exhausted.

**Why it happens:** The standard library doesn't automatically wait on child processes, even when `Child` is dropped. Tokio provides "best-effort" cleanup but doesn't guarantee it. With streaming `p4 fstat` running every 30 seconds on 10K files, zombies accumulate quickly.

**Consequences:**
- PID exhaustion after hours of runtime (Windows: ~32K PIDs)
- "Cannot spawn process" errors
- Server crashes requiring restart
- P4 server connection limits exhausted

**Prevention:**
```rust
// BAD: Dropping Child without waiting
let child = Command::new("p4").spawn()?;
process_manager.register(child).await; // Zombie when dropped!

// GOOD: Explicit wait
let mut child = Command::new("p4").spawn()?;
let output = child.wait_with_output().await?;

// GOOD: Background reaping for long-running processes
let mut child = Command::new("p4").spawn()?;
tokio::spawn(async move {
    let _ = child.wait().await;
});
```

**Detection:**
- On Windows: Task Manager shows multiple orphaned `p4.exe` processes
- On Unix: `ps aux | grep Z` shows zombie processes
- Clippy lint: `zombie_processes` (Rust 1.75+)

**Phase:** Address in Phase 1 (Async Backend Migration) - must solve before launch

**Severity:** CRITICAL - Production crashes, server exhaustion

**Sources:**
- [tokio::process::Command docs](https://docs.rs/tokio/latest/tokio/process/struct.Command.html)
- [std::process::Child docs](https://doc.rust-lang.org/std/process/struct.Child.html)
- [Clippy zombie_processes lint](https://github.com/rust-lang/rust-clippy/pull/11476)

---

### Pitfall 3: Tauri Channel Backpressure Causes UI Freeze

**What goes wrong:** Sending large data chunks (>1MB) through Tauri Channels blocks the sending thread for 30-50ms per send, which blocks the Tokio async executor if called from async context. With 10K files streaming at 100 files/sec, this causes multi-second UI freezes.

**Why it happens:** Tauri Channels internally serialize and queue data for the WebView. Large payloads require synchronous serialization. If streaming `p4 fstat` sends 10K file records as individual channel sends, the cumulative blocking time is 5-8 seconds.

**Consequences:**
- Frozen UI during file tree refresh
- "Application Not Responding" on Windows
- Event loop starvation prevents cancellation
- User force-quits application

**Prevention:**
```rust
// BAD: Large individual sends from async context
for file in files {
    channel.send(file).unwrap(); // Blocks 30-50ms each!
}

// GOOD: Batch into smaller chunks
for chunk in files.chunks(100) {
    channel.send(chunk).unwrap(); // One 30ms block per 100 files
}

// BETTER: Spawn blocking for channel sends
tokio::task::spawn_blocking(move || {
    for chunk in files.chunks(100) {
        channel.send(chunk).unwrap();
    }
});
```

**Detection:**
- Frontend DevTools shows event loop lag warnings
- User reports "app freezes during refresh"
- Windows Event Viewer shows "not responding" events
- `requestIdleCallback` never fires during streaming

**Phase:** Address in Phase 2 (Streaming FStats) - UX blocker

**Severity:** CRITICAL - User-visible freezes, "broken" perception

**Sources:**
- [Tauri Channel blocking discussion](https://github.com/tauri-apps/tauri/discussions/11589)
- [Tauri Channel docs](https://v2.tauri.app/develop/calling-frontend/)

---

### Pitfall 4: TanStack Query Cache Race Condition on Concurrent Invalidations

**What goes wrong:** When streaming `p4 fstat` incrementally merges file data while auto-refresh also invalidates queries, concurrent invalidations create race conditions where the second refetch overwrites the first refetch's data, causing UI to flicker or revert to stale state.

**Why it happens:** TanStack Query's `invalidateQueries` cancels ongoing refetches by default, but if streaming is updating cache via `setQueryData` while invalidation triggers a new fetch, the new fetch can complete before streaming finishes, causing a "last writer wins" scenario.

**Consequences:**
- File tree reverts to old state mid-stream
- User actions (checkout, revert) appear to fail then succeed
- Drag-and-drop operations lost
- Data appears to "flicker" during refresh

**Prevention:**
```typescript
// BAD: Invalidate while streaming is updating cache
channel.onMessage((files) => {
  queryClient.setQueryData(['fileTree'], (old) => merge(old, files));
});
// Auto-refresh invalidates concurrently - RACE!
queryClient.invalidateQueries(['fileTree']);

// GOOD: Use mutation state to block invalidations
const streamingMutationKey = ['streamingFstat'];
queryClient.setMutationDefaults(streamingMutationKey, {
  mutationFn: async () => { /* streaming logic */ }
});

// Check if streaming before invalidating
if (!queryClient.isMutating({ mutationKey: streamingMutationKey })) {
  queryClient.invalidateQueries(['fileTree']);
}
```

**Detection:**
- User reports "files disappear then reappear"
- E2E tests show non-deterministic failures
- React DevTools Profiler shows duplicate renders
- Console logs show query fetch timestamps overlapping

**Phase:** Address in Phase 3 (Incremental Merge) - data integrity issue

**Severity:** CRITICAL - Data loss, user trust erosion

**Sources:**
- [TanStack Query race condition discussion](https://github.com/TanStack/query/discussions/7932)
- [Concurrent Optimistic Updates](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)
- [Query Invalidation docs](https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation)

---

## Moderate Pitfalls

Mistakes that cause delays, poor UX, or technical debt.

### Pitfall 5: Stale Closures in Debounced Search

**What goes wrong:** When migrating to debounced file tree filtering, using `useMemo` or `useCallback` without proper dependencies causes the debounced function to close over stale state, so typed characters don't appear or filter uses old query.

**Why it happens:** Without stabilizing debounce via `useCallback`, a new debounce method is generated on each render, breaking the timer. If dependencies are missing, the closure captures old state values.

**Consequences:**
- Search input shows typed characters but tree doesn't filter
- Filter uses previous search term (1-2 keystrokes behind)
- User re-types search assuming it didn't work
- Cancellation doesn't work (closes over old abort controller)

**Prevention:**
```typescript
// BAD: Debounce re-created every render
const handleSearch = useMemo(() => {
  return debounce((query) => {
    // Closes over stale filterTree function!
    filterTree(query);
  }, 300);
}, []); // Missing dependency!

// GOOD: Stabilize with useCallback and pass values as arguments
const handleSearch = useCallback(
  debounce((query: string) => {
    setFilterQuery(query); // State setter is stable
  }, 300),
  [] // Debounce instance created once
);

// BETTER: Use TanStack Pacer (2026)
import { usePacer } from '@tanstack/pacer';
const { debounce } = usePacer();
const handleSearch = debounce((query: string) => {
  setFilterQuery(query);
}, { delay: 300 });
```

**Detection:**
- User reports "search is laggy" or "search doesn't work"
- DevTools shows filter function re-creating every keystroke
- Console logs show debounce timer resetting constantly
- E2E tests fail intermittently on search

**Phase:** Address in Phase 4 (File Tree Filter) - UX degradation

**Severity:** MODERATE - Annoying UX, not data loss

**Sources:**
- [React debounce stale closures](https://www.developerway.com/posts/debouncing-in-react)
- [TanStack Pacer announcement](https://shaxadd.medium.com/tanstack-pacer-solving-debounce-throttle-and-batching-the-right-way-94d699befc8a)
- [Common React debounce pitfalls](https://thewriting.dev/fixing-react-debounce/)

---

### Pitfall 6: Structural Sharing Breaks Reference Identity for Tree Nodes

**What goes wrong:** When using TanStack Query's structural sharing with react-arborist, tree node reference identity changes on every query update even when data is unchanged, causing the entire tree to re-render and losing scroll position, focus, and open/closed state.

**Why it happens:** TanStack Query performs structural sharing on query results, but for nested tree data, even unchanged subtrees get new object references. react-arborist uses reference identity (`===`) to determine which nodes changed.

**Consequences:**
- Tree collapses and re-expands on every refresh (30 second interval)
- User loses scroll position mid-browse
- Focused file loses focus
- Performance degrades (re-rendering 10K nodes every 30 seconds)

**Prevention:**
```typescript
// BAD: Structural sharing on deeply nested tree
useQuery({
  queryKey: ['fileTree'],
  queryFn: fetchFileTree,
  // Default: structuralSharing: true
});
// Every update creates new node objects!

// OPTION 1: Disable structural sharing for tree data
useQuery({
  queryKey: ['fileTree'],
  queryFn: fetchFileTree,
  structuralSharing: false, // Manual diffing instead
});

// OPTION 2: Custom structural sharing preserving references
useQuery({
  queryKey: ['fileTree'],
  queryFn: fetchFileTree,
  structuralSharing: (oldData, newData) => {
    return deepMergePreservingRefs(oldData, newData);
  }
});

// OPTION 3: Use Zustand for tree, TanStack Query for file data only
const fileTreeStore = create((set) => ({
  nodes: [],
  updateNode: (path, data) => set((state) => ({
    nodes: state.nodes.map(n =>
      n.path === path ? { ...n, ...data } : n
    )
  }))
}));
```

**Detection:**
- User reports "tree keeps collapsing"
- React DevTools Profiler shows Tree component re-rendering 10K+ nodes
- E2E tests show flaky tree expansion assertions
- Performance profiler shows excessive `createElement` calls

**Phase:** Address in Phase 3 (Incremental Tree Builder) - UX issue

**Severity:** MODERATE - Annoying UX, performance hit, not data loss

**Sources:**
- [TanStack Query structural sharing issue](https://github.com/TanStack/query/issues/6812)
- [React Query render optimizations](https://tkdodo.eu/blog/react-query-render-optimizations)
- [Structural sharing performance](https://tanstack.com/query/v5/docs/framework/react/guides/render-optimizations)

---

### Pitfall 7: Batch Query Error Isolation Lost

**What goes wrong:** When replacing individual `p4 describe` calls (N+1 pattern) with batched queries, a single failure in the batch causes all results to fail, hiding which specific changelist caused the error and making debugging impossible.

**Consequences:**
- Shelved files panel shows "Failed to load" for all changelists
- No indication which changelist has corrupt data
- User can't differentiate network error vs. bad data
- Retrying the batch fails again (no progress)

**Prevention:**
```rust
// BAD: Batch all describe calls, fail on first error
async fn batch_describe(changelist_ids: Vec<i32>) -> Result<Vec<Changelist>, String> {
    let mut cmd = Command::new("p4");
    cmd.args(changelist_ids.iter().map(|id| format!("-c{}", id)));
    cmd.output().await?; // First error fails entire batch!
}

// GOOD: Parallel individual queries with error isolation
async fn batch_describe_isolated(ids: Vec<i32>) -> Vec<Result<Changelist, String>> {
    let futures = ids.into_iter().map(|id| async move {
        describe_single(id).await // Each can fail independently
    });
    futures::future::join_all(futures).await
}

// BETTER: Bounded concurrency to avoid overwhelming P4 server
use futures::stream::{self, StreamExt};
async fn batch_describe_throttled(ids: Vec<i32>) -> Vec<Result<Changelist, String>> {
    stream::iter(ids)
        .map(|id| describe_single(id))
        .buffer_unordered(5) // Max 5 concurrent p4 calls
        .collect()
        .await
}
```

**Detection:**
- User reports "all changelists show error"
- Logs show single changelist error but UI shows blanket failure
- Sentry reports batch errors without granular context
- E2E tests can't differentiate error types

**Phase:** Address in Phase 5 (Batch Shelved Files) - error handling issue

**Severity:** MODERATE - Poor debuggability, user frustration

**Sources:**
- [AWS Lambda partial batch failures](https://docs.aws.amazon.com/lambda/latest/dg/example_serverless_SQS_Lambda_batch_item_failures_section.html)
- [Best practices for partial batch responses](https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/best-practices-partial-batch-responses.html)

---

### Pitfall 8: In-Memory Search Index Memory Leak from Retained String Slices

**What goes wrong:** When building in-memory fuzzy search index in Rust, using `&str` slices into a Vec buffer causes the entire buffer to be retained even when individual strings are removed from the index, leading to unbounded memory growth.

**Why it happens:** Rust string slices (`&str`) keep the entire backing allocation alive. If the index stores slices from a 10MB `p4 fstat` output buffer, removing individual files from the index doesn't free the original buffer.

**Consequences:**
- Memory usage grows 10-50MB per refresh (every 30 seconds)
- After 8 hours, application uses 1-2GB memory for 10K files
- Windows kills app or system becomes unresponsive
- File tree operations slow down (GC pressure)

**Prevention:**
```rust
// BAD: Storing slices from large buffer
let output = String::from_utf8(cmd.output().await?.stdout)?;
let mut index = HashMap::new();
for line in output.lines() {
    let path = parse_depot_path(line); // Returns &str slice!
    index.insert(path, metadata); // Retains entire output buffer!
}

// GOOD: Clone strings into index
for line in output.lines() {
    let path = parse_depot_path(line).to_string(); // Owned String
    index.insert(path, metadata); // Only retains necessary data
}

// BETTER: Use arena allocator for controlled lifetime
use bumpalo::Bump;
let arena = Bump::new();
for line in output.lines() {
    let path = arena.alloc_str(parse_depot_path(line));
    index.insert(path, metadata);
}
// Drop arena when refreshing index - frees all at once
```

**Detection:**
- Windows Task Manager shows P4Now memory growing over time
- Rust memory profiler (Jemalloc) shows retained string allocations
- User reports "app gets slower over time"
- Application crashes with OOM after long runtime

**Phase:** Address in Phase 6 (Workspace Search Index) - stability issue

**Severity:** MODERATE - Long-term stability issue, not immediate failure

**Sources:**
- [Rust reference cycles memory leaks](https://doc.rust-lang.org/book/ch15-06-reference-cycles.html)
- [Solving memory leaks in Rust](https://onesignal.com/blog/solving-memory-leaks-in-rust/)
- [Finding memory leaks discussion](https://users.rust-lang.org/t/finding-memory-leaks/123557)

---

### Pitfall 9: Perforce Server Rate Limiting from Parallel Queries

**What goes wrong:** When replacing sequential `p4 describe` calls with parallel batched queries, overwhelming the Perforce server with 50+ simultaneous connections triggers server-side rate limiting or `maxcommands` limits, causing "too many connections" errors.

**Why it happens:** P4 servers have `server.maxcommands` configurables (default 200-500) limiting simultaneous command requests. Each `tokio::spawn` creates a new TCP connection. With 100 pending changelists, spawning 100 parallel `p4 describe` calls exhausts server capacity.

**Consequences:**
- "Connection refused" or "too many connections" errors
- Server admin throttles or blocks P4Now's IP
- Other users on same server experience slowness
- Application banned from corporate network

**Prevention:**
```rust
// BAD: Unbounded parallelism
for id in changelist_ids {
    tokio::spawn(async move {
        p4_describe(id).await // 100+ simultaneous connections!
    });
}

// GOOD: Bounded concurrency with semaphore
use tokio::sync::Semaphore;
const MAX_CONCURRENT_P4_CALLS: usize = 5;
let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_P4_CALLS));

for id in changelist_ids {
    let permit = semaphore.clone().acquire_owned().await.unwrap();
    tokio::spawn(async move {
        let _permit = permit; // Held until task completes
        p4_describe(id).await
    });
}

// BETTER: Use connection pool pattern
lazy_static! {
    static ref P4_SEMAPHORE: Semaphore = Semaphore::new(5);
}

async fn throttled_p4_call<F, T>(f: F) -> Result<T, String>
where
    F: Future<Output = Result<T, String>>,
{
    let _permit = P4_SEMAPHORE.acquire().await.unwrap();
    f.await
}
```

**Detection:**
- Error logs show "Connection refused" or "max clients exceeded"
- P4 admin reports complaints about connection flooding
- Sentry shows spikes in connection errors
- `p4 monitor show` reveals hundreds of commands from same client

**Phase:** Address in Phase 5 (Batch Shelved Files) - server health issue

**Severity:** MODERATE - Can get app banned, affects other users

**Sources:**
- [Perforce connection limits](https://www.perforce.com/manuals/p4sag/Content/P4SAG/performance.prevention.connection_limits.html)
- [Perforce server.maxcommands](https://www.perforce.com/manuals/v19.1/p4sag/Content/P4SAG/performance.prevention.connection_limits.html)
- [Perforce query limits](https://www.perforce.com/manuals/p4sag/Content/P4SAG/performance.prevention.query_limits.html)

---

## Minor Pitfalls

Mistakes that cause annoyance or temporary issues, easily fixed.

### Pitfall 10: React-Arborist Performance Degradation from Non-Virtualized Features

**What goes wrong:** When adding features like "select all visible" or "export filtered results," iterating over all tree nodes instead of just visible nodes bypasses react-arborist's virtualization, causing UI freeze on 10K+ node operations.

**Why it happens:** react-arborist only renders visible nodes (~50-100 at a time). Calling `.map()` or `.filter()` on the full node array triggers JavaScript operations on all 10K nodes, blocking the event loop for 500-1000ms.

**Consequences:**
- "Select All" button freezes UI for 1 second
- Export operation blocks UI
- User thinks app crashed
- Browser shows "page unresponsive" dialog

**Prevention:**
```typescript
// BAD: Operate on full dataset
const selectAll = () => {
  const allNodes = tree.data; // 10K nodes
  allNodes.forEach(node => node.select()); // UI freezes!
};

// GOOD: Batch and defer with requestIdleCallback
const selectAll = () => {
  const allNodes = tree.data;
  const chunks = chunk(allNodes, 100);

  chunks.forEach((chunk, i) => {
    requestIdleCallback(() => {
      chunk.forEach(node => node.select());
    });
  });
};

// BETTER: Use Web Worker for heavy operations
const exportWorker = new Worker('export-worker.js');
exportWorker.postMessage({ nodes: tree.data });
exportWorker.onmessage = (e) => {
  downloadFile(e.data.csv);
};
```

**Detection:**
- User reports "select all is slow"
- Chrome DevTools shows long task warnings (>50ms)
- Performance profiler shows synchronous loops over large arrays
- E2E tests timeout on "select all" operations

**Phase:** Address in Phase 4 (File Tree Filter) - polish issue

**Severity:** MINOR - Annoying but doesn't break core workflow

**Sources:**
- [react-arborist performance best practices](https://medium.com/@livintha/building-powerful-tree-views-with-react-arborist-44319dea804b)
- [Building interactive trees with react-arborist](https://blog.openreplay.com/interactive-tree-components-with-react-arborist/)

---

### Pitfall 11: useEffect Infinite Loop from Missing Dependencies

**What goes wrong:** When adding streaming fstat updates to existing components, forgetting to add TanStack Query's `queryClient` or store updater functions to `useEffect` dependencies causes infinite render loops or stale data.

**Why it happens:** React's exhaustive-deps rule flags missing dependencies, but developers ignore warnings or add `// eslint-disable-next-line` to silence them, creating subtle bugs.

**Consequences:**
- Component re-renders continuously (crashes browser tab)
- Old data shown because effect closes over stale queryClient
- Event listeners attached multiple times (memory leak)
- Console filled with "Maximum update depth exceeded" errors

**Prevention:**
```typescript
// BAD: Missing dependency causes stale closure
useEffect(() => {
  const channel = listen('fstat-update', (event) => {
    queryClient.setQueryData(['fileTree'], event.payload); // Stale queryClient!
  });
  return () => channel.unsubscribe();
}, []); // Missing queryClient dependency!

// GOOD: Include all dependencies
useEffect(() => {
  const channel = listen('fstat-update', (event) => {
    queryClient.setQueryData(['fileTree'], event.payload);
  });
  return () => channel.unsubscribe();
}, [queryClient]); // TanStack Query guarantees stable reference

// BETTER: Use functional updates to avoid dependencies
useEffect(() => {
  const channel = listen('fstat-update', (event) => {
    queryClient.setQueryData(['fileTree'], (old) => merge(old, event.payload));
  });
  return () => channel.unsubscribe();
}, [queryClient]); // Only queryClient needed, not merge function
```

**Detection:**
- Browser tab becomes unresponsive
- Console shows "Maximum update depth exceeded"
- React DevTools Profiler shows component rendering 100+ times/second
- ESLint shows `react-hooks/exhaustive-deps` warning

**Phase:** Monitor during all phases - code quality issue

**Severity:** MINOR - Easy to catch in development, caught by linter

**Sources:**
- [Solving useEffect infinite loops](https://blog.logrocket.com/solve-react-useeffect-hook-infinite-loop-patterns/)
- [useEffect docs](https://react.dev/reference/react/useEffect)
- [useCallback docs](https://react.dev/reference/react/useCallback)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Detection |
|-------------|---------------|------------|-----------|
| **Phase 1: Async Backend** | Zombie processes accumulate | Explicit `.await` on all Child processes, add spawn_blocking for cleanup | Monitor Windows Task Manager for orphaned p4.exe |
| **Phase 1: Async Backend** | Mutex deadlocks across await | Replace std::sync::Mutex with tokio::sync::Mutex | Compiler error or `cargo clippy` |
| **Phase 2: Streaming FStats** | Channel backpressure freezes UI | Batch sends, use spawn_blocking for large payloads | DevTools event loop lag, user reports freezes |
| **Phase 2: Streaming FStats** | Tauri event listeners leak | Unlisten in cleanup, use AbortController | Memory profiler shows growing listener count |
| **Phase 3: Incremental Merge** | Race condition between stream and invalidation | Check `isMutating` before invalidate, use mutation keys | E2E flaky tests, user reports flickering |
| **Phase 3: Incremental Merge** | Structural sharing breaks tree refs | Disable or custom merge, consider Zustand for tree | Tree collapses on refresh, scroll resets |
| **Phase 4: File Tree Filter** | Debounce stale closures | Use useCallback with stable deps, consider TanStack Pacer | Search doesn't update, E2E failures |
| **Phase 4: File Tree Filter** | Full tree iteration bypasses virtualization | Batch with requestIdleCallback, use Web Worker | Select All freezes UI, long task warnings |
| **Phase 5: Batch Shelved Files** | Single error fails entire batch | Parallel isolated queries with error tracking | "All changelists failed" when only one bad |
| **Phase 5: Batch Shelved Files** | Server rate limiting from parallel flood | Semaphore limiting concurrent p4 calls to 5-10 | "Too many connections" errors, admin complaints |
| **Phase 6: Workspace Search** | Memory leak from string slice retention | Clone strings into index, or use arena allocator | Growing memory usage over hours |
| **Phase 6: Workspace Search** | Lock contention on search index | Use RwLock, update index in background task | Search latency spikes, lock profiler shows contention |
| **All Phases** | useEffect infinite loops | Follow exhaustive-deps, use functional updates | Browser tab crash, ESLint warnings |

---

## Integration-Specific Warnings

### Migrating Existing P4Now Codebase (73K LOC)

**High-risk areas:**
1. **useSync.ts streaming** - Already uses Tauri Channels, but needs batching for 10K files
2. **FileTreeStore** - Currently does Map copy per file update, structural sharing will break this
3. **Auto-refresh polling** - 30-second invalidation will race with streaming updates
4. **ProcessManager** - Already uses tokio::sync::Mutex ✓ but needs zombie cleanup
5. **Changelist shelved files** - N+1 p4 describe pattern, needs batched + isolated errors

**Safe areas (low risk):**
- TanStack Query setup already solid (invalidation patterns work)
- react-arborist already virtualized
- Connection settings and state management stable

**Testing priorities:**
1. E2E test with 10K+ file depot (create synthetic test depot)
2. Run application for 8+ hours monitoring memory
3. Simulate network errors during streaming (disconnect P4 server mid-stream)
4. Test concurrent operations (drag-drop while refresh streaming in progress)

---

## Summary

**Top 3 Critical Pitfalls to Address First:**
1. **Zombie process accumulation** (Phase 1) - Will crash production
2. **Tauri Channel backpressure** (Phase 2) - User-facing freeze, "app is broken"
3. **TanStack Query race conditions** (Phase 3) - Data loss, user trust issue

**Confidence Assessment:**
- Tauri + Tokio pitfalls: HIGH (verified with official docs)
- TanStack Query pitfalls: MEDIUM (community patterns, some WebSearch-only)
- React patterns: MEDIUM (official docs + recent 2026 articles)
- Perforce server limits: MEDIUM (official docs, may vary by server config)
- Integration risks: LOW (codebase-specific, need testing to validate)

**Research Gaps:**
- Exact P4 server limits for target production environment (need admin consultation)
- Real-world performance benchmarks for 10K+ file depots (need profiling on target hardware)
- react-arborist structural sharing behavior with 10K nodes (need synthetic testing)

---

## Sources

### Tauri + Tokio
- [Tauri + Async Rust Process](https://rfdonnelly.github.io/posts/tauri-async-rust-process/)
- [Tauri async runtime docs](https://docs.rs/tauri/latest/tauri/async_runtime/index.html)
- [Tokio process Command docs](https://docs.rs/tokio/latest/tokio/process/struct.Command.html)
- [Tauri Channel discussion](https://github.com/tauri-apps/tauri/discussions/11589)
- [Tauri Channels documentation](https://v2.tauri.app/develop/calling-frontend/)

### TanStack Query
- [Query Invalidation docs](https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation)
- [Race condition discussion](https://github.com/TanStack/query/discussions/7932)
- [Concurrent Optimistic Updates](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)
- [Structural sharing issue](https://github.com/TanStack/query/issues/6812)
- [React Query render optimizations](https://tkdodo.eu/blog/react-query-render-optimizations)

### React Patterns
- [How to debounce in React](https://www.developerway.com/posts/debouncing-in-react)
- [TanStack Pacer announcement](https://shaxadd.medium.com/tanstack-pacer-solving-debounce-throttle-and-batching-the-right-way-94d699befc8a)
- [Common debounce pitfalls](https://thewriting.dev/fixing-react-debounce/)
- [Solving useEffect infinite loops](https://blog.logrocket.com/solve-react-useeffect-hook-infinite-loop-patterns/)
- [useEffect docs](https://react.dev/reference/react/useEffect)

### Rust Memory Management
- [Reference cycles memory leaks](https://doc.rust-lang.org/book/ch15-06-reference-cycles.html)
- [Solving memory leaks in Rust](https://onesignal.com/blog/solving-memory-leaks-in-rust/)
- [std::process::Child docs](https://doc.rust-lang.org/std/process/struct.Child.html)
- [Clippy zombie_processes lint](https://github.com/rust-lang/rust-clippy/pull/11476)

### Perforce Server Limits
- [Limiting simultaneous connections](https://www.perforce.com/manuals/p4sag/Content/P4SAG/performance.prevention.connection_limits.html)
- [Perforce server.maxcommands](https://www.perforce.com/manuals/v19.1/p4sag/Content/P4SAG/performance.prevention.connection_limits.html)
- [Perforce query limits](https://www.perforce.com/manuals/p4sag/Content/P4SAG/performance.prevention.query_limits.html)

### React-Arborist
- [Building powerful tree views](https://medium.com/@livintha/building-powerful-tree-views-with-react-arborist-44319dea804b)
- [Interactive tree components](https://blog.openreplay.com/interactive-tree-components-with-react-arborist/)

### Batch Processing
- [AWS Lambda partial batch failures](https://docs.aws.amazon.com/lambda/latest/dg/example_serverless_SQS_Lambda_batch_item_failures_section.html)
- [Best practices for partial batch responses](https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/best-practices-partial-batch-responses.html)
