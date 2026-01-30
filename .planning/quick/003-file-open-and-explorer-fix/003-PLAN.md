---
phase: quick
plan: 003
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/shared/FileContextMenuItems.tsx
autonomous: true

must_haves:
  truths:
    - "Right-clicking any file (workspace or changelist) shows 'Open' option that opens file with OS default app"
    - "Open in Explorer works for files in changelist panel (not just workspace tree)"
  artifacts:
    - path: "src/components/shared/FileContextMenuItems.tsx"
      provides: "Open menu item using openPath, reliable revealItemInDir"
      contains: "openPath"
  key_links:
    - from: "src/components/shared/FileContextMenuItems.tsx"
      to: "@tauri-apps/plugin-opener"
      via: "openPath import"
      pattern: "openPath"
---

<objective>
Add "Open" menu item to the shared FileContextMenuItems component (opens file with OS default app via `openPath` from `@tauri-apps/plugin-opener`), and fix "Open in Explorer" for changelist files where `revealItemInDir` may fail due to path format issues.

Purpose: Users need to quickly open files in their default editor/viewer, and Open in Explorer should work consistently regardless of where the file appears in the UI.
Output: Updated FileContextMenuItems.tsx with both features working.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/shared/FileContextMenuItems.tsx
@node_modules/@tauri-apps/plugin-opener/dist-js/index.d.ts
@src-tauri/capabilities/default.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Open menu item and fix Open in Explorer</name>
  <files>src/components/shared/FileContextMenuItems.tsx</files>
  <action>
  Two changes to FileContextMenuItems.tsx:

  1. **Add "Open" menu item** - Opens file with OS default application:
     - Import `openPath` from `@tauri-apps/plugin-opener` (already have `revealItemInDir` imported from there)
     - Add `handleOpen` function: calls `openPath(file.localPath)`, with try/catch showing toast.error on failure
     - Add an "Open" button immediately after the separator that follows Diff against Have (line 164), BEFORE "Copy Local Path"
     - Use `ExternalLink` icon from lucide-react (import it)
     - No keyboard shortcut label needed
     - The `opener:default` permission in capabilities already covers `openPath`

  2. **Fix Open in Explorer for changelist files** - The `revealItemInDir` call on line 84 uses `file.localPath` which should work. If the issue is path separators (Perforce returns forward slashes on Windows), normalize the path before passing to both `openPath` and `revealItemInDir`:
     - In both `handleOpen` and `handleOpenInExplorer`, pass the localPath directly (the Tauri plugin should handle path normalization)
     - If testing reveals the issue is that localPath is empty or malformed for changelist files, add a guard: if `!file.localPath` show toast.error("No local path available") and return

  Final menu order should be:
  - Checkout (conditional)
  - Revert (conditional)
  - File History
  - Diff against Have (conditional)
  - --- separator ---
  - Open (NEW)
  - Copy Local Path
  - Open in Explorer
  </action>
  <verify>
  - `npm run build` compiles without errors
  - Right-click a file in workspace tree: "Open" option visible, opens file in default app
  - Right-click a file in changelist panel: "Open" option visible, opens file in default app
  - Right-click a file in changelist panel: "Open in Explorer" works (opens Explorer with file selected)
  </verify>
  <done>
  - "Open" menu item appears in all file context menus (workspace and changelist) and opens files with OS default application
  - "Open in Explorer" works for both workspace and changelist files
  </done>
</task>

</tasks>

<verification>
- `npm run build` succeeds
- Manual test: right-click file in workspace tree, verify Open and Open in Explorer both work
- Manual test: right-click file in changelist panel, verify Open and Open in Explorer both work
</verification>

<success_criteria>
- Open menu item present in all file right-click menus
- Open launches file in OS default application (e.g., .txt opens in Notepad)
- Open in Explorer works for changelist files (not just workspace files)
</success_criteria>

<output>
After completion, create `.planning/quick/003-file-open-and-explorer-fix/003-SUMMARY.md`
</output>
