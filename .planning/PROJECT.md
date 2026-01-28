# P4Now

## What This Is

A Windows Perforce GUI that replaces P4V for daily development work. Modern, responsive, and designed to never trap the user in modal dialogs or blocking states. Built with a web tech stack that's AI-friendly for rapid development.

## Core Value

The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive even during network issues or long-running operations.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Configure P4 connection (server, user, client workspace) in app settings
- [ ] Sync / Get Latest from depot
- [ ] View pending changelist (checked-out and modified files)
- [ ] Submit changes with changelist description
- [ ] Open file diff in external diff tool
- [ ] View file history
- [ ] Graceful error handling — non-blocking, cancellable, recoverable
- [ ] Clean, modern visual design
- [ ] Keyboard shortcuts for common operations

### Out of Scope

- Admin tools — not needed for daily workflow, defer to later
- Depot browser / recent submits view — focus on local work first
- Built-in diff viewer — external tools (P4Merge, VS Code, etc.) handle this
- Multi-workspace support — single workspace keeps it simple
- Shelve/unshelve — defer to post-POC
- Reconcile offline work — defer to post-POC

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
- Web tech stack (Electron or Tauri) for AI-friendly development
- No requirement for heavy IDE — should work with simple editors
- Windows target platform

## Constraints

- **Platform**: Windows — primary and only target for now
- **P4 CLI**: Must work with standard Perforce command-line tools (p4.exe)
- **External diff**: Launches user's configured diff tool, doesn't embed one

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| External diff tool only | Avoids building complex diff UI; leverages existing tools | — Pending |
| Single workspace | Simplifies POC; multi-workspace adds significant complexity | — Pending |
| Settings in app (not P4CONFIG) | More explicit control, easier to debug connection issues | — Pending |

---
*Last updated: 2026-01-27 after initialization*
