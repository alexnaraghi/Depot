---
phase: 18-table-stakes-ui-features
plan: 03
subsystem: ui
tags: [react, tanstack-query, p4-describe, changelist-files]

# Dependency graph
requires:
  - phase: 18-02
    provides: invokeP4Describe backend command and P4ChangelistDescription type
provides:
  - Submitted changelist file list display with action badges
  - Click-to-view navigation from CL files to revision detail
  - Sibling files section in RevisionDetailView with real data
  - useChangelistFiles React Query hook for CL file fetching
affects: [19-submit-preview]

# Tech tracking
tech-stack:
  added: []
  patterns: [lazy-loading-submitted-cl-files]

key-files:
  created:
    - src/hooks/useChangelistFiles.ts
  modified:
    - src/components/DetailPane/ChangelistDetailView.tsx
    - src/components/DetailPane/RevisionDetailView.tsx

key-decisions:
  - "Use TanStack Query for submitted CL file caching (60s stale time, no refetch on focus)"
  - "Fetch files only for submitted CLs (pending CLs have files in P4Changelist already)"
  - "Move getActionBadgeColor outside component to accept FileAction | string for reuse"
  - "Pass empty localPath when drilling to revision from submitted CL (depot path sufficient)"

patterns-established:
  - "Conditional hook enablement: useChangelistFiles(id, isSubmitted) only fetches when needed"
  - "Loading skeletons for async file list data"
  - "Current file highlighting in sibling file lists (bg-accent/50)"

# Metrics
duration: 4min
completed: 2026-02-03
---

# Phase 18 Plan 03: Changelist File List UI Summary

**Submitted changelists display complete file lists with action badges; clicking files navigates to revision detail view showing sibling files from same submit**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-03T23:28:20Z
- **Completed:** 2026-02-03T23:32:33Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Submitted changelists show complete file list with action badges (add, edit, delete, integrate, branch, move)
- Clicking file in submitted CL navigates to RevisionDetailView for that specific revision
- RevisionDetailView TODO replaced with real sibling files from p4 describe
- Current file highlighted in sibling list; clicking sibling navigates to that revision

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useChangelistFiles hook** - `440fffe` (feat)
2. **Task 2: Update ChangelistDetailView to show submitted CL files** - `e90aeb0` (feat)
3. **Task 3: Update RevisionDetailView sibling files section** - `d43140f` (feat)

## Files Created/Modified
- `src/hooks/useChangelistFiles.ts` - TanStack Query hook for fetching submitted CL file list via p4 describe
- `src/components/DetailPane/ChangelistDetailView.tsx` - Added submitted CL file list section with action badges and click navigation
- `src/components/DetailPane/RevisionDetailView.tsx` - Replaced TODO with real sibling files from changelist, added navigation between siblings

## Decisions Made

**1. Conditional hook enablement for submitted CLs only**
- Rationale: Pending CLs already have files in P4Changelist.files array; submitted CLs need p4 describe fetch
- Implementation: `useChangelistFiles(changelist.id, isSubmitted)` enables query only when status is submitted

**2. Moved getActionBadgeColor outside component**
- Rationale: Needed by both pending file list (FileAction enum) and submitted file list (string from p4 describe)
- Implementation: Accept `FileAction | string` parameter, handle both enum and string comparisons

**3. Empty localPath when drilling from submitted CL**
- Rationale: Submitted files may not exist in workspace; depot path is sufficient for p4 print/annotate
- Implementation: `drillToRevision(depotPath, '', revision)` passes empty string for localPath

**4. 60-second cache for submitted CL files**
- Rationale: Submitted CLs are immutable; caching reduces backend calls
- Implementation: `staleTime: 60000, refetchOnWindowFocus: false` in useChangelistFiles

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all TypeScript compilation succeeded, hooks integrated cleanly.

## Next Phase Readiness

**Ready for Phase 19 (Submit Preview):**
- File content viewing works via RevisionDetailView
- Submitted CL file lists provide reference implementation for pending CL preview
- useChangelistFiles pattern can be adapted for preview queries

**No blockers.**

---
*Phase: 18-table-stakes-ui-features*
*Completed: 2026-02-03*
