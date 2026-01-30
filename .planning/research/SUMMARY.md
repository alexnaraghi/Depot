# Project Research Summary

**Project:** P4Now v3.0
**Domain:** Desktop Perforce GUI (Tauri 2.0 + React 19)
**Researched:** 2026-01-29
**Confidence:** HIGH

## Executive Summary

P4Now v3.0 builds on a validated v2.0 foundation (Tauri 2.0, React 19, TanStack Query, react-arborist) to add five critical workflows that daily Perforce users expect: conflict resolution, depot browsing, workspace/stream switching, auto-refresh, and E2E testing. The research shows these features integrate cleanly with existing architecture, require minimal new dependencies (only WebdriverIO for E2E testing), and primarily leverage patterns already proven in v2.0.

The recommended approach prioritizes low-risk, high-value features first: auto-refresh (pure query configuration), actionable search (UI-only enhancement), and workspace switching (proven command infrastructure). These validate integration patterns before tackling complex features like resolve workflow (multi-step state machine with external tool integration) and depot browser (lazy-loading tree with performance constraints). E2E testing infrastructure runs in parallel since it's isolated from feature development.

Key risks center on state management complexity: resolve state synchronization after external merge tools complete, query invalidation race conditions during auto-refresh polling, numbered changelist conflicts during stream switching, and memory exhaustion from eager depot tree loading. All risks have documented mitigation patterns from official Perforce/Tauri sources. The architecture's existing ProcessManager, TanStack Query invalidation, and react-arborist virtualization provide the foundation needed to avoid these pitfalls.

## Key Findings

### Recommended Stack

The v3.0 stack leverages v2.0's validated foundation with only one new dependency category: WebdriverIO for E2E testing. All features (resolve, depot browser, workspace switching, auto-refresh) work with existing libraries.

**Core technologies:**
- **WebdriverIO 9.23.0**: E2E testing orchestration — Official Tauri-recommended solution using W3C WebDriver standard
- **tauri-driver (latest)**: WebDriver-Tauri bridge — Enables WebDriver protocol to control Tauri app on Windows/Linux
- **TanStack Query 5.90.20**: Auto-refresh polling — Built-in `refetchInterval` option eliminates need for custom polling library
- **react-arborist 3.4.3**: Depot tree virtualization — Already used for changelist trees; handles 10,000+ nodes efficiently
- **tauri-plugin-opener 2**: External tool launching — Already used for diff tool; works for merge tools and editors

