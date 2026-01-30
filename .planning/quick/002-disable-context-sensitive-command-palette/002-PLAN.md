---
phase: quick
plan: 002
type: execute
wave: 1
depends_on: []
files_modified:
  - src/stores/fileTreeStore.ts
  - src/components/FileTree/FileTree.tsx
  - src/components/CommandPalette.tsx
autonomous: true

must_haves:
  truths:
    - "File commands (Checkout, Diff, Revert, File History) are grayed out when no file is selected"
    - "Submit command is grayed out when no numbered changelist has files"
    - "Disabled commands show a hint explaining why they are unavailable"
    - "Commands become enabled when a file is selected in the file tree"
  artifacts:
    - path: "src/stores/fileTreeStore.ts"
      provides: "Global selectedFile state"
      contains: "selectedFile"
    - path: "src/components/CommandPalette.tsx"
      provides: "Conditionally disabled commands"
      contains: "disabled"
  key_links:
    - from: "src/components/FileTree/FileTree.tsx"
      to: "src/stores/fileTreeStore.ts"
      via: "zustand setSelectedFile action"
    - from: "src/components/CommandPalette.tsx"
      to: "src/stores/fileTreeStore.ts"
      via: "useFileTreeStore selector"
---

<objective>
Disable context-sensitive commands in the command palette when no file or submittable changelist is selected, preventing silent no-ops.

Purpose: Users currently invoke file commands from the command palette expecting an action, but nothing happens when no file is selected. This confuses users.
Output: Command palette that visually grays out unavailable commands with explanatory hints.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/stores/fileTreeStore.ts
@src/stores/changelistStore.ts
@src/components/CommandPalette.tsx
@src/components/FileTree/FileTree.tsx
@src/components/ui/command.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Lift selectedFile to fileTreeStore and wire FileTree</name>
  <files>src/stores/fileTreeStore.ts, src/components/FileTree/FileTree.tsx</files>
  <action>
In `src/stores/fileTreeStore.ts`:
- Add `selectedFile: P4File | null` to the state interface and initial state (null)
- Add `setSelectedFile: (file: P4File | null) => void` action
- Implementation: `setSelectedFile: (file) => set({ selectedFile: file })`

In `src/components/FileTree/FileTree.tsx`:
- Replace the local `const [selectedFile, setSelectedFile] = useState<P4File | null>(null)` with zustand store usage
- Import `useFileTreeStore` and destructure: `const selectedFile = useFileTreeStore(s => s.selectedFile)` and `const setSelectedFile = useFileTreeStore(s => s.setSelectedFile)`
- Remove the `useState` import if no longer needed (but it IS still needed for other state like contextMenu, historyDialog, containerHeight)
- Everything else stays the same since the variable names match
  </action>
  <verify>Run `npx tsc --noEmit` to confirm no type errors. Run `npm run build` to confirm build succeeds.</verify>
  <done>selectedFile is stored in zustand and accessible globally; FileTree behavior unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Disable context-sensitive commands in CommandPalette</name>
  <files>src/components/CommandPalette.tsx</files>
  <action>
In `src/components/CommandPalette.tsx`:

1. Import stores:
   - `import { useFileTreeStore } from '@/stores/fileTreeStore';`
   - `import { useChangelistStore } from '@/stores/changelistStore';`

2. Inside the component, read state:
   - `const selectedFile = useFileTreeStore(s => s.selectedFile);`
   - `const hasFileSelected = selectedFile !== null;`
   - For submit: `const changelists = useChangelistStore(s => s.changelists);`
   - Derive: `const hasSubmittableChangelist = Array.from(changelists.values()).some(cl => cl.id !== 0 && cl.files.length > 0);`
   (id !== 0 excludes the default changelist which cannot be submitted)

3. Add `disabled` prop to the four File group CommandItems (Checkout, Diff, Revert, File History):
   - `<CommandItem disabled={!hasFileSelected} onSelect={...}>`

4. Add `disabled` prop to the Submit CommandItem:
   - `<CommandItem disabled={!hasSubmittableChangelist} onSelect={...}>`

5. Add hint text on disabled items. After the span text on each file command, add:
   - `{!hasFileSelected && <span className="ml-1 text-xs text-muted-foreground">(select a file)</span>}`
   For Submit:
   - `{!hasSubmittableChangelist && <span className="ml-1 text-xs text-muted-foreground">(no files to submit)</span>}`

Note: cmdk's CommandItem already has `data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50` styling in the ui/command.tsx wrapper, so disabled items will automatically appear grayed out and be non-interactive.
  </action>
  <verify>Run `npx tsc --noEmit` to confirm no type errors. Run `npm run build` to confirm build succeeds. Manually open the app, press Cmd/Ctrl+K to open the command palette, and verify: file commands are grayed out with "(select a file)" hint; select a file in the tree, reopen palette, and file commands are now enabled; Submit shows "(no files to submit)" when no numbered changelist has files.</verify>
  <done>File commands disabled when no file selected; Submit disabled when no submittable changelist; hints shown on disabled items; all commands re-enable when conditions are met.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes
- `npm run build` succeeds
- Command palette shows grayed out file commands with "(select a file)" when no file selected
- Command palette shows grayed out Submit with "(no files to submit)" when applicable
- Selecting a file in FileTree enables the file commands
- Having a numbered changelist with files enables Submit
</verification>

<success_criteria>
Context-sensitive commands in the command palette are visually disabled with explanatory hints when their preconditions are not met, eliminating silent no-op behavior.
</success_criteria>

<output>
After completion, create `.planning/quick/002-disable-context-sensitive-command-palette/002-SUMMARY.md`
</output>
