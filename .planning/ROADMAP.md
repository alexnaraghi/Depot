# Roadmap: P4Now

## Milestones

- ✅ **v1.0 MVP** - Phases 01-02 (shipped 2026-01-28)
- ✅ **v2.0 Feature Complete** - Phases 03-08 (shipped 2026-01-30)
- ✅ **v3.0 Daily Driver** - Phases 09-15 (shipped 2026-02-01)
- ✅ **v4.0 Road to P4V Killer** - Phases 16-20 (shipped 2026-02-03)
- 🚧 **v5.0 Large Depot Scale** - Phases 21-25 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 01-02) - SHIPPED 2026-01-28</summary>

### Phase 01: Foundation
**Goal**: Async-first architecture with process management
**Plans**: 8 plans

### Phase 02: Core Workflows
**Goal**: Basic Perforce operations (sync, checkout, submit, revert)
**Plans**: 6 plans

</details>

<details>
<summary>✅ v2.0 Feature Complete (Phases 03-08) - SHIPPED 2026-01-30</summary>

### Phase 03: Settings & Connection
**Goal**: Full P4 connection configuration with workspace browser
**Plans**: 3 plans

### Phase 04: Advanced Changelist Management
**Goal**: Multiple changelists with drag-and-drop and context menus
**Plans**: 3 plans

### Phase 05: History & Diff
**Goal**: File history viewer and external diff integration
**Plans**: 3 plans

### Phase 06: Advanced Workflows
**Goal**: Shelving, reconcile, and submitted CL search
**Plans**: 4 plans

### Phase 07: Command Palette & Shortcuts
**Goal**: Keyboard-first navigation and command execution
**Plans**: 2 plans

### Phase 08: Polish & Visual
**Goal**: Blue-tinted dark theme and loading states
**Plans**: 3 plans

</details>

<details>
<summary>✅ v3.0 Daily Driver (Phases 09-15) - SHIPPED 2026-02-01</summary>

### Phase 09: E2E Testing Foundation
**Goal**: Automated testing infrastructure
**Plans**: 3 plans

### Phase 10: Bug Fixes
**Goal**: Critical bug fixes from manual testing
**Plans**: 2 plans

### Phase 11: Auto-Refresh + Settings
**Goal**: Automatic query refresh with user control
**Plans**: 2 plans

### Phase 11.1: Unified Three-Column Layout
**Goal**: File tree, detail pane, and changelist panel in unified layout
**Plans**: 5 plans

### Phase 12: Search Filtering & Results
**Goal**: In-place filtering with deep search via command palette
**Plans**: 4 plans

### Phase 13: Workspace & Stream Switching
**Goal**: Switch workspace and stream with auto-shelve protection
**Plans**: 5 plans

### Phase 14: Depot Browser
**Goal**: Browse depot hierarchy with lazy loading
**Plans**: 3 plans

### Phase 15: Resolve Workflow
**Goal**: Conflict resolution with external merge tool integration
**Plans**: 2 plans

</details>

<details>
<summary>✅ v4.0 Road to P4V Killer (Phases 16-20) - SHIPPED 2026-02-03</summary>

**Milestone Goal:** Close the most visible daily-use gaps versus P4V — file content viewer, file annotations (blame), workspace sync status, submitted changelist file list, and submit preview dialog.

#### Phase 16: File Content Viewer
**Goal**: User can view file content at any revision with syntax highlighting
**Depends on**: Phase 15
**Requirements**: VIEWER-01, VIEWER-02, VIEWER-03
**Success Criteria** (what must be TRUE):
  1. User can view file content at any revision in detail pane
  2. File content shows syntax highlighting appropriate for file extension
  3. User sees size warning before loading large files with option to proceed
  4. Addresses p4_print tech debt from RevisionDetailView
**Plans**: 3 plans

Plans:
- [x] 16-01-PLAN.md - Install prism-react-renderer, create language map, add backend command
- [x] 16-02-PLAN.md - Create FileContentViewer component with syntax highlighting
- [x] 16-03-PLAN.md - Add file size validation and warning dialog

