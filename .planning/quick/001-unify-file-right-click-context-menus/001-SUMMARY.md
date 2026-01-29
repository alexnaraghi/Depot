---
phase: quick
plan: 001
type: quick-task
subsystem: ui
tags: [context-menus, shared-components, file-operations, ux-consistency]

requires:
  - FileTree context menu implementation
  - ChangelistPanel context menu implementation
  - File operation hooks (useFileOperations, useDiff)

provides:
  - Unified file context menu items across workspace tree and changelist panel
  - Single source of truth for common file operations

affects:
  - Future file context menus will use shared component

tech-stack:
  added: []
  patterns:
    - Shared menu component pattern
    - Optional callback props for menu customization

key-files:
  created:
    - src/components/shared/FileContextMenuItems.tsx
  modified:
    - src/components/FileTree/FileContextMenu.tsx
    - src/components/ChangelistPanel/ChangelistContextMenu.tsx
    - src/components/ChangelistPanel/ChangelistPanel.tsx

decisions:
  - id: D-Q001-01
    decision: Extract file operations to shared component
    rationale: DRY principle - single source of truth for common menu items
  - id: D-Q001-02
    decision: Show shared items only for single-file selection in changelist panel
    rationale: Operations like diff and history are single-file only, multi-select should show only move/shelve

metrics:
  duration: 3 min
  tasks: 2
  commits: 2
  completed: 2026-01-29
---

# Quick Task 001: Unify File Right-Click Context Menus

**One-liner:** Extracted shared FileContextMenuItems component used by both workspace tree and changelist panel, providing consistent file operations (revert, history, diff, copy path) across both menus.

## Overview

Unified file right-click context menu functionality between the workspace FileTree and ChangelistPanel. Previously, the changelist context menu only offered "Move to Changelist" and "Shelve", while the workspace tree had the full set of file operations. Now both menus share a common component for file operations.

## What Was Built

### 1. Shared FileContextMenuItems Component

Created `src/components/shared/FileContextMenuItems.tsx`:
- Renders all common file operation menu items as React fragment
- Includes: Checkout, Revert, File History, Diff against Have, Copy Local Path
- Accepts optional callbacks (`onShowHistory`, `onDiffAgainstHave`)
- Contains all handler logic and status checks (canCheckout, canRevert)
- Reusable across any context menu

### 2. Refactored FileContextMenu

Updated `src/components/FileTree/FileContextMenu.tsx`:
- Now a thin wrapper around FileContextMenuItems
- Retains menu container div with positioning
- Retains click-outside and escape key handling
- Passes through file, onClose, and optional callbacks
- Reduced from 173 to 66 lines (61% reduction)

### 3. Enhanced ChangelistContextMenu

Updated `src/components/ChangelistPanel/ChangelistContextMenu.tsx`:
- Added optional `onShowHistory` and `onDiffAgainstHave` props
- Renders FileContextMenuItems when `files.length === 1`
- Shows separator divider before shared items
- Multi-file selections show only Move/Shelve (no single-file operations)

### 4. Wired Callbacks in ChangelistPanel

Updated `src/components/ChangelistPanel/ChangelistPanel.tsx`:
- Added `historyDialog` state for FileHistoryDialog
- Added `handleShowHistory` callback (sets historyDialog state)
- Added `handleDiffAgainstHave` callback (finds file, calls diffAgainstWorkspace)
- Imported and used `useDiff` hook
- Rendered FileHistoryDialog component
- Passed callbacks to ChangelistContextMenu

## Technical Implementation

**Component Architecture:**
```
FileContextMenuItems (shared)
  ├─> FileContextMenu (workspace tree)
  └─> ChangelistContextMenu (changelist panel)
```

**Callback Flow:**
```
ChangelistPanel
  ├─> handleShowHistory -> setHistoryDialog
  ├─> handleDiffAgainstHave -> useDiff().diffAgainstWorkspace
  └─> ChangelistContextMenu (receives callbacks)
        └─> FileContextMenuItems (renders items with callbacks)
```

**File Operation Logic:**
- `canCheckout`: File is Synced or OutOfDate
- `canRevert`: File is CheckedOut, Added, or Deleted
- File History: Always available
- Diff against Have: Only when canRevert (file is checked out)
- Copy Local Path: Always available

## Behavior

### Workspace Tree (FileContextMenu)
- Right-click any file → shows all file operations
- Unchanged from before, now uses shared component

### Changelist Panel (ChangelistContextMenu)
- Right-click single file → shows:
  1. Move to Changelist (with submenu)
  2. Shelve Selected Files (if numbered changelist)
  3. **Separator**
  4. Checkout for Edit (if applicable)
  5. Revert Changes (if applicable)
  6. File History
  7. Diff against Have (if applicable)
  8. Copy Local Path

- Right-click multiple files → shows only:
  1. Move N files to Changelist (with submenu)
  2. Shelve Selected Files (if numbered changelist)
  - No single-file operations shown

## Testing Verification

1. ✓ TypeScript compilation passes (`npx tsc --noEmit`)
2. ✓ FileContextMenu refactored to use shared component
3. ✓ ChangelistContextMenu renders shared items for single file
4. ✓ ChangelistPanel wires history and diff callbacks
5. ✓ FileHistoryDialog added to ChangelistPanel

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| # | Commit | Description |
|---|--------|-------------|
| 1 | d68c0b8 | Extract shared FileContextMenuItems component |
| 2 | d569be2 | Add shared file operations to changelist context menu |

## Next Steps

This completes the quick task. Users can now access the same file operations from both panels, improving UX consistency.

**Future improvements could include:**
- Batch operations for multi-file selections (e.g., batch revert)
- Additional shared operations (open in editor, reveal in explorer)
- Keyboard shortcuts for common operations
