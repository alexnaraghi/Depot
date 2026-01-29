---
phase: 04-changelist-management
plan: 03
subsystem: ui
tags: [react, typescript, context-menu, p4-reopen, drag-and-drop]

# Dependency graph
requires:
  - phase: 04-02
    provides: Changelist panel UI with CRUD operations and tree rendering
provides:
  - ChangelistContextMenu component with "Move to Changelist" submenu
  - Right-click context menu on file nodes in changelist panel
  - DnD file movement using p4 reopen (not p4 edit)
  - Multi-select support for context menu and DnD
affects: [future-shelve-context-menu, future-keyboard-shortcuts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Context menu pattern: fixed-position div with click-outside/Escape close"
    - "Hover submenu with absolute positioning (left-full top-0)"
    - "invokeP4Reopen for file movement between changelists"
    - "TanStack Query invalidation for both ['p4', 'changes'] and ['p4', 'opened']"

key-files:
  created:
    - path: src/components/ChangelistPanel/ChangelistContextMenu.tsx
      purpose: Right-click context menu with "Move to Changelist" submenu
  modified:
    - path: src/components/ChangelistPanel/ChangelistNode.tsx
      changes: Added onContextMenu prop and handler for file nodes
    - path: src/components/ChangelistPanel/ChangelistPanel.tsx
      changes: Added context menu state, wired to ChangelistNode, fixed DnD to use invokeP4Reopen
---

## Summary

Added right-click context menu for file movement between changelists and fixed drag-and-drop to use `p4 reopen` instead of `p4 edit`.

### What was built

1. **ChangelistContextMenu component** — Right-click menu on file nodes with "Move to Changelist" submenu listing all available changelists (excluding the current one). Supports multi-select. Uses invokeP4Reopen for server-side file movement.

2. **Context menu wiring** — ChangelistNode gets onContextMenu handler for file rows. ChangelistPanel manages context menu state and renders the menu when active.

3. **DnD fix** — handleMove in ChangelistPanel changed from invokeP4Edit to invokeP4Reopen with proper connection args from useConnectionStore.

### Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8066998 | Create changelist context menu with Move to Changelist submenu |
| 2 | 5e1bda4 | Wire context menu to file nodes and fix DnD to use reopen |
| fix | 841780a | Fix changelist visibility, connection args, and context menu |

### Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D-04-03-01 | Follow FileContextMenu.tsx pattern for context menu | Consistency with existing codebase patterns |
| D-04-03-02 | Use invokeP4Reopen for both DnD and context menu moves | Makes file movement intent explicit per D-04-01-02 |

### Human Verification

**Status:** Approved
**Verified:** All CL-01 through CL-07 requirements confirmed working

### Issues

None.
