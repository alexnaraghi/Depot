---
phase: 02-core-workflows
plan: 07
subsystem: sync-workflow
tags: [sync, progress-streaming, conflict-resolution, ui-components]
requires: [02-01-stores, 02-03-backend-commands, 01-02-process-management]
provides:
  - sync-toolbar-component
  - sync-conflict-dialog
  - sync-progress-hook
affects: [02-08-file-tree-integration, 02-09-workspace-view]
tech-stack:
  added: []
  patterns:
    - streaming-progress-via-channel
    - conflict-detection-in-progress-events
    - stateful-hook-with-conflict-state
decisions:
  - id: conflict-stops-sync
    what: Conflicts pause sync and show dialog
    why: User must decide how to handle local vs depot changes
    impact: Prevents data loss from automatic overwrites
  - id: skip-vs-overwrite
    what: Two conflict resolution options (skip or force)
    why: Skip preserves local work, overwrite syncs to depot state
    impact: Users have control over conflict resolution
  - id: progress-in-hook-state
    what: useSync tracks synced/total files count
    why: Toolbar can display progress without prop drilling
    impact: Clean component integration
metrics:
  duration: 3 min
  completed: 2026-01-28
---

# Phase 2 Plan 7: Sync Workflow Summary

**One-liner:** Sync toolbar with real-time progress streaming and conflict resolution dialog for user-controlled depot synchronization.

## What Was Built

### Components Created

1. **useSync hook** (`src/hooks/useSync.ts`)
   - Executes sync operations with `invokeP4Sync`
   - Streams progress events to operation store and output panel
   - Updates file tree store after each file syncs
   - Detects conflicts via `is_conflict` flag in progress events
   - Tracks synced files count and total files for progress display
   - Supports cancellation via `invokeKillProcess`
   - Provides `skipConflict` and `forceSync` for conflict resolution

2. **SyncConflictDialog** (`src/components/dialogs/SyncConflictDialog.tsx`)
   - AlertDialog-based UI for conflict resolution
   - Displays file name, depot path, and server action/revision
   - Two action buttons: Skip (keep local) or Overwrite (force sync)
   - Warning icon and clear messaging about conflict state
   - Dark theme styling matching app design

3. **SyncToolbar** (`src/components/SyncToolbar.tsx`)
   - Sync button with spinning RefreshCw icon during operation
   - Cancel button appears only when sync is running
   - Progress display showing "N / M files" counter
   - Integrates SyncConflictDialog for conflict handling
   - Disabled states during running/cancelling operations

## Key Patterns

**Progress Streaming Flow:**
```
Backend p4_sync → Channel<SyncProgress> → useSync onProgress callback
  → updateMessage (operation store)
  → addOutputLine (output panel)
  → updateFile (file tree store)
  → setSyncedFiles (hook state for progress)
```

**Conflict Detection:**
- Backend detects conflict via P4 output parsing
- Sets `is_conflict: true` in `SyncProgress` event
- Hook stores conflict in state, shows dialog
- User chooses skip or force
- Skip: clears conflict, sync continues
- Force: re-syncs file with `-f` flag

**State Management:**
- Hook maintains local state: `conflict`, `syncedFiles`, `totalFiles`
- Operation store handles: progress, message, cancellation
- File tree store updated per-file as sync progresses

## Integration Points

**Dependencies:**
- `invokeP4Sync` from `@/lib/tauri` (backend bridge)
- `useOperationStore` for progress tracking
- `useFileTreeStore` for updating file revisions
- `AlertDialog` from shadcn/ui for conflict UI

**Export Surface:**
- `useSync` hook: `sync`, `cancel`, `skipConflict`, `forceSync`, status flags
- `SyncToolbar` component: renders toolbar UI
- `SyncConflictDialog` component: renders conflict resolution UI

## Decisions Made

### Conflict Stops Sync
Conflicts pause the sync operation and show a dialog requiring user decision. This prevents automatic overwrites of local changes and gives users control over how to handle conflicts.

**Alternatives considered:**
- Auto-skip conflicts: Too risky, user might lose important local work
- Auto-overwrite: Defeats purpose of conflict detection
- Queue conflicts for batch resolution: More complex, unnecessary for POC

**Chosen:** Stop and ask per-conflict for clarity and safety.

### Skip vs Overwrite Options
Two resolution options: Skip (keep local changes) or Overwrite (force sync from depot). This gives users clear control over each conflict.

**Rationale:** Skip preserves local work in progress, Overwrite syncs to depot state for cases where depot is authoritative.

### Progress in Hook State
The useSync hook tracks `syncedFiles` and `totalFiles` counts internally, exposing them to consumers. This keeps toolbar implementation clean without prop drilling.

**Impact:** SyncToolbar can display progress directly from hook without additional state management.

## Testing Notes

**Manual verification needed:**
1. Sync button triggers sync operation
2. Progress counter updates as files sync
3. Output panel shows file-by-file sync log
4. Cancel button stops sync mid-operation
5. Conflict dialog appears when local edit conflicts with depot
6. Skip option allows continuing sync
7. Overwrite option forces sync of conflicted file

**Edge cases to verify:**
- Empty workspace (no files to sync)
- Large workspace (10,000+ files) - progress streaming performance
- Network interruption during sync
- Multiple conflicts in single sync operation

## Next Phase Readiness

**Ready for:**
- File tree integration (02-08) - can trigger sync from tree context menu
- Workspace view (02-09) - can embed SyncToolbar in main layout

**Blockers/Concerns:**
- Backend `p4_sync` implementation must detect conflicts via P4 output
- Backend must send completion event when sync finishes (currently marked complete immediately after spawn)
- File tree store update assumes file exists in tree (may need to handle new files)

**Future enhancements:**
- Sync specific folders (right-click folder → sync)
- Sync to specific revision
- Preview mode (show what will sync before executing)
- Batch conflict resolution (resolve all conflicts at once)

## Deviations from Plan

None - plan executed exactly as written.

## Files Modified

**Created:**
- `src/hooks/useSync.ts` - Sync hook with progress streaming
- `src/components/dialogs/SyncConflictDialog.tsx` - Conflict resolution dialog
- `src/components/SyncToolbar.tsx` - Sync toolbar component

**Modified:**
- None

## Commits

- `6d55228`: feat(02-07): create useSync hook with progress streaming
- `eeb8ed4`: feat(02-07): create SyncConflictDialog component
- `1a7e43b`: feat(02-07): create SyncToolbar component

---

**Status:** ✅ Complete
**Phase progress:** 7 of 9 plans complete
