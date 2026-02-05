# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-04)

**Core value:** The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive even during network issues or long-running operations.
**Current focus:** v5.0 Large Depot Scale -- Phase 22: Streaming fstat + Progress

## Current Position

Milestone: v5.0 Large Depot Scale
Phase: 22 of 25 (Streaming fstat + Progress) — COMPLETE
Plan: —
Status: Phase 22 verified, ready for Phase 23
Last activity: 2026-02-04 — Phase 22 complete (3/3 plans, 11/11 must-haves verified)

Progress: [████████████████████] 74/74 plans complete (v1-v4) | v5.0: [████░░░░░░] 40% (6/TBD)

## Performance Metrics

**Velocity:**
- Total plans completed: 80 (14 v1.0 + 17 v2.0 + 27 v3.0 + 16 v4.0 + 6 v5.0)
- Quick tasks completed: 10 (007 partial)
- Average duration: 5 min
- Total execution time: ~530 min (104 v1.0 + ~112 v2.0 + 160 v3.0 + 36 quick + 94 v4.0 + 24 v5.0)

**By Phase (v4.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 16 | 3 | 14 min | 5 min |
| 17 | 3 | 41 min | 14 min |
| 18 | 3 | 14 min | 5 min |
| 19 | 2 | 9 min | 5 min |
| 20 | 5 | 16 min | 3 min |

**By Phase (v5.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 21 | 3 | 12 min | 4 min |
| 22 | 3 | 10 min | 3 min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

**v5.0 Roadmap Decisions:**
- Phase 21 (Foundation): ProcessManager tokio support + debounce hook. Zero dependencies, unblocks all streaming work.
- Phase 22 (Streaming): Highest-impact change. Generalizes proven p4_sync Channel pattern to p4_fstat.
- Phase 23 (Search): nucleo-powered FileIndex on Rust side. Depends on streaming data pipeline from Phase 22.
- Phase 24 (Tree): Incremental tree builder + delta refresh. Soft dependency on Phase 22 (can overlap with 23).
- Phase 25 (Batch): N+1 shelved query fix. Independent of streaming pipeline, depends only on Phase 21.

**21-01 Decisions:**
- Migrated from std::process to tokio::process for non-blocking async execution
- Added explicit .wait().await after every .kill().await to prevent zombie processes
- Changed streaming tasks from std::thread::spawn to tokio::spawn

**21-02 Decisions:**
- Preserved std::process::Command inside spawn_blocking for merge tool (intentional blocking)
- Updated all p4 commands to tokio::process with .output().await
- Migrated p4_sync streaming from std::thread::spawn to tokio::spawn

**22-01 Decisions:**
- Batch size of 100 files for balance between first-batch latency and IPC overhead
- Inline filtering of deleted-at-head files during parsing reduces payload by ~10-20%
- Explicit completion signal with total count for frontend progress indicators
- Separate stdout/stderr tokio tasks for parallel processing without blocking

**22-02 Decisions:**
- Use isStreaming state to prevent concurrent streams during active loading
- Update query cache with new array references via spread operator (TanStack Query v5 API)
- Disable refetchOnWindowFocus during streaming to prevent conflicts
- Estimate total files: first batch = 10% of total, refine when approaching 90%

**22-03 Decisions:**
- Extract file count from operation messages via regex for cleaner UI display
- Display format "X files (Y%)" shows both absolute and relative progress

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
- Research summary: `.planning/research/SUMMARY.md`
- Key pitfalls: zombie processes, channel backpressure, TanStack Query race conditions, structural sharing breaks, batch error isolation

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
Stopped at: Phase 22 complete, ready for Phase 23
Resume file: None

---
**v4.0 Road to P4V Killer — COMPLETE:**
- Phase 16: File Content Viewer
- Phase 17: File Annotations
- Phase 18: Table Stakes UI Features
- Phase 19: Submit Enhancement
- Phase 20: Bug Fixes & UI Polish (12/12 verified)
