---
phase: 11-auto-refresh-settings
plan: 01
subsystem: data-sync
tags: [tanstack-query, tauri, auto-refresh, settings, window-focus, zustand]

# Dependency graph
requires:
  - phase: 02-state-management
    provides: TanStack Query infrastructure for data fetching
  - phase: 10-bug-fixes
    provides: Query invalidation patterns and optimistic updates
provides:
  - Auto-refresh infrastructure using TanStack Query refetchInterval
  - Window focus tracking hook for Tauri applications
  - Extended settings schema with editorPath and autoRefreshInterval
  - Conditional auto-refresh pausing during operations and window blur
affects:
  - 11-02-settings-ui (will extend SettingsDialog with new fields)
  - 13-workspace-switching (must respect auto-refresh pause during workspace change)
  - 15-resolve-workflow (must pause auto-refresh during merge operations)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Window focus detection via Tauri events (tauri://focus, tauri://blur)
    - Conditional refetchInterval with multi-factor gating (connection + operation + window focus + user preference)
    - Settings helper functions for efficient single-field access without loading full settings

key-files:
  created:
    - src/hooks/useWindowFocus.ts
  modified:
    - src/types/settings.ts
    - src/lib/settings.ts
    - src/components/ChangelistPanel/useChangelists.ts

key-decisions:
  - "Use TanStack Query refetchInterval instead of custom setInterval for auto-refresh"
  - "Pause auto-refresh when currentOperation exists (prevents query invalidation during active operations)"
  - "Default auto-refresh interval of 5 minutes (300000ms) for existing and new users"
  - "Use ?? operator for autoRefreshInterval to preserve 0 value (disabled state)"

patterns-established:
  - "Window focus hook pattern: optimistic true start, cleanup Promise-based event listeners"
  - "Multi-condition auto-refresh gating: isConnected && !currentOperation && isWindowFocused && interval > 0"
  - "Explicit refetchInterval typing: const value: number | false to satisfy TanStack Query v5 types"

# Metrics
duration: 4min
completed: 2026-01-31
---

# Phase 11 Plan 01: Auto-Refresh Settings Summary

**Auto-refresh infrastructure using TanStack Query with conditional pausing during operations, window blur, and configurable 5-minute default interval**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-31T18:41:37Z
- **Completed:** 2026-01-31T18:45:28Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended settings schema with editorPath and autoRefreshInterval fields
- Created useWindowFocus hook tracking Tauri window focus/blur events
- Wired conditional auto-refresh into all changelist queries (changes, opened, shelved)
- Auto-refresh pauses during active operations, window blur, and when disabled (interval = 0)
- Existing users automatically get 5-minute default interval without manual configuration

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend settings schema and persistence layer** - `5914415` (feat)
2. **Task 2: Create useWindowFocus hook and wire auto-refresh into queries** - `09c4f2b` (feat)

## Files Created/Modified
- `src/types/settings.ts` - Added editorPath (string) and autoRefreshInterval (0-600000ms) fields with defaults
- `src/lib/settings.ts` - Extended loadSettings/saveSettings with new fields, added getAutoRefreshInterval() helper
- `src/hooks/useWindowFocus.ts` - React hook tracking Tauri window focus/blur state via 'tauri://focus' and 'tauri://blur' events
- `src/components/ChangelistPanel/useChangelists.ts` - Added auto-refresh logic with refetchInterval based on connection + operation + window focus + user preference

## Decisions Made

**1. Use TanStack Query refetchInterval instead of custom polling**
- Rationale: Built-in feature handles cleanup, pause/resume, error states, and request deduplication automatically
- Impact: Simpler implementation, fewer edge cases, more robust behavior

**2. Pause auto-refresh when currentOperation exists**
- Rationale: Prevents query invalidation mid-operation (e.g., during sync or submit)
- Impact: Cleaner operation flow, no workspace state flicker during long operations
- Implementation: Added useOperationStore hook call for reactive currentOperation tracking

**3. Default auto-refresh interval of 5 minutes**
- Rationale: Balance between keeping data fresh and avoiding excessive server load
- Impact: Existing users get auto-refresh automatically without manual configuration
- Validation: Max 10 minutes (600000ms) to prevent unreasonably long intervals

**4. Use ?? operator for autoRefreshInterval**
- Rationale: Preserve 0 value (disabled state) - || operator would treat 0 as falsy
- Impact: Users can explicitly disable auto-refresh by setting interval to 0
- Pattern: Same as verboseLogging boolean field

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**TypeScript type error with refetchInterval**
- **Problem:** Initial implementation used `isAutoRefreshActive ? autoRefreshInterval : false`, which resulted in type `number | boolean`. TanStack Query v5 expects `number | false` (rejects `true`).
- **Solution:** Extracted explicit typed constant `const refetchIntervalValue: number | false = ...` to satisfy type checker
- **Resolution:** TypeScript compilation succeeded after explicit typing

## Next Phase Readiness

**Ready for Phase 11 Plan 02 (Settings UI):**
- Settings schema and persistence complete with new fields
- Settings UI can now add editorPath and autoRefreshInterval input fields
- File picker button can use getAutoRefreshInterval() for reactive updates after save

**Auto-refresh behavior verified:**
- Default 5-minute interval for all users
- Pauses during operations (relies on useOperationStore.currentOperation)
- Pauses when window is minimized or inactive (via useWindowFocus hook)
- Disabled when interval = 0

**No blockers or concerns.**

---
*Phase: 11-auto-refresh-settings*
*Completed: 2026-01-31*
