# Project Research Summary

**Project:** P4Now v2.0
**Domain:** Perforce GUI client (Tauri 2.0 + React 19 desktop app)
**Researched:** 2026-01-28
**Confidence:** HIGH

## Executive Summary

P4Now v2.0 extends a working Tauri/React Perforce GUI from basic sync/submit/revert into a full changelist management tool with shelving, file history, reconcile, search, and keyboard-driven workflows. The existing architecture (Rust CLI wrapper spawning p4.exe, React frontend with TanStack Query + Zustand) is sound and scales to v2.0 without fundamental changes. The stack additions are minimal: dnd-kit for drag-and-drop, tauri-plugin-store for settings persistence, and two shadcn/ui components (context-menu, command palette). No new Rust crates beyond tauri-plugin-store are needed.

The recommended approach is backend-first: add all new Rust commands (13 total) and split the growing p4.rs into domain modules, then build settings/connection infrastructure, then layer UI features on top. Connection settings must come first because every feature depends on a configured P4 connection. Multiple changelists is the highest-impact feature and must precede shelve/unshelve (which operates on specific changelists).

The top risks are: (1) unshelve silently overwriting local changes -- requires pre-unshelve conflict detection from day one; (2) reconcile freezing the app on large workspaces -- must use streaming with cancel support; (3) non-atomic file moves between changelists causing UI/server state divergence -- requires partial-failure handling and server re-fetch. All three are solvable with patterns already established in v1.0 (streaming via Channel, process cancellation via ProcessManager).

## Key Findings

### Recommended Stack

The existing stack (Tauri 2, React 19, TanStack Query, Zustand, shadcn/ui, react-arborist) is retained unchanged. New additions are intentionally minimal.

**New dependencies:**
- **@dnd-kit/core + sortable**: Drag files between changelists -- lightweight, accessible, only viable maintained React DnD library
- **tauri-plugin-store**: Persistent settings as JSON -- official Tauri plugin, replaces need for SQLite or localStorage
- **shadcn/ui context-menu (Radix)**: Right-click menus -- already in the Radix ecosystem, zero styling conflicts
- **shadcn/ui command (cmdk)**: Command palette and search UI -- powers Linear/Raycast-style fuzzy search
- **Custom useHotkey hook**: 15-line hook, no library needed for in-app keyboard shortcuts

**Explicitly rejected:** react-beautiful-dnd (deprecated), react-hotkeys-hook (unnecessary), any Rust P4 client crate (CLI spawning proven in v1), SQLite (overkill for settings).

### Expected Features

**Must have (table stakes) -- 12 features:**
- Connection settings UI with validation and workspace selection
- Connection status indicator (green/red dot, stream/repo display)
- Multiple changelists (create, delete, edit description, move files)
- Right-click context menus on files and changelists
- Keyboard shortcuts for all common operations
- Reconcile offline work with preview
- File history viewer
- Shelve/unshelve
- Search submitted changelists
- External diff tool integration
- Display current stream/repository
- Visual design polish

**Should have (differentiators over P4V):**
- Command palette (Ctrl+K) -- P4V has nothing like it
- Client-side description search -- P4V cannot search CL descriptions
- Non-blocking shelve/unshelve with progress/cancel -- P4V blocks
- Inline changelist editing without modal dialogs
- Connection profiles with quick-switch dropdown
- Quick changelist move via inline dropdown (no dialog)

**Defer to v3+:**
- Stream graph visualization, time-lapse view, built-in merge UI, branch/integrate operations, job tracking, auto-background refresh, full workspace/stream switching

### Architecture Approach

The architecture extends naturally: 13 new Rust commands following the existing p4.exe-spawn-and-parse pattern, a tabbed right panel replacing the single changelist sidebar, two new Zustand stores (settings, UI state), and new TanStack Query keys for history/search/connection. The critical refactor is splitting p4.rs (~710 lines growing to ~1500+) into domain modules (info, files, changelists, shelve, history, submit, parser).

