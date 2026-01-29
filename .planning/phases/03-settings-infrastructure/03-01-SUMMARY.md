---
phase: 03-settings-infrastructure
plan: 01
subsystem: settings-persistence
tags: [tauri-plugin-store, rust, backend, settings, persistence]
requires: [v1.0-foundation]
provides: [settings-infrastructure, connection-testing, workspace-browsing]
affects: [03-02-settings-ui]
tech-stack:
  added: [tauri-plugin-store, zod, react-hook-form, @hookform/resolvers]
  patterns: [settings-persistence-layer, optional-connection-args]
key-files:
  created:
    - src/types/settings.ts
    - src/lib/settings.ts
    - src/stores/connectionStore.ts
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/lib.rs
    - src-tauri/src/commands/p4.rs
    - src-tauri/capabilities/default.json
    - package.json
    - src/lib/tauri.ts
decisions:
  - id: D-03-01-01
    what: Use tauri-plugin-store for settings persistence
    why: Official Tauri plugin, provides simple key-value store with automatic save
    alternatives: Custom JSON file handling, environment variables only
  - id: D-03-01-02
    what: All P4 commands accept optional connection args
    why: Allows UI to override env vars with saved settings, enables connection testing
    alternatives: Only use env vars, separate commands for settings-based operations
  - id: D-03-01-03
    what: Connection store tracks status with typed state transitions
    why: Clear state machine for connection lifecycle (disconnected/connecting/connected/error)
    alternatives: Boolean flags, untyped state strings
metrics:
  duration: 9
  tasks: 2
  commits: 2
  files-created: 3
  files-modified: 9
completed: 2026-01-29
---

# Phase 03 Plan 01: Settings Persistence Infrastructure Summary

**One-liner:** Settings persistence layer using tauri-plugin-store with Zod validation, connection state management, and backend commands for workspace browsing and connection testing.

## Objective Completed

Set up settings persistence infrastructure and backend commands for Phase 03. Provides the data layer and Rust backend that the settings UI (Plan 02) will consume.

**Result:** tauri-plugin-store integrated, settings types/schema defined with Zod, connection store created with typed state transitions, Rust commands for workspace listing and connection testing, all existing P4 commands updated to accept optional connection args.

## Tasks Completed

### Task 1: Install dependencies and configure tauri-plugin-store
**Status:** ✅ Complete
**Commit:** `b50c3e9`

**What was done:**
- Added tauri-plugin-store to Cargo.toml and registered in lib.rs
- Added store permissions to capabilities/default.json (allow-get, allow-set, allow-save, allow-load)
- Installed frontend dependencies: @tauri-apps/plugin-store, react-hook-form, zod, @hookform/resolvers
- Created settings types with Zod schema (src/types/settings.ts)
- Created settings persistence layer (src/lib/settings.ts) with loadSettings/saveSettings
- Created connection store (src/stores/connectionStore.ts) with typed state transitions

**Files created:**
- src/types/settings.ts - Zod schema and TypeScript types for P4 settings
- src/lib/settings.ts - Load/save settings via tauri-plugin-store
- src/stores/connectionStore.ts - Zustand store for connection status

**Verification:**
- npm run build passed (TypeScript compilation)
- cargo check passed (Rust compilation)

### Task 2: Add Rust backend commands for workspace browsing and connection testing
**Status:** ✅ Complete
**Commit:** `89ceda1`

**What was done:**
- Added P4Workspace struct to represent workspace info (name, root, stream, description)
- Implemented p4_list_workspaces command to query available workspaces for server/user
- Implemented p4_test_connection command to test connection with credentials
- Extracted parse_ztag_info helper for reuse between p4_info and p4_test_connection
- Updated all P4 commands to accept optional connection args (server, user, client):
  - p4_info, p4_fstat, p4_opened, p4_changes, p4_edit, p4_revert, p4_submit, p4_sync
- Updated helper functions (update_changelist_description) to accept connection args
- Registered new commands in lib.rs invoke_handler
- Added frontend invoke wrappers for p4_list_workspaces and p4_test_connection
- Updated all frontend invoke functions to accept optional connection args
- Fixed existing code (useFileTree, useSync) to use wrapped queryFn calls

