---
phase: quick-004
plan: 01
subsystem: ui
tags: [logging, output-panel, settings, tauri-plugin-store]

requires:
  - phase: 03-settings
    provides: Settings dialog, tauri-plugin-store persistence
  - phase: 06-shelve-reconcile
    provides: Shelve/unshelve/reconcile hooks
provides:
  - Two-tier output logging for all P4 commands
  - Verbose logging toggle in Settings dialog
  - getVerboseLogging() helper for read-only query gating
affects: []

tech-stack:
  added: []
  patterns:
    - "Two-tier logging: mutating commands always log, read-only commands log only when verbose"
    - "useOperationStore.getState().addOutputLine inside queryFn for non-React contexts"
    - "getVerboseLogging() async check before conditional logging"

key-files:
  created: []
  modified:
    - src/types/settings.ts
    - src/lib/settings.ts
    - src/components/SettingsDialog.tsx
    - src/hooks/useShelvedFiles.ts
    - src/hooks/useReconcile.ts
    - src/hooks/useSearch.ts
    - src/hooks/useFileHistory.ts
    - src/hooks/useDiff.ts
    - src/hooks/useSettings.ts
    - src/hooks/useSync.ts
    - src/components/ChangelistPanel/ChangelistPanel.tsx
    - src/components/ChangelistPanel/EditDescriptionDialog.tsx
    - src/components/ChangelistPanel/CreateChangelistDialog.tsx
    - src/components/ChangelistPanel/ChangelistContextMenu.tsx
    - src/components/ChangelistPanel/useChangelists.ts
    - src/components/FileTree/useFileTree.ts

key-decisions:
  - "D-Q004-01: Two-tier logging with verbose setting gating read-only commands"
  - "D-Q004-02: getVerboseLogging() reads directly from store for use in queryFn contexts"

patterns-established:
  - "Mutating commands: always addOutputLine before invoke and after success/error"
  - "Read-only queries: check getVerboseLogging() in queryFn, log command and result count"

duration: 8min
completed: 2026-01-30
---

# Quick Task 004: Audit/Fix P4 Command Output Logging Summary

**Two-tier output logging: mutating commands always log, read-only commands log when verbose setting enabled via Settings toggle**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-30T04:49:41Z
- **Completed:** 2026-01-30T04:57:00Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments
- Added verboseLogging boolean to settings schema with persistence via tauri-plugin-store
- All mutating P4 commands (shelve, unshelve, delete shelf, reopen, create/edit/delete changelist, reconcile apply) always log command and result to output panel
- All read-only P4 commands (info, fstat, opened, changes, filelog, print, describe shelved, reconcile preview, changes submitted) log only when verbose logging enabled
- Verbose Logging toggle in Settings dialog under new Logging section

## Task Commits

1. **Task 1: Add verbose logging setting with UI toggle** - `31ba75c` (feat)
2. **Task 2: Add logging to all mutating commands** - `b253ce3` (feat)
3. **Task 3: Add verbose-gated logging to read-only commands** - `9c9c609` (feat)

## Files Created/Modified
- `src/types/settings.ts` - Added verboseLogging to schema and defaults
- `src/lib/settings.ts` - Added verboseLogging persistence and getVerboseLogging() helper
- `src/components/SettingsDialog.tsx` - Added Logging section with checkbox toggle
- `src/hooks/useShelvedFiles.ts` - Logging for shelve/unshelve/deleteShelf mutations + verbose for shelved query
- `src/hooks/useReconcile.ts` - Verbose for info/preview queries, always-log for reconcile apply
- `src/components/ChangelistPanel/ChangelistPanel.tsx` - Logging for reopen (DnD) and delete changelist
- `src/components/ChangelistPanel/EditDescriptionDialog.tsx` - Logging for create/edit changelist
- `src/components/ChangelistPanel/CreateChangelistDialog.tsx` - Logging for create changelist
- `src/components/ChangelistPanel/ChangelistContextMenu.tsx` - Logging for reopen (context menu)
- `src/components/ChangelistPanel/useChangelists.ts` - Verbose for changes/opened/describe queries
- `src/components/FileTree/useFileTree.ts` - Verbose for info/fstat queries
- `src/hooks/useSearch.ts` - Verbose for submitted changes query
- `src/hooks/useFileHistory.ts` - Verbose for filelog query
- `src/hooks/useDiff.ts` - Verbose for print-to-file operations
- `src/hooks/useSettings.ts` - Verbose for connection test info query
- `src/hooks/useSync.ts` - Verbose for info query

## Decisions Made
- Two-tier approach: mutating always logs, read-only gated by verbose setting
- getVerboseLogging() reads store directly (async) for use inside queryFn where React hooks unavailable
- useOperationStore.getState() pattern for accessing store outside React component lifecycle

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Output logging complete for all P4 commands
- No blockers

---
*Quick Task: 004-audit-fix-p4-command-output-logging*
*Completed: 2026-01-30*
