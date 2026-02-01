# Phase 14: Depot Browser - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Full depot hierarchy browser with lazy loading and file operations. Users can browse the entire depot tree, expand folders on demand, and access file operations (sync, checkout, history, diff) from context menus. The depot browser lives alongside the workspace file tree in the left column.

</domain>

<decisions>
## Implementation Decisions

### Placement & Layout
- Accordion sections in the left column: "Workspace Files" and "Depot" as collapsible headers
- Both sections visible simultaneously, independently collapsible (VS Code / GitKraken pattern)
- No tab switching or mode toggle — both coexist in the same panel
- User controls vertical space allocation by expanding/collapsing each section

### Search Interaction
- Search filtering applies to workspace files only, not the depot tree
- Depot browsing is purely navigation-based (expand/collapse tree nodes)
- Future enhancement: toggle to include depot in search (deferred)

### Detail Pane Integration
- Clicking depot items shows file info in the center detail pane (same pattern as workspace file clicks)

### Claude's Discretion
- Tree node visual design (icons, indentation, type indicators)
- Lazy loading strategy and depth limits
- Context menu action set and ordering
- How to visually distinguish mapped vs unmapped depot files
- Sorting behavior (folders first, alphabetical, etc.)

</decisions>

<specifics>
## Specific Ideas

- "Like VS Code and GitKraken expandable list items" — accordion-style collapsible sections, not tabs
- User explicitly wants to avoid redundant search results between workspace and depot views

</specifics>

<deferred>
## Deferred Ideas

- Depot search/filtering — future enhancement with checkbox toggle to include depot in search
- No other scope creep during discussion

</deferred>

---

*Phase: 14-depot-browser*
*Context gathered: 2026-02-01*
