---
phase: 20-bug-fixes-and-ui-polish
plan: 01
subsystem: ui
tags: [react, mainlayout, toolbar, accordion, connection-dialog]

# Dependency graph
requires:
  - phase: 18-table-stakes-ui-features
    provides: StreamSwitcher, WorkspaceSwitcher, accordion layout
provides:
  - Corrected toolbar component order (Stream -> Workspace -> Client Spec)
  - Sticky accordion headers that never shrink out of view
  - Smart connection dialog that only opens when appropriate
affects: [future-ui-layout-work]

# Tech tracking
tech-stack:
  added: []
  patterns: [initialCheckDone state for async initialization gates]

key-files:
  created: []
  modified: [src/components/MainLayout.tsx]

key-decisions:
  - "Use initialCheckDone state with 500ms timeout to prevent dialog flash on startup"
  - "Add flex-shrink-0 to accordion headers to prevent flex layout from shrinking them"

patterns-established:
  - "Initial connection check pattern: track when connection attempt completes before showing UI errors"

# Metrics
duration: 4min
completed: 2026-02-04
---

# Phase 20 Plan 01: MainLayout Bug Fixes Summary

**Fixed toolbar component order, accordion header visibility, and connection dialog auto-open logic in MainLayout**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-04T05:00:24Z
- **Completed:** 2026-02-04T05:04:46Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Toolbar now displays in correct order: Stream, Workspace, Client Spec (left to right)
- Accordion section headers always remain visible regardless of content size
- Connection dialog only opens when no saved connection exists or connection attempt fails (no more flashing on startup)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix toolbar order and accordion headers** - `2d01909` (fix)
2. **Task 2: Fix connection dialog auto-open logic** - `3460e14` (fix)

## Files Created/Modified
- `src/components/MainLayout.tsx` - Fixed toolbar order, accordion headers, and connection dialog logic

## Decisions Made

**1. Use initialCheckDone state pattern for connection dialog**
- Added state to track when connection initialization completes
- Wait for connectionStatus to become 'connecting' OR 500ms timeout
- Only show dialog after initial check if not connected
- Prevents dialog from flashing open during app startup when valid saved connection exists

**2. Apply flex-shrink-0 to accordion triggers**
- Added to both CollapsibleTrigger elements (Workspace Files and Depot)
- Prevents flex layout from shrinking headers out of view when content expands
- Simple CSS fix ensures headers always visible

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing TypeScript error in useDepotTree.ts**
- Found unused import `useOperationStore`
- Not related to our changes, did not block execution
- MainLayout.tsx changes introduced no new TypeScript errors

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All three high-visibility MainLayout bugs fixed:
- Toolbar layout correct
- Accordion headers always visible
- Connection dialog behavior improved

Ready to continue with remaining Phase 20 bug fixes and UI polish tasks.

---
*Phase: 20-bug-fixes-and-ui-polish*
*Completed: 2026-02-04*
