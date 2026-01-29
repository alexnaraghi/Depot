---
phase: 06-shelve-reconcile
plan: 02
subsystem: ui
tags: [react, tanstack-query, shelve, collapsible, context-menu]

# Dependency graph
requires:
  - phase: 06-01
    provides: Backend commands for p4 shelve, unshelve, delete shelf, and describe shelved
provides:
  - Collapsible shelved files display in changelist panel with purple/violet visual distinction
  - Shelve action in file context menu for numbered changelists
  - Unshelve action with conflict detection and warning
  - Delete shelf action with confirmation dialog
  - Query invalidation for seamless UI updates after mutations
affects: [reconcile, changelist-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shelved files as special tree node type (shelved-section) in changelist tree"
    - "Conflict detection before unshelve by comparing depot paths of shelved vs opened files"
    - "Conditional context menu items based on changelist type (numbered vs default)"

key-files:
  created:
    - src/hooks/useShelvedFiles.ts
    - src/components/ChangelistPanel/ShelvedFilesSection.tsx
  modified:
    - src/utils/treeBuilder.ts
    - src/components/ChangelistPanel/ChangelistNode.tsx
    - src/components/ChangelistPanel/ChangelistContextMenu.tsx
    - src/components/ChangelistPanel/ChangelistPanel.tsx

key-decisions:
  - "Shelved files rendered as special 'shelved-section' tree node type for clean integration with react-arborist"
  - "Purple/violet color scheme for shelved files to visually distinguish from pending files"
  - "Conflict detection on unshelve compares depot paths and shows confirmation dialog if overlaps exist"
  - "Shelve action only available for numbered changelists (default CL cannot have shelves per P4 rules)"

patterns-established:
  - "Pattern: Adding special non-draggable sections to tree by creating custom node types"
  - "Pattern: Conditional context menu items based on entity properties"
  - "Pattern: Confirmation dialogs for destructive operations with clear consequences"

# Metrics
duration: 6min
completed: 2026-01-29
---

# Phase 06 Plan 02: Shelve & Unshelve UI Summary

**Collapsible shelved files display with purple/violet styling, shelve via context menu, unshelve with conflict detection, and delete shelf with confirmation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-29T20:30:02Z
- **Completed:** 2026-01-29T20:35:40Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Users can shelve selected files via right-click context menu (numbered CLs only)
- Shelved files appear in collapsible purple/violet section below pending files
- Unshelve detects conflicts with opened files and warns user before proceeding
- Delete shelf has confirmation dialog preventing accidental deletion
- All operations update UI automatically via TanStack Query invalidation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useShelvedFiles hook and ShelvedFilesSection component** - `29bb881` (feat)
2. **Task 2: Integrate shelved files into changelist panel and add shelve to context menu** - `2f94999` (feat)

## Files Created/Modified
- `src/hooks/useShelvedFiles.ts` - TanStack Query hook with shelved files query and 3 mutations (shelve, unshelve, delete)
- `src/components/ChangelistPanel/ShelvedFilesSection.tsx` - Collapsible section rendering shelved files with purple/violet styling
- `src/utils/treeBuilder.ts` - Added 'shelved-section' node type to changelist tree structure
- `src/components/ChangelistPanel/ChangelistNode.tsx` - Renders shelved-section nodes with ShelvedFilesSection component
- `src/components/ChangelistPanel/ChangelistContextMenu.tsx` - Added shelve action with Archive icon, separator, and disabled state handling
- `src/components/ChangelistPanel/ChangelistPanel.tsx` - Updated drag/drop rules to prevent shelved-section from being draggable/droppable

## Decisions Made
- **Shelved section as tree node:** Rather than rendering outside the tree, added 'shelved-section' as a special node type in the tree structure. This integrates cleanly with react-arborist's virtualization and maintains consistent visual hierarchy.
- **Conflict detection approach:** Compare depot paths of shelved files against currently opened files (using invokeP4Opened) before unshelving. Show window.confirm with file count if conflicts exist. User can cancel to abort the operation.
- **Purple/violet color scheme:** Used violet-400/violet-300 for text and violet-900/30 for badges to clearly distinguish shelved files from pending files (which use default slate colors).
- **Context menu conditional display:** Only show "Shelve" option when currentChangelistId > 0, as default CL cannot have shelves per Perforce rules.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**TypeScript errors on first compile:**
- Issue: P4FileInfo uses `depot_path` (snake_case) but code referenced `depotPath` (camelCase)
- Fix: Updated conflict detection to use `depot_path` property from invokeP4Opened result
- Also removed unused `isLoading` variable from ShelvedFilesSection

All issues resolved during Task 1 before commit.

## Next Phase Readiness

- Shelve/unshelve UI complete and ready for user testing
- Reconcile functionality (06-03) can now be developed independently
- Future enhancement: Add shelve diff tool support to compare shelved vs have revisions

---
*Phase: 06-shelve-reconcile*
*Completed: 2026-01-29*
