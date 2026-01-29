# Phase 06: Shelve & Reconcile - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Shelve/unshelve files in changelists and reconcile offline work with a preview before applying. Users can shelve pending files, view shelved files, unshelve them back, delete shelves, and run workspace reconcile to detect offline edits/adds/deletes. Shelf diffing and advanced merge are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Shelf display & interaction
- Shelved files appear in a separate "Shelved" section below pending files within the same changelist
- Shelving is triggered at the file level — user selects specific files to shelve (like P4V's shelve dialog)
- After shelving, files remain checked out — both shelf and workspace have the changes
- Unshelving goes back to the shelf's original changelist, no target CL prompt
- Unshelve is all-or-nothing — no partial file selection from a shelf
- Explicit "Delete Shelf" action available in the shelved files section

### Unshelve conflict handling
- Claude's Discretion: conflict warning and resolution approach (safest option)
- Claude's Discretion: unshelve preview/confirmation behavior (safety vs speed tradeoff)

### Reconcile preview flow
- Claude's Discretion: preview presentation (dialog vs panel — match existing UI patterns)
- Individual file selection with checkboxes — user picks which detected changes to reconcile
- Reconciled files go to the changelist the files are already associated with (no changelist picker)
- Claude's Discretion: grouping by type vs flat list (match existing patterns)

### Reconcile scope & triggers
- Dedicated "Reconcile" toolbar button in the main header
- Always scans the entire workspace (no folder scoping)
- On demand only — no automatic reconcile on launch or workspace switch
- Claude's Discretion: progress feedback during scan (match existing progress patterns)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-shelve-reconcile*
*Context gathered: 2026-01-29*
