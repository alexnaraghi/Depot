# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-04)

**Core value:** The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive even during network issues or long-running operations.
**Current focus:** v5.0 Large Depot Scale

## Current Position

Milestone: v5.0 Large Depot Scale
Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-04 — Milestone v5.0 started

Progress: [████████████████████] 74/74 plans complete (v1.0: 14, v2.0: 17, v3.0: 27, v4.0: 16)

## Performance Metrics

**Velocity:**
- Total plans completed: 74 (14 v1.0 + 17 v2.0 + 27 v3.0 + 16 v4.0)
- Quick tasks completed: 10 (007 partial)
- Average duration: 5 min
- Total execution time: ~506 min (104 v1.0 + ~112 v2.0 + 160 v3.0 + 36 quick + 94 v4.0)

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
| 20 | 5 | 16 min | 3 min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

**v4.0 Phase Structure:**
- Phase 16 (Foundational): File Content Viewer enables submit preview, addresses p4_print tech debt
- Phase 17 (Complex): File Annotations has most requirements (6), establishes long-running command patterns
- Phase 18 (Quick wins): Sync Status + CL File List, addresses p4_describe tech debt
- Phase 19 (Enhancement): Submit Preview with action badges - COMPLETE

**Quick Task 009 Decisions:**
- Backend: Return Ok(vec![]) for CLs without shelved files instead of Err
- Backend: Check stderr for "no shelved files" patterns before treating as error
- Backend: Add -s flag to p4 describe to suppress diffs for performance
- Frontend: Catch errors in queryFn and return [] instead of throwing
- Frontend: Set retry: 1 to reduce from default 3 retries

### Pending Todos

19 pending — see `.planning/todos/pending/`
- 7 from previous sessions
- 8 new from testing (2026-02-03): connection dialog, shelve/unshelve UI, CL details regression, depot disappearing, toolbar context, client spec error, toolbar layout, async loading indicators
- 1 new: Add standard file menu bar (File, Edit, View, Help)
- 1 new: Fix workspace dropdown selecting wrong workspace
- 1 new: Rename app from p4now to Depot
- 1 new: Prepare repository for public GitHub publish

### Blockers/Concerns

None

**Research notes:**
- Large depot scalability analysis: `reports/large-depot-scalability-analysis.md`
- 12 issues identified, P0+P1 (7 issues) scoped for v5.0
- Key insight: Use p4 have + p4 files (not p4 fstat) for sync status (10-100x faster)
- Key insight: Use tokio::process::Command to avoid blocking async runtime
- Key insight: Build Rust-side file index for instant workspace search

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 005 | Fix detail pane selection and CL click behavior | 2026-02-01 | 1c7a040 | [005-fix-detail-pane-selection-and-cl-click](./quick/005-fix-detail-pane-selection-and-cl-click/) |
| 006 | Architecture report short-term fixes | 2026-02-02 | 9b2e63b | [006-architecture-report-short-term-fixes](./quick/006-architecture-report-short-term-fixes/) |
| 007 | Address "now" architecture improvements | 2026-02-02 | e481331 | [007-address-now-architecture-improvements](./quick/007-address-now-architecture-improvements/) |
| 008 | Large depot scalability analysis | 2026-02-03 | 584ef65 | [008-analyze-large-depot-scalability-report](./quick/008-analyze-large-depot-scalability-report/) |
| 009 | Fix shelved file lists not showing up | 2026-02-04 | cdb4d35 | [009-shelved-file-lists-still-do-not-show-up-](./quick/009-shelved-file-lists-still-do-not-show-up-/) |

## Session Continuity

Last session: 2026-02-04
Stopped at: Starting v5.0 Large Depot Scale milestone
Resume file: None

---
**v4.0 Road to P4V Killer — COMPLETE:**
- Phase 16: File Content Viewer
- Phase 17: File Annotations
- Phase 18: Table Stakes UI Features
- Phase 19: Submit Enhancement
- Phase 20: Bug Fixes & UI Polish (12/12 verified)
