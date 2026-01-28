---
phase: 02-core-workflows
plan: 03
subsystem: api
tags: [rust, tauri, perforce, p4, command-line, parser]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: ProcessManager for cancellable operations
provides:
  - Typed Tauri commands for 7 core P4 operations (fstat, opened, changes, edit, revert, submit, sync)
  - P4 -ztag output parsing into structured Rust types
  - Event emission for real-time UI updates on file state changes
  - Streaming progress support for sync operations
affects: [02-04-tree-file-list, 02-05-changelist-panel, future-ui-components]

# Tech tracking
tech-stack:
  added: [serde_json for event payloads]
  patterns:
    - P4 -ztag parsing for machine-readable command output
    - Event emission on state-changing operations (edit, revert, submit)
    - Channel-based streaming for long-running operations

key-files:
  created:
    - src-tauri/src/commands/p4.rs
  modified:
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs

key-decisions:
  - "Use p4 -ztag for structured output instead of parsing text"
  - "p4_edit handles both checkout and reopen (move between changelists)"
  - "Emit events on file operations for UI reactivity"
  - "Stream sync progress via Channel for real-time updates"

patterns-established:
  - "P4 command execution pattern: spawn -> parse output -> emit events"
  - "Ztag parsing: HashMap accumulation per record, build struct from fields"
  - "File status derivation from p4 fields (action, haveRev, headRev)"

# Metrics
duration: 3min
completed: 2026-01-28
---

# Phase 2 Plan 3: P4 Backend Commands Summary

**Rust backend with typed Tauri commands for 7 core P4 operations, parsing -ztag output into structured types with event emission for UI reactivity**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-28T04:04:13Z
- **Completed:** 2026-01-28T04:07:21Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Complete backend command layer for core P4 operations
- Structured data parsing from p4 -ztag output format
- Real-time event emission for file state changes
- Streaming progress support for sync operations with cancellation
- All commands properly registered and wired into Tauri

## Task Commits

Each task was committed atomically:

1. **Task 1: Create P4 data structures and fstat command** - `e6369dc` (feat)
2. **Task 2: Add opened, changes, edit, revert commands** - `d14e13e` (feat)
3. **Task 3: Add submit and sync commands, wire up module** - `3de018e` (feat)

## Files Created/Modified

- `src-tauri/src/commands/p4.rs` - Complete P4 command implementation with 7 operations
- `src-tauri/src/commands/mod.rs` - Export p4 module
- `src-tauri/src/lib.rs` - Register all 7 p4 commands in Tauri invoke handler

## Decisions Made

**P4 -ztag parsing strategy:**
- Use -ztag flag for structured output (key-value pairs per line)
- Parse into HashMap per record, then build typed structs
- Avoids fragile text parsing of human-readable output

**p4_edit handles both checkout and reopen:**
- Perforce treats `p4 edit -c <CL>` on already-opened file as reopen
- Single command handles both checkout and move-between-changelists
- Eliminates need for separate p4_reopen command

**Event emission on state changes:**
- p4_edit emits 'file-status-changed' for each opened file
- p4_revert emits 'file-status-changed' for each reverted file
- p4_submit emits 'changelist-submitted' on success
- Enables real-time UI updates without polling

**Sync streaming via Channel:**
- Parse each output line into SyncProgress struct
- Stream progress events as files sync
- Return process ID for cancellation via ProcessManager
- Supports conflict detection (can't clobber writable file)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly with clear requirements.

## User Setup Required

None - no external service configuration required. P4 commands assume p4.exe is in PATH and P4 environment variables are configured (will be handled in settings UI in future plans).

## Next Phase Readiness

**Ready for UI integration:**
- Backend provides all data needed for file tree and changelist UI
- Events enable reactive updates
- Streaming progress supports sync UI

**Blockers/Concerns:**
- Commands assume P4 connection is configured (P4PORT, P4USER, P4CLIENT)
- No validation of P4 connection status yet
- Error handling returns stderr strings - may need structured error types later
- File count in P4Changelist defaults to 0 (needs separate p4 opened -c <CL> query)

**For Phase 2 continuation:**
- Tree view can use p4_fstat for file status
- Changelist panel can use p4_opened and p4_changes
- Operations (edit, revert, submit, sync) are ready for UI binding

---
*Phase: 02-core-workflows*
*Completed: 2026-01-28*