#### Phase 17: File Annotations
**Goal**: User can view per-line blame information with rich interaction
**Depends on**: Phase 16
**Requirements**: BLAME-01, BLAME-02, BLAME-03, BLAME-04, BLAME-05, BLAME-06
**Success Criteria** (what must be TRUE):
  1. User can view per-line author, revision, and date for any file
  2. User can click annotation to navigate to that revision's changelist detail
  3. User can navigate annotations with keyboard (up/down between change blocks)
  4. Annotations show age heatmap coloring (recent changes hot, old changes cold)
  5. User can hover annotation to see full commit message tooltip
  6. User can "blame prior revision" to peel back history layers
**Plans**: 3 plans

Plans:
- [x] 17-01-PLAN.md - Backend p4_annotate command, useFileAnnotations hook, parsing/color utilities
- [x] 17-02-PLAN.md - FileAnnotationViewer and AnnotationGutter with virtualization and heatmap
- [x] 17-03-PLAN.md - Interactive features: tooltip, keyboard nav, CL click, blame prior revision

#### Phase 18: Table Stakes UI Features
**Goal**: Workspace sync status and submitted changelist file lists
**Depends on**: Phase 16
**Requirements**: SYNC-01, SYNC-02, SYNC-03, CLFILE-01, CLFILE-02, CLFILE-03
**Success Criteria** (what must be TRUE):
  1. File tree shows icon overlay indicating which files are out-of-date
  2. Sync status compares have-rev vs head-rev for each file
  3. Sync status visible in tree without expanding folders (bubbles up)
  4. User can view complete file list for any submitted changelist
  5. Files in submitted CL show action indicators (add, edit, delete, integrate)
  6. User can click file in submitted CL to view that revision
  7. Addresses p4_describe tech debt from RevisionDetailView
**Plans**: 3 plans

Plans:
- [x] 18-01-PLAN.md - Sync status overlays with folder aggregation
- [x] 18-02-PLAN.md - Backend p4_describe command for submitted CL files
- [x] 18-03-PLAN.md - Submitted CL file list display and navigation

#### Phase 19: Submit Enhancement
**Goal**: User can preview changelist before submitting
**Depends on**: Phase 16, Phase 18
**Requirements**: SUBMIT-01, SUBMIT-02, SUBMIT-03, SUBMIT-04
**Success Criteria** (what must be TRUE):
  1. Submit action shows preview dialog before executing
  2. Preview dialog shows changelist description
  3. Preview dialog shows clickable list of files to be submitted
  4. User can cancel from preview, edit description, or proceed with submit
  5. User can click file in preview to view content before submitting
**Plans**: 2 plans

Plans:
- [x] 19-01-PLAN.md — Extract action badge utility, replace SubmitDialog with Dialog-based component
- [x] 19-02-PLAN.md — Add file click navigation from submit preview to detail pane

#### Phase 20: Bug Fixes & UI Polish
**Goal**: Fix regressions and UX issues found during testing, unify loading behavior
**Depends on**: Phase 19
**Success Criteria** (what must be TRUE):
  1. Connection dialog only shows when no saved connection exists
  2. Shelve/unshelve operations update UI and shelved files list loads correctly
  3. CL details panel shows correct file count (regression fixed)
  4. Depot browser survives accordion collapse/expand without losing data
  5. File selection in any panel updates contextual toolbar icons
  6. Client spec loads successfully (root field parsing fixed)
  7. Top toolbar order is: Stream, Workspace, Client Spec
  8. Unified async loading indicator in status bar for all operations
  9. Depot directory loading shows progress without requiring double-click
  10. Settings menu is scrollable when content overflows
  11. Accordion headers always visible regardless of content size
  12. Default CL description edit moves files to new numbered CL
**Plans**: 5 plans

Plans:
- [x] 20-01-PLAN.md — Fix toolbar order, accordion headers, and connection dialog auto-open
- [x] 20-02-PLAN.md — Fix query invalidation in shelve/unshelve and edit description
- [x] 20-03-PLAN.md — Fix depot browser data persistence and loading progress
- [x] 20-04-PLAN.md — Fix client spec parsing and settings dialog scrollability
- [x] 20-05-PLAN.md — Fix file selection toolbar update and CL file count display