**Files modified:**
- src-tauri/src/commands/p4.rs - All commands now accept optional connection args
- src-tauri/src/lib.rs - Registered new commands
- src/lib/tauri.ts - Added wrappers for new commands, updated all existing wrappers
- src/components/FileTree/useFileTree.ts - Fixed queryFn wrapper
- src/hooks/useSync.ts - Fixed queryFn wrapper and sync call

**Verification:**
- cargo check passed (Rust compilation with 1 warning about unused method)
- npm run build passed (TypeScript compilation)

## Technical Implementation

### Settings Persistence
**Pattern:** Singleton store instance with lazy initialization
```typescript
let storeInstance: Awaited<ReturnType<typeof load>> | null = null;
async function getStore() {
  if (!storeInstance) {
    storeInstance = await load('settings.json');
  }
  return storeInstance;
}
```

**Schema:** Zod validation for type safety
```typescript
export const settingsSchema = z.object({
  p4port: z.string().min(1, 'Server address is required'),
  p4user: z.string().min(1, 'Username is required'),
  p4client: z.string().min(1, 'Workspace is required'),
});
```

### Connection State Management
**Pattern:** Zustand store with typed state transitions
- States: `disconnected | connecting | connected | error`
- Actions: `setConnecting() | setConnected(info) | setDisconnected() | setError(message)`
- Stores connection metadata: workspace, stream, server, user, errorMessage

### Backend Commands
**Pattern:** Optional connection args on all P4 commands
```rust
pub async fn p4_info(server: Option<String>, user: Option<String>, client: Option<String>) -> Result<P4ClientInfo, String> {
    let mut cmd = Command::new("p4");
    if let Some(s) = &server { cmd.args(["-p", s]); }
    if let Some(u) = &user { cmd.args(["-u", u]); }
    if let Some(c) = &client { cmd.args(["-c", c]); }
    cmd.args(["-ztag", "info"]);
    // ...
}
```

**New Commands:**
- `p4_list_workspaces(server, user)` - Returns Vec<P4Workspace> by parsing p4 clients -ztag output
- `p4_test_connection(server, user, client)` - Returns P4ClientInfo by parsing p4 info -ztag output

**Parsing:** Reusable ztag parsers (parse_ztag_info, parse_ztag_clients) follow same pattern as existing parse_ztag_fstat

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Phase 03 Plan 02 (Settings UI) is ready to proceed:**
- ✅ Settings persistence layer complete
- ✅ Connection store for status tracking complete
- ✅ Backend commands for workspace browsing complete
- ✅ Backend commands for connection testing complete
- ✅ All existing commands accept optional connection args

**Blockers:** None

**Concerns:** None

**Recommendations:**
- Plan 02 should implement settings UI with:
  - Form using react-hook-form + Zod validation
  - "Browse Workspaces" button using p4_list_workspaces
  - "Test Connection" button using p4_test_connection
  - Connection status display using useConnectionStore

## Artifacts Reference

**Settings Infrastructure:**
- Settings schema: `src/types/settings.ts` exports `settingsSchema`, `P4Settings`, `defaultSettings`
- Settings persistence: `src/lib/settings.ts` exports `loadSettings()`, `saveSettings(settings)`
- Connection store: `src/stores/connectionStore.ts` exports `useConnectionStore()`

**Backend Commands:**
- New commands: `p4_list_workspaces(server, user)`, `p4_test_connection(server, user, client)`
- Updated commands: All P4 commands now accept `server?: string, user?: string, client?: string`

**Frontend Wrappers:**
- New: `invokeListWorkspaces(server, user)`, `invokeTestConnection(server, user, client)`
- Updated: All invoke functions accept optional connection args

## Lessons Learned

1. **tauri-plugin-store API:** Removed `autoSave: false` option - not needed in v2 API
2. **TypeScript QueryFn:** Must wrap invoke functions with no-arg lambda when using optional params: `queryFn: () => invokeP4Info()`
3. **Rust Command Pattern:** Optional args pattern works well - if None, omit from command args (falls back to env vars)
4. **Parsing Consistency:** Extracting shared parsing functions (parse_ztag_info) enables reuse and consistency
