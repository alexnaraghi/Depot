# Phase 24: Tree Performance + Delta Refresh - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Make file tree updates incremental (no full rebuilds when <10% changes) and auto-refresh efficient (queries only changed files). Unchanged subtrees preserve object identity for react-arborist. Delta refresh merges incrementally without flicker or scroll position loss.

</domain>

<decisions>
## Implementation Decisions

### Auto-refresh timing
- Intervals are user-configurable in settings (existing auto-refresh setting already present)
- Default: 30s for opened/shelved files, 5min for full workspace refresh
- Auto-refresh pauses when app window loses focus (save resources)
- On focus return: refresh immediately if interval elapsed while unfocused, otherwise wait for normal interval

### Change notifications
- All p4 commands log to Output window (existing project requirement)
- No toast/popup notifications for auto-refresh changes
- Tree updates silently — data just stays fresh

### Claude's Discretion
- Exact threshold calculation for "10% change" heuristic
- Batch update implementation details for file tree store
- Object identity preservation strategy for react-arborist
- Delta merge algorithm specifics

</decisions>

<specifics>
## Specific Ideas

- Leverage existing auto-refresh settings infrastructure
- Output window already captures p4 command activity — no new notification system needed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-tree-performance-delta-refresh*
*Context gathered: 2026-02-04*
