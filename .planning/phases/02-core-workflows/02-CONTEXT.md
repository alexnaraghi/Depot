# Phase 2: Core Workflows - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement daily Perforce operations — sync, checkout, changelist view, submit, revert — with the non-blocking UI foundation from Phase 1. Users can sync their workspace, check out files for editing, organize work into changelists, submit changes, and revert files. Diff view, file history, shelving, and other advanced features belong in future phases.

</domain>

<decisions>
## Implementation Decisions

### File/Workspace View
- Tree view (hierarchical folders, expand/collapse like VS Code explorer)
- Each file shows: status icon, file type icon, revision number (#rev)
- Show all workspace files (full tree), not just files with activity
- Interactions: right-click context menu AND toolbar for selected files

### Changelist Management
- Sidebar panel showing pending changelists (always visible)
- Users can create multiple named changelists
- Move files between changelists via drag and drop
- Each changelist displays: file count, description preview, status badge, expandable file list

### Sync Workflow
- Sync immediately (no preview step), show progress as it runs
- File-by-file progress display (scrolling log of each file as it syncs)
- On conflict (local edit vs incoming): stop sync and show alert dialog for user decision
- Global "Sync" button for whole workspace + folder-level sync via right-click

### File State Feedback
- Color-coded icons for file states (green=synced, blue=checked out, etc.)
- Wait for server confirmation before updating UI (no optimistic updates)
- Empty states: simple text message ("No pending changes" etc.)

### Claude's Discretion
- Whether to add a status bar summary of file state counts
- Exact color palette for state icons
- Empty state message wording
- Tree virtualization strategy for large workspaces
- Toolbar icon selection and layout

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches that fit the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-core-workflows*
*Context gathered: 2026-01-27*
