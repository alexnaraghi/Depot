# Roadmap: P4Now

## Milestones

- :white_check_mark: **v1.0 MVP** - Phases 01-02 (shipped 2026-01-28)
- :construction: **v2.0 Feature Complete** - Phases 03-08 (in progress)

<details>
<summary>v1.0 MVP (Phases 01-02) - SHIPPED 2026-01-28</summary>

**2 phases, 14 plans, 104 min total execution**

See `.planning/milestones/v1.0-ROADMAP.md` for full details.

Key accomplishments:
- Async-first architecture (never blocks UI)
- Process management with reliable cancellation
- File tree with P4V-style status icons
- Changelist management and submit workflow
- Sync with progress streaming and conflict detection

</details>

## v2.0 Feature Complete (In Progress)

**Milestone Goal:** Transform P4Now from MVP into a full daily-driver Perforce client with settings, history, diff, changelists, shelving, reconcile, and polish.

- [x] **Phase 03: Settings & Infrastructure** - Connection settings UI, status indicator, and persistent configuration
- [x] **Phase 04: Changelist Management** - Multiple changelists with create, edit, delete, and drag-drop file moves
- [x] **Phase 05: History, Diff & Search** - File history viewer, external diff integration, and submitted changelist search
- [ ] **Phase 06: Shelve & Reconcile** - Shelve/unshelve workflows and offline reconcile with preview
- [ ] **Phase 07: Context Menus & Keyboard Shortcuts** - Right-click menus, keyboard shortcuts, and command palette
- [ ] **Phase 08: Visual Polish** - Consistent design, loading states, and professional appearance

## Phase Details

### Phase 03: Settings & Infrastructure
**Goal**: User can configure, monitor, and persist their P4 connection without editing config files
**Depends on**: Phase 02 (v1.0 core workflows)
**Requirements**: CONN-01, CONN-04, CONN-05, CONN-06, CONN-07, CONN-08
**Success Criteria** (what must be TRUE):
  1. User can open a settings dialog, enter server/user/workspace, and the app connects using those settings
  2. User can browse available workspaces and select one from a list
  3. Settings persist across app restarts without re-entry
  4. Connection status (connected/disconnected/error) is visible at all times in the UI
  5. Current workspace name and stream/repository are displayed in the header or status bar
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Settings persistence infrastructure and Rust backend commands
- [x] 03-02-PLAN.md — Settings dialog UI, connection status, and header integration

### Phase 04: Changelist Management
**Goal**: User can organize pending work across multiple changelists with full CRUD and file movement
**Depends on**: Phase 03 (connection infrastructure)
**Requirements**: CL-01, CL-02, CL-03, CL-04, CL-05, CL-06, CL-07
**Success Criteria** (what must be TRUE):
  1. User can see all pending changelists (default and numbered) with their files listed
  2. User can create a new changelist with a description, edit the description, and delete empty changelists
  3. User can drag-and-drop files between changelists and the files move on the server
  4. User can move files between changelists via a right-click "Move to Changelist" option
  5. User can submit any specific numbered changelist (not only the default)
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md — Rust backend commands (create, delete, reopen, edit description) + TypeScript bindings
- [x] 04-02-PLAN.md — Changelist CRUD UI (create/edit dialogs, delete button, default CL handling)
- [x] 04-03-PLAN.md — File context menu with "Move to Changelist" submenu, DnD reopen fix, verification

### Phase 05: History, Diff & Search
**Goal**: User can investigate file history, compare revisions with an external diff tool, and search submitted changelists
**Depends on**: Phase 03 (connection infrastructure)
**Requirements**: HIST-01, HIST-02, HIST-03, DIFF-01, DIFF-02, DIFF-03, SRCH-01, SRCH-02, SRCH-03, SRCH-04
**Success Criteria** (what must be TRUE):
  1. User can view a file's revision history showing revision number, action, changelist, date, user, and description
  2. User can launch an external diff tool to compare any revision against the previous revision or the workspace version
  3. User can configure the external diff tool path and arguments in settings
  4. User can search submitted changelists by number, author, or description and see results with changelist number, date, user, and description
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — Rust backend commands (filelog, print, diff launch, changes search) + TS bindings + diff tool settings
- [x] 05-02-PLAN.md — File History dialog, diff hooks, context menu integration, Settings diff tool config
- [x] 05-03-PLAN.md — Search bar in header, search results panel, client-side filtering

### Phase 06: Shelve & Reconcile
**Goal**: User can shelve/unshelve files safely and reconcile offline work with a preview before applying
**Depends on**: Phase 04 (changelist management)
**Requirements**: SHELV-01, SHELV-02, SHELV-03, SHELV-04, SHELV-05, RECON-01, RECON-02, RECON-03, RECON-04
**Success Criteria** (what must be TRUE):
  1. User can shelve files in a changelist and see shelved files displayed distinctly from pending files
  2. User can unshelve files to a target changelist, with a warning when local changes would be overwritten
  3. User can delete a shelf from a changelist
  4. User can run reconcile, see a preview of detected offline edits/adds/deletes, select/deselect individual files, and choose a target changelist before applying
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 07: Context Menus & Keyboard Shortcuts
**Goal**: User can access all operations via right-click menus, keyboard shortcuts, and a command palette
**Depends on**: Phase 06 (all features exist to bind to)
**Requirements**: CTX-01, CTX-02, CTX-03, KEY-01, KEY-02, KEY-03
**Success Criteria** (what must be TRUE):
  1. Right-clicking a file in pending changes shows Diff, Revert, Move to Changelist, Shelve, and File History actions
  2. Right-clicking a changelist header shows Submit, Shelve, New Changelist, Edit Description, and Delete actions
  3. Right-clicking a file in workspace view shows Checkout, Add, Diff, File History, and Get Revision actions
  4. Keyboard shortcuts work for core operations (Refresh, Sync, Submit, Revert, Diff, History) and are displayed in menus/tooltips
  5. User can open a command palette (Ctrl+K or Ctrl+Shift+P) with fuzzy search for all operations
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

### Phase 08: Visual Polish
**Goal**: The app looks professional and feels polished with consistent design and proper loading states
**Depends on**: Phase 07 (all functional surfaces exist)
**Requirements**: VIS-01, VIS-02, VIS-03
**Success Criteria** (what must be TRUE):
  1. All views have consistent spacing, typography, and color usage
  2. Async operations show loading states or skeleton placeholders instead of blank areas
  3. The app looks competitive with modern developer tools (VS Code, Linear, etc.)
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 03 -> 04 -> 05 -> 06 -> 07 -> 08
(Phase 05 depends on 03 only, so could overlap with 04 if needed)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 01. Non-Blocking Foundation | v1.0 | 8/8 | Complete | 2026-01-28 |
| 02. Core Workflows | v1.0 | 6/6 | Complete | 2026-01-28 |
| 03. Settings & Infrastructure | v2.0 | 2/2 | Complete | 2026-01-29 |
| 04. Changelist Management | v2.0 | 3/3 | Complete | 2026-01-29 |
| 05. History, Diff & Search | v2.0 | 3/3 | Complete | 2026-01-29 |
| 06. Shelve & Reconcile | v2.0 | 0/TBD | Not started | - |
| 07. Context Menus & Keyboard Shortcuts | v2.0 | 0/TBD | Not started | - |
| 08. Visual Polish | v2.0 | 0/TBD | Not started | - |

---
*Last updated: 2026-01-29 after Phase 05 completion*
