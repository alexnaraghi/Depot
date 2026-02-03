# Roadmap: P4Now

## Milestones

- ✅ **v1.0 MVP** - Phases 01-02 (shipped 2026-01-28)
- ✅ **v2.0 Feature Complete** - Phases 03-08 (shipped 2026-01-30)
- ✅ **v3.0 Daily Driver** - Phases 09-15 (shipped 2026-02-01)
- 🚧 **v4.0 Road to P4V Killer** - Phases 16-19 (in progress)

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

### 🚧 v4.0 Road to P4V Killer (In Progress)

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
- [ ] 17-01-PLAN.md - Backend p4_annotate command, useFileAnnotations hook, parsing/color utilities
- [ ] 17-02-PLAN.md - FileAnnotationViewer and AnnotationGutter with virtualization and heatmap
- [ ] 17-03-PLAN.md - Interactive features: tooltip, keyboard nav, CL click, blame prior revision

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
**Plans**: TBD

Plans:
- [ ] 18-01: TBD

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
**Plans**: TBD

Plans:
- [ ] 19-01: TBD

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
| 17. File Annotations | v4.0 | 0/3 | Planned | - |
| 18. Table Stakes UI | v4.0 | 0/TBD | Not started | - |
| 19. Submit Enhancement | v4.0 | 0/TBD | Not started | - |
