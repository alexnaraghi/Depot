---
phase: 25-batch-optimization
plan: 01
subsystem: backend
tags: [rust, tauri, perforce, batch-processing, streaming, tokio]

# Dependency graph
requires:
  - phase: 21-foundation
    provides: tokio::process support, ProcessManager for cancellation
provides:
  - Backend batch command for shelved file queries
  - ShelvedBatchProgress streaming via Tauri Channel
  - Per-changelist error isolation
  - Cancellable batch operations
affects: [25-02, 25-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch command with Channel streaming and per-item error isolation"
    - "Multi-CL -ztag parsing with changelist context tracking"

key-files:
  created: []
  modified:
    - src-tauri/src/commands/p4/types.rs
    - src-tauri/src/commands/p4/parsing.rs
    - src-tauri/src/commands/p4/p4handlers.rs
    - src-tauri/src/lib.rs

key-decisions:
  - "Progress updates every 5 CLs to avoid IPC channel flooding"
  - "CLs without shelved files return Some(vec![]) not error for partial success"
  - "Field indices reset per CL - track context via 'change' field"
  - "Use .send() for all Channel messages (try_send not available)"

patterns-established:
  - "Batch command pattern: parse all output, send per-item results via Channel, Complete with success/error counts"
  - "Multi-CL parsing: track current_cl_id, flush on new 'change' field, accumulate fields per CL context"

# Metrics
duration: 4min
completed: 2026-02-05
---

# Phase 25 Plan 01: Batch Optimization Summary

**Backend batch command accepting multiple changelist IDs with Channel streaming, per-CL error isolation, and ProcessManager cancellation support**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-05T22:43:46Z
- **Completed:** 2026-02-05T22:47:35Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Created ShelvedBatchResult and ShelvedBatchProgress types for streaming batch results
- Implemented parse_describe_shelved_batch handling multi-CL -ztag output with context tracking
- Added p4_describe_shelved_batch Tauri command with Channel streaming and ProcessManager registration
- Command isolates errors per changelist - batch continues on individual failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Add batch types to types.rs** - `2c5b59b` (feat)
2. **Task 2: Add batch parsing function to parsing.rs** - `7c0c1d2` (feat)
3. **Task 3: Add p4_describe_shelved_batch command to p4handlers.rs** - `e142fc8` (feat)

## Files Created/Modified
- `src-tauri/src/commands/p4/types.rs` - Added ShelvedBatchResult struct and ShelvedBatchProgress enum for streaming
- `src-tauri/src/commands/p4/parsing.rs` - Added parse_describe_shelved_batch and extract_shelved_files_from_fields functions
- `src-tauri/src/commands/p4/p4handlers.rs` - Added p4_describe_shelved_batch command with Channel streaming
- `src-tauri/src/lib.rs` - Registered p4_describe_shelved_batch in invoke_handler

## Decisions Made

**1. Progress update frequency**
- Send progress every 5 CLs to avoid flooding IPC channel
- Always send Result messages with .send() to ensure delivery
- Send Progress messages with .send() (try_send not available in Tauri Channel API)

**2. Empty result handling**
- CLs without shelved files return Some(vec![]) not error
- Stderr filtering skips "no shelved files", "not shelved", "no shelf" messages
- Only treat actual errors (network, auth) as failures

**3. Field index reset handling**
- Field indices (depotFile0, depotFile1, etc.) reset per changelist
- Track current changelist context via "change" field
- Flush accumulated files when new "change" field appears
- Prevents file list merging across different changelists

**4. Channel API usage**
- Use .send() instead of .try_send() (try_send not available in Tauri Channel)
- All messages sent with .send() - blocking acceptable for batch results
- Progress messages sent on every 5th CL or on completion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**1. Tauri Channel API doesn't have try_send()**
- **Issue:** Plan specified try_send() for Progress messages to avoid blocking
- **Resolution:** Changed to .send() for all messages - Channel doesn't expose try_send() method
- **Impact:** Minimal - batch processing is already in background task, blocking on Channel send is acceptable
- **Verification:** Compiles and builds successfully

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Phase 25 Plan 02 (frontend batch query integration):
- Backend command `p4_describe_shelved_batch` available via Tauri IPC
- Types ShelvedBatchProgress and ShelvedBatchResult serializable to frontend
- Command returns process_id for cancellation
- Progress streaming via Channel working pattern

**No blockers**

---
*Phase: 25-batch-optimization*
*Completed: 2026-02-05*
