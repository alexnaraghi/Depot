# Phase 1: Non-Blocking Foundation - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish async-first architecture that prevents UI freezes, zombie processes, and enables operation cancellation. This is infrastructure — users experience it through responsiveness, not direct interaction. Covers process spawning, cancellation, cleanup, progress reporting, and error handling patterns.

</domain>

<decisions>
## Implementation Decisions

### Cancellation behavior
- Immediate kill on Cancel click — terminate process instantly, accept partial state
- Cancel button appears only during active cancellable operations (not always visible)
- One operation at a time — queue operations, show "operation in progress" if user tries another

### Progress feedback
- Progress bar when p4 provides progress info (e.g., sync), indeterminate spinner otherwise
- Dedicated status bar at bottom of window for operation status
- Collapsible output panel showing raw p4 command output for power users

### Error presentation
- Toast notifications for errors — non-blocking, auto-dismiss after 5-10 seconds
- Errors logged in the collapsible output panel for history/review
- No modal dialogs for errors

### Background operations
- Operations persist if user navigates away in app — status bar continues showing progress
- In-app notifications only — no Windows system notifications
- Close app during operation: just close and cleanup, no confirmation dialog (kill process immediately, ensure no zombies)

### Claude's Discretion
- Cancel feedback style (toast vs status update)
- Progress detail level (current file name vs totals only)
- Retry button presence in error toasts (based on error type)
- Completion notification style for background operations (toast vs status bar only)

</decisions>

<specifics>
## Specific Ideas

- Status bar should feel like VS Code's status bar — unobtrusive but informative
- Output panel like VS Code's terminal panel — collapsible, shows raw output for debugging
- The "never blocked" promise is core — UI must remain responsive at all times

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-non-blocking-foundation*
*Context gathered: 2026-01-27*
