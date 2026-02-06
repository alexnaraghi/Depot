# Depot

## What This Is

Depot is a modern Windows Perforce GUI that replaces P4V for daily development work. Features a three-column layout (file tree, detail pane, changelists), depot browser, workspace/stream switching, in-place search filtering, auto-refresh, conflict resolution with external merge tools, settings management, file history, external diff, multiple changelists with drag-and-drop, shelving, reconcile, context menus, keyboard shortcuts, command palette, and a polished blue-tinted dark theme. Designed to never trap the user in modal dialogs or blocking states.

## Core Value

The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive even during network issues or long-running operations.

## Requirements

### Validated

- ✓ Sync / Get Latest from depot — v1.0
- ✓ View pending changelist (checked-out and modified files) — v1.0
- ✓ Submit changes with changelist description — v1.0
- ✓ Checkout files for editing — v1.0
- ✓ Revert changes (discard local modifications) — v1.0
- ✓ File status indicators (modified, synced, checked out) — v1.0
- ✓ Graceful error handling — non-blocking, cancellable, recoverable — v1.0
- ✓ All operations async (never freeze UI) — v1.0
- ✓ Full P4 connection settings UI (server, user, client workspace) — v2.0
- ✓ Workspace browser and selection — v2.0
- ✓ Connection settings persist across restarts — v2.0
- ✓ Connection status indicator — v2.0
- ✓ Repository/stream display in header — v2.0
- ✓ Multiple changelists — view, create, edit, delete, drag-drop files — v2.0
- ✓ Submit specific numbered changelist — v2.0
- ✓ File history viewer (revision, action, CL, date, user, description) — v2.0
- ✓ External diff tool integration (configurable path and arguments) — v2.0
- ✓ Diff workspace vs depot, between revisions — v2.0
- ✓ Search submitted changelists by number, author, description — v2.0
- ✓ Shelve/unshelve files with conflict warnings — v2.0
- ✓ View and delete shelved files — v2.0
- ✓ Reconcile offline work with preview and file selection — v2.0
- ✓ Right-click context menus for files and changelists — v2.0
- ✓ Keyboard shortcuts for core operations — v2.0
- ✓ Command palette with fuzzy search — v2.0
- ✓ Clean, modern visual design with loading states — v2.0
- ✓ E2E testing infrastructure with WebdriverIO + tauri-driver — v3.0
- ✓ Drag-and-drop reliability with optimistic updates — v3.0
- ✓ Auto-refresh with configurable polling interval — v3.0
- ✓ Three-column layout (file tree, detail pane, changelists) — v3.0
- ✓ In-place search filtering with command palette deep search — v3.0
- ✓ Workspace switching with query invalidation — v3.0
- ✓ Stream switching with auto-shelve confirmation — v3.0
- ✓ Depot browser with lazy-loaded hierarchy — v3.0
- ✓ Conflict resolution with external merge tool integration — v3.0
- ✓ Settings dialog (external editor, auto-refresh interval) — v3.0
- ✓ Manual refresh button — v3.0
- ✓ Client spec viewer (read-only) — v3.0
- ✓ Actionable search results with context menus — v3.0
- ✓ File content viewer with syntax highlighting — v4.0
- ✓ File annotations (blame) with heatmap, tooltips, keyboard nav — v4.0
- ✓ Workspace file tree sync status (have-rev vs head-rev) — v4.0
- ✓ Submit dialog with changelist preview and edit — v4.0
- ✓ Submitted changelist full file list view — v4.0
- ✓ Streaming fstat with progressive loading (<500ms first batch, cancellable) — v5.0
- ✓ Non-blocking async backend with tokio::process (no zombie processes) — v5.0
- ✓ Instant file search with persistent Rust-side fuzzy index (<5ms, 100K files) — v5.0
- ✓ Incremental tree updates with structural sharing (no full rebuilds when <10% change) — v5.0
- ✓ Two-tier auto-refresh (30s delta, 5min full) for large depot efficiency — v5.0
- ✓ Batch shelved file queries (single command vs N+1 pattern) — v5.0
- ✓ Debounced filter input (150ms) for responsive search — v5.0
- ✓ Repository secured with zero credentials in Git history (Gitleaks + TruffleHog) — v6.0
- ✓ Application rebranded to "Depot" with MIT license — v6.0
- ✓ Permanent bundle identifier set (com.depot.app) — v6.0
- ✓ Public documentation (README, CONTRIBUTING) with P4V comparison — v6.0
- ✓ GitHub Actions release automation with NSIS and MSI installers — v6.0
- ✓ Release workflow validated with functional installers — v6.0

### Active

No active requirements - v6.0 complete. Next milestone requirements will be defined with `/gsd:new-milestone`.

### Out of Scope

- Admin tools — not needed for daily workflow
- Built-in diff viewer — external tools (P4Merge, VS Code, etc.) handle this
- Built-in merge/resolve UI — external merge tool (P4Merge) handles conflict resolution
- Stream graph visualization — DAG layout extremely complex
- Time-lapse view — enormous UI effort for niche use
- Branch/integrate operations — complex, not core daily workflow
- Job/fix tracking — rarely used outside enterprise
- Modal dialogs for workflows — P4V's biggest pain point

## Context

**Current state:** Shipped v6.0 Public Launch Preparation with ~20,000 LOC (TypeScript + Rust).
Tech stack: Tauri 2.0, React 19, TanStack Query, Zustand, shadcn/ui, Tailwind CSS, react-arborist, Immer, nucleo-matcher, WebdriverIO.
Released as open-source MIT licensed project "Depot" with public v0.1.0 alpha.

