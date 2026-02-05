# Phase 23: FileIndex and Search - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a persistent Rust-side file index (nucleo-powered) that enables instant fuzzy search across large workspaces. The file tree filter uses this index instead of rebuilding matches per keystroke. Index rebuilds automatically after streaming fstat completes.

</domain>

<decisions>
## Implementation Decisions

### Search UX
- Ranking: fuzzy score with recency bias (prefer recently modified files when scores are close)
- Result limit: progressive, show 50 initially with ability to load more
- Search modes: toggle between fuzzy and exact matching (user can switch)
- Entry point: file tree filter only (no separate command palette quick-open)

### Filter behavior
- Debounce: standard 150ms debounce (matches existing behavior)
- Minimum chars: 1 character to start filtering
- Tree presentation: filtered tree with ancestor paths (not flat list)
  - Matching files stay in hierarchy with all parent folders visible up to root
  - Allows distinguishing files with same name in different paths
- Scroll position: restore previous position when clearing filter

### Result presentation
- File type icons: yes, preserve existing icon behavior
- Empty state: simple "No matches" message
- Result count: display match count near the filter input

### Claude's Discretion
- Match highlighting style (bold, background, or accent color)
- Exact placement/format of result count display
- Index rebuild timing details
- nucleo configuration parameters

</decisions>

<specifics>
## Specific Ideas

- Tree stays hierarchical during filter — user mentioned wanting to differentiate files with same name but different paths (e.g., `src/components/Button.tsx` vs `src/legacy/Button.tsx`)
- Recency bias helps surface files user is actively working on

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-fileindex-and-search*
*Context gathered: 2026-02-04*
