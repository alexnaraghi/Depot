---
phase: 15-resolve-workflow
plan: 01
subsystem: backend
tags: [rust, tauri, p4, resolve, merge]

# Dependency graph
requires:
  - phase: 14-depot-browser
    provides: Backend command patterns for p4 operations
provides:
  - Rust Tauri commands for detecting unresolved files
  - Rust Tauri commands for quick resolve (theirs/yours/merge)
  - Rust Tauri command for launching external merge tools with blocking wait
affects: [15-02-resolve-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "tokio::task::spawn_blocking for blocking external process calls"
    - "Temp file extraction pattern for merge tool inputs"

key-files:
  created: []
  modified:
    - src-tauri/src/commands/p4.rs
    - src-tauri/src/lib.rs

key-decisions:
  - "P4MERGE env var with MERGE fallback for merge tool path"
  - "Descriptive error when P4MERGE not set guides users to configuration"
  - "Temp files use timestamp-based unique names to avoid collisions"
  - "Best-effort cleanup of temp files after merge tool exits"

patterns-established:
  - "spawn_blocking pattern: wrap std::process::Command in tokio::task::spawn_blocking for blocking wait"
  - "Resolve field extraction: use p4 fstat -ztag to get resolveBaseFile, resolveFromFile0, and revision fields"

# Metrics
duration: 3min
completed: 2026-02-01
---

# Phase 15 Plan 01: Resolve Backend Commands Summary

**Three Rust Tauri commands for resolve workflow: detect unresolved files via p4 fstat -Ru, accept quick resolve modes, and launch P4MERGE with blocking wait and temp file management**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-01T21:53:49Z
- **Completed:** 2026-02-01T21:57:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- p4_fstat_unresolved command detects files needing resolution via p4 fstat -Ru -Or
- p4_resolve_accept command executes quick resolve with theirs/yours/merge modes
- launch_merge_tool command spawns P4MERGE with blocking wait, temp file extraction, and cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Add p4_fstat_unresolved and p4_resolve_accept commands** - `f1b171c` (feat)
2. **Task 2: Add launch_merge_tool command and register all resolve commands** - `46506cd` (feat)

## Files Created/Modified
- `src-tauri/src/commands/p4.rs` - Added three new Tauri commands with ztag parsing and spawn_blocking pattern
- `src-tauri/src/lib.rs` - Registered p4_fstat_unresolved, p4_resolve_accept, launch_merge_tool in invoke_handler

## Decisions Made

1. **P4MERGE env var with MERGE fallback** - Checks P4MERGE first, then MERGE, providing descriptive error if neither set to guide users to configuration
2. **Timestamp-based temp file names** - Uses SystemTime UNIX timestamp to create unique temp file names for base/theirs extractions, avoiding collisions during concurrent resolves
3. **Best-effort temp cleanup** - Removes temp files after merge tool exits using `let _ = std::fs::remove_file()` pattern (ignores cleanup errors)
4. **spawn_blocking for merge tool wait** - Uses tokio::task::spawn_blocking to wrap std::process::Command for blocking wait without blocking async runtime
5. **resolveAction0 field parsing** - Extracts resolve action from ztag's resolveAction0 field with "merge" as default fallback

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Users must set P4MERGE environment variable to their merge tool path (e.g., `C:\Program Files\Perforce\p4merge.exe`). The launch_merge_tool command provides a descriptive error message if P4MERGE is not set.

## Next Phase Readiness

Backend resolve commands are complete and callable from the frontend. Ready for resolve UI implementation in plan 15-02.

**Key integration points for UI:**
- Call p4_fstat_unresolved() to detect files needing resolution
- Display list with depot paths, local paths, head/have revisions, and resolve action
- Provide quick resolve buttons calling p4_resolve_accept(file, mode) with theirs/yours/merge
- Launch merge tool button calls launch_merge_tool(depot_path, local_path) and awaits exit code

**No blockers.** All commands compile and are registered.

---
*Phase: 15-resolve-workflow*
*Completed: 2026-02-01*
