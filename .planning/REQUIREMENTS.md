# Requirements: P4Now v4.0 Road to P4V Killer

**Defined:** 2026-02-03
**Core Value:** The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive.

## v4.0 Requirements

Requirements for P4V parity milestone. Each maps to roadmap phases.

### File Content Viewer

- [x] **VIEWER-01**: User can view file content at any revision in detail pane
- [x] **VIEWER-02**: File content is syntax highlighted based on file extension
- [x] **VIEWER-03**: Large files show size warning with option to load anyway

### File Annotations (Blame)

- [x] **BLAME-01**: User can view per-line author, revision, and date for a file
- [x] **BLAME-02**: User can click annotation to view that revision's changelist
- [x] **BLAME-03**: User can navigate annotations with keyboard (up/down between changes)
- [x] **BLAME-04**: Annotations show age heatmap coloring (recent = hot, old = cold)
- [x] **BLAME-05**: User can hover annotation to see full commit message tooltip
- [x] **BLAME-06**: User can "blame prior revision" to peel back history layers

### Workspace Sync Status

- [x] **SYNC-01**: File tree shows icon overlay indicating out-of-date files
- [x] **SYNC-02**: Sync status compares have-rev vs head-rev
- [x] **SYNC-03**: Sync status visible in tree without expanding folders

### Submit Dialog Preview

- [ ] **SUBMIT-01**: Submit action shows preview dialog before executing
- [ ] **SUBMIT-02**: Preview dialog shows changelist description
- [ ] **SUBMIT-03**: Preview dialog shows list of files to be submitted
- [ ] **SUBMIT-04**: User can cancel, edit description, or proceed with submit

### Submitted Changelist File List

- [x] **CLFILE-01**: User can view all files in a submitted changelist
- [x] **CLFILE-02**: Files show action indicators (add, edit, delete, integrate)
- [x] **CLFILE-03**: User can click file to view that revision

## Future Requirements

Deferred to later milestones. Tracked but not in v4.0 roadmap.

### Bookmarks

- **BKMK-01**: User can add bookmark from depot/workspace tree
- **BKMK-02**: User can view bookmarks list in sidebar
- **BKMK-03**: User can remove bookmarks
- **BKMK-04**: Bookmarks persist across sessions

### File Content Viewer (Enhanced)

- **VIEWER-04**: Viewer shows line numbers with selection
- **VIEWER-05**: User can copy file content to clipboard
- **VIEWER-06**: User can open file directly in external editor from viewer

### Workspace Sync Status (Enhanced)

- **SYNC-04**: User can click to sync individual out-of-date file
- **SYNC-05**: User can filter tree to show only out-of-date files

### Submit Dialog (Enhanced)

- **SUBMIT-05**: User can edit description inline in preview dialog
- **SUBMIT-06**: Preview shows diff summary for files

### Submitted Changelist File List (Enhanced)

- **CLFILE-04**: User can filter/search within file list
- **CLFILE-05**: File list virtualized for 1000+ file changelists

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Inline blame gutter mode | High complexity; standard blame view sufficient for v4.0 |
| Bookmark folders/categories | Deferred with all bookmark features |
| Real-time blame updates | Would require file watching; static blame sufficient |
| Blame across renames | p4 annotate -i adds significant complexity |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIEWER-01 | Phase 16 | Complete |
| VIEWER-02 | Phase 16 | Complete |
| VIEWER-03 | Phase 16 | Complete |
| BLAME-01 | Phase 17 | Complete |
| BLAME-02 | Phase 17 | Complete |
| BLAME-03 | Phase 17 | Complete |
| BLAME-04 | Phase 17 | Complete |
| BLAME-05 | Phase 17 | Complete |
| BLAME-06 | Phase 17 | Complete |
| SYNC-01 | Phase 18 | Complete |
| SYNC-02 | Phase 18 | Complete |
| SYNC-03 | Phase 18 | Complete |
| SUBMIT-01 | Phase 19 | Pending |
| SUBMIT-02 | Phase 19 | Pending |
| SUBMIT-03 | Phase 19 | Pending |
| SUBMIT-04 | Phase 19 | Pending |
| CLFILE-01 | Phase 18 | Complete |
| CLFILE-02 | Phase 18 | Complete |
| CLFILE-03 | Phase 18 | Complete |

**Coverage:**
- v4.0 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

**Phase breakdown:**
- Phase 16 (File Content Viewer): 3 requirements
- Phase 17 (File Annotations): 6 requirements
- Phase 18 (Table Stakes UI): 6 requirements (3 sync + 3 CL file list)
- Phase 19 (Submit Enhancement): 4 requirements

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-03 after roadmap creation*
