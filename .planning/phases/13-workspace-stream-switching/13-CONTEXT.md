# Phase 13: Workspace & Stream Switching - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Fast switching between P4 workspaces and streams via header UI without modal dialogs. Users see available workspaces/streams in dropdowns and can switch between them. Stream switching auto-shelves pending work to prevent loss. Read-only client spec viewing included.

</domain>

<decisions>
## Implementation Decisions

### Switcher UI
- Separate dropdowns for workspace and stream, positioned left of toolbar in header
- Current workspace/stream displayed as name only (no icons)
- Fix existing header label that incorrectly says "repository" — should say "workspace"
- Dropdown list metadata: Claude's discretion (e.g., root path for disambiguation if useful)

### Pre-switch safeguards
- Stream switching with pending files in default CL: show confirmation dialog listing what will be shelved, then shelve on confirm
- Numbered CLs during stream switch: Claude's discretion (pick safest approach — likely same confirm+shelve treatment)
- Workspace switching: no safeguard needed (P4CLIENT change, files are independent)
- No auto-unshelve on return — user manually unshelves via existing shelve UI

### Post-switch transition
- Loading state: Claude's discretion, but must be non-blocking (user can cancel or close app)
- Detail pane resets to workspace summary after switch (clean slate)
- Auto-sync after switch: Claude's discretion (pick safest default)
- Toast notification on successful switch ("Switched to workspace X")

### Client spec viewer
- Access method: Claude's discretion (pick most discoverable placement)
- Fields shown: Claude's discretion (useful subset vs full spec)
- Display location: Claude's discretion (dialog vs detail pane, based on existing patterns)
- Copy behavior: Claude's discretion

### Claude's Discretion
- Dropdown list metadata (root path, owner, etc.)
- Numbered CL handling during stream switch (likely confirm+shelve)
- Loading state pattern during switch (must remain non-blocking/cancellable)
- Whether to prompt for sync after switching
- Client spec viewer: access point, field selection, display location, copy interaction
- Error handling for failed switches (network issues, permission errors)

</decisions>

<specifics>
## Specific Ideas

- Header currently says "repository" above workspace name — fix to say "workspace"
- App must never freeze during switch operations — cancellable and responsive at all times (core project value)
- Toast notification pattern for switch confirmation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-workspace-stream-switching*
*Context gathered: 2026-02-01*