**Todos addressed:**
- 2026-02-03: connection-dialog-shows-on-startup
- 2026-02-03: shelve-unshelve-no-ui-update
- 2026-02-03: cl-details-shows-zero-files
- 2026-02-03: depots-disappear-after-accordion-toggle
- 2026-02-03: file-click-no-toolbar-update
- 2026-02-03: client-spec-missing-root-field
- 2026-02-03: toolbar-layout-order
- 2026-02-03: unify-async-loading-indicators
- 2026-02-02: settings-menu-scrollable-layout
- 2026-02-01: fix-depot-accordion-header-visibility
- 2026-01-29: move-files-when-editing-default-cl-description

</details>

### v5.0 Large Depot Scale (In Progress)

**Milestone Goal:** Make P4Now work smoothly with 10,000+ file depots by replacing blocking all-or-nothing data flows with streaming, incremental, and cancellable operations. The app should feel instant even on large workspaces.

#### Phase 21: Async Foundation
**Goal**: Backend process infrastructure supports non-blocking async execution for all subsequent streaming work
**Depends on**: Phase 20
**Requirements**: STREAM-04, TREE-02
**Success Criteria** (what must be TRUE):
  1. ProcessManager tracks and cleanly terminates tokio::process child processes (no zombie p4.exe accumulation)
  2. tokio feature flags (process, io-util) are enabled and a basic async p4 command executes without blocking the runtime
  3. A useDebounce hook exists and prevents rapid-fire callbacks (150ms default delay)
  4. Existing p4 commands continue to work unchanged (no regressions from ProcessManager update)
**Plans**: 3 plans

Plans:
- [x] 21-01-PLAN.md — Enable tokio process features, migrate ProcessManager and streaming commands to async
- [x] 21-02-PLAN.md — Migrate all p4 handler commands to tokio::process::Command
- [x] 21-03-PLAN.md — Create useDebounce hook and integrate into FileTree filter

#### Phase 22: Streaming fstat + Progress
**Goal**: Users see workspace files appearing progressively instead of waiting for a single blocking load
**Depends on**: Phase 21
**Requirements**: STREAM-01, STREAM-02, STREAM-03, PROG-01, PROG-02, PROG-03
**Success Criteria** (what must be TRUE):
  1. Workspace file tree begins populating within 500ms of opening a large workspace (first batch visible)
  2. Files arrive in incremental batches during loading (not all-or-nothing)
  3. User can cancel an in-progress workspace load and the partial results remain visible
  4. Operations longer than 2 seconds show a progress indicator with file count / estimated total
  5. All progress indicators have a cancel button that stops the underlying p4 process
**Plans**: 3 plans

Plans:
- [x] 22-01-PLAN.md — Backend streaming fstat command with Channel output
- [x] 22-02-PLAN.md — Frontend streaming integration with batch accumulation
- [x] 22-03-PLAN.md — Progress indicator enhancement and cancellation UX

#### Phase 23: FileIndex and Search
**Goal**: User can instantly search across all workspace files with fuzzy matching powered by a persistent Rust-side index
**Depends on**: Phase 22
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, TREE-01
**Success Criteria** (what must be TRUE):
  1. User can search workspace file paths and get results in under 5ms (even with 100K files)
  2. FileIndex rebuilds automatically after streaming fstat completes (no manual trigger needed)
  3. Search results use fuzzy matching that handles typos and partial paths (nucleo-quality results)
  4. File tree filter uses the persistent FileIndex instead of rebuilding a match set per keystroke
**Plans**: 3 plans

Plans:
- [x] 23-01-PLAN.md — Create FileIndex module with nucleo fuzzy matching and Tauri commands
- [x] 23-02-PLAN.md — Frontend search integration with fuzzy/exact toggle and match count
- [x] 23-03-PLAN.md — Integrate FileIndex with streaming fstat for automatic rebuild

