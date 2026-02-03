---
phase: 17-file-annotations
plan: 02
subsystem: ui
tags: [react, tanstack-virtual, prism-react-renderer, typescript, file-viewer, virtualization]

# Dependency graph
requires:
  - phase: 17-01
    provides: useFileAnnotations hook, calculateAgeColor utility, annotation parsing
  - phase: 16-02
    provides: Size validation patterns from FileContentViewer
provides:
  - FileAnnotationViewer component with side-by-side gutter and code view
  - AnnotationGutter with virtualized rendering and heatmap coloring
  - Integration into RevisionDetailView with "View Annotations" toggle
affects: [17-03-keyboard-navigation, 17-04-annotation-tooltip]

# Tech tracking
tech-stack:
  added: ["@tanstack/react-virtual@3.13.18"]
  patterns:
    - "Virtualized list rendering with useVirtualizer for large files"
    - "Side-by-side layout with synchronized scrolling"
    - "Size validation pattern reuse from Phase 16"
    - "Heatmap coloring based on timestamp age"

key-files:
  created:
    - src/components/DetailPane/AnnotationGutter.tsx
    - src/components/DetailPane/FileAnnotationViewer.tsx
  modified:
    - src/components/DetailPane/RevisionDetailView.tsx
    - package.json

key-decisions:
  - "Use @tanstack/react-virtual for virtualization (handles 1000+ lines smoothly)"
  - "Reuse FileContentViewer size validation pattern (1MB auto-load, 10MB max)"
  - "Mutual exclusivity: content OR annotations view, not both simultaneously"
  - "Single scroll container for gutter + code synchronization"
  - "Fixed 20px line height for perfect alignment between gutter and code"

patterns-established:
  - "Virtualization pattern: useVirtualizer with overscan=10, estimateSize=20px"
  - "Heatmap integration: calculateAgeColor with min/max timestamp range"
  - "Size validation reuse: Same thresholds and warning patterns across file viewers"

# Metrics
duration: 28min
completed: 2026-02-03
---

# Phase 17 Plan 02: File Annotation Viewer Summary

**Virtualized file blame viewer with heatmap-colored gutter showing per-line changelist, author, and date alongside syntax-highlighted code**

## Performance

- **Duration:** 28 min
- **Started:** 2026-02-03T10:35:17Z
- **Completed:** 2026-02-03T10:39:39Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- FileAnnotationViewer component displays blame data with size validation (1MB auto-load, 10MB max)
- AnnotationGutter uses @tanstack/react-virtual for smooth rendering of large files (1000+ lines)
- Heatmap coloring shows code age (blue = old, red = recent) using calculateAgeColor
- Side-by-side layout with synchronized scrolling between gutter and code
- RevisionDetailView toggle button switches between content and annotations views

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @tanstack/react-virtual and create AnnotationGutter** - `5e16088` (feat)
   - Installed @tanstack/react-virtual@3.13.18
   - Created AnnotationGutter with useVirtualizer (20px line height, overscan 10)
   - Implemented heatmap coloring and click handlers

2. **Task 2: Create FileAnnotationViewer and integrate into RevisionDetailView** - `f44edb3` (feat)
   - Created FileAnnotationViewer with size validation
   - Side-by-side gutter + syntax-highlighted code layout
   - Added "View Annotations" toggle to RevisionDetailView
   - Mutual exclusivity with file content viewer
   - Fixed AnnotationGutter containerRef type to allow null

## Files Created/Modified

- `src/components/DetailPane/AnnotationGutter.tsx` - Virtualized gutter with heatmap coloring
- `src/components/DetailPane/FileAnnotationViewer.tsx` - Main blame viewer container with size validation
- `src/components/DetailPane/RevisionDetailView.tsx` - Added "View Annotations" toggle button
- `package.json` - Added @tanstack/react-virtual dependency

## Decisions Made

**1. @tanstack/react-virtual for virtualization**
- Handles large files (1000+ lines) smoothly
- useVirtualizer API provides precise control over scroll positioning
- Overscan of 10 lines prevents blank areas during fast scrolling

**2. Reuse FileContentViewer size validation pattern**
- 1MB auto-load threshold (prevents slow initial loads)
- 10MB absolute maximum (prevents memory exhaustion)
- Same user experience across all file viewers

**3. Mutual exclusivity between content and annotations**
- Users see either file content OR annotations, not both
- Simplifies UI, avoids cognitive overload
- Both toggle buttons remain visible for easy switching

**4. Fixed 20px line height for alignment**
- Ensures perfect sync between gutter lines and code lines
- Prevents misalignment during scroll
- Matches typical terminal/editor line heights

**5. Single scroll container**
- Both gutter and code share one scrolling element
- Natural synchronization without manual scroll event handling
- Simpler implementation, better performance

## Deviations from Plan

**Auto-fixed Issues**

**1. [Rule 3 - Blocking] Fixed containerRef TypeScript type**
- **Found during:** Task 2 (FileAnnotationViewer creation)
- **Issue:** useRef<HTMLDivElement>(null) creates RefObject<HTMLDivElement | null>, but AnnotationGutter expected RefObject<HTMLDivElement>
- **Fix:** Updated AnnotationGutter interface to accept RefObject<HTMLDivElement | null>
- **Files modified:** src/components/DetailPane/AnnotationGutter.tsx
- **Verification:** npm run build passes without TypeScript errors
- **Committed in:** f44edb3 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type fix required for compilation. No scope creep.

## Issues Encountered

None - plan executed smoothly with only one TypeScript type fix required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 03 (Keyboard Navigation):**
- AnnotationGutter already has highlightedBlockIndex prop for keyboard nav
- groupAnnotationBlocks utility from Plan 01 ready to use
- Click handler placeholder in place (console.log for now)

**Ready for Plan 04 (Annotation Tooltips):**
- AnnotationGutter renders each line with hover support
- Layout accommodates overlays

**Blockers/Concerns:**
- None

---
*Phase: 17-file-annotations*
*Completed: 2026-02-03*
