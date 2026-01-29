# Requirements: P4Now v2.0

**Defined:** 2026-01-28
**Core Value:** The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive.

## v2.0 Requirements

### Connection & Settings

- [x] **CONN-01**: User can configure P4 connection (server, user, client workspace) in a settings UI
- [x] **CONN-04**: User can browse and select from available workspaces
- [x] **CONN-05**: Connection settings persist across app restarts
- [x] **CONN-06**: Visual connection status indicator (connected/disconnected/error) visible at all times
- [x] **CONN-07**: Current repository/stream name displayed in header or status bar
- [x] **CONN-08**: Current workspace name displayed in header or status bar

### Changelist Management

- [x] **CL-01**: User can view all pending changelists (default + numbered) with their files
- [x] **CL-02**: User can create a new numbered changelist with a description
- [x] **CL-03**: User can edit a changelist description inline
- [x] **CL-04**: User can delete an empty changelist
- [x] **CL-05**: User can move files between changelists via drag-and-drop
- [x] **CL-06**: User can move files between changelists via right-click context menu
- [x] **CL-07**: User can submit a specific numbered changelist (not just default)

### Shelve/Unshelve

- [x] **SHELV-01**: User can shelve files in a changelist
- [x] **SHELV-02**: User can view shelved files in a changelist (distinct from pending files)
- [x] **SHELV-03**: User can unshelve files to a target changelist
- [x] **SHELV-04**: User can delete a shelf
- [x] **SHELV-05**: User sees warning when unshelving would overwrite local changes

### Context Menus

- [ ] **CTX-01**: Right-click file in pending changes shows: Diff, Revert, Move to Changelist, Shelve, File History
- [ ] **CTX-02**: Right-click changelist header shows: Submit, Shelve, New Changelist, Edit Description, Delete
- [ ] **CTX-03**: Right-click file in workspace view shows: Checkout, Add, Diff, File History, Get Revision

### File History

- [x] **HIST-01**: User can view file history showing revision, action, changelist, date, user, description
- [x] **HIST-02**: User can diff a revision against the previous revision (launches external diff tool)
- [x] **HIST-03**: User can diff a revision against the workspace version

### External Diff

- [x] **DIFF-01**: User can configure external diff tool path and arguments in settings
- [x] **DIFF-02**: User can launch diff for workspace file vs depot head
- [x] **DIFF-03**: User can launch diff between two specific revisions

### Reconcile

- [x] **RECON-01**: User can run reconcile to detect offline edits, adds, and deletes
- [x] **RECON-02**: Reconcile shows preview of detected changes before applying
- [x] **RECON-03**: User can select/deselect individual files from reconcile preview
- [x] **RECON-04**: User can choose target changelist for reconciled files

### Keyboard Shortcuts

- [ ] **KEY-01**: Keyboard shortcuts for core operations (Refresh, Sync, Submit, Revert, Diff, History)
- [ ] **KEY-02**: Keyboard shortcuts displayed in context menus and tooltips
- [ ] **KEY-03**: Command palette (Ctrl+K or Ctrl+Shift+P) with fuzzy search for all operations

### Search

- [x] **SRCH-01**: User can search submitted changelists by changelist number
- [x] **SRCH-02**: User can search submitted changelists by author
- [x] **SRCH-03**: User can search submitted changelists by description text
- [x] **SRCH-04**: Search results show changelist number, date, user, and description

### Visual Design

- [ ] **VIS-01**: Clean, modern visual design consistent across all views
- [ ] **VIS-02**: Proper loading states and skeletons for async operations
- [ ] **VIS-03**: Professional look competitive with modern developer tools

## Future Requirements

### Deferred from v2.0

- **CONN-02**: Set charset for Unicode-mode servers — add when Unicode server users need it
- **CONN-03**: Test connection button in settings — can validate on save instead
- **AUTO-01**: Auto-detect offline changes on app launch via file system watcher
- **PROF-01**: Save multiple connection profiles for quick switching
- **MERGE-01**: Built-in merge/resolve UI (use external tools for now)
- **BRANCH-01**: Branch/integrate operations
- **CMDPAL-01**: Command palette customizable shortcuts

## Out of Scope

| Feature | Reason |
|---------|--------|
| Stream graph visualization | DAG layout extremely complex; show stream name as text instead |
| Time-lapse view | Line-by-line blame slider is enormous UI effort for niche use |
| Built-in merge/resolve UI | 3-way merge is a separate product category; P4Merge is free |
| Image diff viewer | Very niche; launch external diff tool for images |
| Branch/integrate operations | Complex P4 operations with many edge cases; not core daily workflow |
| Job/fix tracking | Rarely used outside enterprise; show raw description only |
| Auto-background refresh | Constant fstat polling hammers server; use manual F5 refresh |
| Multi-workspace support | Single workspace keeps it simple; switch via settings |
| Modal dialogs for workflows | P4V's biggest pain point; use inline panels and dropdowns |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | Phase 03 | Complete |
| CONN-04 | Phase 03 | Complete |
| CONN-05 | Phase 03 | Complete |
| CONN-06 | Phase 03 | Complete |
| CONN-07 | Phase 03 | Complete |
| CONN-08 | Phase 03 | Complete |
| CL-01 | Phase 04 | Complete |
| CL-02 | Phase 04 | Complete |
| CL-03 | Phase 04 | Complete |
| CL-04 | Phase 04 | Complete |
| CL-05 | Phase 04 | Complete |
| CL-06 | Phase 04 | Complete |
| CL-07 | Phase 04 | Complete |
| HIST-01 | Phase 05 | Complete |
| HIST-02 | Phase 05 | Complete |
| HIST-03 | Phase 05 | Complete |
| DIFF-01 | Phase 05 | Complete |
| DIFF-02 | Phase 05 | Complete |
| DIFF-03 | Phase 05 | Complete |
| SRCH-01 | Phase 05 | Complete |
| SRCH-02 | Phase 05 | Complete |
| SRCH-03 | Phase 05 | Complete |
| SRCH-04 | Phase 05 | Complete |
| SHELV-01 | Phase 06 | Complete |
| SHELV-02 | Phase 06 | Complete |
| SHELV-03 | Phase 06 | Complete |
| SHELV-04 | Phase 06 | Complete |
| SHELV-05 | Phase 06 | Complete |
| RECON-01 | Phase 06 | Complete |
| RECON-02 | Phase 06 | Complete |
| RECON-03 | Phase 06 | Complete |
| RECON-04 | Phase 06 | Complete |
| CTX-01 | Phase 07 | Pending |
| CTX-02 | Phase 07 | Pending |
| CTX-03 | Phase 07 | Pending |
| KEY-01 | Phase 07 | Pending |
| KEY-02 | Phase 07 | Pending |
| KEY-03 | Phase 07 | Pending |
| VIS-01 | Phase 08 | Pending |
| VIS-02 | Phase 08 | Pending |
| VIS-03 | Phase 08 | Pending |

**Coverage:**
- v2.0 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-01-28*
*Last updated: 2026-01-29 after Phase 06 completion*
