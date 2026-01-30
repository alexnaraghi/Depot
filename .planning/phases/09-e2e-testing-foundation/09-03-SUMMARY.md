---
phase: 09-e2e-testing-foundation
plan: 03
subsystem: testing
tags: [webdriverio, tauri, e2e, plugin-store, settings, perforce]

# Dependency graph
requires:
  - phase: 09-01
    provides: WebdriverIO v9 + tauri-driver E2E test infrastructure
provides:
  - P4 connection settings pre-seeding for E2E test auto-connect
  - Environment variable-driven test configuration (P4E2E_PORT, P4E2E_USER, P4E2E_CLIENT)
  - Tauri plugin-store manipulation helper for test setup
affects: [10-bug-fixes, future-e2e-tests]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Settings seeding before app launch", "Environment variable validation in test helpers"]

key-files:
  created:
    - e2e/test/helpers/seed-settings.ts
  modified:
    - e2e/wdio.conf.ts

key-decisions:
  - "Pre-seed settings via filesystem before app launch (not via UI automation)"
  - "Validate all env vars at once and provide clear error message listing missing vars"
  - "Platform-aware Tauri store path resolution (Windows/Linux/macOS)"

patterns-established:
  - "E2E test helpers in e2e/test/helpers/ directory"
  - "Environment variable prefix P4E2E_ for test-specific configuration"

# Metrics
duration: 2min
completed: 2026-01-30
---

# Phase 09 Plan 03: E2E Settings Seeding Summary

**P4 connection settings auto-seeded from environment variables (P4E2E_PORT, P4E2E_USER, P4E2E_CLIENT) to Tauri plugin-store before app launch**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-30T09:07:50Z
- **Completed:** 2026-01-30T09:09:23Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- E2E tests auto-connect to P4 server without manual login
- Clear error messages when required environment variables are missing
- Cross-platform Tauri plugin-store path resolution

## Task Commits

Each task was committed atomically:

1. **Task 1: Create settings seeding helper and update wdio config** - `49969d1` (feat)

**Plan metadata:** (will be committed separately)

## Files Created/Modified
- `e2e/test/helpers/seed-settings.ts` - Reads P4E2E_* env vars, validates presence, writes settings.json to platform-specific Tauri store directory
- `e2e/wdio.conf.ts` - Updated onPrepare hook to call seedSettings before spawning tauri-driver, added env var documentation to prerequisites

## Decisions Made

**1. Pre-seed settings via filesystem before app launch (not via UI automation)**
- Rationale: Direct filesystem manipulation is faster, more reliable, and avoids brittle UI automation for settings configuration
- Alternative considered: Automate settings UI with WebdriverIO commands
- Rejected because: Settings screen automation would be slow, fragile, and require waiting for UI to render

**2. Validate all env vars at once and provide clear error message listing missing vars**
- Rationale: Better developer experience - see all missing vars at once rather than one at a time
- Error message includes example values and clear setup instructions

**3. Platform-aware Tauri store path resolution (Windows/Linux/macOS)**
- Rationale: E2E tests should work on all supported platforms without modification
- Implementation: Detects platform via process.platform and uses correct APPDATA/HOME/.config path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

E2E test users must set environment variables:
- P4E2E_PORT (e.g., "ssl:perforce:1666")
- P4E2E_USER (e.g., "jdoe")
- P4E2E_CLIENT (e.g., "jdoe-workspace")

This is documented in wdio.conf.ts prerequisites comment.

## Next Phase Readiness

**E2E Testing Foundation (Phase 09) COMPLETE**

All foundation elements in place:
- WebdriverIO v9 + tauri-driver configured (09-01)
- Core workflow test specs written (09-02)
- Settings auto-seeding for P4 connection (09-03)

E2E tests can now:
1. Auto-connect to P4 server via pre-seeded settings
2. Test all core workflows (sync, checkout, revert, submit)
3. Run against built app binary with generous timeouts for slow servers

**Blockers for future E2E work:**
- macOS does NOT support E2E testing (no WKWebView driver for tauri-driver)
- Users must manually run `npm run tauri build` before tests (no auto-build in wdio config)
- Tests are Windows/Linux only

**Ready for Phase 10:** Bug Fixes and Enhancements
- All 09-01 and 09-02 E2E test specs will verify bug fixes
- Settings seeding enables automated regression testing

---
*Phase: 09-e2e-testing-foundation*
*Completed: 2026-01-30*
