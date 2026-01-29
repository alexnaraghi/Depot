# Phase 04: Changelist Management - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

User can organize pending work across multiple changelists with full CRUD and file movement. Includes viewing all pending changelists with files, creating/editing/deleting changelists, drag-and-drop file moves, right-click "Move to Changelist", and submitting any specific changelist.

Context menus and keyboard shortcuts for these operations are Phase 07 scope — this phase implements the underlying UI and interactions.

</domain>

<decisions>
## Implementation Decisions

### Changelist panel layout
- Accordion sections — each changelist is a collapsible section header with files listed below (P4V-style pending pane)
- Header shows: changelist number + description + file count (e.g. "#12345 — Fix login bug (3 files)")
- Files displayed as flat list with depot paths
- Files show P4 action icons (edit, add, delete) — same icons as the workspace file tree from v1.0

### File movement interactions
- Drag-and-drop: drag file(s) to target changelist's header bar to move
- Multi-select supported: Ctrl/Shift click to select multiple files, then drag or right-click to move all
- Visual feedback: highlight target header + change mouse cursor to indicate drag in progress (no ghost preview)
- Right-click context menu on files: "Move to Changelist" with submenu listing available changelists
- No inline hover button — context menu is the non-drag alternative

### Changelist CRUD behavior
- Create: Claude's discretion on inline vs dialog flow
- Edit description: edit button on header opens a dialog with textarea
- Delete: only enabled for empty changelists — cannot delete a changelist with files (button disabled/hidden)
- Delete empty changelists: no confirmation needed, immediate delete

### Default changelist handling
- Always displayed first, visually distinct from numbered changelists (muted styling, "Default" label)
- Always visible even when empty — serves as consistent anchor and drop target
- Can be submitted directly (P4 allows this, prompts for description)
- Description is not editable — editing the default CL description in P4 automatically creates a new numbered changelist with that description, so the default always has no description
- This P4 behavior should be reflected: if user tries to "edit" the default description, it should create a new numbered changelist

### Claude's Discretion
- Create changelist flow (inline vs dialog)
- Exact accordion expand/collapse animation
- Loading states for P4 operations (reopen, move, etc.)
- Styling details for drag feedback

</decisions>

<specifics>
## Specific Ideas

- Default changelist editing creates a numbered CL — this is core P4 behavior that the UI should reflect naturally
- Action icons should be consistent with the existing file tree icons from v1.0

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-changelist-management*
*Context gathered: 2026-01-29*
