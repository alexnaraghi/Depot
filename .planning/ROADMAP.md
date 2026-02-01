# Roadmap: P4Now

## Milestones

- ✅ **v1.0 MVP** - Phases 01-02 (shipped 2026-01-28)
- ✅ **v2.0 Feature Complete** - Phases 03-08 (shipped 2026-01-30)
- 🚧 **v3.0 Daily Driver** - Phases 09-15 (in progress)

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

### 🚧 v3.0 Daily Driver (In Progress)

**Milestone Goal:** Make P4Now reliable enough for real contributors to evaluate with their daily Perforce workflows.

#### Phase 09: E2E Testing Foundation
**Goal**: Automated regression testing infrastructure for core workflows
**Depends on**: Nothing (parallel track)
**Requirements**: TEST-01
**Success Criteria** (what must be TRUE):
  1. E2E test suite runs on Windows CI with WebdriverIO + tauri-driver
  2. Tests validate sync operation (initiate, monitor progress, verify completion)
  3. Tests validate checkout operation (select file, checkout, verify status change)
  4. Tests validate submit operation (create CL description, submit, verify success)
  5. Tests validate revert operation (revert file, verify status restored)
**Plans**: 3 plans

Plans:
- [x] 09-01-PLAN.md — E2E infrastructure setup + data-testid attributes
- [x] 09-02-PLAN.md — E2E test specs for all core workflows
- [x] 09-03-PLAN.md — Pre-seed P4 connection settings for automated test startup

#### Phase 10: Bug Fixes
**Goal**: Stabilize existing features before adding new complexity
**Depends on**: Nothing (touches existing code)
**Requirements**: BUGF-01, BUGF-02, BUGF-03, BUGF-04, RFSH-02
**Success Criteria** (what must be TRUE):
  1. User can drag files between changelists reliably without UI freezing or files disappearing
  2. User can edit default CL description and files automatically move to a new numbered CL
  3. User can unshelve files to a specific numbered CL (not forced to default)
  4. User sees resolve dialog immediately after unshelving conflicting files
  5. User can manually refresh workspace state via toolbar button
**Plans**: 2 plans

Plans:
- [x] 10-01-PLAN.md — Fix drag-drop reliability, default CL file movement, refresh button
- [x] 10-02-PLAN.md — Fix unshelve target CL + resolve detection after unshelve

#### Phase 11: Auto-Refresh + Settings
**Goal**: Configurable periodic polling with smart operation gating
**Depends on**: Phase 10 (relies on stable query infrastructure)
**Requirements**: RFSH-01, STNG-01, STNG-02
**Success Criteria** (what must be TRUE):
  1. Workspace state auto-refreshes at user-configurable interval (default 5m)
  2. Auto-refresh pauses automatically during active operations (sync, submit, etc.)
  3. Auto-refresh pauses when window is minimized or inactive
  4. User can configure external editor path in settings dialog
  5. User can configure auto-refresh interval in settings dialog (or disable entirely)
**Plans**: 2 plans

Plans:
- [x] 11-01-PLAN.md — Settings schema extension + useWindowFocus hook + auto-refresh query wiring
- [x] 11-02-PLAN.md — Tauri dialog plugin + SettingsDialog UI (editor path, auto-refresh interval)

#### Phase 11.1: Unified Three-Column Layout (INSERTED)
**Goal**: Revamp main window to three-column layout (file tree | detail pane | changelists) with selection-driven detail views
**Depends on**: Phase 11 (needs stable auto-refresh and settings infrastructure)
**Requirements**: Design doc: `.planning/design/unified-column-layout.md`
**Success Criteria** (what must be TRUE):
  1. Main window uses three-column layout: file tree (left), detail pane (center), changelists (right)
  2. Detail pane shows contextual content based on selection (file detail, CL detail, revision detail, workspace summary)
  3. Breadcrumb navigation in detail pane with back stack (max ~3 levels)
  4. File history displays inline in file detail view (replaces FileHistoryDialog)
  5. Column widths are resizable and persist across sessions
**Plans**: 5 plans

Plans:
- [x] 11.1-01-PLAN.md — Selection store + three-column layout skeleton
- [x] 11.1-02-PLAN.md — WorkspaceSummaryView + FileDetailView with inline history
- [x] 11.1-03-PLAN.md — ChangelistDetailView + RevisionDetailView
- [x] 11.1-04-PLAN.md — Breadcrumb navigation + wire side column selections
- [x] 11.1-05-PLAN.md — Column width persistence + cleanup + visual verification

