# P4Now

## What This Is

A modern Windows Perforce GUI that replaces P4V for daily development work. Features a three-column layout (file tree, detail pane, changelists), depot browser, workspace/stream switching, in-place search filtering, auto-refresh, conflict resolution with external merge tools, settings management, file history, external diff, multiple changelists with drag-and-drop, shelving, reconcile, context menus, keyboard shortcuts, command palette, and a polished blue-tinted dark theme. Designed to never trap the user in modal dialogs or blocking states.

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

### Active

- [ ] Streaming fstat with incremental frontend merge (10K+ files without UI freeze)
- [ ] File tree filter performance (persistent fuzzy index, debounce, no full tree walks)
- [ ] Scalable unified search architecture (workspace index, streaming server search, unified UI)
- [ ] Incremental tree builder with structural sharing (avoid full rebuild on refresh)
- [ ] Batch shelved file queries (eliminate N+1 p4 describe per changelist)
- [ ] Async backend commands (tokio::process::Command, unblock thread pool)
- [ ] Batch file tree store updates (eliminate Map copy per file during sync)

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

**Current state:** Shipped v3.0 with ~15,000 LOC (TypeScript + Rust), ~73,000 total.
Tech stack: Tauri 2.0, React 19, TanStack Query, Zustand, shadcn/ui, Tailwind CSS, react-arborist, WebdriverIO.

**Known issues / tech debt:**
- E2E tests need execution against real P4 server (human_needed)
- TODO: unshelve all for changelist (ChangelistPanel.tsx:576)
- TODO: p4_print command for Open This Revision (RevisionDetailView.tsx:43)
- TODO: p4_describe command for sibling files (RevisionDetailView.tsx:96)
- Workspace/stream switch not registered in operation store (auto-refresh edge case)

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

## Current Milestone: v5.0 Large Depot Scale

**Goal:** Make P4Now work smoothly with 10,000+ file depots by fixing all P0 and P1 scalability bottlenecks identified in the large depot analysis.

**Target features:**
- Streaming fstat with incremental frontend merge (no more full workspace load on every refresh)
- Persistent fuzzy index and debounced filtering (instant search at any scale)
- Scalable unified search: Rust-side workspace index, streaming server search, single search UI
- Incremental tree builder with structural sharing (avoid full rebuild every 30 seconds)
- Batch shelved file queries (eliminate N+1 p4 describe per changelist)
- Async backend commands via tokio::process::Command (unblock thread pool)
- Batch file tree store updates (eliminate Map copy per file during sync)

## Milestones

| Version | Status | Date |
|---------|--------|------|
| v1.0 MVP | Complete | 2026-01-28 |
| v2.0 Feature Complete | Complete | 2026-01-30 |
| v3.0 Daily Driver | Complete | 2026-02-01 |
| v4.0 Road to P4V Killer | Complete | 2026-02-03 |
| v5.0 Large Depot Scale | In Progress | — |

See `.planning/milestones/` for archived roadmaps and requirements.

---
*Last updated: 2026-02-04 after v5.0 milestone start*
