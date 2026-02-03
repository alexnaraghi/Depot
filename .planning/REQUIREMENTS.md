# Requirements: P4Now v4.0 Road to P4V Killer

**Defined:** 2026-02-03
**Core Value:** The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive.

## v4.0 Requirements

Requirements for P4V parity milestone. Each maps to roadmap phases.

### File Content Viewer

- [ ] **VIEWER-01**: User can view file content at any revision in detail pane
- [ ] **VIEWER-02**: File content is syntax highlighted based on file extension
- [ ] **VIEWER-03**: Large files show size warning with option to load anyway

### File Annotations (Blame)

- [ ] **BLAME-01**: User can view per-line author, revision, and date for a file
- [ ] **BLAME-02**: User can click annotation to view that revision's changelist
- [ ] **BLAME-03**: User can navigate annotations with keyboard (up/down between changes)
- [ ] **BLAME-04**: Annotations show age heatmap coloring (recent = hot, old = cold)
- [ ] **BLAME-05**: User can hover annotation to see full commit message tooltip
- [ ] **BLAME-06**: User can "blame prior revision" to peel back history layers

### Workspace Sync Status

- [ ] **SYNC-01**: File tree shows icon overlay indicating out-of-date files
- [ ] **SYNC-02**: Sync status compares have-rev vs head-rev
- [ ] **SYNC-03**: Sync status visible in tree without expanding folders

### Submit Dialog Preview

- [ ] **SUBMIT-01**: Submit action shows preview dialog before executing
- [ ] **SUBMIT-02**: Preview dialog shows changelist description
- [ ] **SUBMIT-03**: Preview dialog shows list of files to be submitted
- [ ] **SUBMIT-04**: User can cancel, edit description, or proceed with submit

### Submitted Changelist File List

- [ ] **CLFILE-01**: User can view all files in a submitted changelist
- [ ] **CLFILE-02**: Files show action indicators (add, edit, delete, integrate)
- [ ] **CLFILE-03**: User can click file to view that revision

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
| VIEWER-01 | — | Pending |
| VIEWER-02 | — | Pending |
| VIEWER-03 | — | Pending |
| BLAME-01 | — | Pending |
| BLAME-02 | — | Pending |
| BLAME-03 | — | Pending |
| BLAME-04 | — | Pending |
| BLAME-05 | — | Pending |
| BLAME-06 | — | Pending |
| SYNC-01 | — | Pending |
| SYNC-02 | — | Pending |
| SYNC-03 | — | Pending |
| SUBMIT-01 | — | Pending |
| SUBMIT-02 | — | Pending |
| SUBMIT-03 | — | Pending |
| SUBMIT-04 | — | Pending |
| CLFILE-01 | — | Pending |
| CLFILE-02 | — | Pending |
| CLFILE-03 | — | Pending |

**Coverage:**
- v4.0 requirements: 19 total
- Mapped to phases: 0
- Unmapped: 19

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-03 after initial definition*
