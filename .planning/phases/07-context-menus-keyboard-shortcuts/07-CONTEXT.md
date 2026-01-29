# Phase 7: Context Menus & Keyboard Shortcuts - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

User can access all operations via right-click context menus, keyboard shortcuts, and a command palette. Builds on Quick Task 001 which already unified file context menus with shared FileContextMenuItems component.

</domain>

<decisions>
## Implementation Decisions

### Context menu coverage
- **Changelist header menu (NEW):** Submit, Shelve, Unshelve (if shelved files exist), New Changelist, Edit Description, Delete (empty CLs only), Revert (CLs with files)
- **Workspace file tree menu:** Existing items + Add, Get Revision (for non-checked-out files)
- **All file menus:** Add "Open in Explorer" option (opens file's folder in Windows Explorer)
- **Existing file menus stay:** FileContextMenu and ChangelistContextMenu already have shared file ops via FileContextMenuItems
- **Conditional actions:** Empty changelists show Delete; changelists with content show Revert instead. Individual files also get Revert.

### Keyboard shortcut design
- **Operations with shortcuts:** Refresh, Sync, Submit, Revert, Diff, History, New Changelist
- **Convention:** Match P4V defaults where they exist; VS Code-style (Ctrl+letter, Ctrl+Shift+letter) where P4V has no shortcut
- **Scope:** Context-sensitive — file-specific shortcuts (Revert, Diff, History) only active when a file is selected
- **Dialogs:** Claude's discretion on behavior when dialogs are open
- **Configurability:** Fixed defaults now, design so configuration can be added later (centralized shortcut registry)
- **New Changelist shortcut:** Yes, include a shortcut for quick CL creation

### Command palette
- **Trigger:** Both Ctrl+Shift+P and Ctrl+, open the palette
- **Commands:** Claude's discretion on which commands appear (all major operations)
- **Ordering:** Claude's discretion (recency, frequency, or alphabetical)
- **Scope:** Global commands only — not context-aware, same commands regardless of selection
- **Search:** Fuzzy search for filtering commands

### Menu & shortcut display
- **Context menus:** Right-aligned muted text for shortcut hints (VS Code style)
- **Toolbar tooltips:** Show shortcut in tooltip on hover, e.g., "Sync (Ctrl+Shift+S)"
- **Command palette:** Right-aligned muted shortcut text, consistent with context menus
- **Separators:** Claude's discretion on grouping related actions with separator lines

### Claude's Discretion
- Dialog keyboard behavior (suppress shortcuts or allow some)
- Command palette command list, ordering, and grouping
- Menu separator grouping logic
- Specific P4V shortcut mappings (research needed)
- Exact shortcut key assignments where P4V has no default

</decisions>

<specifics>
## Specific Ideas

- Match P4V keyboard shortcuts where they exist — user wants familiar muscle memory
- VS Code style (Ctrl+letter / Ctrl+Shift+letter) as fallback convention
- "Open in Explorer" for all file context menus — common developer workflow
- Changelist header menu should be smart: Delete for empty CLs, Revert for CLs with files

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-context-menus-keyboard-shortcuts*
*Context gathered: 2026-01-29*
