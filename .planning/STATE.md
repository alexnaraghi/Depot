# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-03)

**Core value:** The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive even during network issues or long-running operations.
**Current focus:** v4.0 Road to P4V Killer - Phase 20 (Bug Fixes & UI Polish)

## Current Position

Milestone: v4.0 Road to P4V Killer
Phase: 20 of 20 (Bug Fixes & UI Polish)
Plan: 0 of ?
Status: NOT PLANNED
Last activity: 2026-02-03 — Phase 20 added (Bug Fixes & UI Polish)

Progress: [████████████████████] 69/69 plans complete (v1.0: 14, v2.0: 17, v3.0: 27, v4.0: 11)

## Performance Metrics

**Velocity:**
- Total plans completed: 69 (14 v1.0 + 17 v2.0 + 27 v3.0 + 11 v4.0)
- Quick tasks completed: 8 (007 partial)
- Average duration: 5 min
- Total execution time: ~488 min (104 v1.0 + ~112 v2.0 + 160 v3.0 + 34 quick + 78 v4.0)

**By Phase (v3.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 09 | 3 | 16 min | 5 min |
| 10 | 2 | 9 min | 5 min |
| 11 | 2 | 9 min | 5 min |
| 11.1 | 5 | 44 min | 9 min |
| 12 | 4 | 38 min | 10 min |
| 13 | 5 | 25 min | 5 min |
| 14 | 3 | 15 min | 5 min |
| 15 | 2 | 10 min | 5 min |

**By Phase (v4.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 16 | 3 | 14 min | 5 min |
| 17 | 3 | 41 min | 14 min |
| 18 | 3 | 14 min | 5 min |
| 19 | 2 | 9 min | 5 min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

**v4.0 Phase Structure:**
- Phase 16 (Foundational): File Content Viewer enables submit preview, addresses p4_print tech debt
- Phase 17 (Complex): File Annotations has most requirements (6), establishes long-running command patterns
- Phase 18 (Quick wins): Sync Status + CL File List, addresses p4_describe tech debt
- Phase 19 (Enhancement): Submit Preview with action badges - COMPLETE

**Phase 19 Decisions:**
- Use Dialog instead of AlertDialog for workflow-style submit confirmation
- Extract getActionBadgeColor to shared utility for DRY
- Use drillToFile from detailPaneStore for file navigation from submit dialog

### Pending Todos

17 pending — see `.planning/todos/pending/`
- 7 from previous sessions
- 8 new from testing (2026-02-03): connection dialog, shelve/unshelve UI, CL details regression, depot disappearing, toolbar context, client spec error, toolbar layout, async loading indicators
- 1 new: Add standard file menu bar (File, Edit, View, Help)
- 1 new: Fix workspace dropdown selecting wrong workspace

### Blockers/Concerns

None — v4.0 "Road to P4V Killer" milestone complete!

**Research notes:**
- Use p4 have + p4 files (not p4 fstat) for sync status (10-100x faster)
- Use p4 describe -s to suppress diffs (critical for large CLs)
- New libraries: prism-react-renderer (syntax highlighting, INSTALLED), @tanstack/react-virtual (virtualization, INSTALLED), @radix-ui/react-tooltip (tooltips, INSTALLED)
- Size checks before p4 print and p4 annotate (10MB limits, IMPLEMENTED)
- P4FileInfo struct doesn't include fileSize — parse p4 -ztag fstat directly in frontend hooks
- Lazy tooltip loading pattern: enabled: isOpen for on-demand fetching

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 005 | Fix detail pane selection and CL click behavior | 2026-02-01 | 1c7a040 | [005-fix-detail-pane-selection-and-cl-click](./quick/005-fix-detail-pane-selection-and-cl-click/) |
| 006 | Architecture report short-term fixes | 2026-02-02 | 9b2e63b | [006-architecture-report-short-term-fixes](./quick/006-architecture-report-short-term-fixes/) |
| 007 | Address "now" architecture improvements | 2026-02-02 | e481331 | [007-address-now-architecture-improvements](./quick/007-address-now-architecture-improvements/) |

## Session Continuity

Last session: 2026-02-03
Stopped at: Completed 19-02-PLAN.md (File Click Navigation) - v4.0 MILESTONE COMPLETE
Resume file: None

---
**v4.0 Features Complete** — now stabilizing:
- Phase 16: File Content Viewer ✅
- Phase 17: File Annotations ✅
- Phase 18: Table Stakes UI Features ✅
- Phase 19: Submit Enhancement ✅
- Phase 20: Bug Fixes & UI Polish ← current (11 todos, addressing regressions + UX issues)
