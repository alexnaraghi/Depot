# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive even during network issues or long-running operations.
**Current focus:** Phase 11.1 complete — Three-Column Layout

## Current Position

Milestone: v3.0 Daily Driver
Phase: 15 of 15 (Resolve Workflow)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-02-01 — Completed 15-02 (Resolve Frontend UI)

Progress: [███████░░░] 70% (28 of ~40 estimated plans for v3.0)

## Performance Metrics

**Velocity:**
- Total plans completed: 58 (14 v1.0 + 17 v2.0 + 27 v3.0)
- Quick tasks completed: 6
- Average duration: 6 min
- Total execution time: ~376 min (104 v1.0 + ~112 v2.0 + 160 v3.0)

**By Phase (v3.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 09 | 3 | 16 min | 5 min |
| 10 | 2 | 9 min | 5 min |
| 11 | 2 | 9 min | 5 min |
| 11.1 | 5 | 44 min | 9 min |
| 12 | 4 | 38 min | 10 min |
| 13 | 5 | 25 min | 5 min |
| 14 | 3 | 15 min | 5 min |
| 15 | 2 | 10 min | 5 min |

**Recent Trend:**
- Last 5 plans: 4 min (14-02), 8 min (14-03), 3 min (15-01), 7 min (15-02)
- Trend: Phase 15 complete, resolve workflow end-to-end functional
- Phase 15-01: Resolve backend commands (3 min)
- Phase 15-02: Resolve frontend UI (7 min)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting v3.0 work:

- External diff tool only (v2.0) — Same pattern for merge tools in Phase 15
- TanStack Query + Zustand (v2.0) — Auto-refresh uses `refetchInterval` in Phase 11
- Query invalidation pattern (v2.0) — Critical for workspace/stream switching in Phase 13
- P4 env var isolation (v2.0) — Must clear P4CLIENT explicitly when switching workspaces
- react-arborist (v2.0) — Reuse for depot browser virtualization in Phase 14
- WebdriverIO v9 + tauri-driver (v3.0/09-01) — Standard Tauri E2E testing pattern
- Data-testid selector pattern (v3.0/09-01) — Sanitize special chars with hyphens for stable test selectors
- Await .length pattern (v3.0/09-02) — WebdriverIO v9 ChainablePromiseArray requires awaiting .length property
- Generous E2E timeouts (v3.0/09-02) — 30s for P4 operations, 10s for UI interactions to handle slow servers
- Pre-seed settings via filesystem (v3.0/09-03) — Direct plugin-store manipulation before app launch, not UI automation
- P4E2E_ env var prefix (v3.0/09-03) — Test-specific P4 connection configuration separate from user's P4CONFIG
- Optimistic updates for drag-drop (v3.0/10-01) — cancelQueries + snapshot + rollback pattern prevents UI flicker on error
- Targeted query invalidation (v3.0/10-01) — Use refetchType: 'all' to force immediate refetch instead of blanket invalidation
- Separate source/target CL params (v3.0/10-02) — Enables future unshelve-to-different-CL UI while maintaining backward compatibility
- Post-operation conflict detection (v3.0/10-02) — Non-blocking async checks in onSuccess callbacks with graceful error handling
- TanStack Query refetchInterval for auto-refresh (v3.0/11-01) — Use built-in polling instead of custom setInterval, conditional based on connection + operation + window focus + user preference
- Pause auto-refresh during operations (v3.0/11-01) — Check useOperationStore.currentOperation to prevent query invalidation mid-operation
- Default 5-minute auto-refresh (v3.0/11-01) — 300000ms default with 0 = disabled, max 10 minutes
- Window focus tracking via Tauri events (v3.0/11-01) — Use tauri://focus and tauri://blur events to pause auto-refresh when window is inactive
- Native file picker for path selection (v3.0/11-02) — Use tauri-plugin-dialog's open() instead of manual path entry for better UX
- Preset dropdown for intervals (v3.0/11-02) — Select component with preset options prevents invalid configuration values
- DetailSelection discriminated union (v3.0/11.1-01) — Type-safe selection handling with none, file, changelist, revision types
- Navigation history depth limiting (v3.0/11.1-01) — Max 3 items in back stack prevents memory bloat during deep navigation
- Separate select vs drill actions (v3.0/11.1-01) — Side column clicks reset history (selectFile/selectChangelist), detail pane clicks preserve history (drillToFile/drillToRevision)
- Three-column layout always visible (v3.0/11.1-01) — Removed sidebar collapse functionality, all columns always shown with independent resize handles
- Query cache reads for dashboard stats (v3.0/11.1-02) — WorkspaceSummaryView uses queryClient.getQueryData() to read from existing cache instead of making new queries
- Inline file history (v3.0/11.1-02) — History embedded directly in FileDetailView instead of separate dialog, clickable rows drill into revision detail
- Conditional action buttons (v3.0/11.1-02) — File action buttons shown/hidden based on file status from fileTreeStore for better UX
- Reuse existing dialogs for detail views (v3.0/11.1-03) — SubmitDialog and EditDescriptionDialog imported from ChangelistPanel directory to maintain consistency
- Revision sibling files placeholder (v3.0/11.1-03) — Backend lacks p4_describe for submitted CLs, placeholder with TODO for future backend enhancement
- Breadcrumb visibility pattern (v3.0/11.1-04) — Breadcrumb hides when selection.type === 'none' (workspace summary has no navigation)
- Escape key in DetailPane (v3.0/11.1-04) — Global keyboard handler added to DetailPane via useEffect, works even when breadcrumb not rendered
- Side column click preservation (v3.0/11.1-04) — Click handlers additive to existing behavior, preserve expand/collapse, drag-drop, context menus
- Column width persistence (v3.0/11.1-05) — Tauri-plugin-store with layout.leftColumnWidth (280) and layout.rightColumnWidth (320), load on mount and save on mouseup
- FileHistoryDialog migration (v3.0/11.1-05) — Removed from FileTree and ChangelistPanel, Ctrl+H navigates to inline file detail view instead of opening modal dialog
- Layout resize fix (v3.0/11.1-05) — Flex columns need flexShrink: 0 to prevent shrinking when explicit widths set
- No debounce on search input (v3.0/12-01) — Instant filtering on every keystroke, useDeferredValue in consumers (Plan 02) handles performance
- Event-based search focus (v3.0/12-01) — MainLayout dispatches 'p4now:focus-search' event, SearchBar listens to avoid ref passing
- Progressive Escape key behavior (v3.0/12-01) — First Escape clears text, second Escape blurs (prevents accidental unfocus)
- useDeferredValue for filter performance (v3.0/12-02) — Wrap filterTerm with useDeferredValue to avoid blocking UI renders during rapid typing
- Dimming over hiding (v3.0/12-02) — Non-matching items dimmed (opacity-30) instead of removed to preserve tree structure and spatial context
- Non-interactive dimmed items (v3.0/12-02) — Dimmed items have pointer-events-none, tabIndex=-1, aria-hidden=true for full accessibility
- Folder/CL header visibility rule (v3.0/12-02) — Headers remain visible if description matches OR any children match (prevents orphaned children)
- Client-side submitted CL filtering (v3.0/12-03) — Reuses query cache, filters 500 prefetched CLs on keystroke for instant results
- Search input in view not prompt (v3.0/12-03) — Command palette opens search view with focused input instead of window.prompt
- Context menus on search results (v3.0/12-03) — Right-click shows Copy/View operations matching FileNode/ChangelistNode patterns
- Clickable author names for filtering (v3.0/12-03) — Clicking author in submitted CL results filters to that author's changes
- Filter-active background tint (v3.0/12-04) — bg-blue-950/20 tint on filtered columns provides visual feedback when searchFilterStore.isActive is true
- Result-click dismisses filter (v3.0/12-04) — Clicking matching items clears filter after navigation to show full context
- Toolbar search integration (v3.0/12-04) — Toolbar search bar shows submitted CL results in detail pane, not just column filtering
- Workspace switcher in header (v3.0/13-02) — Radix Select dropdown with root path metadata, invalidates all queries and resets detail pane on switch
- Auto-shelve for default CL (v3.0/13-03) — Stream switching shelves default CL files by creating new numbered CL, reopening files, then shelving
- Pre-switch file confirmation (v3.0/13-03) — ShelveConfirmDialog shows grouped file list before stream switch with open files
- Graceful degradation for disconnected states (v3.0/13-05) — Header components show static fallback text when server unavailable instead of hiding or null
- p4_dirs empty result handling (v3.0/14-01) — "no such file(s)" errors return empty array for graceful UI handling
- depot_type field naming (v3.0/14-01) — Use depot_type instead of type to avoid reserved keyword conflicts
- Accordion persistence (v3.0/14-02) — Store accordion section open/closed state in localStorage for UI state persistence across sessions
- Lazy loading on toggle (v3.0/14-02) — Load depot subdirectories only when user expands folder to prevent memory exhaustion with large depots
- Local tree state for depot (v3.0/14-02) — Use local useState for tree data instead of TanStack Query cache, query cache used only for directory listings
- P4MERGE env var with MERGE fallback (v3.0/15-01) — launch_merge_tool checks P4MERGE first, then MERGE, with descriptive error if neither set
- spawn_blocking for merge tool wait (v3.0/15-01) — Use tokio::task::spawn_blocking to wrap std::process::Command for blocking wait without blocking async runtime
- Timestamp-based temp file names (v3.0/15-01) — SystemTime UNIX timestamp creates unique temp file names for base/theirs extractions to avoid collisions
- Best-effort temp cleanup (v3.0/15-01) — Remove temp files after merge tool exits using `let _ = std::fs::remove_file()` pattern (ignore cleanup errors)
- No auto-refetch for conflicts (v3.0/15-02) — useUnresolvedFiles has no refetchInterval, conflicts detected only on manual refresh/sync/unshelve
- Conflict banner in FileDetailView (v3.0/15-02) — Yellow banner at top with Launch Merge Tool, Accept Theirs, Accept Yours buttons
- ResolveBlockingOverlay pattern (v3.0/15-02) — Full-screen modal prevents UI interaction during merge tool execution with preventDefault on escape/outside click
- Confirmation after merge tool (v3.0/15-02) — Show ResolveConfirmDialog after merge tool exits with code 0 before auto-accepting result (prevents data loss on tool cancel)
- Destructive styling for Accept Theirs (v3.0/15-02) — Red/destructive button styling with warning message about discarding local changes
- Soft submit blocking (v3.0/15-02) — Submit shows toast error with unresolved file count instead of disabling button
- Context menu resolve prominence (v3.0/15-02) — "Resolve..." item at top of menu with yellow text and separator for visual prominence
- Query invalidation after resolve (v3.0/15-02) — Invalidate opened, changes, unresolved, fileTree queries after any resolve operation

### Roadmap Evolution

- Phase 11.1 inserted after Phase 11: Unified Three-Column Layout (INSERTED) — Revamp main window to three-column layout before search filtering work. Phase 12 renamed from "Actionable Search" to "Search Filtering & Results" and updated to depend on 11.1.

### Pending Todos

1 pending todo (Phase 10 bug fixes complete):
1. ~~Fix changelist drag and drop~~ → COMPLETE (10-01, BUGF-01)
2. ~~Move files when editing default CL~~ → COMPLETE (10-01, BUGF-02)
3. ~~Unshelve to same changelist~~ → COMPLETE (10-02, BUGF-03)
4. ~~Resolve dialog after unshelve~~ → COMPLETE (10-02, BUGF-04) - informational only, full UI in Phase 15
5. ~~E2E testing with WebdriverIO~~ → COMPLETE (09-01, TEST-01)
6. ~~Implement refresh button~~ → COMPLETE (10-01, RFSH-02)
7. Separate connection dialog from settings → TBD (new)

### Blockers/Concerns

**Phase 09 (E2E Testing):** COMPLETE
- WebdriverIO v9 works with tauri-driver (concern resolved in 09-01)
- macOS does NOT support E2E testing (no WKWebView driver) — Windows/Linux only
- Users must manually build app with `npm run tauri build` before running tests (no auto-build in wdio config)
- All core workflows covered: sync, checkout, revert, submit (09-02)
- Settings auto-seeding enables P4 auto-connect (09-03)
- E2E tests require P4E2E_PORT, P4E2E_USER, P4E2E_CLIENT env vars

**Phase 11 (Auto-Refresh):** COMPLETE
- Query invalidation race conditions → RESOLVED (11-01: auto-refresh pauses when currentOperation exists)
- Optimal intervals depend on server performance → RESOLVED (11-01: configurable interval with 5-minute default, 0 = disabled)
- Settings UI implementation → COMPLETE (11-02: editor path and auto-refresh interval controls in settings dialog)

**Phase 13 (Workspace/Stream Switching):**
- Numbered CL files block stream switching (need pre-flight validation + shelve workflow)
- P4CLIENT env var inheritance (must explicitly clear before setting new value)

**Phase 14 (Depot Browser):** COMPLETE
- Large depot memory exhaustion → RESOLVED (14-02: lazy load with `p4 dirs <path>/*`, virtualize with react-arborist)

**Phase 15 (Resolve Workflow):** COMPLETE
- External merge tool edge cases → RESOLVED (15-01: spawn_blocking with child.wait(), 15-02: confirmation dialog after exit code 0)
- Resolve state sync after tool completes → RESOLVED (15-02: query invalidation for opened, changes, unresolved, fileTree)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 005 | Fix detail pane selection and CL click behavior | 2026-02-01 | 1c7a040 | [005-fix-detail-pane-selection-and-cl-click](./quick/005-fix-detail-pane-selection-and-cl-click/) |

## Session Continuity

Last session: 2026-02-01
Stopped at: Completed 15-02 (Resolve Frontend UI) — Phase 15 COMPLETE
Resume file: None

**Recent completed plans:**
- 14-02: Depot browser UI with accordion layout (4 min)
- 14-03: Context menu + detail pane integration (8 min)
- 15-01: Resolve backend commands (3 min)
- 15-02: Resolve frontend UI (7 min)

---
**Next step:** Phase 15 complete. All planned v3.0 phases complete. Ready for v3.0 release or additional feature phases.
