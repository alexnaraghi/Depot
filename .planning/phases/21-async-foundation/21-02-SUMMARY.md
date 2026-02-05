---
phase: 21-async-foundation
plan: 02
subsystem: backend
tags: [tokio, async, rust, process-management]

# Dependency graph
requires:
  - phase: 21-01
    provides: ProcessManager and process.rs migrated to tokio::process
provides:
  - All p4 handler commands using tokio::process::Command for non-blocking execution
  - apply_connection_args updated to accept tokio::process::Command
  - p4_sync using tokio::spawn for async streaming
  - update_changelist_description as async function
affects: [22-streaming, 23-search, 24-tree, 25-batch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All p4 commands execute via tokio::process::Command with .await for non-blocking I/O"
    - "Helper functions (apply_connection_args, update_changelist_description) use tokio types"
    - "Stream readers use tokio::spawn with AsyncBufReadExt for line-by-line processing"

key-files:
  created: []
  modified:
    - src-tauri/src/commands/p4/parsing.rs
    - src-tauri/src/commands/p4/p4handlers.rs

key-decisions:
  - "Preserved std::process::Command inside spawn_blocking for merge tool (intentional blocking)"
  - "Updated all p4 commands to tokio::process with .output().await"
  - "Migrated p4_sync streaming from std::thread::spawn to tokio::spawn"

patterns-established:
  - "tokio::process::Command for all p4 CLI operations"
  - "AsyncBufReadExt for streaming line-by-line output"
  - "tokio::spawn for background streaming tasks"

# Metrics
duration: 5min
completed: 2026-02-05
---

# Phase 21 Plan 02: p4handlers Async Migration Summary

**All p4 commands migrated to tokio::process::Command with non-blocking async execution, completing full async foundation for v5.0**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-05T02:32:04Z
- **Completed:** 2026-02-05T02:37:13Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Migrated all 42+ p4 command invocations from std::process::Command to tokio::process::Command
- Updated apply_connection_args helper to accept tokio::process::Command
- Converted p4_sync streaming from blocking std::thread::spawn to async tokio::spawn
- Made update_changelist_description async with proper tokio process execution
- Zero remaining blocking p4 operations (except intentional spawn_blocking for merge tool)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update apply_connection_args and migrate p4handlers.rs to tokio::process** - `0e864a6` (feat)

## Files Created/Modified
- `src-tauri/src/commands/p4/parsing.rs` - Updated apply_connection_args signature to tokio::process::Command, made update_changelist_description async
- `src-tauri/src/commands/p4/p4handlers.rs` - Migrated all p4 commands to tokio::process::Command, replaced std::thread::spawn with tokio::spawn in p4_sync

## Decisions Made

**Preserved std::process::Command in merge tool:**
- launch_merge_tool intentionally uses std::process::Command inside spawn_blocking
- Merge tools require blocking wait for user interaction - correct design
- All other p4 operations use tokio::process::Command

**Streaming migration:**
- Replaced std::thread::spawn with tokio::spawn in p4_sync
- Updated from std::io::BufRead to tokio::io::AsyncBufReadExt
- Changed from .lines().map_while(Result::ok) to .lines().next_line().await

**Helper function async:**
- update_changelist_description changed to async fn
- All callers updated to .await the result
- Uses tokio::io::AsyncWriteExt for stdin writes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - migration was straightforward. All .output() calls needed .await, all .write_all() calls needed .await, streaming tasks needed tokio::spawn.

## Next Phase Readiness

Async foundation complete. All p4 operations are non-blocking:
- ProcessManager uses tokio::process (21-01)
- All p4 handlers use tokio::process (21-02)
- Ready for Phase 22 (streaming) to leverage async foundation
- Ready for Phase 23 (search) concurrent operations
- Ready for Phase 24 (tree) non-blocking updates
- Ready for Phase 25 (batch) parallel queries

No blockers. System is fully async end-to-end.

---
*Phase: 21-async-foundation*
*Completed: 2026-02-05*
