# Feature Landscape: Large Depot Scalability

**Domain:** Perforce GUI for large depot support (10K+ files)
**Researched:** 2026-02-04
**Context:** Adding scalability to existing P4Now (Tauri 2.0 + React 19) with virtualized file tree, client-side search, and auto-refresh features

---

## Executive Summary

Large depot support in Perforce GUIs is defined by **incremental loading, workspace restriction, and progressive disclosure**. P4V handles 100K+ file workspaces through lazy directory loading, workspace-restricted depot views, and batch size configuration. Modern SCM GUIs (VS Code, IntelliJ, SourceTree) share common patterns: virtualized file trees, debounced search with incremental results, background refresh with cancellation, and explicit "Load More" pagination.

P4Now already has the foundation: react-arborist virtualization, TanStack Query caching, and streaming p4 sync. The scalability gap is in **initial load** (full fstat blocks for 10-30 seconds), **filter performance** (rebuilds tree per keystroke), and **search architecture** (no unified scalable search exists).

This document categorizes features into table stakes (must-have for 10K+ file support), differentiators (where P4Now can exceed P4V), and anti-features (things to deliberately avoid building).

---

## Table Stakes

Features users expect from any Perforce GUI handling large depots. Missing these = product feels broken at scale.

### TS-1: Incremental Workspace Loading
**What:** Load file metadata progressively instead of blocking until all 10K+ files are fetched.

**Why expected:** P4V lazy loads directories (expand-on-demand). VS Code loads git status incrementally. Users expect the UI to become interactive within 1-2 seconds, not 10-30 seconds.

**Current gap:** P4Now calls `p4 fstat //...` on every load and blocks until complete. At 10K files: 5-15 second freeze. At 50K files: 30-60 second hang.

**Complexity:** Medium
- **Backend:** Convert `p4_fstat` to streaming (emit batches of 100 files via Tauri Channel)
- **Frontend:** Merge incremental batches into file map without rebuilding entire tree
- **Query pattern:** Use `staleTime: Infinity` + manual invalidation instead of 30-second auto-refetch

