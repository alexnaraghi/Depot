# Phase 12: Search Filtering & Results - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

In-place search filtering of file tree and changelist columns via the existing toolbar search bar, plus command palette deep searches for submitted CLs and depot paths. Results display in the detail pane. No new search capabilities beyond filtering and the two deep search types.

</domain>

<decisions>
## Implementation Decisions

### Filter behavior
- Fuzzy matching (typing "mctl" matches "MyController")
- Instant filtering on every keystroke (no debounce)
- Non-matching items are dimmed, not hidden — tree structure preserved
- Matches against both file paths AND changelist descriptions
- While filter is active, dimmed items are non-interactive — only matching items can be clicked

### Search input placement
- Reuse existing toolbar search bar (no new UI element)
- Remove the existing dropdown menu from search bar (deprecated)
- Ctrl+F keyboard shortcut focuses the search bar (already works by click)
- Search bar minimizes/collapses when a result is clicked or filter is cancelled

### Visual feedback
- Matching characters highlighted within file names and CL descriptions
- Match count badge shown in/near the search bar (e.g., "12 matches")
- Clicking a search result navigates to it in detail pane AND dismisses the filter (restores normal view)
- Escape or clearing search restores unfiltered state with all items interactive again

### Deep search (command palette)
- Two deep search types: "Search submitted changelists" and "Search depot paths"
- Results display in the detail pane (center column), replacing current view
- Submitted CL search: 50 results initially with "Load more" button
- Clicking a submitted CL result drills into full CL detail view (files, description, timestamp)

### Claude's Discretion
- Escape key behavior (clear text first vs unfocus first)
- Fuzzy matching algorithm choice
- Search bar minimize/collapse animation
- Depot path search result presentation
- How "Load more" pagination works with P4 commands

</decisions>

<specifics>
## Specific Ideas

- Search is modal: while filtering is active, non-matching items are dimmed and non-interactive. Clicking a match or cancelling search exits this mode.
- The existing toolbar search bar is reused and enhanced — the dropdown menu currently on it should be removed as it's deprecated.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-search-filtering*
*Context gathered: 2026-01-31*
