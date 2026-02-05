# Requirements: P4Now v5.0 Large Depot Scale

**Defined:** 2026-02-04
**Core Value:** The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive even during network issues or long-running operations.
**Source:** `reports/large-depot-scalability-analysis.md` + domain research

## v5.0 Requirements

Requirements for large depot scalability milestone. Makes P4Now work smoothly with 10,000+ file depots.

### Streaming Workspace Loading

- [ ] **STREAM-01**: Workspace file tree loads progressively via streaming (first files visible in <500ms)
- [ ] **STREAM-02**: Streaming fstat sends batches of files incrementally (not all-or-nothing)
- [ ] **STREAM-03**: User can cancel streaming load in progress
- [ ] **STREAM-04**: Backend uses tokio::process for non-blocking async process execution

### File Tree Performance

- [ ] **TREE-01**: File tree filter uses persistent fuzzy index (built once, queried per keystroke)
- [ ] **TREE-02**: Filter input is debounced (150ms) to prevent redundant computation
- [ ] **TREE-03**: Tree builder uses structural sharing (unchanged subtrees preserve object identity)
- [ ] **TREE-04**: Tree updates incrementally when <10% of files change (no full rebuild)
- [ ] **TREE-05**: File tree store batches updates (no Map copy per individual file)

### Search Architecture

- [ ] **SEARCH-01**: Rust-side FileIndex provides instant workspace file search (<5ms for 100K files)
- [ ] **SEARCH-02**: FileIndex rebuilds automatically after workspace data loads
- [ ] **SEARCH-03**: FileIndex uses nucleo fuzzy matching for high-quality results

### Delta Refresh

- [ ] **DELTA-01**: Auto-refresh (30s) queries only opened/shelved files, not full fstat
- [ ] **DELTA-02**: Periodic full refresh occurs less frequently (e.g., every 5 minutes)
- [ ] **DELTA-03**: Delta refresh merges incrementally with existing file tree data

### Batch Operations

- [ ] **BATCH-01**: Shelved file queries use single batched backend call (not N+1 per changelist)
- [ ] **BATCH-02**: Batch query isolates errors per changelist (one failure doesn't hide all results)
- [ ] **BATCH-03**: Batch query uses sequential execution to avoid server rate limiting

### Progress & Feedback

- [ ] **PROG-01**: Operations longer than 2 seconds show progress indicator
- [ ] **PROG-02**: Progress indicator shows file count / estimated total during streaming
- [ ] **PROG-03**: All progress indicators support cancellation

## Future Requirements

Deferred to later milestones. Tracked but not in v5.0 roadmap.

### Unified Search

- **USEARCH-01**: Single search UI shows results from workspace, depot, and changelists
- **USEARCH-02**: Search results stream in progressively from each source
- **USEARCH-03**: Command palette triggers deep search mode

### Workspace Optimization

- **WSOPT-01**: Depot browser restricts to workspace mapping by default
- **WSOPT-02**: Server queries use -m flag with "Load More" pagination
- **WSOPT-03**: Scoped reconcile for directory-level operations

### Viewer Enhancement

- **VIEW-01**: Virtualized code viewer handles files with 100K+ lines

### Previously Deferred (from v4.0)

- **BKMK-01**: User can add bookmark from depot/workspace tree
- **BKMK-02**: User can view bookmarks list in sidebar
- **BKMK-03**: User can remove bookmarks
- **BKMK-04**: Bookmarks persist across sessions
- **VIEWER-04**: Viewer shows line numbers with selection
- **VIEWER-05**: User can copy file content to clipboard
- **VIEWER-06**: User can open file directly in external editor from viewer
- **SYNC-04**: User can click to sync individual out-of-date file
- **SYNC-05**: User can filter tree to show only out-of-date files
- **SUBMIT-05**: User can edit description inline in preview dialog
- **SUBMIT-06**: Preview shows diff summary for files
- **CLFILE-04**: User can filter/search within file list
- **CLFILE-05**: File list virtualized for 1000+ file changelists

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full-text content search / grep | Prohibitively expensive at scale, no P4 protocol support |
| Real-time file system watching | No Perforce protocol for push notifications |
| Offline mode / local caching | Perforce is server-authoritative |
| Automatic background syncing | Dangerous; user should always initiate sync |
| Client-side CL history beyond 500 | Diminishing returns, server-side search sufficient |
| Unified search UI | Deferred to post-v5.0; workspace search tier included |
| Workspace-restricted depot view | P1 but not on critical path for 7 core bottlenecks |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STREAM-01 | Phase 22 | Pending |
| STREAM-02 | Phase 22 | Pending |
| STREAM-03 | Phase 22 | Pending |
| STREAM-04 | Phase 21 | Complete |
| TREE-01 | Phase 23 | Pending |
| TREE-02 | Phase 21 | Complete |
| TREE-03 | Phase 24 | Pending |
| TREE-04 | Phase 24 | Pending |
| TREE-05 | Phase 24 | Pending |
| SEARCH-01 | Phase 23 | Pending |
| SEARCH-02 | Phase 23 | Pending |
| SEARCH-03 | Phase 23 | Pending |
| DELTA-01 | Phase 24 | Pending |
| DELTA-02 | Phase 24 | Pending |
| DELTA-03 | Phase 24 | Pending |
| BATCH-01 | Phase 25 | Pending |
| BATCH-02 | Phase 25 | Pending |
| BATCH-03 | Phase 25 | Pending |
| PROG-01 | Phase 22 | Pending |
| PROG-02 | Phase 22 | Pending |
| PROG-03 | Phase 22 | Pending |

**Coverage:**
- v5.0 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-02-04*
*Last updated: 2026-02-04*
