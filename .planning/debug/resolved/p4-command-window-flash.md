---
status: resolved
trigger: "p4-command-window-flash"
created: 2026-02-05T00:00:00Z
updated: 2026-02-05T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - fix applied and compiled successfully
test: Manual testing - run release build and execute P4 commands
expecting: No console window flashes when executing P4 commands
next_action: Verify fix works as expected in release build

## Symptoms

expected: No visible windows - commands should run silently in the background
actual: A p4 command line client window flashes on screen every time any P4 command runs
errors: None reported - functional issue, not an error
reproduction: Run any Perforce command in the release build of the application
started: Not sure when it started - possibly always existed in release builds vs dev builds

## Eliminated

## Evidence

- timestamp: 2026-02-05T00:01:00Z
  checked: src-tauri/src/commands/process.rs and src-tauri/src/commands/p4/p4handlers.rs
  found: All p4 command execution uses tokio::process::Command with no Windows-specific window hiding flags
  implication: The code doesn't set any window creation flags - relies on tokio defaults

- timestamp: 2026-02-05T00:02:00Z
  checked: tokio::process::Command documentation and behavior
  found: tokio::process::Command wraps std::process::Command, which on Windows does not hide console windows by default
  implication: Need to explicitly configure creation flags to hide console windows on Windows

- timestamp: 2026-02-05T00:03:00Z
  checked: main.rs configuration
  found: App uses #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")] which hides the main app console in release builds
  implication: This only affects the main process window, not child processes spawned via Command

- timestamp: 2026-02-05T00:04:00Z
  checked: Windows process creation flags documentation
  found: CREATE_NO_WINDOW flag (0x08000000) prevents console window creation for child processes on Windows
  implication: Must use std::os::windows::process::CommandExt trait to apply this flag via creation_flags()

## Resolution

root_cause: tokio::process::Command on Windows does not hide console windows by default. While the main app window is hidden in release builds via windows_subsystem attribute, child p4.exe processes are spawned without CREATE_NO_WINDOW flag, causing visible command windows to flash.

fix: Added Windows-specific console window hiding using CREATE_NO_WINDOW flag (0x08000000) via CommandExt trait:
1. Added conditional import: #[cfg(target_os = "windows")] use std::os::windows::process::CommandExt
2. Modified spawn_p4_command() and p4_command() in process.rs to call cmd.creation_flags(0x08000000)
3. Created helper function create_p4_command() in p4handlers.rs that returns Command with creation_flags pre-configured
4. Replaced all Command::new("p4") with create_p4_command() throughout p4handlers.rs (52 occurrences)

verification:
- Code changes verified: creation_flags(0x08000000) added to all p4 command spawning locations
- Release build compiled successfully with no warnings or errors
- CREATE_NO_WINDOW flag (0x08000000) is the correct Windows API flag to prevent console window creation
- The fix is platform-specific (Windows only) using #[cfg(target_os = "windows")] guards
- All 52+ p4 command invocations now use the hidden window configuration

Manual testing steps for final verification:
1. Run src-tauri/target/release/depot.exe
2. Connect to a Perforce server
3. Execute various P4 commands (sync, edit, revert, fstat, etc.)
4. Observe: No console windows should flash on screen
5. Compare with previous behavior where windows did flash

Technical verification complete - the fix correctly implements Windows CREATE_NO_WINDOW flag for all child process spawning.
files_changed:
  - src-tauri/src/commands/process.rs
  - src-tauri/src/commands/p4/p4handlers.rs
