---
phase: 17-file-annotations
plan: 03
subsystem: detail-pane
tags: [annotations, tooltips, keyboard-nav, blame-navigation, interactions]
requires: [17-02]
provides: [interactive-annotations, changelist-tooltips, keyboard-navigation, blame-history]
affects: []
tech-stack:
  added: ["@radix-ui/react-tooltip@^1.1.8"]
  patterns: ["lazy-loading-tooltips", "keyboard-navigation-hooks", "revision-history-stack"]
key-files:
  created:
    - path: "src/components/ui/tooltip.tsx"
      purpose: "Radix UI tooltip wrapper component"
      lines: 30
    - path: "src/hooks/useChangelistDescription.ts"
      purpose: "Lazy-loading hook for changelist descriptions"
      lines: 50
    - path: "src/components/DetailPane/AnnotationTooltip.tsx"
      purpose: "Tooltip showing full commit message on annotation hover"
      lines: 70
    - path: "src/hooks/useAnnotationNavigation.ts"
      purpose: "Keyboard navigation hook for Alt+Arrow keys"
      lines: 75
  modified:
    - path: "src/components/DetailPane/AnnotationGutter.tsx"
      changes: "Wrap lines with AnnotationTooltip, change highlightedBlockIndex to highlightedLines Set"
    - path: "src/components/DetailPane/FileAnnotationViewer.tsx"
      changes: "Integrate keyboard nav, add blame prior revision controls, navigation indicators"
    - path: "src/components/DetailPane/RevisionDetailView.tsx"
      changes: "Implement click-to-CL navigation using invokeP4Changes and selectChangelist"
decisions:
  - id: lazy-tooltip-loading
    choice: "Fetch description only when tooltip opens (enabled: isOpen)"
    rationale: "Avoids N API calls on initial render, descriptions fetched on-demand"
  - id: keyboard-nav-pattern
    choice: "Alt+Arrow keys for block navigation, ignoring input/textarea"
    rationale: "Alt modifier prevents conflicts with text editing, common IDE pattern"
  - id: blame-history-stack
    choice: "Track revision history as array, allow multi-level back navigation"
    rationale: "Enables deep investigation workflow, peeling back multiple layers"
  - id: highlightedLines-set
    choice: "Change from highlightedBlockIndex to highlightedLines Set<number>"
    rationale: "More flexible for highlighting entire blocks spanning multiple lines"
metrics:
  duration: 8
  completed: 2026-02-03
---

# Phase 17 Plan 03: File Annotations Interactive Features Summary

**One-liner:** Annotation hover tooltips, Alt+Arrow keyboard navigation, click-to-CL drill-down, and blame prior revision history peeling

## What Was Built

### Tooltip System (Task 1)
1. **Radix UI Tooltip Component** (`src/components/ui/tooltip.tsx`)
   - Standard shadcn/ui wrapper for @radix-ui/react-tooltip
   - TooltipProvider, Tooltip, TooltipTrigger, TooltipContent exports
   - Configured with fade/zoom animations, side offsets

2. **Changelist Description Hook** (`src/hooks/useChangelistDescription.ts`)
   - `parseChangelistDescription(output: string)` - parses p4 describe -s output
   - `useChangelistDescription(changelistId, options)` - TanStack Query hook
   - Lazy loading: `enabled: false` by default, activated on tooltip open
   - 1-hour staleTime (descriptions immutable)

3. **Annotation Tooltip Component** (`src/components/DetailPane/AnnotationTooltip.tsx`)
   - Props: changelistId, user, date, children
   - Tracks isOpen state, triggers description fetch on open
   - 500ms delayDuration prevents accidental triggers
   - Content: CL number, author, date, separator, description
   - Loading state with Loader2 spinner
   - Side: "right" to avoid gutter obscuration

### Keyboard Navigation (Task 2)
4. **Navigation Hook** (`src/hooks/useAnnotationNavigation.ts`)
   - `useAnnotationNavigation(blocks, scrollToLine)` hook
   - Alt+ArrowDown: next block, Alt+ArrowUp: previous block
   - Ignores events from input/textarea elements
   - e.preventDefault() prevents page scrolling
   - Returns: currentBlockIndex, currentBlock, totalBlocks, programmatic nav functions
   - Resets index when blocks change (file navigation)

5. **Gutter Integration**
   - Wrapped each annotation line with AnnotationTooltip
   - Changed `highlightedBlockIndex?: number` to `highlightedLines?: Set<number>`
   - Line highlighting with `ring-2 ring-primary/50` for current block
   - TooltipProvider wrapper for entire gutter

6. **Viewer Integration**
   - scrollToLine callback: calculates position (lineNumber * 20px), scrolls with -100px offset
   - useAnnotationNavigation hook integration
   - highlightedLines calculation: Set<number> from currentBlock startLine to endLine
   - Navigation indicator: "Block X of Y (Alt+↑/↓ to navigate)" when totalBlocks > 1

### Click-to-CL and Blame Prior (Task 3)
7. **Click-to-Changelist Navigation** (`RevisionDetailView.tsx`)
   - handleAnnotationClick now async, calls invokeP4Changes('submitted')
   - Finds matching changelist by ID, converts to P4Changelist format
   - Calls selectChangelist from detailPaneStore
   - Error handling with toast notifications
   - Files array left empty (lazy loaded later)

