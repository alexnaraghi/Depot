---
phase: 15-resolve-workflow
plan: 02
subsystem: ui
tags: [react, typescript, tanstack-query, merge, resolve]

# Dependency graph
requires:
  - phase: 15-01-resolve-backend
    provides: Backend commands for resolve operations
  - phase: 11.1-three-column-layout
    provides: FileDetailView component for conflict banner
  - phase: 10-critical-bugfixes
    provides: File operation hooks and query invalidation patterns
provides:
  - useResolve hook with conflict detection and resolve operations
  - useUnresolvedFiles TanStack Query hook for conflict state
  - Conflict banner in FileDetailView with resolve action buttons
  - ResolveBlockingOverlay for merge tool execution
  - ResolveConfirmDialog for destructive resolve confirmations
  - Context menu resolve integration
  - Submit blocking for changelists with unresolved files
affects: [future-batch-resolve, conflict-history]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useUnresolvedFiles TanStack Query hook with no auto-refetch (manual refresh only)"
    - "ResolveBlockingOverlay prevents UI interaction during merge tool execution"
    - "ResolveConfirmDialog with destructive styling for Accept Theirs"
    - "Query invalidation after resolve: opened, changes, unresolved, fileTree"

key-files:
  created:
    - src/hooks/useResolve.ts
    - src/components/dialogs/ResolveBlockingOverlay.tsx
    - src/components/dialogs/ResolveConfirmDialog.tsx
  modified:
    - src/types/p4.ts
    - src/components/DetailPane/FileDetailView.tsx
    - src/components/shared/FileContextMenuItems.tsx
    - src/components/FileTree/FileContextMenu.tsx
    - src/components/FileTree/FileNode.tsx
    - src/components/FileTree/FileTree.tsx
    - src/components/ChangelistPanel/ChangelistContextMenu.tsx
    - src/components/ChangelistPanel/ChangelistPanel.tsx

key-decisions:
  - "Conflict detection via useUnresolvedFiles TanStack Query hook (no auto-refetch, manual refresh only)"
  - "Yellow conflict banner in FileDetailView with Launch Merge Tool, Accept Theirs, Accept Yours buttons"
  - "ResolveBlockingOverlay prevents UI interaction during merge tool execution"
  - "ResolveConfirmDialog with destructive styling for Accept Theirs"
  - "Context menu Resolve... item at top with yellow text for conflicted files"
  - "Submit blocking via toast error (soft block, not disabled button)"
  - "Query invalidation after resolve: opened, changes, unresolved, fileTree"

patterns-established:
  - "Conflict detection: useUnresolvedFiles hook provides query data and isFileUnresolved(depotPath) helper"
  - "Blocking overlay: prevent onInteractOutside and onEscapeKeyDown during blocking operations"
  - "Merge tool flow: show overlay → launch tool → on exit code 0 show confirm dialog → on confirm call resolve"
  - "Quick resolve flow: show confirm dialog → on confirm call resolve with mode"
  - "Submit blocking: check unresolved files, show toast with count, prevent submit"

# Metrics
duration: 7min
completed: 2026-02-01
---

# Phase 15 Plan 02: Resolve Frontend UI Summary

**Complete resolve workflow UI: conflict detection with TanStack Query, yellow conflict banner in FileDetailView, merge tool launching with blocking overlay, quick resolve with confirmation dialogs, context menu integration, and submit blocking for unresolved files**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-01T23:48:21Z
- **Completed:** 2026-02-01T23:55:09Z
- **Tasks:** 3 (2 auto tasks + 1 checkpoint)
- **Files modified:** 11

## Accomplishments
- useResolve hook provides conflict detection via useUnresolvedFiles and resolve operations (launchMergeTool, resolveAccept)
- P4UnresolvedFile type added with depotPath, localPath, headRev, haveRev, resolveAction fields
- Yellow conflict banner renders in FileDetailView with three action buttons
- ResolveBlockingOverlay prevents UI interaction during merge tool execution with Loader2 spinner
- ResolveConfirmDialog handles destructive resolve confirmations with red styling for Accept Theirs
- Context menu shows "Resolve..." item at top with yellow text for conflicted files
- File nodes show AlertTriangle icon overlay for conflicted files
- Submit blocked with toast error when changelist has unresolved files
- Query invalidation after resolve updates all relevant caches (opened, changes, unresolved, fileTree)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useResolve hook, types, and dialog components** - `bc400e5` (feat)
2. **Task 2: Wire conflict UI into FileDetailView, context menus, and submit blocking** - `c4b7750` (feat)
3. **Task 3: Checkpoint - human verification** - User approved

**Plan metadata:** (to be committed after SUMMARY.md creation)

## Files Created/Modified

**Created:**
- `src/hooks/useResolve.ts` - useResolve and useUnresolvedFiles hooks with query management
- `src/components/dialogs/ResolveBlockingOverlay.tsx` - Full-screen blocking overlay during merge tool execution
- `src/components/dialogs/ResolveConfirmDialog.tsx` - Reusable confirmation dialog for resolve actions

**Modified:**
- `src/types/p4.ts` - Added P4UnresolvedFile interface
- `src/components/DetailPane/FileDetailView.tsx` - Added yellow conflict banner with resolve action buttons
- `src/components/shared/FileContextMenuItems.tsx` - Added "Resolve..." menu item for conflicted files
- `src/components/FileTree/FileContextMenu.tsx` - Wired onResolve callback to navigate to file detail
- `src/components/FileTree/FileNode.tsx` - Added AlertTriangle overlay icon for conflicted files
- `src/components/FileTree/FileTree.tsx` - Added onResolve prop handling
- `src/components/ChangelistPanel/ChangelistContextMenu.tsx` - Added onResolve prop
- `src/components/ChangelistPanel/ChangelistPanel.tsx` - Submit blocking for unresolved files

## Decisions Made

1. **No auto-refetch for unresolved files query** - Conflicts are detected only on manual refresh, sync, or unshelve. No automatic background polling to avoid surprising users with status changes while idle.

2. **Soft block for submit** - Submit shows toast error with file count instead of disabling button. Maintains consistency with other blocking patterns and provides clear feedback.

3. **Confirmation after merge tool exit** - Shows ResolveConfirmDialog after merge tool exits with code 0 asking "Accept merged result?" to prevent auto-accepting when user cancelled or didn't save (addresses research pitfall #5).

4. **Destructive styling for Accept Theirs** - Red/destructive button styling and warning message "This will discard your local changes" to prevent accidental data loss.

5. **Context menu Resolve... at top** - Positioned above Checkout/Revert with yellow text color and separator after for visual prominence.

6. **Query invalidation scope** - After any resolve operation, invalidate opened (file status), changes (changelist state), unresolved (conflict state), and fileTree (tree visualization) for complete UI refresh.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Users must set P4MERGE environment variable to their merge tool path before using "Launch Merge Tool" button. The backend command provides descriptive error if not set (handled in plan 15-01).

## Next Phase Readiness

Phase 15 is now complete. Resolve workflow is fully functional:
- Conflicts are detected via useUnresolvedFiles hook
- Conflicted files show yellow warning icon in file tree
- FileDetailView shows conflict banner with resolve options
- Launch Merge Tool spawns external tool with blocking overlay
- Accept Theirs/Yours show confirmation before executing
- Submit is blocked for changelists with unresolved files
- All queries invalidated after resolution completes

**No blockers.** The resolve workflow is end-to-end functional.

**Phase 15 complete.** This was the final phase in the v3.0 Daily Driver milestone.

---
*Phase: 15-resolve-workflow*
*Completed: 2026-02-01*
