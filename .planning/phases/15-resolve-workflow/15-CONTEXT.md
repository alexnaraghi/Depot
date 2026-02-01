# Phase 15: Resolve Workflow - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Conflict detection and external merge tool integration. Users see which files have conflicts after sync/unshelve, launch their configured merge tool, and mark files resolved. No new file operations or changelist capabilities — just the resolve flow end-to-end.

</domain>

<decisions>
## Implementation Decisions

### Conflict indicators
- Warning icon overlay on existing file icon (similar to VS Code merge conflict markers)
- Conflicted files stay in their normal changelist position (no separate section)
- Detail pane shows yellow/orange conflict banner at top of file detail view with action buttons
- Conflict count indicator: Claude's discretion on whether aggregate count is needed

### Merge tool launch
- Launch from both: right-click context menu AND conflict banner button in detail pane
- Uses P4MERGE from P4 environment (standard Perforce behavior, no custom settings)
- If P4MERGE not set: show error message explaining how to set it, with link to Perforce docs
- While merge tool is open: blocking overlay dims the app with "Waiting for merge tool..." message, prevents other operations

### Resolution feedback
- After successful merge tool exit: Claude's discretion on auto-resolve vs confirm
- After failed/cancelled merge: warning toast, file stays conflicted, user can retry
- Quick-resolve buttons (Accept Theirs / Accept Yours) in the conflict banner alongside Launch Merge Tool
- Quick-resolve confirmation: Claude's discretion based on destructiveness

### Multi-file conflicts
- Multi-file resolve approach: Claude's discretion (one-at-a-time vs sequential resolve-all)
- Batch accept (Accept All Theirs/Yours): Claude's discretion on safety vs convenience
- Submit blocked if changelist has unresolved conflicts (show message listing unresolved files)

### Claude's Discretion
- Conflict detection timing (after sync/unshelve only vs also on refresh)
- Conflict count aggregate indicator placement (if any)
- Auto-resolve after merge tool success vs confirmation dialog
- Quick-resolve confirmation requirement
- Multi-file resolve UX (one-at-a-time vs resolve-all button)
- Batch accept availability
- Exact conflict banner styling and button layout

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint: P4MERGE from environment only, no custom merge tool settings in P4Now.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-resolve-workflow*
*Context gathered: 2026-02-01*
