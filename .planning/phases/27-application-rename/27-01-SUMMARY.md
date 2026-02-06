---
phase: 27-application-rename
plan: 01
subsystem: configuration
tags: [tauri, branding, rename, cargo, package-json, licensing]

# Dependency graph
requires:
  - phase: 26-security-audit
    provides: Repository validated safe for public release
provides:
  - Application rebranded from "p4now" to "Depot" across all configuration files
  - Permanent bundle identifier "com.depot.app" established
  - MIT license established for open-source release
  - Version 0.1.0 set consistently across all package manifests
affects: [27-02-codebase-rename, 28-documentation, 29-release-automation, 30-final-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - LICENSE (MIT license)
  modified:
    - src-tauri/Cargo.toml (package name, lib name)
    - src-tauri/src/main.rs (lib reference)
    - src-tauri/tauri.conf.json (productName, identifier, window title)
    - package.json (package name)
    - index.html (browser title)

key-decisions:
  - "Bundle identifier set to 'com.depot.app' - PERMANENT (cannot change after public release)"
  - "MIT license established (replaced AGPL-3.0 per PROJECT.md requirements)"
  - "Product name uses title case 'Depot' consistently"

patterns-established: []

# Metrics
duration: 3min
completed: 2026-02-05
---

# Phase 27 Plan 01: Configuration Rename Summary

**Core application configuration rebranded from "p4now" to "Depot" with permanent bundle identifier "com.depot.app" and MIT license established**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-05T20:55:37Z
- **Completed:** 2026-02-05T20:58:53Z
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments
- Rust package and lib renamed from p4now/p4now_lib to depot/depot_lib with successful compilation
- Tauri configuration updated with "Depot" branding and permanent bundle identifier
- Frontend configuration (package.json, index.html) updated with Depot branding
- MIT license established, replacing AGPL-3.0 per PROJECT.md requirements

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Rust configuration** - `4ec8873` (refactor)
2. **Task 2: Update Tauri configuration** - `4cd1f02` (refactor)
3. **Task 3: Update frontend configuration** - `06fff52` (refactor)
4. **Task 4: Add MIT LICENSE file** - `c0c1712` (docs)

## Files Created/Modified
- `src-tauri/Cargo.toml` - Package name changed to "depot", lib name to "depot_lib"
- `src-tauri/src/main.rs` - Updated to call depot_lib::run()
- `src-tauri/tauri.conf.json` - Product name "Depot", identifier "com.depot.app", window title "Depot"
- `package.json` - Package name changed to "depot"
- `index.html` - Browser title changed to "Depot"
- `LICENSE` - MIT license (created/replaced AGPL-3.0)

## Decisions Made

**Bundle identifier permanence:** Set to "com.depot.app". This identifier is permanent - changing it after public release breaks user installations and settings migration on all platforms. Pre-v1.0 timing makes this change safe.

**License change from AGPL-3.0 to MIT:** PROJECT.md explicitly requires "Add MIT license and establish as open-source project". The existing AGPL-3.0 license was replaced with MIT. Pre-v1.0, no external contributors exist, making this a safe transition.

**Branding consistency:** Product name uses title case "Depot" consistently across all UI-facing configuration (tauri.conf.json productName and window title, index.html). Package names use lowercase "depot" per convention (Cargo.toml, package.json).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Replaced existing AGPL-3.0 license with MIT**
- **Found during:** Task 4 (Add MIT LICENSE file)
- **Issue:** Plan expected to create new LICENSE file, but AGPL-3.0 license already existed
- **Fix:** Replaced AGPL-3.0 with MIT license per PROJECT.md requirement: "Add MIT license and establish as open-source project"
- **Files modified:** LICENSE
- **Verification:** `ls LICENSE && head -3 LICENSE` confirms MIT License header with copyright 2026
- **Committed in:** c0c1712 (Task 4 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** License replacement aligns with explicit PROJECT.md requirement for MIT licensing. No scope creep - corrected to match project goals.

## Issues Encountered
None - all tasks completed as specified with Rust compilation verification successful.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Ready for Phase 27-02 (codebase rename). Core configuration files now consistently use "Depot" branding. Bundle identifier is permanent and cannot be changed after public release. All subsequent work will build on this foundation.

**Blockers:** None

**Notes for future phases:**
- Bundle identifier "com.depot.app" affects settings storage paths and E2E test configuration (will be updated in 27-02)
- Version display and dynamic window titles will be implemented in later plans
- Comprehensive grep verification for remaining "p4now" references will be performed in codebase rename plan

---
*Phase: 27-application-rename*
*Completed: 2026-02-05*
