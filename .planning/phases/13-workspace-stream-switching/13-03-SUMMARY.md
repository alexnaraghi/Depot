---
phase: 13
plan: 03
subsystem: workspace-management
tags: [stream-switching, shelving, ui-component, perforce]
requires: [13-01]
provides:
  - StreamSwitcher dropdown component with shelve safety
  - ShelveConfirmDialog for pre-switch file shelving
  - Stream switching workflow with open file handling
affects: [13-04, 13-05]
tech-stack:
  added: []
  patterns: [dialog-confirmation, pre-action-validation, auto-shelving]
key-files:
  created:
    - src/components/Header/StreamSwitcher.tsx
    - src/components/dialogs/ShelveConfirmDialog.tsx
  modified:
    - src/components/MainLayout.tsx
decisions:
  - title: Auto-shelve to new CL for default changelist files
    rationale: Default changelist cannot be shelved directly, must create numbered CL first
    impact: Requires p4 change + p4 reopen + p4 shelve sequence
  - title: Group files by changelist in confirmation dialog
    rationale: Users need to see which CLs will be shelved before confirming
    impact: Better UX transparency before destructive operation
duration: 6 minutes
completed: 2026-02-01
---

# Phase 13 Plan 03: Stream Switcher with Shelve Safety Summary

**One-liner:** Stream dropdown with pre-switch shelve confirmation and automatic file shelving to new CLs

## What Was Built

Created a complete stream switching workflow that safely handles open files:

1. **StreamSwitcher component** - Dropdown showing current stream with ability to switch
   - Fetches available streams via `invokeP4ListStreams`
   - Displays stream short names (e.g., "main" instead of "//depot/main")
   - Checks for open files via `invokeP4Opened` before switching
   - Triggers confirmation dialog if files are open
   - Executes stream switch via `invokeP4UpdateClientStream`
   - Updates connection state and invalidates queries after switch

2. **ShelveConfirmDialog component** - Confirmation dialog for pre-switch shelving
   - Lists all open files grouped by changelist
   - Shows depot path and action (edit/add/delete) for each file
   - Provides cancel/confirm buttons with loading state
   - Uses Radix Dialog pattern consistent with existing dialogs

3. **Auto-shelving workflow** - Intelligent shelving based on changelist type
   - For default changelist files: Create new numbered CL → Reopen files → Shelve
   - For numbered changelists: Shelve all files in place
   - Handles multiple changelists with files
   - Shows progress via loading spinner on confirm button

4. **MainLayout integration** - Replaced static stream display
   - StreamSwitcher appears after WorkspaceSwitcher in header
   - Hidden when workspace has no stream (classic depot)
   - Consistent styling with existing header components

## Technical Implementation

**Stream switching logic:**
```typescript
// Check for open files
const files = await invokeP4Opened(p4port, p4user, p4client);

if (files.length > 0) {
  // Show confirmation dialog
  setOpenFiles(files);
  setShelveDialogOpen(true);
} else {
  // Switch directly
  await invokeP4UpdateClientStream(workspace, newStream, p4port, p4user);
  // Refresh state
}
```

**Auto-shelve for default CL:**
```typescript
if (clId === 0) {
  const newClId = await invokeP4CreateChange(description, ...);
  await invokeP4Reopen(depotPaths, newClId, ...);
  await invokeP4Shelve(newClId, [], ...);
} else {
  await invokeP4Shelve(clId, [], ...);
}
```

**Dialog grouping:**
- Files grouped by changelist ID using `reduce`
- Default CL (ID 0) shown as "Default Changelist"
- Numbered CLs shown as "CL #NNN"
- Each group shows action and depot path per file

## Key Commits

| Commit | Description | Files |
|--------|-------------|-------|
| f30a040 | Create ShelveConfirmDialog | ShelveConfirmDialog.tsx |
| 9697a43 | Create StreamSwitcher with shelve workflow | StreamSwitcher.tsx |
| 81666fc | Integrate StreamSwitcher into MainLayout | MainLayout.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Testing Notes

**Manual verification needed:**
1. Stream dropdown appears when workspace has a stream
2. Selecting different stream with no open files switches immediately
3. Selecting different stream with open files shows confirmation dialog
4. Dialog lists files grouped by changelist
5. Cancel button closes dialog without switching
6. Confirm button shelves files and switches stream
7. Loading spinner appears during shelve operation
8. Toast notification on successful switch
9. UI refreshes with new stream context after switch
10. Stream dropdown hidden for classic depot workspaces

**Edge cases to verify:**
- Mixed default and numbered CL files (tests multi-CL shelving)
- Shelve failure mid-operation (error handling and rollback)
- Network error during stream switch (error toast)

## Next Phase Readiness

**Dependencies satisfied for:**
- Phase 13-04: Workspace switching can use similar shelve workflow pattern
- Phase 13-05: Stream switching UX complete for workspace onboarding

**API contract established:**
- `invokeP4ListStreams` returns available streams
- `invokeP4UpdateClientStream` updates workspace stream
- `invokeP4Shelve` with empty array shelves all CL files
- `invokeP4Reopen` moves files between changelists

**Patterns established:**
- Pre-action confirmation dialogs with file lists
- Auto-shelving workflow for safe context switches
- Grouped file display by changelist
- Loading states during async operations

## Known Limitations

1. **No undo for stream switch** - Once switched, user must manually switch back
2. **No conflict detection** - Stream switch may fail if workspace out of sync
3. **No progress indication** - Shelving large file sets shows only spinner
4. **No partial shelve** - All open files must be shelved, no selective shelving

## Metrics

- **Components created:** 2
- **API calls integrated:** 5 (list_streams, opened, create_change, reopen, shelve)
- **Lines of code:** ~360
- **Build time:** 9.11s (no performance regression)