#### Phase 12: Search Filtering & Results
**Goal**: In-place search filtering of file tree and changelist columns with command palette for deep searches
**Depends on**: Phase 11.1 (relies on three-column layout with detail pane)
**Requirements**: SRCH-01, SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):
  1. Typing in toolbar search filters file tree (left column) and changelists (right column) in-place
  2. Filtered columns show match count badges and subtle background tint
  3. Pressing Escape or clearing search restores unfiltered state
  4. Command palette provides "Search submitted changelists" and "Search depot" for deep searches
**Plans**: 4 plans

Plans:
- [x] 12-01-PLAN.md — Search filter store + rewire SearchBar for in-place filtering
- [x] 12-02-PLAN.md — Wire fuzzy filtering into FileTree and ChangelistPanel (dim/highlight)
- [x] 12-03-PLAN.md — Command palette deep search commands + detail pane search results
- [x] 12-04-PLAN.md — Visual polish (tint, result-click dismiss) + verification checkpoint

#### Phase 13: Workspace & Stream Switching
**Goal**: Fast switching between workspaces and streams without modal dialogs
**Depends on**: Phase 11 (needs auto-refresh pausing during switch operations)
**Requirements**: WKSP-01, WKSP-02, WKSP-03, STRM-01, STRM-02
**Success Criteria** (what must be TRUE):
  1. User sees list of available workspaces in header dropdown
  2. User can switch to different workspace and UI refreshes with new workspace files
  3. User can view client spec (read-only) in a dialog
  4. User can switch to different stream via header dropdown
  5. Default CL files are automatically shelved when switching streams (prevents work loss)
**Plans**: 5 plans

Plans:
- [ ] 13-01-PLAN.md — Rust backend commands (list streams, get client spec, update client stream)
- [ ] 13-02-PLAN.md — WorkspaceSwitcher component + header label fix
- [ ] 13-03-PLAN.md — StreamSwitcher with shelve confirmation dialog
- [ ] 13-04-PLAN.md — ClientSpecDialog (read-only viewer)
- [ ] 13-05-PLAN.md — Integration polish + verification checkpoint

#### Phase 14: Depot Browser
**Goal**: Full depot hierarchy with lazy loading and file operations
**Depends on**: Phase 13 (reuses workspace context and file operation patterns)
**Requirements**: DPOT-01, DPOT-02
**Success Criteria** (what must be TRUE):
  1. User can browse full depot hierarchy in a tree view (lazy-loaded, one level at a time)
  2. User can expand depot folders without UI freezing (virtualized tree handles 10,000+ files)
  3. User can sync files or folders from depot browser via context menu
  4. User can right-click depot files to access operations (checkout, history, diff)
**Plans**: 3 plans

Plans:
- [ ] 14-01-PLAN.md — Rust backend commands (p4_dirs, p4_depots) + TypeScript invoke wrappers
- [ ] 14-02-PLAN.md — DepotBrowser component + accordion left column layout
- [ ] 14-03-PLAN.md — Context menu operations + detail pane integration + visual verification

#### Phase 15: Resolve Workflow
**Goal**: Conflict detection and external merge tool integration
**Depends on**: Phase 14 (all other features complete, resolve touches multiple areas)
**Requirements**: RSLV-01, RSLV-02
**Success Criteria** (what must be TRUE):
  1. User sees conflict indicator on files needing resolution after sync or unshelve
  2. User can launch external merge tool on conflicted file via context menu
  3. Merge tool waits for user to complete resolution and closes properly
  4. File automatically marked as resolved server-side after merge tool exits successfully
  5. File status updates immediately in UI after resolution completes
**Plans**: TBD

Plans:
- [ ] 15-01: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 09 → 10 → 11 → 12 → 13 → 14 → 15

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 09. E2E Testing Foundation | 0/? | Not started | - |
| 10. Bug Fixes | 2/2 | ✓ Complete | 2026-01-31 |
| 11. Auto-Refresh + Settings | 2/2 | ✓ Complete | 2026-01-31 |
| 11.1 Unified Three-Column Layout | 5/5 | ✓ Complete | 2026-01-31 |
| 12. Search Filtering & Results | 4/4 | ✓ Complete | 2026-02-01 |
| 13. Workspace & Stream Switching | 5/5 | ✓ Complete | 2026-02-01 |
| 14. Depot Browser | 0/? | Not started | - |
| 15. Resolve Workflow | 0/? | Not started | - |
