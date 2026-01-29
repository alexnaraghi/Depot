# P4Now

## What This Is

A Windows Perforce GUI that replaces P4V for daily development work. Modern, responsive, and designed to never trap the user in modal dialogs or blocking states. Built with a web tech stack that's AI-friendly for rapid development.

## Core Value

The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive even during network issues or long-running operations.

## Requirements

### Validated (v1.0 MVP - Shipped 2026-01-28)

- [x] Sync / Get Latest from depot
- [x] View pending changelist (checked-out and modified files)
- [x] Submit changes with changelist description
- [x] Checkout files for editing
- [x] Revert changes (discard local modifications)
- [x] File status indicators (modified, synced, checked out)
- [x] Graceful error handling — non-blocking, cancellable, recoverable
- [x] All operations async (never freeze UI)

### Active (v2.0)

- [ ] Full P4 connection settings UI (server, user, client workspace, charset)
- [ ] Open file diff in external diff tool
- [ ] View file history
- [ ] Clean, modern visual design
- [ ] Keyboard shortcuts for common operations
- [ ] Connection status indicator
- [ ] Reconcile offline differences (manual button + explore auto-detection)
- [ ] Right-click context menu in pending changes and workspace views
- [ ] Multiple changelists — view, create, manage, drag-drop files between them
- [ ] Display current repository and stream
- [ ] Shelve/unshelve files in changelists, view shelved files
- [ ] Search submitted changelists by number, description, or author

### Out of Scope

- Admin tools — not needed for daily workflow
- Built-in diff viewer — external tools (P4Merge, VS Code, etc.) handle this
- Multi-workspace support — single workspace keeps it simple

## Context

**Pain points with P4V:**
- Modal dialogs block the entire app when connection drops (VPN disconnect)
- Operations that get stuck leave user trapped — can't cancel, close, or recover
- Feels dated and heavy for simple daily operations

**User workflow:**
- Single Perforce workspace
- Daily operations: sync, edit files, view pending changes, submit
- Occasionally view history, diff against previous versions
- Works over VPN — connection can be intermittent

**Tech direction:**
- Tauri 2.0 + React 19 for desktop app
- Rust backend for P4 process management
- TanStack Query for data fetching, Zustand for state
- shadcn/ui components with Tailwind CSS

## Constraints

- **Platform**: Windows — primary and only target for now
- **P4 CLI**: Must work with standard Perforce command-line tools (p4.exe)
- **External diff**: Launches user's configured diff tool, doesn't embed one

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| External diff tool only | Avoids building complex diff UI; leverages existing tools | Validated |
| Single workspace | Simplifies POC; multi-workspace adds significant complexity | Validated |
| Settings in app (not P4CONFIG) | More explicit control, easier to debug connection issues | Validated |
| Tauri 2.0 over Electron | Smaller binary, Rust backend for process management | Validated |
| tokio::sync::Mutex | Async safety across await points in Rust | Validated |
| TanStack Query + Zustand | Query for server data, Zustand for UI state | Validated |
| react-arborist | Virtualized tree for 10,000+ files | Validated |
| Query invalidation pattern | UI updates via query invalidation, not store updates | Validated |
| Depot path for P4 commands | DVCS support (avoid -d flag that breaks RSH) | Validated |

## Current Milestone: v2.0 Feature Complete

**Goal:** Transform P4Now from MVP into a full daily-driver Perforce client with settings, history, diff, changelists, shelving, reconcile, and polish.

**Target features:**
- Full P4 connection settings UI
- File history viewer and external diff integration
- Multiple changelist management with drag-drop
- Shelve/unshelve workflow
- Reconcile offline differences
- Context menus, keyboard shortcuts, visual polish
- Repository/stream display and connection status
- Search submitted changelists

## Milestones

| Version | Status | Date |
|---------|--------|------|
| v1.0 MVP | Complete | 2026-01-28 |
| v2.0 Feature Complete | Active | — |

See `.planning/milestones/` for archived roadmaps and requirements.

---
*Last updated: 2026-01-28 after v2.0 milestone started*
