# Project Milestones: P4Now

## v5.0 Large Depot Scale (Shipped: 2026-02-05)

**Delivered:** Make P4Now work smoothly with 10,000+ file depots by replacing blocking all-or-nothing data flows with streaming, incremental, and cancellable operations.

**Phases completed:** 21-25 (15 plans total)

**Key accomplishments:**

- Non-blocking async infrastructure with tokio::process, eliminating zombie processes and thread pool exhaustion
- Progressive workspace loading with streaming fstat delivering first 100 files in <500ms with cancellable operations
- Instant file search via Rust-side FileIndex with nucleo fuzzy matching (<5ms for 100K+ files)
- Incremental tree updates using Immer structural sharing, preventing full rebuilds when <10% of files change
- Two-tier auto-refresh: 30s delta refresh (opened files only) + 5min full refresh (comprehensive)
- Batch shelved file loading replacing N+1 query pattern with single command and per-CL error isolation

**Stats:**

- 218 files created/modified (combined v4.0 + v5.0)
- ~33,000 lines added, ~20,000 total LOC (TypeScript + Rust)
- 5 phases, 15 plans
- ~6 hours development time (2026-02-04 18:28 → 2026-02-05 00:21)

**Git range:** `feat(21-01)` → `feat(25-02)`

**What's next:** Consider v6.0 for unified search UI, workspace-optimized depot browser, and telemetry

---

## v4.0 Road to P4V Killer (Shipped: 2026-02-03)

**Delivered:** Close the most visible daily-use gaps versus P4V with file content viewer, annotations (blame), sync status overlays, submitted changelist file lists, and submit preview dialog.

**Phases completed:** 16-20 (16 plans total)

**Key accomplishments:**

- File content viewer with syntax highlighting via prism-react-renderer and size warnings for large files
- File annotations (blame) with per-line authorship, age heatmap coloring, interactive tooltips, keyboard navigation, and "blame prior" revision peeling
- Workspace sync status with have-rev vs head-rev overlays and folder-level aggregation
- Submitted changelist complete file list display with action indicators and clickable navigation
- Submit preview dialog showing description and file list before submission with inline edits
- 12 critical bug fixes: connection dialog auto-open, shelve/unshelve UI updates, depot accordion persistence, file selection toolbar context, client spec parsing, settings scrollability

**Stats:**

- Included in v5.0 combined stats above
- 5 phases, 16 plans
- 2 days (2026-02-03)

**Git range:** `feat(16-01)` → `feat(20-05)`

**What's next:** Large depot scalability (v5.0)

---

## v3.0 Daily Driver (Shipped: 2026-02-01)

**Delivered:** Production-ready Perforce client with three-column layout, depot browser, workspace/stream switching, search filtering, auto-refresh, conflict resolution, and E2E testing infrastructure.

**Phases completed:** 09-15 (26 plans total, 1 quick task)

**Key accomplishments:**

- E2E testing infrastructure with WebdriverIO v9 + tauri-driver and auto-seeded P4 settings
- Bug fixes for drag-drop reliability, unshelve targeting, and post-operation conflict detection
- Auto-refresh with configurable polling interval and settings dialog enhancements (editor path, refresh interval)
- Three-column layout redesign with file tree, detail pane, and changelists (replaced modal dialogs with inline views)
- In-place search filtering with fuzzy matching, command palette deep search, and actionable results
- Workspace and stream switching with auto-shelve confirmation and graceful disconnected states
- Depot browser with lazy-loaded hierarchy, context menu operations, and detail pane integration
- Conflict resolution workflow with external merge tool launcher, blocking overlay, and submit blocking

**Stats:**

- 142 files created/modified
- 18,890 lines added (TypeScript + Rust)
- 8 phases, 26 plans, 1 quick task
- 3 days from v2.0 to ship (2026-01-30 → 2026-02-01)

**Git range:** `v2.0` → `v3.0`

**What's next:** TBD

---

## v2.0 Feature Complete (Shipped: 2026-01-30)

**Delivered:** Full daily-driver Perforce client with settings, history, diff, changelists, shelving, reconcile, context menus, keyboard shortcuts, command palette, and polished dark theme.

**Phases completed:** 03-08 (18 plans total, plus 4 quick tasks)

**Key accomplishments:**

- Settings dialog with connection status, workspace browser, and full P4 environment isolation
- Multiple changelist management with CRUD, drag-and-drop, and context menu file moves
- File history viewer, external diff integration, and GitKraken-style submitted changelist search
- Shelve/unshelve workflows with conflict detection and reconcile with grouped preview dialog
- Command palette with fuzzy search, context menus for all views, and global keyboard shortcuts
- Blue-tinted dark theme with semantic color system, skeleton loading states, and unified toolbar

**Stats:**

- 238 files created/modified
- 53,504 lines added (TypeScript + Rust)
- 6 phases, 18 plans, 4 quick tasks
- 3 days from v1.0 to ship (2026-01-28 → 2026-01-30)
- 127 commits

**Git range:** `v1.0` → `v2.0`

**What's next:** Next milestone TBD

---

## v1.0 MVP (Shipped: 2026-01-28)

**Delivered:** Async-first Perforce GUI with non-blocking architecture, file tree, changelist management, sync, and submit workflows.

**Phases completed:** 01-02 (14 plans total)

**Key accomplishments:**

- Async-first architecture (never blocks UI)
- Process management with reliable cancellation
- File tree with P4V-style status icons
- Changelist management and submit workflow
- Sync with progress streaming and conflict detection

**Stats:**

- 2 phases, 14 plans, 104 min total execution
- 1 day (2026-01-27 → 2026-01-28)

**Git range:** `init` → `v1.0`

---
