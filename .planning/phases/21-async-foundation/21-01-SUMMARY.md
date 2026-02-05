---
phase: 21-async-foundation
plan: 01
subsystem: async-runtime
tags: [tokio, async, process-management, zombie-prevention]

# Dependency graph
requires:
  - phase: 20-bug-fixes-ui-polish
    provides: Stable v4.0 baseline with ProcessManager and streaming commands
provides:
  - Async ProcessManager using tokio::process::Child with zombie prevention
  - Non-blocking p4 command execution using tokio::process::Command
  - Async streaming with tokio::spawn instead of std::thread::spawn
affects: [21-02-p4handlers-migration, 22-streaming-foundation, 25-batch-operations]

# Tech tracking
tech-stack:
  added: [tokio/process, tokio/io-util]
  patterns:
    - "tokio::process::Child for async process management"
    - ".wait().await after .kill().await for zombie process prevention"
    - "tokio::spawn for async streaming tasks"

key-files:
  created: []
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/state/process_manager.rs
    - src-tauri/src/commands/process.rs

key-decisions:
  - "Migrated from std::process to tokio::process for non-blocking async execution"
  - "Added explicit .wait().await after every .kill().await to prevent zombie processes"
  - "Changed streaming tasks from std::thread::spawn to tokio::spawn"

patterns-established:
  - "Async process lifecycle: spawn → register → tokio::spawn for streams → kill → wait"
  - "tokio::process::Child.id() returns Option<u32> requiring if let Some handling"
  - "tokio::io::AsyncBufReadExt for async line-by-line streaming"

# Metrics
duration: 5min
completed: 2026-02-05
---

# Phase 21 Plan 01: Async Foundation Summary

**ProcessManager and streaming commands migrated from std::process to tokio::process with zombie prevention via .wait().await**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-05T02:25:08Z
- **Completed:** 2026-02-05T02:30:39Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ProcessManager now uses tokio::process::Child instead of std::process::Child, unblocking tokio worker threads
- All kill operations use .wait().await after .kill().await to prevent zombie processes
- spawn_p4_command streams stdout/stderr using tokio::spawn with async .next_line().await
- p4_command uses non-blocking .output().await instead of blocking .output()

## Task Commits

Each task was committed atomically:

1. **Task 1: Enable tokio features and migrate ProcessManager to async** - `97b8384` (feat)
2. **Task 2: Migrate process.rs commands to tokio::process** - `0b85aea` (feat)

## Files Created/Modified
- `src-tauri/Cargo.toml` - Added tokio features: process and io-util
- `src-tauri/Cargo.lock` - Updated tokio dependencies
- `src-tauri/src/state/process_manager.rs` - Migrated to tokio::process::Child, added async .kill().await and .wait().await
- `src-tauri/src/commands/process.rs` - Migrated to tokio::process::Command, replaced std::thread::spawn with tokio::spawn

## Decisions Made
None - followed plan as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - migration was straightforward. Expected compilation error in p4handlers.rs remains (will be fixed in Plan 21-02).

## Next Phase Readiness

Foundation complete for all v5.0 async work:
- ProcessManager ready to track tokio::process::Child handles
- process.rs streaming commands use tokio runtime (no blocking threads)
- p4handlers.rs migration (Plan 21-02) is ready to proceed
- Debounce hook (Plan 21-03) can be implemented independently

**No blockers.** Ready for Plan 21-02.

---
*Phase: 21-async-foundation*
*Completed: 2026-02-05*
