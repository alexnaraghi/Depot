# Requirements: P4Now v2.0

**Defined:** 2026-01-28
**Core Value:** The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive.

## v2.0 Requirements

### Connection & Settings

- [ ] **CONN-01**: User can configure P4 connection (server, user, client workspace) in a settings UI
- [ ] **CONN-04**: User can browse and select from available workspaces
- [ ] **CONN-05**: Connection settings persist across app restarts
- [ ] **CONN-06**: Visual connection status indicator (connected/disconnected/error) visible at all times
- [ ] **CONN-07**: Current repository/stream name displayed in header or status bar
- [ ] **CONN-08**: Current workspace name displayed in header or status bar

### Changelist Management

- [ ] **CL-01**: User can view all pending changelists (default + numbered) with their files
- [ ] **CL-02**: User can create a new numbered changelist with a description
- [ ] **CL-03**: User can edit a changelist description inline
- [ ] **CL-04**: User can delete an empty changelist
- [ ] **CL-05**: User can move files between changelists via drag-and-drop
- [ ] **CL-06**: User can move files between changelists via right-click context menu
- [ ] **CL-07**: User can submit a specific numbered changelist (not just default)

### Shelve/Unshelve

- [ ] **SHELV-01**: User can shelve files in a changelist
- [ ] **SHELV-02**: User can view shelved files in a changelist (distinct from pending files)
- [ ] **SHELV-03**: User can unshelve files to a target changelist
- [ ] **SHELV-04**: User can delete a shelf
- [ ] **SHELV-05**: User sees warning when unshelving would overwrite local changes

### Context Menus

- [ ] **CTX-01**: Right-click file in pending changes shows: Diff, Revert, Move to Changelist, Shelve, File History
- [ ] **CTX-02**: Right-click changelist header shows: Submit, Shelve, New Changelist, Edit Description, Delete
- [ ] **CTX-03**: Right-click file in workspace view shows: Checkout, Add, Diff, File History, Get Revision

### File History

- [ ] **HIST-01**: User can view file history showing revision, action, changelist, date, user, description
- [ ] **HIST-02**: User can diff a revision against the previous revision (launches external diff tool)
- [ ] **HIST-03**: User can diff a revision against the workspace version

### External Diff

- [ ] **DIFF-01**: User can configure external diff tool path and arguments in settings
- [ ] **DIFF-02**: User can launch diff for workspace file vs depot head
- [ ] **DIFF-03**: User can launch diff between two specific revisions

### Reconcile

- [ ] **RECON-01**: User can run reconcile to detect offline edits, adds, and deletes
- [ ] **RECON-02**: Reconcile shows preview of detected changes before applying
- [ ] **RECON-03**: User can select/deselect individual files from reconcile preview
- [ ] **RECON-04**: User can choose target changelist for reconciled files

### Keyboard Shortcuts

- [ ] **KEY-01**: Keyboard shortcuts for core operations (Refresh, Sync, Submit, Revert, Diff, History)
- [ ] **KEY-02**: Keyboard shortcuts displayed in context menus and tooltips
- [ ] **KEY-03**: Command palette (Ctrl+K or Ctrl+Shift+P) with fuzzy search for all operations

### Search

- [ ] **SRCH-01**: User can search submitted changelists by changelist number
- [ ] **SRCH-02**: User can search submitted changelists by author
- [ ] **SRCH-03**: User can search submitted changelists by description text
- [ ] **SRCH-04**: Search results show changelist number, date, user, and description

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
| CONN-01 | — | Pending |
| CONN-04 | — | Pending |
| CONN-05 | — | Pending |
| CONN-06 | — | Pending |
| CONN-07 | — | Pending |
| CONN-08 | — | Pending |
| CL-01 | — | Pending |
| CL-02 | — | Pending |
| CL-03 | — | Pending |
| CL-04 | — | Pending |
| CL-05 | — | Pending |
| CL-06 | — | Pending |
| CL-07 | — | Pending |
| SHELV-01 | — | Pending |
| SHELV-02 | — | Pending |
| SHELV-03 | — | Pending |
| SHELV-04 | — | Pending |
| SHELV-05 | — | Pending |
| CTX-01 | — | Pending |
| CTX-02 | — | Pending |
| CTX-03 | — | Pending |
| HIST-01 | — | Pending |
| HIST-02 | — | Pending |
| HIST-03 | — | Pending |
| DIFF-01 | — | Pending |
| DIFF-02 | — | Pending |
| DIFF-03 | — | Pending |
| RECON-01 | — | Pending |
| RECON-02 | — | Pending |
| RECON-03 | — | Pending |
| RECON-04 | — | Pending |
| KEY-01 | — | Pending |
| KEY-02 | — | Pending |
| KEY-03 | — | Pending |
| SRCH-01 | — | Pending |
| SRCH-02 | — | Pending |
| SRCH-03 | — | Pending |
| SRCH-04 | — | Pending |
| VIS-01 | — | Pending |
| VIS-02 | — | Pending |
| VIS-03 | — | Pending |

**Coverage:**
- v2.0 requirements: 40 total
- Mapped to phases: 0
- Unmapped: 40 (awaiting roadmap)

---
*Requirements defined: 2026-01-28*
*Last updated: 2026-01-28 after initial definition*
