---
phase: 12
plan: 01
subsystem: search-infrastructure
tags: [zustand, search, filtering, ui]
requires: [11.1]
provides:
  - Global search filter store
  - Rewired SearchBar component
  - Ctrl+F shortcut
affects: [12-02, 12-03]
tech-stack:
  added: ['@nozbe/microfuzz']
  patterns: ['Global filter state', 'Event-based focus control']
key-files:
  created:
    - src/stores/searchFilterStore.ts
  modified:
    - src/components/SearchBar.tsx
    - src/components/MainLayout.tsx
    - src/lib/shortcuts.ts
  deleted:
    - src/components/SearchResultsPanel.tsx
    - src/hooks/useSearch.ts
decisions:
  - id: 12-01-instant-filter
    title: No debounce on search input
    rationale: Instant filtering on every keystroke per CONTEXT.md. useDeferredValue in consumers (Plan 02) handles performance.
  - id: 12-01-event-focus
    title: Event-based search focus
    rationale: MainLayout dispatches 'p4now:focus-search' event, SearchBar listens. Avoids ref passing across component tree.
  - id: 12-01-progressive-escape
    title: Progressive Escape key behavior
    rationale: First Escape clears text, second Escape blurs. Prevents accidental unfocus when user just wants to clear.
metrics:
  duration: 3 min
  completed: 2026-02-01
---

# Phase 12 Plan 01: Search Filter Infrastructure Summary

**One-liner:** Zustand-based global search filter store with always-visible toolbar search bar, instant filtering, and match count badge display.

## What Was Built

Established the shared state foundation for in-place column filtering. The old dropdown search pattern (SearchResultsPanel showing submitted changelists) has been completely removed and replaced with a global filter store that will drive in-place filtering in FileTree and ChangelistPanel.

### Components Delivered

1. **searchFilterStore.ts**
   - Zustand store with filterTerm, isActive, fileTreeMatchCount, changelistMatchCount
   - setFilterTerm, clearFilter, setFileTreeMatchCount, setChangelistMatchCount actions
   - No debounce — instant updates on every keystroke
   - isActive computed from filterTerm.trim().length > 0

2. **SearchBar.tsx (rewritten)**
   - Always-visible search input in toolbar header (no collapse/expand)
   - Updates filter store on every keystroke via onChange
   - Shows match count badge when filter is active (sum of fileTree + changelist matches)
   - Clear X button (only visible when text present)
   - Escape key: progressive behavior (clear text → blur)
   - Listens for 'p4now:focus-search' event to handle Ctrl+F

3. **MainLayout.tsx (updated)**
   - Added Ctrl+F shortcut handler using useHotkeys
   - Dispatches 'p4now:focus-search' custom event
   - preventDefault: true to prevent browser's native find dialog

4. **shortcuts.ts (updated)**
   - Added SEARCH: { keys: 'ctrl+f', label: 'Ctrl+F' }

### Deleted Components

- **SearchResultsPanel.tsx** — Old dropdown showing submitted changelists
- **useSearch.ts** — Hook for fetching and filtering submitted changelists

These are replaced by the filter store. The old pattern showed a dropdown of search results; the new pattern filters content in-place within existing columns.

## Technical Implementation

### Filter Store Architecture

```typescript
interface SearchFilterState {
  filterTerm: string;          // Current search/filter text
  isActive: boolean;           // Computed: term.trim().length > 0
  fileTreeMatchCount: number;  // Set by FileTree consumer
  changelistMatchCount: number; // Set by ChangelistPanel consumer

  setFilterTerm: (term: string) => void;
  clearFilter: () => void;
  setFileTreeMatchCount: (count: number) => void;
  setChangelistMatchCount: (count: number) => void;
}
```

**Key design decisions:**
- No debounce in store — consumers use `useDeferredValue` for performance (Plan 02)
- Match counts set by consumers, not computed in store (consumers own their filtering logic)
- clearFilter resets both filterTerm and match counts in single action

### SearchBar Component

**Visual design:**
- Compact inline: `bg-muted rounded-md px-2 py-1 border border-border`
- Search icon (lucide Search, 4x4) on left
- Input: w-48, transparent background, no focus ring
- Clear X button: h-5 w-5, ghost variant, only shown when filterTerm non-empty
- Match count: text-xs, text-muted-foreground, whitespace-nowrap

**Behavior:**
- Always visible (no collapse pattern)
- onChange → setFilterTerm (instant, no debounce)
- Ctrl+F focuses and selects all text
- Escape: if text → clear, if empty → blur
- stopPropagation on Escape to prevent other handlers

### Keyboard Shortcut Integration

**Ctrl+F flow:**
1. MainLayout: `useHotkeys(SHORTCUTS.SEARCH.keys, ..., { enableOnFormTags: true, preventDefault: true })`
2. Dispatch: `window.dispatchEvent(new CustomEvent('p4now:focus-search'))`
3. SearchBar: `useEffect` listener focuses input and selects text

**Why custom event instead of ref?**
- Avoids prop drilling inputRef through MainLayout → SearchBar
- SearchBar component owns focus behavior
- Consistent with existing 'p4now:*' event pattern

## Dependencies Installed

- **@nozbe/microfuzz@1.0.0** — Fuzzy matching library for highlight ranges (used in Plan 02)

## Deviations from Plan

None — plan executed exactly as written.

## Testing Evidence

- TypeScript compilation: ✓ `npx tsc --noEmit` passes
- Build: ✓ `npm run build` succeeds
- No broken imports: ✓ Grep confirms no remaining imports of deleted files
- Package installed: ✓ `npm ls @nozbe/microfuzz` shows v1.0.0

## Next Phase Readiness

**Ready for Plan 02 (FileTree Filtering):**
- ✓ searchFilterStore provides filterTerm subscription
- ✓ setFileTreeMatchCount available for match count updates
- ✓ Match count badge in SearchBar will display FileTree's count

**Ready for Plan 03 (ChangelistPanel Filtering):**
- ✓ searchFilterStore provides filterTerm subscription
- ✓ setChangelistMatchCount available for match count updates
- ✓ Match count badge in SearchBar will display combined counts

**Blockers:** None

**Notes:**
- Match count currently shows 0 (no consumers yet)
- Typing in search bar updates store (can verify with React DevTools)
- Plan 02/03 will wire FileTree/ChangelistPanel to consume filterTerm and update match counts

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| d91b30b | feat | Install microfuzz and create searchFilterStore |
| 7ca1cde | feat | Rewire SearchBar to use filter store |

**Total changes:**
- 3 files created
- 4 files modified
- 2 files deleted
- 1 package added
- ~138 lines added, ~323 lines removed
