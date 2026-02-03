---
phase: 17-file-annotations
plan: 01
subsystem: api
tags: [perforce, p4-annotate, tauri, rust, react-query, blame]

# Dependency graph
requires:
  - phase: 16-file-content-viewer
    provides: "p4_print_content pattern for file size validation"
provides:
  - "Backend p4_annotate command with P4AnnotationLine struct"
  - "Frontend useFileAnnotations hook with TanStack Query caching"
  - "Annotation parsing utilities for grouping and coloring"
affects: [17-02-blame-ui, 17-03-blame-navigation]

# Tech tracking
tech-stack:
  added: [regex (Rust crate for parsing p4 annotate output)]
  patterns:
    - "Size validation before p4 annotate (10MB limit, matches p4_print_content)"
    - "TanStack Query with 1-hour staleTime (annotations at specific revision are immutable)"
    - "Annotation block grouping for keyboard navigation"
    - "Age-based heatmap coloring (blue=old, red=new)"

key-files:
  created:
    - src-tauri/src/commands/p4.rs (p4_annotate command)
    - src/hooks/useFileAnnotations.ts
    - src/lib/annotationParser.ts
    - src/lib/annotationColors.ts
  modified:
    - src-tauri/src/lib.rs (register p4_annotate)
    - src-tauri/Cargo.toml (add regex dependency)
    - src/lib/tauri.ts (add invokeP4Annotate function)

key-decisions:
  - "Use regex crate for parsing p4 annotate output format"
  - "Implement size check before annotation (10MB limit like content viewer)"
  - "Cache annotations for 1 hour (immutable at specific revision)"
  - "Group consecutive lines by changelist for block navigation"

patterns-established:
  - "Age color calculation: hue = 240 - (age * 240) maps blue→red"
  - "Relative time descriptions: Today, Yesterday, N days/weeks/months/years ago"
  - "Annotation blocks track startLine and endLine for keyboard navigation"

# Metrics
duration: 5min
completed: 2026-02-03
---

# Phase 17 Plan 01: File Annotations Infrastructure Summary

**Backend p4_annotate command with size validation, frontend TanStack Query hook, and annotation parsing utilities for grouping and age-based coloring**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-03T10:26:44Z
- **Completed:** 2026-02-03T10:31:55Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Backend p4_annotate command parses p4 annotate -u -c output with size validation
- Frontend hook provides annotation data with 1-hour caching (immutable revisions)
- Utility functions ready for UI components (grouping, coloring, age descriptions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add p4_annotate backend command** - `8cd9670` (feat)
2. **Task 2: Create annotation parsing and color utilities** - `bbe2223` (feat)
3. **Task 3: Create useFileAnnotations hook** - `d7705e0` (feat)

## Files Created/Modified
- `src-tauri/src/commands/p4.rs` - P4AnnotationLine struct, p4_annotate command with size check, regex parsing
- `src-tauri/src/lib.rs` - Registered p4_annotate command
- `src-tauri/Cargo.toml` - Added regex crate dependency
- `src/lib/tauri.ts` - P4AnnotationLine interface, invokeP4Annotate function
- `src/hooks/useFileAnnotations.ts` - TanStack Query hook with 1-hour cache, useAnnotationBlocks wrapper
- `src/lib/annotationParser.ts` - groupAnnotationBlocks function, AnnotationBlock interface
- `src/lib/annotationColors.ts` - calculateAgeColor (blue→red heatmap), getAgeDescription (relative time)

## Decisions Made
- Used regex crate for parsing p4 annotate output (format: "CL#: USER DATE CONTENT")
- Applied same 10MB size limit as p4_print_content to prevent memory exhaustion
- Set 1-hour staleTime for annotations (immutable at specific revision, long cache appropriate)
- Grouped consecutive lines by changelist ID for keyboard navigation blocks
- Age color formula: hue = 240 - (age * 240) produces blue (old) to red (new) gradient

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all implementations followed existing patterns from Phase 16 file content viewer.

## Next Phase Readiness

Ready for Phase 17 Plan 02 (Blame UI Components):
- Backend command returns structured annotation data
- Frontend hook fetches and caches annotations
- Parsing utilities group blocks and calculate colors
- All exports properly typed and importable

No blockers. Next plan can implement UI components using these utilities.

---
*Phase: 17-file-annotations*
*Completed: 2026-02-03*
