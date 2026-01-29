# Phase 05: History, Diff & Search - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

User can investigate file history, compare revisions with an external diff tool, and search submitted changelists. This phase delivers three capabilities: a file history viewer, external diff tool launching, and submitted changelist search. Creating/editing files and changelist CRUD are handled in earlier phases.

</domain>

<decisions>
## Implementation Decisions

### History viewer layout
- Display in a modal dialog (single file at a time, close and reopen for another file)
- Load last 50 revisions initially with a "Load more" button
- Claude's discretion on table vs compact list layout, columns, and styling

### Diff tool integration
- Diff tool path configurable in P4Now's settings dialog (not relying on P4DIFF env var)
- User primarily uses VS Code diff — ensure `code --diff` works as a first-class option
- Comparison options: diff against previous revision OR against current workspace file (not arbitrary revision pairs)
- Diff also launchable from pending changes view (workspace file vs have revision)

### Search experience
- Search icon in the top-right header area; clicking it reveals a search text input (GitKraken-style)
- Single unified text box — auto-detects if input is changelist number, user, keyword, or file path
- Searchable fields: changelist number, description text, author/user, file path
- Claude's discretion on results display (dropdown vs panel)

### Navigation & access points
- File history accessed via right-click context menu ("File History") on files in file tree and pending changes
- Diff from pending changes accessed via right-click context menu ("Diff against have")
- Search result changelists expand inline to show details (files changed, description, etc.)
- Expanded search results have diff and history actions on individual files

### Claude's Discretion
- History viewer layout style (table rows vs compact list)
- History viewer column selection and styling
- Search results display approach (dropdown vs panel)
- All technical implementation details

</decisions>

<specifics>
## Specific Ideas

- Search bar inspired by GitKraken — icon in header that expands to text input on click
- VS Code diff (`code --diff`) as primary diff tool experience
- Search should feel fast and unified — one box, smart parsing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-history-diff-search*
*Context gathered: 2026-01-29*
