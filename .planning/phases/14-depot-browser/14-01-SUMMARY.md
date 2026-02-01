---
phase: 14-depot-browser
plan: 01
subsystem: backend
status: complete
completed: 2026-02-01

requires:
  - phases/13-workspace-stream-switching

provides:
  - p4_dirs Rust command for browsing depot subdirectories
  - p4_depots Rust command for listing depot roots
  - TypeScript wrappers for depot browsing commands

affects:
  - phases/14-depot-browser/14-02 (will use these commands for UI)

tech-stack:
  added: []
  patterns:
    - -ztag output parsing for p4 dirs and depots commands

key-files:
  created:
    - .planning/phases/14-depot-browser/14-01-SUMMARY.md
  modified:
    - src-tauri/src/commands/p4.rs
    - src-tauri/src/lib.rs
    - src/lib/tauri.ts

decisions:
  - id: p4-dirs-empty-result-handling
    what: "Handle 'no such file(s)' errors as empty results"
    why: "Depot paths may not exist or have no subdirectories - this is valid, not an error"
    alternatives: ["Return error to frontend", "Special error type for not found"]
    impact: "Frontend receives empty array instead of error, simplifying UI logic"

  - id: depot-type-field-naming
    what: "Use depot_type instead of type for P4Depot struct field"
    why: "Matches Rust naming conventions and avoids reserved keyword conflicts"
    alternatives: ["Use 'type' and handle with raw identifiers", "Use 'kind' instead"]
    impact: "Consistent with other struct field naming patterns in codebase"

metrics:
  duration: 3 min
  commits: 2
  files_modified: 3
  lines_added: 160

tags: [backend, p4-commands, depot-browsing, rust, typescript]
---

# Phase 14 Plan 01: Backend Commands for Depot Browsing

**One-liner:** Rust commands for p4 dirs and p4 depots with TypeScript wrappers

## Objective

Add backend support for depot browsing by implementing `p4_dirs` and `p4_depots` Tauri commands with their corresponding TypeScript invoke wrappers.

## What Was Built

### Rust Backend Commands (p4.rs)

1. **p4_depots command**
   - Lists all depot roots with name and type
   - Uses `-ztag` output parsing consistent with existing commands
   - Returns `Vec<P4Depot>` with name and depot_type fields
   - Handles connection args via `apply_connection_args` helper

2. **p4_dirs command**
   - Lists immediate subdirectories of a depot path
   - Supports `include_deleted` flag for `-D` option
   - Returns `Vec<String>` of depot directory paths
   - Gracefully handles "no such file(s)" errors as empty results
   - Prevents client reference errors with proper error handling

3. **Supporting structs and functions**
   - `P4Depot` struct with Debug, Clone, Serialize derives
   - `parse_ztag_depots` function for parsing depot list output
   - `build_depot` helper for constructing P4Depot from HashMap
   - `parse_ztag_dirs` function for extracting directory paths

### Command Registration (lib.rs)

- Added `commands::p4_dirs` to invoke_handler
- Added `commands::p4_depots` to invoke_handler
- Placed after `commands::p4_update_client_stream` for logical grouping

### TypeScript Wrappers (tauri.ts)

1. **P4Depot interface**
   ```typescript
   export interface P4Depot {
     name: string;
     depot_type: string;
   }
   ```

2. **invokeP4Depots function**
   - Accepts optional server and user parameters
   - Returns `Promise<P4Depot[]>`
   - Matches Rust signature with camelCase conversion

3. **invokeP4Dirs function**
   - Accepts depotPath, includeDeleted, and optional connection params
   - Returns `Promise<string[]>`
   - Includes comprehensive JSDoc with parameter descriptions

## Implementation Details

### p4_dirs Error Handling

The command handles two types of "not found" scenarios gracefully:
- `"no such file(s)"` - Path doesn't exist in depot
- `"must refer to client"` - Invalid depot path format

Both return empty arrays instead of errors, allowing the UI to handle missing paths naturally.

### -ztag Parsing Pattern

Both commands follow the established pattern:
1. Execute command with `-ztag` flag
2. Parse line-by-line looking for `"... "` prefix
3. Build HashMap of key-value pairs per record
4. Convert HashMap to typed struct on blank line separator
5. Return collected results

### Parameter Naming

TypeScript uses camelCase (`depotPath`, `includeDeleted`) while Rust uses snake_case (`depot_path`, `include_deleted`). Tauri's invoke bridge handles automatic conversion.

## Verification Results

1. **Rust compilation:** `cargo check` passed without errors
2. **TypeScript compilation:** `npx tsc --noEmit` passed without errors
3. **Command registration:** Both commands visible in lib.rs invoke_handler
4. **TypeScript exports:** Both invoke wrappers exported from tauri.ts

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

### Phase 14-02: Depot Browser UI

**Ready:** Backend commands are implemented and tested for compilation.

**Provides:**
- `invokeP4Depots()` for fetching depot roots
- `invokeP4Dirs(path)` for lazy-loading subdirectories
- Type-safe interfaces for depot data

**Note:** Frontend can now call these commands to build the depot browser tree view.

### Technical Debt

None introduced.

### Blockers Resolved

None - this was the first plan in the phase.

## Session Notes

**Execution pattern:** Fully autonomous (no checkpoints)

**Task breakdown:**
1. Task 1: Add Rust commands and register in lib.rs (3 min)
2. Task 2: Add TypeScript wrappers and types (1 min)

**Smooth areas:**
- Followed existing command patterns exactly
- -ztag parsing reused established helpers
- No refactoring needed

**Learning:**
- Depot "Type" field must be capitalized in -ztag parsing
- p4 dirs can fail with client reference errors if path format is wrong
- Empty result handling improves UI resilience

## Commits

1. `8c86148` - feat(14-01): add p4_dirs and p4_depots Rust commands
2. `2b2e7ed` - feat(14-01): add TypeScript invoke wrappers for depot commands
