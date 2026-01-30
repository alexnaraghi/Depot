# Phase 09: E2E Testing Foundation - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated regression testing infrastructure for core Perforce workflows (sync, checkout, submit, revert) using WebdriverIO + tauri-driver on Windows. No CI pipeline — local execution only for now.

</domain>

<decisions>
## Implementation Decisions

### Test environment setup
- Real Tauri window (not headless) — tests launch the actual app via tauri-driver
- Suite-level test isolation — shared setup per suite, not per-test
- Claude's Discretion: P4 server approach (real local p4d vs mocked) and server provisioning strategy

### Test structure & organization
- Tests organized by feature area (e.g., changelist.test.ts, file-operations.test.ts), not individual workflows
- Assertions are outcome-focused — verify end results (file checked out, CL submitted) without asserting intermediate UI states
- No screenshot capture on failure — logs only
- Claude's Discretion: Page Object pattern vs direct selectors

### CI integration
- Local only for now — no CI pipeline in this phase
- Console output only for test results (no HTML reports)
- Single npm script: `npm run test:e2e` that builds app + runs all tests
- Claude's Discretion: Whether tests can run individually by file/suite

### Test data & state
- State reset between suites by reverting all pending changes (not fresh workspace)
- Validate UI state only — assert the UI shows correct status after operations. P4 server-side validation deferred.
- Claude's Discretion: File types in fixtures (text-only vs mixed), P4 server management (self-managed vs external)

</decisions>

<specifics>
## Specific Ideas

- "To start we will prioritize that the UI state updates correctly" — UI-first validation, server-side checks can come later
- Windows-only (macOS does not support E2E testing with WKWebView driver)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-e2e-testing-foundation*
*Context gathered: 2026-01-29*
