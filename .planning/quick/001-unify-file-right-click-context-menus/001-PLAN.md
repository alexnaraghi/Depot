---
phase: quick
plan: 001
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/shared/FileContextMenuItems.tsx
  - src/components/FileTree/FileContextMenu.tsx
  - src/components/ChangelistPanel/ChangelistContextMenu.tsx
  - src/components/ChangelistPanel/ChangelistPanel.tsx
autonomous: true

must_haves:
  truths:
    - "Right-clicking a file in the changelist panel shows revert, history, diff against have, and copy path options"
    - "Right-clicking a file in the workspace tree shows the same file operations"
    - "Both menus share a single source of truth for common menu items"
  artifacts:
    - path: "src/components/shared/FileContextMenuItems.tsx"
      provides: "Shared file context menu items component"
    - path: "src/components/ChangelistPanel/ChangelistContextMenu.tsx"
      provides: "Updated changelist menu using shared items"
    - path: "src/components/ChangelistPanel/ChangelistPanel.tsx"
      provides: "Wires onShowHistory and onDiffAgainstHave to ChangelistContextMenu"
  key_links:
    - from: "ChangelistContextMenu.tsx"
      to: "FileContextMenuItems.tsx"
      via: "import and render"
    - from: "ChangelistPanel.tsx"
      to: "ChangelistContextMenu.tsx"
      via: "onShowHistory and onDiffAgainstHave props"
---

<objective>
Unify file right-click context menu items between the workspace FileTree and the ChangelistPanel so that revert, file history, diff against have, and copy local path are available in both menus.

Purpose: Users expect the same file operations regardless of which panel they right-click in. Currently the changelist context menu only has "Move to Changelist" and "Shelve" but lacks revert, history, diff, and copy path.

Output: A shared component for common file menu items, used by both context menus.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/FileTree/FileContextMenu.tsx
@src/components/ChangelistPanel/ChangelistContextMenu.tsx
@src/components/ChangelistPanel/ChangelistPanel.tsx
@src/components/FileTree/FileTree.tsx
@src/hooks/useFileOperations.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract shared FileContextMenuItems component</name>
  <files>src/components/shared/FileContextMenuItems.tsx, src/components/FileTree/FileContextMenu.tsx</files>
  <action>
Create `src/components/shared/FileContextMenuItems.tsx` that renders the common file operation menu items: Checkout, Revert, File History, Diff against Have, Copy Local Path.

Props interface:
```typescript
interface FileContextMenuItemsProps {
  file: P4File;
  onClose: () => void;
  onShowHistory?: (depotPath: string, localPath: string) => void;
  onDiffAgainstHave?: (depotPath: string, localPath: string) => void;
}
```

Move ALL the handler logic (handleCheckout, handleRevert, handleCopyPath, handleShowHistory, handleDiffAgainstHave) and the corresponding button JSX from `FileContextMenu.tsx` into this new component. Include the `useFileOperations` hook call, the canCheckout/canRevert status checks, and all the button elements with their existing styling.

This component renders a React fragment of buttons (no wrapper div) so it can be embedded in any menu container.

Then refactor `FileContextMenu.tsx` to import and render `<FileContextMenuItems>` inside its existing menu container div, passing through the file, onClose, onShowHistory, and onDiffAgainstHave props. The menu container div with ref, click-outside handling, and escape handling stays in FileContextMenu.tsx. Only the menu item buttons move to the shared component.

Verify behavior is identical by checking that FileContextMenu still renders the same items.
  </action>
  <verify>Run `npx tsc --noEmit` to confirm no type errors. Visually inspect that FileContextMenu.tsx is now a thin wrapper around FileContextMenuItems.</verify>
  <done>FileContextMenu.tsx renders FileContextMenuItems inside its container. All file operation buttons live in the shared component.</done>
</task>

<task type="auto">
  <name>Task 2: Add shared items to ChangelistContextMenu and wire callbacks</name>
  <files>src/components/ChangelistPanel/ChangelistContextMenu.tsx, src/components/ChangelistPanel/ChangelistPanel.tsx</files>
  <action>
1. Update `ChangelistContextMenu.tsx`:
   - Add `onShowHistory` and `onDiffAgainstHave` optional callback props (same signature as FileContextMenu).
   - Import `FileContextMenuItems` from `@/components/shared/FileContextMenuItems`.
   - The changelist context menu receives `files: P4File[]` (potentially multiple). For the shared file operations (revert, history, diff, copy path), these only make sense for a single file. Add the shared items ONLY when `files.length === 1`. Render `<FileContextMenuItems file={files[0]} onClose={onClose} onShowHistory={onShowHistory} onDiffAgainstHave={onDiffAgainstHave} />` AFTER the existing Move to Changelist and Shelve items, separated by a `<div className="h-px bg-slate-700 my-1" />` divider.

2. Update `ChangelistPanel.tsx`:
   - Add state for file history dialog: `const [historyDialog, setHistoryDialog] = useState<{depotPath: string, localPath: string} | null>(null);`
   - Add handler functions mirroring FileTree.tsx patterns:
     - `handleShowHistory(depotPath, localPath)` sets historyDialog state
     - `handleDiffAgainstHave(depotPath, localPath)` invokes the diff panel (follow the same pattern as FileTree.tsx - look at how FileTree implements this to match exactly)
   - Pass `onShowHistory={handleShowHistory}` and `onDiffAgainstHave={handleDiffAgainstHave}` to ChangelistContextMenu.
   - Add the FileHistoryDialog and DiffPanel rendering (same as FileTree.tsx does) so the dialogs actually appear. Import the necessary components (FileHistoryDialog, DiffPanel) from their existing locations.

Important: Look at how FileTree.tsx implements the full history dialog and diff panel rendering to match the pattern exactly. The ChangelistPanel needs the same dialog/panel rendering infrastructure.
  </action>
  <verify>Run `npx tsc --noEmit` to confirm no type errors. Run `cargo tauri dev` and right-click a file under a changelist - verify revert, history, diff against have, and copy path items appear and function correctly.</verify>
  <done>Right-clicking a single file in the changelist panel shows all the same file operations as the workspace tree. Multi-file selections show only move/shelve (no single-file operations). Both menus use FileContextMenuItems as the single source of truth.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. Right-click a file in workspace tree: shows checkout, revert, history, diff, copy path (unchanged)
3. Right-click a single file in changelist panel: shows move, shelve, then separator, then revert, history, diff, copy path
4. Right-click multiple files in changelist panel: shows only move and shelve (no single-file items)
5. Each shared menu item (revert, history, diff, copy path) works correctly from the changelist panel
6. FileContextMenuItems.tsx is the single source for common items - no duplicated button/handler code
</verification>

<success_criteria>
- All four required operations (revert, history, diff against have, copy path) available in both context menus
- Common menu items defined once in FileContextMenuItems.tsx
- No type errors, app builds and runs correctly
</success_criteria>

<output>
After completion, create `.planning/quick/001-unify-file-right-click-context-menus/001-SUMMARY.md`
</output>