#### Phase 24: Tree Performance + Delta Refresh
**Goal**: File tree updates are incremental (no full rebuilds) and auto-refresh is cheap (queries only changed files)
**Depends on**: Phase 22
**Requirements**: TREE-03, TREE-04, TREE-05, DELTA-01, DELTA-02, DELTA-03
**Success Criteria** (what must be TRUE):
  1. When less than 10% of files change, the tree updates incrementally without rebuilding from scratch
  2. Unchanged subtrees preserve object identity (react-arborist does not re-render stable branches)
  3. File tree store applies batch updates (not one Map copy per individual file change)
  4. Auto-refresh (30s cycle) queries only opened/shelved files, not the entire workspace fstat
  5. A periodic full refresh (every 5 minutes) catches files changed outside the opened/shelved set
  6. Delta refresh merges incrementally with existing tree data (no flicker or scroll position loss)
**Plans**: 4 plans

Plans:
- [ ] 24-01-PLAN.md — Install Immer, add settings for two-tier refresh, batch update action in store
- [ ] 24-02-PLAN.md — Incremental tree update with Immer structural sharing
- [ ] 24-03-PLAN.md — Backend p4_fstat_opened command for delta refresh
- [ ] 24-04-PLAN.md — Two-tier auto-refresh integration in useFileTree

#### Phase 25: Batch Optimization
**Goal**: Shelved file queries execute as a single efficient operation instead of N+1 individual calls
**Depends on**: Phase 21
**Requirements**: BATCH-01, BATCH-02, BATCH-03
**Success Criteria** (what must be TRUE):
  1. All shelved file lists load from a single batched backend call (not one p4 describe per changelist)
  2. If one changelist's shelved query fails, other changelists still show their shelved files
  3. Batch query executes sequentially to avoid triggering Perforce server rate limiting
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 01. Foundation | v1.0 | 8/8 | Complete | 2026-01-28 |
| 02. Core Workflows | v1.0 | 6/6 | Complete | 2026-01-28 |
| 03. Settings & Connection | v2.0 | 3/3 | Complete | 2026-01-30 |
| 04. Changelist Management | v2.0 | 3/3 | Complete | 2026-01-30 |
| 05. History & Diff | v2.0 | 3/3 | Complete | 2026-01-30 |
| 06. Advanced Workflows | v2.0 | 4/4 | Complete | 2026-01-30 |
| 07. Command Palette | v2.0 | 2/2 | Complete | 2026-01-30 |
| 08. Polish & Visual | v2.0 | 3/3 | Complete | 2026-01-30 |
| 09. E2E Testing | v3.0 | 3/3 | Complete | 2026-01-30 |
| 10. Bug Fixes | v3.0 | 2/2 | Complete | 2026-01-31 |
| 11. Auto-Refresh | v3.0 | 2/2 | Complete | 2026-01-31 |
| 11.1 Three-Column Layout | v3.0 | 5/5 | Complete | 2026-01-31 |
| 12. Search Filtering | v3.0 | 4/4 | Complete | 2026-02-01 |
| 13. Workspace/Stream | v3.0 | 5/5 | Complete | 2026-02-01 |
| 14. Depot Browser | v3.0 | 3/3 | Complete | 2026-02-01 |
| 15. Resolve Workflow | v3.0 | 2/2 | Complete | 2026-02-01 |
| 16. File Content Viewer | v4.0 | 3/3 | Complete | 2026-02-03 |
| 17. File Annotations | v4.0 | 3/3 | Complete | 2026-02-03 |
| 18. Table Stakes UI | v4.0 | 3/3 | Complete | 2026-02-03 |
| 19. Submit Enhancement | v4.0 | 2/2 | Complete | 2026-02-03 |
| 20. Bug Fixes & UI Polish | v4.0 | 5/5 | Complete | 2026-02-03 |
| 21. Async Foundation | v5.0 | 3/3 | Complete | 2026-02-04 |
| 22. Streaming fstat + Progress | v5.0 | 3/3 | Complete | 2026-02-04 |
| 23. FileIndex and Search | v5.0 | 3/3 | Complete | 2026-02-05 |
| 24. Tree Performance + Delta Refresh | v5.0 | 0/4 | Not started | - |
| 25. Batch Optimization | v5.0 | 0/TBD | Not started | - |
