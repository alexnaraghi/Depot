# Phase 12: Actionable Search - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Make search results interactive entry points. Clicking search results opens relevant views (file history, author changelists). No right-click context menus on search results — all interaction is left-click. Search panel closes after clicking a result.

</domain>

<decisions>
## Implementation Decisions

### Click behavior (core interaction model)
- No right-click context menus on search results — all actions via left-click
- Clicking a file opens file history panel directly (not navigate-to-file)
- Clicking an author opens history panel showing that author's recent changelists
- Clicking a CL number — Claude's discretion (minimal behavior, e.g., copy to clipboard)
- Search panel closes after clicking any result

### Author changelist view
- Opens in the existing history panel with the author's recent CLs
- No back button — close and reopen from wherever needed
- Scope and count at Claude's discretion

### Search results display
- Mixed list with icons/badges indicating type (files, CLs, authors) — not grouped by type
- Fuzzy matching (forgiving, like VS Code command palette)

### Navigation
- Clicking a file search result only opens history — does not scroll/highlight in main changelist view

### Claude's Discretion
- CL number click behavior (copy to clipboard or similar minimal action)
- Author CL count and scope (workspace vs server-wide)
- Fuzzy search algorithm choice
- Icon/badge design for result types
- Keyboard navigation within search results

</decisions>

<specifics>
## Specific Ideas

- Click interaction model inspired by command palette UX — click and it takes you there, panel closes
- Fuzzy matching like VS Code's command palette

</specifics>

<deferred>
## Deferred Ideas

- Clickable submitted CL details window — deferred to future milestone (layout change planned)
- Clickable files within CL details view — deferred with CL details window

</deferred>

---

*Phase: 12-actionable-search*
*Context gathered: 2026-01-31*
