---
phase: 01-non-blocking-foundation
plan: 02
subsystem: infra
tags: [tauri, rust, async, process-management, tokio, channels]

# Dependency graph
requires:
  - phase: 01-01
    provides: Tauri 2.0 scaffold with shell plugin
provides:
  - ProcessManager state for tracking Child handles
  - Tauri commands for process spawning with stdout streaming
  - Process cancellation by ID
  - App close cleanup to prevent zombie processes
affects: [01-03, 01-04, 02-01]

# Tech tracking
tech-stack:
  added: [uuid@1, tokio@1]
  patterns: [async-mutex-for-state, channel-stdout-streaming, windows-taskkill-fallback]

key-files:
  created:
    - src-tauri/src/state/mod.rs
    - src-tauri/src/state/process_manager.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/commands/process.rs
  modified:
    - src-tauri/src/lib.rs
    - src-tauri/Cargo.toml

key-decisions:
  - "tokio::sync::Mutex over std::sync::Mutex for async safety across await points"
  - "Arc wrapper on ProcessManager for Clone support in window event handlers"
  - "Windows taskkill /F /T fallback for reliable process tree killing"
  - "std::thread for blocking IO (pipe reading) to avoid blocking Tauri async runtime"

patterns-established:
  - "Process tracking: register() returns ID, kill(id) removes and terminates"
  - "Channel streaming: spawn background threads to read stdout/stderr and send via Channel"
  - "Window close handler: block_on async cleanup in sync callback"

# Metrics
duration: 10min
completed: 2026-01-28
---

# Phase 01 Plan 02: Async Process Management Summary

**Rust ProcessManager with tokio::sync::Mutex for tracking p4.exe processes, Tauri commands for spawning/killing with Channel-based stdout streaming, and window close cleanup**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-01-28T05:59:00Z
- **Completed:** 2026-01-28T06:09:30Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- ProcessManager state struct with async Mutex for safe process handle tracking
- Tauri commands: spawn_p4_command (streaming), p4_command (blocking), kill_process, kill_all_processes
- Window close event handler triggers cleanup to prevent zombie processes
- Windows-specific taskkill fallback for reliable process tree killing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ProcessManager state** - `994a926` (feat)
2. **Task 2: Create Tauri commands** - `2e25d6e` (feat)
3. **Task 3: Wire up state and commands** - `d6c553d` (feat)

## Files Created/Modified

### Created
- `src-tauri/src/state/mod.rs` - Module exports for state
- `src-tauri/src/state/process_manager.rs` - ProcessManager with async Mutex, register/kill/kill_all methods
- `src-tauri/src/commands/mod.rs` - Module exports for commands
- `src-tauri/src/commands/process.rs` - Tauri commands for process lifecycle

### Modified
- `src-tauri/src/lib.rs` - Registered state and commands, added window close handler
- `src-tauri/Cargo.toml` - Added uuid and tokio dependencies

## Decisions Made

1. **tokio::sync::Mutex over std::sync::Mutex** - Required because we hold the lock across await points in async methods (per RESEARCH.md Pitfall 6)
2. **Arc wrapper on Mutex** - Enables Clone for ProcessManager so it can be shared into window event closure
3. **std::thread for pipe reading** - BufReader::lines() is blocking IO, so we spawn OS threads instead of blocking Tauri's async runtime
4. **Windows taskkill fallback** - child.kill() on Windows doesn't kill child processes; taskkill /F /T /PID ensures full process tree cleanup (per RESEARCH.md Pitfall 1)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Cargo not in PATH** - Same issue as 01-01. The bash environment doesn't have Rust toolchain in PATH. Code was written following Tauri 2.0 patterns from RESEARCH.md. User should verify compilation with `npm run tauri dev` or `cargo check` in their native terminal where Rust is configured.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready:** ProcessManager and commands provide the async infrastructure for non-blocking p4 operations
- **Frontend integration needed:** React hooks to invoke these commands (01-03 scope)
- **Verification recommended:** User should run `npm run tauri dev` and test invoke from DevTools:
  ```javascript
  await window.__TAURI__.core.invoke('p4_command', { args: ['info'] })
  ```
- **Note:** Rust compilation could not be verified in this environment due to cargo PATH issue (same as 01-01)

---
*Phase: 01-non-blocking-foundation*
*Completed: 2026-01-28*
