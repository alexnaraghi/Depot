# Requirements: P4Now

**Defined:** 2026-01-27
**Core Value:** The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive.

## v1 Requirements

Requirements for initial proof of concept. Each maps to roadmap phases.

### Core Operations

- [ ] **CORE-01**: User can sync/get latest changes from depot
- [ ] **CORE-02**: User can submit changes with changelist description
- [ ] **CORE-03**: User can checkout/edit files (mark for editing)
- [ ] **CORE-04**: User can revert changes (discard local modifications)
- [ ] **CORE-05**: User can view pending changelist (modified/checked out files)
- [ ] **CORE-06**: User sees file status indicators (modified, synced, added, etc.)

### Architecture (Non-Blocking UX)

- [x] **ARCH-01**: All p4 commands execute asynchronously (never freeze UI)
- [x] **ARCH-02**: User can cancel any running operation
- [x] **ARCH-03**: Errors are non-modal and recoverable (never trap user in dialog)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Review & History

- **REVW-01**: User can view file history (revision list with descriptions)
- **REVW-02**: User can launch external diff tool for file comparison
- **REVW-03**: User sees streaming progress feedback during long operations

### Workspace & Navigation

- **WORK-01**: User can configure workspace settings in GUI (server, user, client)
- **WORK-02**: User can browse workspace files in tree view

### Advanced Operations

- **ADVN-01**: User can reconcile offline work (detect files modified without checkout)
- **ADVN-02**: User can shelve/unshelve changes

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Admin tools | Not needed for daily developer workflow |
| Depot browser | Focus on local workspace first |
| Built-in diff viewer | External tools (P4Merge, VS Code) handle this better |
| Multi-workspace support | Single workspace keeps POC simple |
| Blame/Annotate view | Advanced feature, defer to later |
| Compare arbitrary revisions | Advanced feature, defer to later |
| Search files | Can use OS file explorer for now |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01 | Phase 1 | Complete |
| ARCH-02 | Phase 1 | Complete |
| ARCH-03 | Phase 1 | Complete |
| CORE-01 | Phase 2 | Pending |
| CORE-02 | Phase 2 | Pending |
| CORE-03 | Phase 2 | Pending |
| CORE-04 | Phase 2 | Pending |
| CORE-05 | Phase 2 | Pending |
| CORE-06 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-27*
*Last updated: 2026-01-28 after Phase 1 completion*
