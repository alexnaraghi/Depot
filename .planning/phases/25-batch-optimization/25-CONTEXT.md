# Phase 25: Batch Optimization - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Batch shelved file queries to eliminate N+1 p4 describe calls per changelist. All shelved file lists load from a single efficient backend operation instead of individual queries. This phase focuses solely on the batch loading mechanism - the UI for displaying shelved files already exists.

</domain>

<decisions>
## Implementation Decisions

### Error Isolation
- Continue processing other CLs when one CL's shelved query fails
- Show results for successful queries, log error for failed ones
- Fire yellow toast on partial failure with count-only summary (e.g., "Loaded 8 of 10 changelists")
- Point user to output window for detailed error information
- No visual distinction on failed CLs in UI (silent failure - just no shelved files shown)
- No manual retry option - failed CLs auto-retry on next refresh cycle
- Rate limit errors treated as partial success (show what loaded, toast warning, UI remains functional)

### Rate Limiting
- Claude's discretion on batching approach: research whether `p4 describe` supports multiple CL numbers in one command vs sequential individual queries
- If sequential queries are needed for error isolation: no delay between requests (fire as fast as possible)
- Ensure rate limit errors don't corrupt UI state - handle same as partial success scenario

### UI Feedback
- Overall progress indicator in status bar showing count-based progress: "Loading shelved files... (8/12)"
- All p4 commands must print to output window (existing pattern)
- Operation is cancellable via small cancel button in status bar next to spinner/progress indicator
- Trigger on panel load (automatic when changelist panel opens/refreshes)
- Partial results kept when user cancels mid-batch

### Claude's Discretion
- Exact batching implementation (single multi-CL command vs sequential individual queries)
- Progress update frequency during batch load
- Exact error message format in output window
- Whether to implement retry logic for individual failed CLs within the batch

</decisions>

<specifics>
## Specific Ideas

- Toast message format for partial success: simple count (e.g., "Loaded 8 of 10 changelists") without listing which CLs failed
- Rate limiting is a server-side concern - implementation should handle gracefully but not over-engineer prevention
- UI must never be left in a corrupted half-done state regardless of errors

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 25-batch-optimization*
*Context gathered: 2026-02-05*