**Public release status:**
- Repository security audited and cleared (zero credentials in 522 commits)
- GitHub Actions release workflow producing NSIS and MSI installers
- Documentation complete with README, CONTRIBUTING, P4V comparison
- Ready for public v0.1.0 alpha release to GitHub

**Known issues / tech debt:**
- E2E tests need execution against real P4 server (human_needed)
- 13 pending todos (see .planning/todos/pending/)
- Full sync status re-aggregation after incremental updates (future optimization: partial branch)
- Clean Windows VM installer testing deferred to post-v6.0

## Constraints

- **Platform**: Windows — primary and only target for now
- **P4 CLI**: Must work with standard Perforce command-line tools (p4.exe)
- **External diff**: Launches user's configured diff tool, doesn't embed one

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| External diff tool only | Avoids building complex diff UI; leverages existing tools | ✓ Good |
| Single workspace | Simplifies app; multi-workspace adds significant complexity | ✓ Good |
| Settings in app (not P4CONFIG) | More explicit control, easier to debug connection issues | ✓ Good |
| Tauri 2.0 over Electron | Smaller binary, Rust backend for process management | ✓ Good |
| tokio::sync::Mutex | Async safety across await points in Rust | ✓ Good |
| TanStack Query + Zustand | Query for server data, Zustand for UI state | ✓ Good |
| react-arborist | Virtualized tree for 10,000+ files | ✓ Good |
| Query invalidation pattern | UI updates via query invalidation, not store updates | ✓ Good |
| Depot path for P4 commands | DVCS support (avoid -d flag that breaks RSH) | ✓ Good |
| tauri-plugin-store for settings | Official Tauri plugin, simple key-value store | ✓ Good |
| P4 env var isolation | Clear P4CONFIG, override P4PORT/P4USER/P4CLIENT for DVCS compat | ✓ Good |
| p4 reopen for file moves | Makes file movement between changelists explicit | ✓ Good |
| Client-side search filtering | Prefetched cache + useMemo for instant search results | ✓ Good |
| Blue-tinted dark theme (hue 220) | VS Code aesthetic, semantic color system | ✓ Good |
| No animations | Instant UI response, removed all transition classes | ✓ Good |
| Custom events for shortcuts | Cross-component keyboard shortcuts without prop drilling | ✓ Good |
| WebdriverIO v9 + tauri-driver | Standard Tauri E2E testing, pre-seed settings via filesystem | ✓ Good |
| Optimistic updates for drag-drop | cancelQueries + snapshot + rollback prevents UI flicker | ✓ Good |
| TanStack Query refetchInterval | Built-in polling conditional on connection/operation/focus | ✓ Good |
| DetailSelection discriminated union | Type-safe detail pane routing with none/file/changelist/revision | ✓ Good |
| Dimming over hiding for search | Preserves tree structure and spatial context | ✓ Good |
| Auto-shelve on stream switch | Create numbered CL, reopen files, shelve to prevent work loss | ✓ Good |
| Lazy loading for depot browser | Load subdirectories on toggle to prevent memory exhaustion | ✓ Good |
| spawn_blocking for merge tool | Doesn't block async runtime while waiting for external process | ✓ Good |
| tokio::process migration | Non-blocking async with .wait().await for zombie prevention | ✓ Good |
| Streaming fstat with 100-file batches | Balance first-batch latency vs IPC overhead | ✓ Good |
| nucleo fuzzy matching | Fast, high-quality search with recency bias (1.5x <7 days) | ✓ Good |
| Immer structural sharing | Unchanged subtrees preserve identity, React skips re-render | ✓ Good |
| Two-tier refresh (30s/5min) | Delta queries only opened files, full catches all changes | ✓ Good |
| Batch shelved queries | Single command vs N+1 with per-CL error isolation | ✓ Good |
| Dual-tool security scanning | Both Gitleaks and TruffleHog for comprehensive coverage | ✓ Good |
| Permanent bundle identifier | com.depot.app set before public release (cannot change after) | ✓ Good |
| MIT license | Permissive license for open-source community adoption | ✓ Good |
| Unsigned binaries for v0.1 | Cost ($100-500/year) not justified for early testing | ✓ Good |
| .planning/ directory public | Showcase transparent agentic development methodology | ✓ Good |
| Manual workflow trigger | workflow_dispatch only for v0.1; tag triggers after validation | ✓ Good |
| Draft-first releases | All releases created as drafts for human review | ✓ Good |

## Previous Release

**v6.0 Public Launch Preparation** (shipped 2026-02-06)

Repository secured and prepared for public GitHub release. Application rebranded to "Depot" with MIT license, comprehensive documentation, and automated release workflow producing functional installers.

## Milestones

| Version | Status | Date |
|---------|--------|------|
| v1.0 MVP | Complete | 2026-01-28 |
| v2.0 Feature Complete | Complete | 2026-01-30 |
| v3.0 Daily Driver | Complete | 2026-02-01 |
| v4.0 Road to P4V Killer | Complete | 2026-02-03 |
| v5.0 Large Depot Scale | Complete | 2026-02-05 |
| v6.0 Public Launch Preparation | Complete | 2026-02-06 |

See `.planning/milestones/` for archived roadmaps and requirements.

---
*Last updated: 2026-02-06 after v6.0 milestone completion*