**What NOT to add:**
- Playwright (Tauri APIs don't work in Playwright browser mode; requires CDP workarounds)
- Custom polling library (TanStack Query `refetchInterval` covers all auto-refresh needs)
- New tree library (react-arborist already handles large virtualized trees)

**Critical version note:** macOS does NOT support E2E testing (no WKWebView driver available). E2E tests run on Windows/Linux only.

### Expected Features

Research identified 11 P1 features for v3.0 launch (daily driver readiness) and 9 P2/P3 features for post-launch based on contributor feedback.

**Must have (table stakes):**
- Resolve workflow: Conflict detection after sync, launch external merge tool, accept source/target/merged options
- Depot browser: Full hierarchy tree, sync files/folders, checkout, view history, diff operations
- Workspace switching: Select different workspace, show available workspaces
- Stream switching: Change current stream, auto-shelve default CL files
- Auto-refresh: Periodic workspace polling, file status updates, manual refresh action
- Search: Interact with file results (diff, history, checkout), jump to changelist/author

**Should have (competitive advantage):**
- Non-blocking resolve workflow (vs P4V's modal dialogs)
- Fast depot tree lazy loading (vs P4V's slow upfront load)
- Workspace switch without modal dialog (header dropdown vs P4V's dialog)
- Smart auto-refresh polling (pause when window inactive vs P4V's constant polling)
- Unified omnisearch (single search box vs P4V's separate dialogs)

**Defer (v2+):**
- Batch resolve operations
- Depot folder diff
- Stream sync size preview before switching
- Multi-file history view
- Keyboard-first depot navigation

### Architecture Approach

v3.0 integrates seamlessly with v2.0's proven architecture: Rust backend spawning p4.exe processes via ProcessManager, TanStack Query for data fetching, Zustand for state, shadcn/ui for components. No architectural changes needed.

**Major components:**

1. **Resolve Module** (`src-tauri/src/commands/resolve.rs`) — Runs `p4 resolve -n` for preview, `p4 resolve -am/-at/-ay` for acceptance, launches merge tool with `.wait()` to block until completion, then marks resolved server-side

2. **Depot Browser** (`src/components/DepotBrowser/`) — Clones FileTree pattern with react-arborist, lazy-loads directories on expand via `p4 dirs <path>/*` (single level only), uses existing file operations (sync, checkout, history)

3. **Workspace/Stream Switcher** (`src/hooks/useWorkspaceSwitcher.ts`) — Updates connectionStore, clears P4CLIENT env var explicitly in Rust, invalidates ALL queries via `queryClient.clear()`, verifies success with `p4 info`

4. **Auto-Refresh** (query configuration) — Adds `refetchInterval` to existing TanStack Query hooks, gates polling with `enabled: !isOperationActive` flag from operationStore, uses `refetchIntervalInBackground: false` to pause when minimized

5. **E2E Testing** (`e2e-tests/`) — WebdriverIO with tauri-driver, mocks Tauri dialog APIs for testability, uses `browser.execute()` workaround for `.click()` bugs, runs on Windows/Linux CI runners only

**Integration patterns:**
- Query invalidation cascade: Workspace/stream switch → `queryClient.clear()` → refetch all data
- Lazy loading with enabled flag: Depot tree → `enabled: isExpanded` → fetch only when user expands node
- Conditional auto-refresh: `refetchInterval: autoRefresh && !isOperationActive ? 30000 : false`
- State-based navigation: Search result click → `changelistStore.setExpandedChangelist(id)` → scroll into view

### Critical Pitfalls

Research identified 7 critical pitfalls, all with documented prevention strategies:

1. **Resolve state inconsistency after external merge tool** — External merge tool closes but file remains "needs resolve" in UI. Prevention: Use `child.wait()` to block until tool closes, capture exit code, run `p4 resolve -am` only on success, invalidate file queries immediately.

2. **Query invalidation race conditions during auto-refresh** — Auto-refresh polls every 30s, user starts sync, both spawn p4.exe processes that race to update cache, causing stale data overwrites and process leaks. Prevention: Disable auto-refresh during active operations via `enabled: !isOperationActive` flag, use `staleTime: 30000` to prevent thrashing.

3. **Numbered changelist files block stream switching** — User has files in numbered CL #1234, stream switch fails with "Cannot switch streams. Files opened in numbered changelist." Prevention: Pre-flight validation checks for numbered CLs, shows shelve-and-switch dialog, implements atomic shelve-then-switch workflow.

4. **Depot tree browser loads entire depot into memory** — App runs `p4 dirs //...` to fetch 50,000+ files, UI freezes 30s, memory spikes 800MB, may crash with OOM. Prevention: Lazy load on folder expand (one level at a time), use `p4 dirs <path>/*` not `//...`, virtualize with react-arborist, cache with long staleTime.

5. **Workspace switching doesn't clear P4 environment inheritance** — Settings update but p4.exe inherits P4CLIENT from system env, queries return files from old workspace. Prevention: Always clear `P4CLIENT` env var in Rust before setting new value, verify with `p4 info`, clear ALL query cache after switch.

6. **E2E tests can't interact with native system dialogs** — Test clicks button that opens native file picker, WebDriver can't interact with OS-level dialog, test hangs and times out. Prevention: Define E2E scope (UI only), mock Tauri dialog APIs in test mode, use `browser.execute()` workaround for click bugs, test backend separately with Rust unit tests.

7. **Unshelve to same CL conflicts with stream-switch auto-shelve** — User shelves numbered CL #1234 on Stream A, switches to Stream B, unshelves CL #1234 but it doesn't exist on Stream B, files go to default CL unexpectedly. Prevention: Check if target CL exists before unshelving, show dialog offering to create matching CL or unshelve to default, detect conflicts and trigger resolve workflow.

## Implications for Roadmap

Based on research, suggested 6-phase structure that progresses from low-risk query configuration to complex multi-step workflows:

### Phase 1: Foundation (Auto-Refresh)
**Rationale:** Lowest risk, validates query patterns, no new components, pure configuration of existing TanStack Query hooks
**Delivers:** Configurable auto-refresh with user toggle, smart polling that pauses during operations and when window inactive
**Addresses:** Auto-refresh features from FEATURES.md (periodic polling, file status updates, manual refresh)
**Avoids:** Pitfall #2 (query invalidation races) by implementing operation gating from day 1

### Phase 2: Navigation (Actionable Search)
**Rationale:** Pure frontend enhancement, builds on existing search, validates state-based navigation pattern
**Delivers:** Clickable search results that expand changelist and scroll into view, context menu for operations
**Addresses:** Search interactivity features from FEATURES.md (interact with results, jump to changelist/author)
**Uses:** Existing changelistStore extended with `setExpandedChangelist` method

### Phase 3: Workspace Management (Switching)
**Rationale:** Tests architecture's flexibility for global state changes, establishes env var clearing pattern, enables stream switching
**Delivers:** Workspace dropdown selector, stream switcher with auto-shelve, query invalidation cascade
**Addresses:** Workspace/stream switching features from FEATURES.md
**Avoids:** Pitfall #5 (env inheritance) and #3 (numbered CL blocks) with pre-flight checks and explicit env clearing
**Implements:** Query invalidation cascade pattern from ARCHITECTURE.md

### Phase 4: Depot Browser
**Rationale:** Larger feature but self-contained, reuses FileTree pattern, validates lazy loading architecture
**Delivers:** Lazy-loaded depot hierarchy tree, basic operations (sync, checkout, history, diff)
**Addresses:** Depot browser features from FEATURES.md (tree view, operations)
**Avoids:** Pitfall #4 (memory exhaustion) with lazy loading on folder expand, never querying `//...`
**Uses:** Existing react-arborist with `enabled: isExpanded` pattern from ARCHITECTURE.md

### Phase 5: Resolve Workflow
**Rationale:** Complex multi-step state machine, touches multiple areas, requires careful external tool integration
**Delivers:** Conflict detection after sync/unshelve, external merge tool launching with proper wait/verify, accept source/target/merged
**Addresses:** Resolve workflow features from FEATURES.md
**Avoids:** Pitfall #1 (resolve state inconsistency) with `child.wait()`, exit code validation, server-side marking, query invalidation
**Implements:** Similar pattern to existing ReconcilePreviewDialog, reuses tauri-plugin-opener

### Phase 6: E2E Testing (Parallel Track)
**Rationale:** Independent of feature development, can start anytime, validates completed features incrementally
**Delivers:** WebdriverIO infrastructure, initial test specs for connection/changelist/file operations, CI integration
**Addresses:** E2E testing requirement from STACK.md
**Avoids:** Pitfall #6 (dialog interaction) by defining clear scope (UI only), mocking Tauri APIs in test mode
**Uses:** WebdriverIO 9.23.0 + tauri-driver from STACK.md, Windows/Linux CI runners only

### Phase Ordering Rationale

- **Phases 1-2 validate patterns:** Auto-refresh tests query coordination, search tests state-based navigation. Both low-risk, build confidence.
- **Phase 3 establishes global state management:** Workspace switching requires invalidating everything, clearing env vars, verifying success. Must work before stream switching depends on it.
- **Phase 4 tests lazy loading architecture:** Depot browser is largest feature but self-contained. Success proves lazy loading pattern for future features.
- **Phase 5 deferred to end:** Resolve workflow most complex (external tool + state machine + server-side marking). Build expertise with simpler features first.
- **Phase 6 runs parallel:** E2E testing infrastructure independent of features. Can start during Phase 1 and incrementally add tests as features complete.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Resolve):** External merge tool integration has edge cases (exit codes, timeout handling, P4MERGE vs other tools). May need `/gsd:research-phase` for tool-specific patterns.
- **Phase 3 (Stream Switching):** Auto-shelve workflow interaction with numbered CLs has subtleties. May need validation with real Perforce server testing.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Auto-Refresh):** TanStack Query `refetchInterval` is well-documented, official examples exist
- **Phase 2 (Actionable Search):** Standard React state management and DOM scrolling, no unknowns
- **Phase 4 (Depot Browser):** react-arborist lazy loading is established pattern from v2.0 changelist trees
- **Phase 6 (E2E Testing):** Official Tauri WebdriverIO guide provides complete setup

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Tauri/TanStack docs, verified npm versions, existing v2.0 patterns |
| Features | HIGH | Official P4V documentation, Perforce command reference, verified workflows |
| Architecture | HIGH | Extends proven v2.0 architecture, no breaking changes, integration points clear |
| Pitfalls | HIGH | Official Perforce resolve docs, Tauri WebDriver docs, TanStack Query issues/discussions |

**Overall confidence:** HIGH

### Gaps to Address

Research was comprehensive, but some areas need validation during implementation:

- **P4MERGE vs other merge tools:** Research focused on P4MERGE (Perforce official tool). Supporting other tools (Beyond Compare, KDiff3, VS Code) may require tool-specific exit code mapping. Handle during Phase 5 with extensible tool configuration.

- **Large depot performance:** Lazy loading pattern is sound, but actual performance with 100k+ file depots needs validation. May need additional optimizations (search-to-jump, bookmarks) in v3.x based on user feedback.

- **WebdriverIO version compatibility:** tauri-driver may require downgrading to WebdriverIO v7 (docs show v9, but community reports compatibility issues). Verify during Phase 6 setup; prepared to adjust versions.

- **Stream auto-shelve edge cases:** P4V auto-shelves default CL only; research suggests extending to numbered CLs is valuable but needs testing. Validate during Phase 3 with real multi-stream workflows.

- **Auto-refresh optimal intervals:** Research suggests 30s for changelists, 60s for files, but optimal values depend on server performance and network latency. Make configurable in settings, let users tune.

## Sources

### Primary (HIGH confidence)
- [Tauri v2 WebDriver Testing](https://v2.tauri.app/develop/tests/webdriver/) — E2E testing approach
- [TanStack Query Auto Refetching](https://tanstack.com/query/v4/docs/framework/react/examples/auto-refetching) — Polling patterns
- [p4 resolve Command Reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_resolve.html) — Resolve workflow
- [p4 dirs Command Reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_dirs.html) — Depot directory queries
- [p4 switch Command Reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_switch.html) — Stream switching
- [Resolve files | P4V Documentation](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/branches.resolve.html) — UI workflow
- [Shelve streams | P4V Documentation](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/streams.shelved.html) — Auto-shelve behavior

### Secondary (MEDIUM confidence)
- [react-arborist performance discussion](https://blog.openreplay.com/interactive-tree-components-with-react-arborist/) — Virtualization for 10,000+ nodes
- [WebDriver Tauri GitHub Issue #10670](https://github.com/tauri-apps/tauri/issues/10670) — Setup issues and workarounds
- [TanStack Query invalidation race Discussion #6953](https://github.com/TanStack/query/discussions/6953) — Stale UI during races
- [P4V usability issues - GitHub Gist](https://gist.github.com/gorlak/abbf2ed0b60169afd4189744a7d0c38b) — Competitive analysis

### Tertiary (LOW confidence)
- [Playwright CDP with Tauri](https://github.com/Haprog/playwright-cdp) — Why NOT to use Playwright (requires workarounds)
- [Custom Merge Tool Bug #2529](https://github.com/fork-dev/TrackerWin/issues/2529) — Exit code handling issues

---
*Research completed: 2026-01-29*
*Ready for roadmap: yes*