8. **Blame Prior Revision** (`FileAnnotationViewer.tsx`)
   - Added state: blameRevision, revisionHistory (stack)
   - handleBlamePriorRevision: decrements blameRevision, pushes to history
   - handleBlameHistoryBack: pops from history, restores previous revision
   - Header controls:
     - "Back" button (ArrowLeft icon) - disabled if history.length <= 1
     - "Blame Prior Revision" button (History icon) - disabled if blameRevision <= 1
     - Status indicator: "Viewing blame at #{blameRevision}"
   - useFileAnnotations uses blameRevision instead of props.revision
   - State reset on depotPath/revision changes

## BLAME Requirements Verification

✅ **BLAME-01**: Per-line author, revision, date visible in gutter
   - Implemented in Plan 02, verified functional

✅ **BLAME-02**: Click annotation navigates to changelist detail
   - handleAnnotationClick fetches CL and calls selectChangelist
   - Navigation preserves history stack

✅ **BLAME-03**: Alt+Up/Down navigates between change blocks
   - useAnnotationNavigation hook handles keyboard events
   - Current block highlighted with ring styling

✅ **BLAME-04**: Heatmap coloring (blue=old, red=recent) on gutter
   - Implemented in Plan 02, verified functional

✅ **BLAME-05**: Hover shows tooltip with full commit message
   - AnnotationTooltip with lazy-loaded description
   - 500ms delay prevents accidental triggers

✅ **BLAME-06**: "Blame Prior Revision" button peels back history
   - handleBlamePriorRevision decrements revision
   - revisionHistory stack enables multi-level back navigation

**All 6 BLAME requirements satisfied.**

## Technical Decisions

### Lazy Tooltip Loading
**Problem:** Loading descriptions for all annotations upfront would trigger N API calls on render.

**Solution:** `enabled: isOpen` in useChangelistDescription hook. Description fetched only when tooltip opens.

**Trade-offs:**
- ✅ Minimal initial load (no unnecessary API calls)
- ✅ 1-hour staleTime caches descriptions after first fetch
- ⚠️ First hover shows loading spinner (acceptable UX)

### Keyboard Navigation Pattern
**Problem:** Need non-conflicting keyboard shortcuts for annotation navigation.

**Solution:** Alt+Arrow keys, with input/textarea exclusion.

**Rationale:**
- Alt modifier prevents conflicts with text editing
- Arrow keys intuitive for "up/down" navigation
- Common pattern in IDEs (VSCode, IntelliJ)
- e.preventDefault() stops page scroll

### Blame History Stack
**Problem:** Users may need to peel back multiple revisions to investigate change origins.

**Solution:** Track revisionHistory as array, support multi-level back navigation.

**Implementation:**
- handleBlamePriorRevision pushes current revision to history before decrementing
- handleBlameHistoryBack pops from history
- State reset on file/revision changes prevents stale history

### highlightedLines Set
**Problem:** Original highlightedBlockIndex only highlighted single index, not entire block.

**Solution:** Change to `highlightedLines: Set<number>` (1-indexed line numbers).

**Benefits:**
- Highlights all lines in current block (startLine to endLine)
- More flexible for future multi-selection features
- Clean Set lookup: `highlightedLines?.has(lineNumber)`

## Deviations from Plan

None - plan executed exactly as written.

## Performance Considerations

1. **Tooltip Virtualization:** Only visible tooltips rendered (Radix UI handles this)
2. **Lazy Description Loading:** No upfront API calls, descriptions fetched on-demand
3. **Stale Time:** 1-hour staleTime caches descriptions (immutable data)
4. **Keyboard Handler:** Single window listener, efficient event filtering
5. **highlightedLines Calculation:** Memoized with useMemo, recalculates only on currentBlock change

## Next Phase Readiness

### Blockers/Concerns
None - Phase 17 complete with all 6 BLAME requirements satisfied.

### Integration Points
- **Phase 18 (Sync Status):** Could add annotation sync status indicator (local vs head revision)
- **Phase 19 (Submit Preview):** Annotations could preview "what will be submitted" for pending CLs

### Follow-up Improvements (Future)
1. **Description Caching:** Consider persisting to localStorage for offline access
2. **Keyboard Shortcuts Help:** Add "?" key to show keyboard shortcuts tooltip
3. **Multi-Block Selection:** Extend highlightedLines to support Shift+Alt+Arrow for range selection
4. **Performance Monitoring:** Add telemetry for tooltip fetch times, keyboard nav responsiveness

## Files Created/Modified

**Created (4 files):**
- `src/components/ui/tooltip.tsx` - Radix UI wrapper (30 lines)
- `src/hooks/useChangelistDescription.ts` - Description fetching hook (50 lines)
- `src/components/DetailPane/AnnotationTooltip.tsx` - Tooltip component (70 lines)
- `src/hooks/useAnnotationNavigation.ts` - Keyboard navigation hook (75 lines)

**Modified (4 files):**
- `src/components/DetailPane/AnnotationGutter.tsx` - Tooltip wrapping, highlightedLines
- `src/components/DetailPane/FileAnnotationViewer.tsx` - Keyboard nav, blame prior revision
- `src/components/DetailPane/RevisionDetailView.tsx` - Click-to-CL navigation
- `package.json` / `package-lock.json` - Added @radix-ui/react-tooltip

**Total:** 8 files, 225+ new lines

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 609b839 | feat(17-03): add tooltip and changelist description fetching |
| 2 | 6e2686b | feat(17-03): add keyboard navigation and integrate tooltips |
| 3 | 8103237 | feat(17-03): add click-to-CL navigation and blame prior revision |

**Duration:** 8 minutes
**Status:** Complete ✅