**Major components:**
1. **Rust command modules** (p4/*.rs) -- all P4 CLI interactions, split by domain
2. **Settings infrastructure** (tauri-plugin-store + settingsStore) -- connection config, diff tool, UI prefs
3. **Tabbed right panel** -- changelists (existing), file history (new), search (new)
4. **DnD layer** (dnd-kit DndContext) -- wraps changelist panel for file moves
5. **Context menu system** (Radix context-menu) -- shared primitive for file and changelist menus
6. **Keyboard shortcut system** (custom hook) -- registered in App.tsx, scoped by UI state

### Critical Pitfalls

1. **Unshelve overwrites local changes silently** -- always run `p4 diff` before unshelve to detect conflicts; never pass `-f` without confirmation
2. **Reconcile freezes on large workspaces** -- must use streaming spawn with cancel; scope to subdirectories; batch UI updates
3. **Non-atomic file moves between changelists** -- handle partial failures explicitly; re-fetch server state after reopen; implement undo
4. **Default changelist (id=0) special cases** -- abstract CL id translation ("default" string vs 0); confirm before submitting default CL
5. **WebView captures keyboard shortcuts** -- F5 reloads app, Ctrl+R refreshes, Ctrl+P prints; must intercept at document level with preventDefault

## Implications for Roadmap

### Phase 1: Backend Infrastructure + Settings
**Rationale:** Every frontend feature needs Rust commands. Settings/connection is the dependency root for all server operations.
**Delivers:** All 13 new Rust commands, p4.rs module split, tauri-plugin-store integration, settings dialog, connection monitoring, enhanced status bar.
**Addresses:** Connection settings UI, connection status indicator, stream/repo display.
**Avoids:** Pitfall 9 (settings corruption -- establish proper persistence early), Pitfall 8 (connection polling -- use exponential backoff from start).

### Phase 2: Changelist Management
**Rationale:** Highest-impact UX gap in v1.0. Required before shelve (which targets specific CLs) and drag-drop.
**Delivers:** Multiple changelist CRUD, drag-and-drop file moves, multi-select support.
**Uses:** dnd-kit, p4_reopen/p4_change_new/p4_change_delete commands.
**Avoids:** Pitfall 3 (non-atomic moves -- handle partial failure), Pitfall 4 (default CL edge cases), Pitfall 10 (accidental DnD -- confirmation + undo).

### Phase 3: Context Menus + Keyboard Shortcuts
**Rationale:** These are interaction layers that span all features. Best added once the core features exist to bind to.
**Delivers:** Right-click menus on files and changelists, keyboard shortcut system, command palette, shortcut help dialog.
**Uses:** shadcn/ui context-menu, shadcn/ui command (cmdk), custom useHotkey hook.
**Avoids:** Pitfall 7 (WebView shortcut conflicts -- intercept at document level, avoid F5/Ctrl+R).

### Phase 4: History, Search, and Diff
**Rationale:** Independent panels that add investigation capabilities. Naturally group as the tabbed right panel.
**Delivers:** File history viewer, submitted changelist search with description filtering, external diff tool launch.
**Uses:** p4_filelog, p4_changes_search, p4_diff_external commands; tabbed panel layout.
**Avoids:** Pitfall 5 (history perf cliff -- paginate with `-m 50`), Pitfall 6 (diff tool blocks event loop -- use spawn, not output), Pitfall 11 (search hammers server -- limit + date range + debounce).

### Phase 5: Shelve/Unshelve + Reconcile
**Rationale:** Less frequent workflows that depend on solid changelist management. Shelve has the most dangerous pitfall (data loss).
**Delivers:** Shelve/unshelve with conflict detection, reconcile with streaming preview and cancel.
**Avoids:** Pitfall 1 (unshelve overwrites -- pre-check with p4 diff), Pitfall 2 (reconcile freezes -- streaming + scoped paths + cancel).

### Phase 6: Visual Polish
**Rationale:** Quality pass after all functional surfaces exist. Cannot polish what is not built yet.
**Delivers:** Consistent spacing/typography, dark mode, loading skeletons, professional appearance.

### Phase Ordering Rationale

- Backend before frontend: all UI features need commands to exist first
- Settings before everything: connection config is the dependency root
- Changelists before shelve: shelve operates on specific changelists
- Context menus after core features: menus bind to existing actions
- Search and history are independent of changelist work -- could parallelize with Phase 2
- Polish last: apply once all surfaces exist

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Settings):** Research Tauri 2.0 WebView key interception API for disabling default shortcuts. Research `p4 set` behavior across Windows environments.
- **Phase 2 (Changelists):** Research dnd-kit multi-drag patterns. Research p4 reopen behavior with locked files.
- **Phase 5 (Shelve/Reconcile):** Research p4 unshelve conflict resolution flow. Research reconcile streaming output format for progress parsing.

Phases with standard patterns (skip deep research):
- **Phase 3 (Context Menus + Shortcuts):** Well-documented Radix/shadcn patterns. Custom hook is trivial.
- **Phase 4 (History/Search/Diff):** Standard CRUD views with TanStack Query. Diff launch is fire-and-forget spawn.
- **Phase 6 (Polish):** CSS/design work, no technical research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All additions are official plugins or established libraries; clear rationale for each; explicit rejection list |
| Features | HIGH | Based on official Perforce 2025.x documentation and P4V behavior analysis |
| Architecture | HIGH | Based on direct codebase analysis of existing v1.0 implementation |
| Pitfalls | HIGH | Based on P4 CLI behavior, Tauri/WebView constraints, and known library limitations |

**Overall confidence:** HIGH

### Gaps to Address

- **Tauri WebView2 key interception:** Exact API for disabling default shortcuts (F5 reload, Ctrl+P print) needs validation during Phase 3 implementation
- **p4 reconcile streaming output format:** Need to verify parseable progress indicators exist in reconcile stdout for progress bar
- **dnd-kit + react-arborist interop:** Both libraries handle drag events; potential conflict if file tree nodes are also drag sources
- **Command concurrency limits:** With 13+ commands, concurrent p4.exe spawns could spike on Windows (~10ms per spawn). May need a command queue limiting concurrency to 3-4 processes. Evaluate during Phase 1.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `src-tauri/src/` and `src/` directories
- [Perforce 2025.x CLI reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/) -- shelve, reconcile, filelog, reopen, changes
- [Tauri 2.0 Store Plugin](https://v2.tauri.app/plugin/store/) -- official docs
- [Tauri 2.0 Global Shortcut Plugin](https://v2.tauri.app/plugin/global-shortcut/) -- official docs
- [shadcn/ui components](https://ui.shadcn.com/docs/) -- context-menu, command
- [Radix UI primitives](https://www.radix-ui.com/primitives/docs/) -- context menu

### Secondary (MEDIUM confidence)
- [dnd-kit documentation](https://docs.dndkit.com) -- stable but last release ~1yr ago
- [Radix context menu position issue #2611](https://github.com/radix-ui/primitives/issues/2611) -- known minor issue
- [Aptabase: Persistent state in Tauri apps](https://aptabase.com/blog/persistent-state-tauri-apps) -- Store vs SQL vs localStorage guidance

### Tertiary (LOW confidence)
- Tauri WebView2 keyboard interception behavior -- needs runtime validation on Windows

---
*Research completed: 2026-01-28*
*Ready for roadmap: yes*
