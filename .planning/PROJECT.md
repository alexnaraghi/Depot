# P4Now

## What This Is

A modern Windows Perforce GUI that replaces P4V for daily development work. Features settings management, file history, external diff, multiple changelists with drag-and-drop, shelving, reconcile, context menus, keyboard shortcuts, command palette, and a polished blue-tinted dark theme. Designed to never trap the user in modal dialogs or blocking states.

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

### Active

- [ ] Resolve workflow — detect conflicts, launch external merge tool, mark resolved
- [ ] Depot tree browser — full depot hierarchy with sync, checkout, history, diff operations
- [ ] Workspace switching — disconnect/connect to different workspaces
- [ ] Stream switching — change which stream the workspace is on
- [ ] View client spec — read-only view of workspace mappings and settings
- [ ] Actionable search results — interact with files, CLs, and authors from search
- [ ] Auto-refresh — configurable periodic polling of workspace state and pending CLs
- [ ] External editor setting — configure preferred editor
- [ ] Automated E2E testing — regression tests for existing and new functionality
- [ ] Fix changelist drag-and-drop reliability
- [ ] Move files when editing default CL description
- [ ] Unshelve to same changelist (not default)
- [ ] Resolve dialog after unshelving conflicts
- [ ] Implement refresh button

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

**Current state:** Shipped v2.0 with ~55,000 LOC (TypeScript + Rust).
Tech stack: Tauri 2.0, React 19, TanStack Query, Zustand, shadcn/ui, Tailwind CSS, react-arborist.

**Known issues / tech debt:**
- Changelist drag-and-drop reliability needs improvement
- Default CL description editing should move files to new CL
- Unshelve should offer resolve dialog for conflicts
- No automated E2E testing yet

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

## Current Milestone: v3.0 Daily Driver

**Goal:** Make P4Now reliable enough for real contributors to evaluate with their daily Perforce workflows.

**Target features:**
- Resolve workflow with external merge tool
- Depot tree browser with full file operations
- Workspace and stream switching
- Actionable search results
- Auto-refresh with configurable polling interval
- Settings additions (external editor, auto-refresh interval)
- Automated E2E testing for regression coverage
- Bug fixes for drag-and-drop, unshelve, default CL, refresh

## Milestones

| Version | Status | Date |
|---------|--------|------|
| v1.0 MVP | Complete | 2026-01-28 |
| v2.0 Feature Complete | Complete | 2026-01-30 |
| v3.0 Daily Driver | In Progress | — |

See `.planning/milestones/` for archived roadmaps and requirements.

---
*Last updated: 2026-01-29 after v3.0 milestone start*