**Dependencies:**
- Requires Tauri Channel pattern (already exists in `p4_sync`)
- Requires async command refactor (Issue #6: replace `cmd.output()` with `tokio::process::Command`)

**Implementation notes:**
- P4V loads directories on expand, but P4Now's flat file list approach is superior for search
- Instead of directory-level lazy load, use streaming fstat with background completion
- First 500 files render immediately (< 1 second), remaining files trickle in over 5-10 seconds
- Tree stays interactive during load

**Sources:**
- [P4V Release Notes](https://www.perforce.com/perforce/doc.current/user/p4vnotes.txt) - Directories now lazy load on expand
- Scalability analysis Issue #1

---

### TS-2: Delta Refresh (Incremental Updates)
**What:** After initial load, refresh only changed files instead of re-querying the entire workspace.

**Why expected:** P4V doesn't re-scan the entire depot on every refresh. IntelliJ VCS only queries git status for modified paths. Users expect background refresh to be non-blocking.

**Current gap:** Every 30-second auto-refresh runs full `p4 fstat //...` again. With 10K files, app is in permanent loading state.

**Complexity:** Medium
- **Backend:** Add `p4_fstat_opened` (only opened files: `-Ro`) and `p4_fstat_shelved` (only shelved: `-Rs`)
- **Frontend:** Merge delta results into existing file map instead of replacing
- **Invalidation:** Only run full fstat on explicit user action (connection change, manual refresh)

**Dependencies:**
- Requires incremental file map updates (don't create new Map on every update)
- Requires query invalidation strategy in TanStack Query

**Implementation notes:**
- P4 supports filtered fstat: `-Ro` (opened), `-Rs` (shelved), `-Ru` (unresolved)
- Typical workspace has 10-50 opened files, not 10,000
- Delta query takes 100-500ms instead of 5-15 seconds
- Full refresh becomes opt-in via toolbar button

**Sources:**
- [p4 fstat reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_fstat.html) - Filter flags
- Scalability analysis Issue #1

---

### TS-3: Debounced Search with Persistent Index
**What:** Filter file tree without rebuilding fuzzy search index on every keystroke.

**Why expected:** VS Code search has < 10ms keystroke latency with 100K files. P4V depot search is instant for client-side filtering. Users expect typing to feel responsive.

**Current gap:** `filterResults` rebuilds microfuzz index on every keystroke. At 10K files: 50-200ms input lag. At 50K: 500ms+ = unusable.

**Complexity:** Low
- **Pattern fix:** Build fuzzy index once in `useMemo` (dependent on `files` array, not `filterTerm`)
- **Debounce:** Add 100-150ms debounce to filter term propagation
- **Avoid tree walks:** Use flat `files` array from useFileTree instead of `collectFiles()` recursive walk

**Dependencies:**
- None (pure frontend optimization)

**Implementation notes:**
- microfuzz already supports persistent index creation
- Current code creates index in `filterResults` callback (wrong)
- Move to component-level memo, pass to debounced filter function
- Target: < 10ms per keystroke at 10K files, < 50ms at 100K files

**Sources:**
- Scalability analysis Issue #2
- [fzf fuzzy finder performance](https://github.com/junegunn/fzf) - Handles millions of items with < 100ms response

---

### TS-4: Workspace-Restricted Depot View
**What:** Filter depot browser to only show paths mapped in the client spec.

**Why expected:** P4V defaults to "Tree restricted to workspace view" and calls this "the single most impactful performance feature for large depots." Users don't want to browse depot paths they can't sync.

**Current gap:** DepotBrowser shows entire depot. In a shared 500GB depot, users browse irrelevant paths and accidentally expand massive directories.

**Complexity:** Medium
- **Backend:** Parse client spec view mapping (`p4 client -o`)
- **Frontend:** Filter `p4 dirs` results to only show mapped paths
- **UI:** Add toggle in depot browser toolbar (default: ON)

**Dependencies:**
- Requires client spec parsing (view mapping is Perforce path wildcard syntax)
- Requires depot path matching logic (check if path overlaps with client view)

**Implementation notes:**
- P4V makes this the default, with "Entire Depot Tree" as opt-in
- Dramatically reduces accidental queries to irrelevant depot sections
- Example: Client maps `//depot/main/...`, don't show `//depot/archive/...`
- View syntax supports exclusions (`-//depot/main/tests/...`)

**Sources:**
- [P4V performance tips](https://articles.assembla.com/en/articles/1804524-speed-up-your-perforce-repo-with-p4v) - "Tree restricted to workspace view"
- [Creating workspaces](https://www.perforce.com/manuals/p4v/Content/P4V/using.workspaces.html) - Mapping overrides

---

### TS-5: Server-Side Result Limiting with Pagination
**What:** Pass `-m <limit>` to `p4 files` to cap results at server instead of fetching all and truncating client-side.

**Why expected:** P4V uses `-m` with batch sizes (default 500). Git GUIs paginate log results. Users expect "Load More" pattern for large result sets.

**Current gap:** `p4_files` has `max_results` param but doesn't pass `-m` to p4 command. A directory with 5,000 files transmits all 5,000 over wire, then truncates to 1,000.

**Complexity:** Low
- **Backend:** Add `-m {max_results}` to p4 command args, return `truncated: bool` flag
- **Frontend:** Show "Load more files..." node when truncated, increase limit on click

**Dependencies:**
- None (straightforward p4 command enhancement)

**Implementation notes:**
- P4V defaults to 500 files per batch, configurable in preferences
- "Load More" button is simpler than scroll-based loading (avoids scroll event complexity)
- Return current count + total available (if p4 provides it)
- Backend: 0.5 days, Frontend: 0.5 days

**Sources:**
- Scalability analysis Issue #8
- [p4 files reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_sync.html) - `-m max` flag

---

### TS-6: Batch Shelved File Queries
**What:** Fetch shelved files for multiple changelists in a single backend call instead of N separate queries.

**Why expected:** P4V has "Number of changelists to fetch at a time" preference to minimize server load. ORMs batch queries to avoid N+1. Users expect app to handle 20+ pending changelists without spawning 20 processes.

**Current gap:** `useChangelists` creates a separate `useQuery` per changelist. Developer with 20 pending CLs = 20 concurrent `p4 describe -S` commands every 30 seconds.

**Complexity:** Low
- **Backend:** Add `p4_describe_shelved_batch(clIds: Vec<i32>)` that runs describes sequentially, returns Map
- **Frontend:** Replace per-CL queries with single batch query, distribute results to components

**Dependencies:**
- None (pure query optimization)

**Implementation notes:**
- Don't parallelize in backend (risks overwhelming server)
- Run sequentially, aggregate results, return as map
- Frontend: Single query instead of N queries reduces overhead
- Only fetch for expanded changelists (lazy load pattern)

**Sources:**
- Scalability analysis Issue #5
- [P4V preferences](https://legacy-docs.perforce.com/doc.current/manuals/v14.3/p4v/configuring.preferences.html) - Batch size config

---

### TS-7: Progress Indicators for Long-Running Operations
**What:** Show progress bar or spinner with cancellation option for operations taking > 2 seconds.

**Why expected:** P4V shows progress dialog for large syncs. VS Code shows progress in status bar for git operations. Microsoft UX guidelines require feedback for operations > 2 seconds.

**Current gap:** `p4_fstat` on 50K files blocks for 30-60 seconds with no progress indication. User can't tell if app is hung or working.

**Complexity:** Low
- **Pattern:** Use existing streaming pattern from `p4_sync` (emits progress events)
- **UI:** Show progress bar in status bar or overlay, with estimated file count
- **Cancellation:** Provide cancel button that kills p4 process

**Dependencies:**
- Requires streaming fstat (TS-1)
- Requires process cancellation support in ProcessManager

**Implementation notes:**
- Microsoft guidelines: > 2 seconds = show progress, > 5 seconds = allow cancellation
- For very lengthy operations (> 2 minutes), use notifications instead of blocking dialog
- Show: "Loading workspace... 2,500 / ~10,000 files" (estimated total)
- Cancel button important for accidental large queries

**Sources:**
- [Progress Bars - Win32 UX Guide](https://learn.microsoft.com/en-us/windows/win32/uxguide/progress-bars) - 2 second threshold
- [CLI UX progress patterns](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays) - Spinner vs progress bar

---

### TS-8: Background Async Command Execution
**What:** Don't block Tokio thread pool with synchronous `cmd.output()` calls.

**Why expected:** IntelliJ runs git commands in background threads. Tauri apps use async runtime. Users expect multiple operations to run concurrently without queuing.

**Current gap:** All p4 commands use `std::process::Command::output()` which blocks a thread. With 4-8 threads in pool, a few concurrent fstat calls exhaust the pool and freeze the UI.

**Complexity:** Low
- **Pattern:** Replace `std::process::Command` with `tokio::process::Command`
- **Alternative:** Wrap blocking calls in `tokio::task::spawn_blocking()`

**Dependencies:**
- None (mechanical refactor of existing commands)

**Implementation notes:**
- Change import, add `.await` to command execution
- Tokio yields thread while waiting for child process
- Allows concurrent p4 operations without thread exhaustion
- Critical for streaming fstat + concurrent shelved queries + auto-refresh

**Sources:**
- Scalability analysis Issue #6
- [tokio::process::Command](https://docs.rs/tokio/latest/tokio/process/struct.Command.html)

---

## Differentiators

Features that set P4Now apart from P4V. Not expected, but valued. These are opportunities to exceed P4V.

### DIFF-1: Unified Search with Streaming Results
**What:** Single search bar that queries workspace files (fuzzy), depot paths (wildcard), and changelists (description/author) simultaneously, showing categorized results as they arrive.

**Value proposition:** P4V has three separate search mechanisms with different UIs and syntax. Users must know whether to use "Filter" (client-side), "Search depot files" (wildcard syntax), or "Search changes" (limited to 500 recent). P4Now can provide VS Code-style Command Palette experience.

**Complexity:** High
- **Tier 1:** Client-side fuzzy search (already exists, needs performance fix)
- **Tier 2:** Backend in-memory file index for instant fuzzy workspace search (Rust)
- **Tier 3:** Streaming server-proxied search (enhanced p4 files + p4 changes)
- **UI:** Single search input with categorized results (Workspace | Depot | Changelists)

**Dependencies:**
- Requires TS-3 (debounced search fix)
- Requires streaming p4 commands

**Implementation notes:**
- Workspace results: instant (client-side fuzzy via microfuzz)
- Depot results: stream in asynchronously (p4 files with fuzzy pattern)
- Changelist results: stream in asynchronously (p4 changes with description filter)
- Show results as they arrive (Workspace immediately, Depot 500ms later, CLs 1s later)
- Keyboard nav: up/down, Enter to open, Tab to switch categories
- Estimated effort: 5-7 days

**Why P4V doesn't do this:**
- P4V is built on Qt with separate dialog-based UIs
- Adding unified search would require significant UI refactoring
- P4Now's React architecture makes this natural

**Sources:**
- Scalability analysis Issue #3 (complete search architecture)
- [SmartGit feature request](https://smartgit.userecho.com/communities/1/topics/10-ctrl-p-tool-menu-search) - Users want Ctrl+P fuzzy search

---

### DIFF-2: Incremental Tree Updates (Structural Sharing)
**What:** When a single file changes (e.g., after checkout), update just that node in the tree instead of rebuilding the entire tree from scratch.

**Value proposition:** P4V rebuilds the entire file list on every refresh, causing visible jank. VS Code git extension only updates changed paths. P4Now can provide smooth, jitter-free updates.

**Complexity:** Medium
- **Pattern:** Compare incoming files with existing files by depot path
- **Structural sharing:** Only rebuild subtrees that actually changed
- **React optimization:** Use stable references to prevent unnecessary re-renders

**Dependencies:**
- Requires delta refresh (TS-2)
- Requires tree builder refactor

**Implementation notes:**
- TanStack Query supports `structuralSharing` option to preserve references
- When single file changes, walk tree to find node, update in place
- When folder contents change, rebuild that subtree only
- Prevents 170ms full rebuild on every 30-second refresh
- Estimated effort: 2-3 days

**Why P4V doesn't do this:**
- P4V's tree is QTreeWidget with full model replacement pattern
- Incremental updates require more sophisticated state management
- P4Now's immutable React tree makes this feasible

**Sources:**
- Scalability analysis Issue #4
- [TanStack Query structuralSharing](https://tanstack.com/query/latest/docs/react/guides/advanced-ssr#structural-sharing)

---

### DIFF-3: Scoped Reconcile Operations
**What:** Allow users to reconcile a specific directory instead of scanning the entire workspace filesystem.

**Value proposition:** P4V reconcile always scans the whole workspace. At 50K files, this takes 1-2 minutes. Users often know exactly which directory they modified. P4Now can provide directory-scoped reconcile with right-click context menu.

**Complexity:** Low
- **Pattern:** Add "Reconcile this folder" to folder context menu
- **Backend:** Pass directory path to `p4 reconcile -n <path>/...`
- **UI:** Show progress with file count

**Dependencies:**
- Requires progress indicators (TS-7)

**Implementation notes:**
- Right-click folder → "Reconcile this folder..."
- Run `p4 reconcile -n //depot/path/...` instead of `//...`
- Show streaming progress (files scanned)
- Dramatically faster for targeted workflows
- Estimated effort: 1 day

**Why P4V doesn't do this:**
- P4V's reconcile dialog doesn't have directory-scoping UI
- Adding scope selector would complicate already-complex dialog
- P4Now's context menu approach is simpler

**Sources:**
- Scalability analysis Issue #11
- User workflows: "I added files in this one directory, why scan everything?"

---

### DIFF-4: Virtualized Code/Annotation Viewer
**What:** Only render visible lines of file content instead of rendering entire 5,000-line file as DOM.

**Value proposition:** P4V's built-in viewer struggles with large files. VS Code handles multi-MB files smoothly via virtualization. P4Now can match modern editor performance.

**Complexity:** Medium
- **Option 1:** Integrate Monaco Editor (heavy, 5MB, but battle-tested)
- **Option 2:** Custom virtualized line renderer (lighter, more control)

**Dependencies:**
- None (enhancement to existing viewer)

**Implementation notes:**
- Current viewer creates thousands of `<span>` elements for syntax highlighting
- Files > 5,000 lines cause 1-2 second render delay
- Virtualization renders only visible 50-100 lines
- Annotation gutter virtualizes in sync with content
- Estimated effort: 1-2 days

**Why P4V doesn't do this:**
- P4V viewer is QTextEdit with line limit
- Full virtualization would require custom Qt widget
- P4Now's React ecosystem makes virtualization libraries available

**Sources:**
- Scalability analysis Issues #9, #10
- [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react)

---

## Anti-Features

Features to deliberately NOT build for this milestone. Common mistakes in large depot support.

### ANTI-1: Full-Text Content Search (Grep Across Workspace)
**Why avoid:** P4 has no built-in grep. Would require downloading every file's content, which is prohibitively expensive. P4V doesn't provide this. VS Code grep works because files are local; P4Now would need to sync everything first.

**What to do instead:** Focus on file name search and changelist description search. For content search, recommend users sync relevant directories and use external grep tools (ripgrep, ag).

**If users request:** Point to `p4 grep` command (available in some Perforce versions) but don't implement in GUI for this milestone.

---

### ANTI-2: Real-Time File System Watching
**Why avoid:** Perforce has no file system watcher protocol. Implementing OS-level file watching (FSEvents, inotify) would require complex state reconciliation (which files are tracked? which changes matter?). P4V doesn't do this. The 30-second auto-refresh is industry standard.

**What to do instead:** Use manual refresh button + refetchOnWindowFocus (existing pattern). Provide clear "Last updated" timestamp. Delta refresh (TS-2) makes refreshes cheap.

**If users request:** Explain Perforce architecture limitation. Suggest they use explicit sync/reconcile operations rather than relying on automatic detection.

---

### ANTI-3: Offline Mode / Local Caching
**Why avoid:** Perforce is server-authoritative. P4V requires server connection for all operations. Implementing offline mode would require duplicating Perforce's entire workspace metadata locally, handling sync conflicts, and reconciling on reconnect.

**What to do instead:** Show clear connection status. On disconnect, disable operations cleanly with helpful error messages. Don't pretend operations can work offline.

**If users request:** Explain that P4's architecture requires server communication. Git GUIs can work offline because git is distributed; Perforce is centralized by design.

---

### ANTI-4: Automatic Background Syncing
**Why avoid:** Syncing is a user-initiated operation with disk I/O and potential merge conflicts. P4V requires explicit sync actions. Auto-sync would surprise users ("why are files changing?"), consume bandwidth, and risk overwriting local changes.

**What to do instead:** Show sync status clearly (TS-1 foundation: sync badges). Provide one-click sync actions. Make "sync latest" easy to trigger, but never automatic.

**If users request:** Offer "Sync on startup" preference (opt-in, defaults OFF). Never sync in background without explicit user action.

---

### ANTI-5: Client-Side Changelist History Beyond 500 CLs
**Why avoid:** P4V caps at 500 recent submitted changelists for good reason: displaying thousands of CLs in a UI causes rendering lag, and users rarely browse deep history via GUI (they use `p4 changes` CLI with filters). Building infinite scroll or pagination adds complexity without clear user value.

**What to do instead:** Keep 500-CL prefetch. Add "Search changelists" with server-side filtering (DIFF-1). For deep history, users can use CLI or filter by date range.

**If users request:** Add cursor-based pagination (P3 in scalability analysis, Issue #12) but default to 500. Don't implement infinite scroll or load-all-history.

---

## Feature Dependencies

```
Incremental Loading (TS-1)
  ↓
Delta Refresh (TS-2) ──→ Incremental Tree Updates (DIFF-2)
  ↓
Background Async Execution (TS-8)
  ↓
Progress Indicators (TS-7)


Debounced Search (TS-3)
  ↓
Unified Search (DIFF-1)


Workspace Restriction (TS-4) ──→ Server-Side Limiting (TS-5)


Batch Shelved Queries (TS-6) ← TS-8 (async execution)


Scoped Reconcile (DIFF-3) ← TS-7 (progress)


Virtualized Viewer (DIFF-4) ← no dependencies
```

**Critical path for 10K file support:**
1. TS-8 (async execution) - enables concurrent operations
2. TS-1 (incremental loading) - unblocks initial load
3. TS-3 (debounced search) - fixes input lag
4. TS-2 (delta refresh) - prevents re-query thrashing

**Quick wins (high impact, low effort):**
- TS-3: Debounced search (1-2 days)
- TS-5: Server-side limiting (1 day)
- TS-6: Batch queries (1 day)
- TS-8: Async execution (1-2 days)

---

## MVP Recommendation

For milestone "Large Depot Scalability," prioritize:

### Must-Have (P0)
1. **TS-1:** Incremental workspace loading (streaming fstat)
2. **TS-3:** Debounced search (fix input lag)
3. **TS-8:** Background async execution (unblock concurrent ops)

### Should-Have (P1)
4. **TS-2:** Delta refresh (prevent re-query)
5. **TS-7:** Progress indicators (UX clarity)
6. **TS-6:** Batch shelved queries (reduce server load)
7. **TS-4:** Workspace-restricted depot view (most impactful P4V feature)

### Nice-to-Have (Defer to post-milestone)
- DIFF-1: Unified search (5-7 days, complex, high value but not blocking)
- DIFF-2: Incremental tree updates (polish, depends on TS-2)
- DIFF-3: Scoped reconcile (workflow enhancement)
- DIFF-4: Virtualized viewer (file-size issue, not depot-size issue)
- TS-5: Server-side limiting (DepotBrowser already caches, not critical path)

### Explicitly Defer
- All anti-features (ANTI-1 through ANTI-5)
- Changelist history pagination (P3 issue, < 500 CL use case is rare)

---

## Complexity Summary

| Feature | Complexity | Effort | Dependencies | Priority |
|---------|-----------|--------|--------------|----------|
| TS-1: Incremental Loading | Medium | 3-4 days | TS-8 | P0 |
| TS-2: Delta Refresh | Medium | 2-3 days | TS-1 | P1 |
| TS-3: Debounced Search | Low | 1-2 days | None | P0 |
| TS-4: Workspace Restriction | Medium | 1-2 days | Client spec parsing | P1 |
| TS-5: Server-Side Limiting | Low | 1 day | None | P2 |
| TS-6: Batch Queries | Low | 1 day | TS-8 | P1 |
| TS-7: Progress Indicators | Low | 1 day | TS-1 | P1 |
| TS-8: Async Execution | Low | 1-2 days | None | P0 |
| DIFF-1: Unified Search | High | 5-7 days | TS-3 | P2 |
| DIFF-2: Incremental Tree | Medium | 2-3 days | TS-2 | P2 |
| DIFF-3: Scoped Reconcile | Low | 1 day | TS-7 | P2 |
| DIFF-4: Virtualized Viewer | Medium | 1-2 days | None | P2 |

**Total P0 effort:** 5-8 days (TS-1, TS-3, TS-8)
**Total P0+P1 effort:** 12-17 days (add TS-2, TS-4, TS-6, TS-7)
**Full milestone effort:** 24-34 days (includes all differentiators)

---

## UX Patterns: How P4V Handles Large Depots

Based on research, here's how P4V actually works:

### Workspace Loading
- **Pattern:** Lazy directory loading. Directories load when expanded, not at startup.
- **P4Now approach:** Different - use streaming fstat with flat file list (better for search). Load first 500 files immediately, stream remainder.
- **Tradeoff:** P4Now's flat list enables instant search; P4V's lazy directories have faster initial render but slower search.

### Depot Browser
- **Pattern:** Tree restricted to workspace view (default), entire depot tree (opt-in). Uses `p4 files -m 500` for server-side limiting. Load more on scroll.
- **P4Now approach:** Same pattern. Add workspace restriction toggle, implement `-m` flag.
- **Direct adoption:** This is P4V's best pattern, copy it exactly.

### Changelist Metadata
- **Pattern:** Batch size preference "Number of changelists to fetch at a time" (default ~50). Fetches in batches to avoid server overload.
- **P4Now approach:** Implement batch query command, lazy load shelved files only for expanded CLs.
- **Improvement:** P4Now can batch better with Rust backend aggregation.

### Search Experience
- **Pattern:** THREE separate mechanisms:
  1. Filter (client-side text match, no fuzzy)
  2. Search depot files (requires exact wildcard syntax `//depot/.../*.cpp`)
  3. Search submitted changes (limited to recent 500, no server-side filtering)
- **P4Now approach:** Unify into single search bar with fuzzy matching.
- **Opportunity:** This is where P4Now can significantly exceed P4V.

### Long-Running Operations
- **Pattern:** Progress dialog with determinate progress bar, Cancel button. For very long ops (> 2 min), minimize dialog and show in status bar.
- **P4Now approach:** Same pattern. Use Tauri Channel for progress events, show in status bar with cancel option.
- **Direct adoption:** Microsoft UX guidelines P4V follows are sound.

### File List Refresh
- **Pattern:** Manual refresh button. Auto-refresh only on window focus (checks for server changes).
- **P4Now approach:** Similar, but add delta refresh instead of full re-query.
- **Improvement:** P4V re-queries everything; P4Now can query only opened/shelved files.

---

## Sources

### High Confidence (Official Documentation & Direct Observation)
- [P4V Release Notes](https://www.perforce.com/perforce/doc.current/user/p4vnotes.txt) - Lazy loading, performance enhancements
- [Creating and managing workspaces](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/using.workspaces.html) - Workspace restriction, mapping overrides
- [Speed Up Your Perforce Repo with P4V](https://articles.assembla.com/en/articles/1804524-speed-up-your-perforce-repo-with-p4v) - Performance best practices
- [Tuning Perforce for Performance](https://www.perforce.com/perforce/doc.092/manuals/p4sag/07_perftune.html) - Client view optimization
- [P4V Preferences](https://legacy-docs.perforce.com/doc.current/manuals/v14.3/p4v/configuring.preferences.html) - Batch size configuration
- [p4 fstat reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_fstat.html) - Filter flags for incremental queries
- [P4V User Guide 2021.1](https://ftp.perforce.com/perforce/r21.2/doc/manuals/p4v.pdf) - UI patterns, dialog flows
- P4Now scalability analysis (reports/large-depot-scalability-analysis.md) - Issues 1-12 with solutions

### Medium Confidence (Community Best Practices)
- [Progress Bars - Win32 UX Guide](https://learn.microsoft.com/en-us/windows/win32/uxguide/progress-bars) - Progress indicator timing
- [CLI UX progress patterns](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays) - Progress display best practices
- [Handle cancelled background task - UWP](https://learn.microsoft.com/en-us/windows/uwp/launch-resume/handle-a-cancelled-background-task) - Cancellation patterns
- [Background tasks overview - Android](https://developer.android.com/develop/background-work/background-tasks) - Long-running task patterns
- [fzf fuzzy finder](https://github.com/junegunn/fzf) - Fuzzy search performance (millions of items)
- [SmartGit feature request](https://smartgit.userecho.com/communities/1/topics/10-ctrl-p-tool-menu-search) - User demand for unified search

### Low Confidence (SCM GUI Comparison, Indirect Evidence)
- [VS Code disk performance](https://code.visualstudio.com/remote/advancedcontainers/improve-performance) - Exclude patterns for large repos
- [IntelliJ large project performance issues](https://intellij-support.jetbrains.com/hc/en-us/community/posts/21635422486802--Issue-with-IntelliJ-IDEA-Performance-on-Large-Projects) - Known problems with large repos
- [SourceTree performance issues](https://jira.atlassian.com/browse/SRCTREE-6538) - Large repo slowness
- [SourceTree performance optimization guide](https://the-pi-guy.com/blog/sourcetree_performance_optimization_and_troubleshooting/) - Antivirus exclusions, Git LFS

**Note on SCM GUI research:** VS Code, IntelliJ, and SourceTree are Git-based tools. Git's distributed architecture enables patterns (offline mode, fast local operations) that don't translate to Perforce. Only P4V patterns are directly comparable.
