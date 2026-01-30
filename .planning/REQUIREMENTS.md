# Requirements: P4Now v3.0

**Defined:** 2026-01-29
**Core Value:** The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive.

## v3.0 Requirements

### Resolve

- [ ] **RSLV-01**: User sees conflict indicator on files needing resolution after sync
- [ ] **RSLV-02**: User can launch external merge tool on conflicted files

### Depot Browser

- [ ] **DPOT-01**: User can browse full depot hierarchy in a tree view
- [ ] **DPOT-02**: User can sync files/folders from depot browser

### Workspace Management

- [ ] **WKSP-01**: User can view list of available workspaces
- [ ] **WKSP-02**: User can switch to a different workspace
- [ ] **WKSP-03**: User can view client spec (read-only)

### Stream Management

- [ ] **STRM-01**: User can switch to a different stream
- [ ] **STRM-02**: Default CL files are auto-shelved when switching streams

### Search

- [ ] **SRCH-01**: User can perform operations on search results via context menu
- [ ] **SRCH-02**: User can click a submitted CL to view its details
- [ ] **SRCH-03**: User can click an author to list their recent changes

### Auto-Refresh

- [ ] **RFSH-01**: Workspace state auto-refreshes at a configurable interval
- [ ] **RFSH-02**: User can manually refresh via button

### Settings

- [ ] **STNG-01**: User can configure external editor
- [ ] **STNG-02**: User can configure auto-refresh interval

### Testing

- [ ] **TEST-01**: E2E test suite validates core workflows (sync, checkout, submit, revert)

### Bug Fixes

- [ ] **BUGF-01**: Changelist drag-and-drop works reliably
- [ ] **BUGF-02**: Editing default CL description moves files to new CL
- [ ] **BUGF-03**: Unshelve places files in same changelist (not default)
- [ ] **BUGF-04**: Resolve dialog appears after unshelving conflicting files

## Future Requirements

### Resolve (v3.x)

- **RSLV-03**: User can accept source/target/merged via context menu
- **RSLV-04**: User can batch-resolve multiple files with same strategy

### Depot Browser (v3.x)

- **DPOT-03**: User can checkout files from depot browser
- **DPOT-04**: User can view file history from depot browser
- **DPOT-05**: User can diff files from depot browser
- **DPOT-06**: User can bookmark common depot paths

### Stream Management (v3.x)

- **STRM-03**: User sees sync size preview before switching streams
- **STRM-04**: Numbered CLs are auto-shelved when switching streams (not just default)

### Search (v3.x)

- **SRCH-04**: Unified omnisearch for files, CLs, users, depot paths

### Auto-Refresh (v3.x)

- **RFSH-03**: Polling pauses when window is inactive
- **RFSH-04**: Visual indicator shows when data was last refreshed
- **RFSH-05**: Files locked by other users are highlighted

## Out of Scope

| Feature | Reason |
|---------|--------|
| Built-in merge/resolve UI | External tools (P4Merge) handle this better |
| Interactive resolve wizard | Modal workflow violates core value |
| Automatic resolve without preview | Dangerous for real conflicts |
| Stream graph visualization | DAG layout extremely complex |
| Workspace spec editing | Advanced operation, easy to break workspace |
| Multi-workspace simultaneous views | State management complexity; fast switching is sufficient |
| Background sync during stream switch | File system inconsistency and race conditions |
| Auto-unshelve after stream switch | Silent conflict risk; manual unshelve is safer |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 09 | Pending |
| BUGF-01 | Phase 10 | Pending |
| BUGF-02 | Phase 10 | Pending |
| BUGF-03 | Phase 10 | Pending |
| BUGF-04 | Phase 10 | Pending |
| RFSH-02 | Phase 10 | Pending |
| RFSH-01 | Phase 11 | Pending |
| STNG-01 | Phase 11 | Pending |
| STNG-02 | Phase 11 | Pending |
| SRCH-01 | Phase 12 | Pending |
| SRCH-02 | Phase 12 | Pending |
| SRCH-03 | Phase 12 | Pending |
| WKSP-01 | Phase 13 | Pending |
| WKSP-02 | Phase 13 | Pending |
| WKSP-03 | Phase 13 | Pending |
| STRM-01 | Phase 13 | Pending |
| STRM-02 | Phase 13 | Pending |
| DPOT-01 | Phase 14 | Pending |
| DPOT-02 | Phase 14 | Pending |
| RSLV-01 | Phase 15 | Pending |
| RSLV-02 | Phase 15 | Pending |

**Coverage:**
- v3.0 requirements: 21 total
- Mapped to phases: 21 ✓
- Unmapped: 0

---
*Requirements defined: 2026-01-29*
*Last updated: 2026-01-29 after roadmap creation*
