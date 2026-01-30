---
phase: quick-004
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/settings.ts
  - src/lib/settings.ts
  - src/components/SettingsDialog.tsx
  - src/hooks/useShelvedFiles.ts
  - src/hooks/useReconcile.ts
  - src/components/ChangelistPanel/ChangelistPanel.tsx
  - src/components/ChangelistPanel/EditDescriptionDialog.tsx
  - src/components/ChangelistPanel/CreateChangelistDialog.tsx
  - src/components/ChangelistPanel/ChangelistContextMenu.tsx
  - src/components/ChangelistPanel/useChangelists.ts
  - src/components/FileTree/useFileTree.ts
  - src/hooks/useSearch.ts
  - src/hooks/useFileHistory.ts
  - src/hooks/useDiff.ts
  - src/hooks/useSettings.ts
autonomous: true

must_haves:
  truths:
    - "Mutating P4 commands (shelve, unshelve, delete shelf, reopen, create change, delete change, edit description, reconcile apply) always log command and result to output panel"
    - "Read-only P4 commands (info, fstat, opened, changes, filelog, print, list workspaces, test connection, changes submitted, describe shelved, reconcile preview) log to output panel only when verbose logging is enabled"
    - "User can toggle verbose logging in Settings dialog, persisted across restarts"
  artifacts:
    - path: "src/types/settings.ts"
      provides: "verboseLogging field in P4Settings"
      contains: "verboseLogging"
    - path: "src/lib/settings.ts"
      provides: "Persistence of verboseLogging setting"
      contains: "verboseLogging"
  key_links:
    - from: "src/hooks/useShelvedFiles.ts"
      to: "src/store/operation.ts"
      via: "addOutputLine calls in shelve/unshelve/deleteShelf mutations"
      pattern: "addOutputLine"
    - from: "src/components/ChangelistPanel/ChangelistPanel.tsx"
      to: "src/store/operation.ts"
      via: "addOutputLine calls in reopen/deleteChange handlers"
      pattern: "addOutputLine"
---

<objective>
Add two-tier output logging to all P4 commands. Mutating commands always log their command string and result to the output panel. Read-only commands log only when a "Verbose Logging" setting is enabled.

Purpose: Users need visibility into what P4 commands are running, especially mutating ones. Verbose mode enables debugging read-only queries.
Output: All P4 invocations log to the output panel with appropriate tier filtering.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/store/operation.ts
@src/hooks/useFileOperations.ts
@src/types/settings.ts
@src/lib/settings.ts
@src/components/SettingsDialog.tsx
@src/hooks/useShelvedFiles.ts
@src/hooks/useReconcile.ts
@src/components/ChangelistPanel/ChangelistPanel.tsx
@src/components/ChangelistPanel/EditDescriptionDialog.tsx
@src/components/ChangelistPanel/CreateChangelistDialog.tsx
@src/components/ChangelistPanel/ChangelistContextMenu.tsx
@src/components/ChangelistPanel/useChangelists.ts
@src/components/FileTree/useFileTree.ts
@src/hooks/useSearch.ts
@src/hooks/useFileHistory.ts
@src/hooks/useDiff.ts
@src/hooks/useSettings.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add verbose logging setting with UI toggle</name>
  <files>
    src/types/settings.ts
    src/lib/settings.ts
    src/components/SettingsDialog.tsx
  </files>
  <action>
1. In `src/types/settings.ts`: Add `verboseLogging: z.boolean()` to `settingsSchema`. Update `defaultSettings` with `verboseLogging: false`.

2. In `src/lib/settings.ts`: Add `verboseLogging` to `loadSettings()` (use `await store.get<boolean>('verboseLogging') ?? defaultSettings.verboseLogging`) and `saveSettings()`.

3. In `src/components/SettingsDialog.tsx`: Add a "Verbose Logging" toggle in a new "Logging" section after the Diff Tool section. Use a simple HTML `<input type="checkbox">` styled with Tailwind (the project has no Switch/Checkbox UI component). Wire it as a FormField for `verboseLogging`. Label: "Verbose Logging", description text: "Log read-only P4 commands (info, fstat, opened, etc.) to the output panel".

The checkbox section pattern:
```tsx
<div className="border-t border-border pt-4 mt-2">
  <h3 className="text-sm font-medium text-foreground mb-3">Logging</h3>
  <FormField
    control={form.control}
    name="verboseLogging"
    render={({ field }) => (
      <FormItem className="flex items-center gap-3">
        <FormControl>
          <input
            type="checkbox"
            checked={field.value}
            onChange={field.onChange}
            className="h-4 w-4 rounded border-border accent-primary"
          />
        </FormControl>
        <div>
          <FormLabel className="text-sm">Verbose Logging</FormLabel>
          <p className="text-xs text-muted-foreground">
            Log read-only P4 commands to the output panel
          </p>
        </div>
      </FormItem>
    )}
  />
</div>
```

Also update the form `defaultValues` to include `verboseLogging: false`.
  </action>
  <verify>Run `npm run build` -- no type errors. Open Settings dialog and confirm the Verbose Logging checkbox renders in its own section.</verify>
  <done>Settings schema includes verboseLogging boolean, persisted via tauri-plugin-store, toggle visible in Settings dialog.</done>
</task>

<task type="auto">
  <name>Task 2: Add logging to all mutating commands</name>
  <files>
    src/hooks/useShelvedFiles.ts
    src/hooks/useReconcile.ts
    src/components/ChangelistPanel/ChangelistPanel.tsx
    src/components/ChangelistPanel/EditDescriptionDialog.tsx
    src/components/ChangelistPanel/CreateChangelistDialog.tsx
    src/components/ChangelistPanel/ChangelistContextMenu.tsx
  </files>
  <action>
For each mutating command location, import `useOperationStore` and destructure `addOutputLine`. Log the command string before invocation and the result after. Follow the pattern in `useFileOperations.ts` (log command, log result lines, log errors to stderr).

**useShelvedFiles.ts** - The hooks use `useMutation` so add logging inside `mutationFn` and `onSuccess`/`onError`. Since hooks cannot call other hooks conditionally, get `addOutputLine` at the top of each hook function via `useOperationStore.getState().addOutputLine` OR import `useOperationStore` and destructure at hook level.

Best approach: Import `{ useOperationStore }` and destructure `addOutputLine` at the top of each hook (`useShelve`, `useUnshelve`, `useDeleteShelf`).

- `useShelve`: Log `p4 shelve -c {changelistId} {filePaths.join(' ')}` before invoke. In onSuccess: `addOutputLine(data, false)` (the result string). In onError: `addOutputLine('Error: ' + error, true)`.
- `useUnshelve`: Log `p4 unshelve -s {changelistId}` (append file paths if provided). In onSuccess: `addOutputLine(data, false)`. In onError (except user cancelled): `addOutputLine('Error: ' + error, true)`.
- `useDeleteShelf`: Log `p4 shelve -d -c {changelistId}` before invoke. In onSuccess: `addOutputLine(data, false)`. In onError: `addOutputLine('Error: ' + error, true)`.

**ChangelistPanel.tsx** - Has inline `invokeP4Reopen` and `invokeP4DeleteChange` calls.
- Import `useOperationStore` and destructure `addOutputLine`.
- Before `invokeP4Reopen`: `addOutputLine('p4 reopen -c {targetCl} {paths}', false)`. After: `addOutputLine(result.join('\n'), false)`. On catch: `addOutputLine('Error: ' + error, true)`.
- Before `invokeP4DeleteChange`: `addOutputLine('p4 change -d {cl.id}', false)`. After: `addOutputLine('Change {cl.id} deleted.', false)`. On catch: `addOutputLine('Error: ' + error, true)`.

**EditDescriptionDialog.tsx** - Has `invokeP4CreateChange` and `invokeP4EditChangeDescription`.
- Import `useOperationStore` and get `addOutputLine` via `useOperationStore.getState()` (inside submit handler, not hook level since this is a component).
  Actually, better: destructure from `useOperationStore()` at component level.
- Before `invokeP4CreateChange`: `addOutputLine('p4 change -o (new changelist)', false)`. After: `addOutputLine('Change {newClId} created.', false)`.
- Before `invokeP4EditChangeDescription`: `addOutputLine('p4 change -i (edit changelist {changelistId})', false)`. After: `addOutputLine('Change {changelistId} updated.', false)`.
- On catch: `addOutputLine('Error: ' + error, true)`.

**CreateChangelistDialog.tsx** - Has `invokeP4CreateChange`.
- Import and use `addOutputLine` at component level.
- Before invoke: `addOutputLine('p4 change -o (new changelist)', false)`. After: `addOutputLine('Change {newClId} created.', false)`. On catch: `addOutputLine('Error: ' + error, true)`.

**ChangelistContextMenu.tsx** - Has `invokeP4Reopen`.
- Import and use `addOutputLine` at component level.
- Before invoke: `addOutputLine('p4 reopen -c {targetCl} {paths}', false)`. After: `addOutputLine(result.join('\n'), false)`. On catch: `addOutputLine('Error: ' + error, true)`.
  </action>
  <verify>Run `npm run build` -- no type errors. Exercise each mutating operation (shelve, unshelve, delete shelf, reopen, create CL, delete CL, edit description, reconcile apply) and confirm output panel shows command + result.</verify>
  <done>All mutating P4 commands log command string and result to output panel regardless of verbose setting.</done>
</task>

<task type="auto">
  <name>Task 3: Add verbose-gated logging to read-only commands</name>
  <files>
    src/components/ChangelistPanel/useChangelists.ts
    src/components/FileTree/useFileTree.ts
    src/hooks/useSearch.ts
    src/hooks/useFileHistory.ts
    src/hooks/useDiff.ts
    src/hooks/useReconcile.ts
    src/hooks/useSettings.ts
    src/hooks/useShelvedFiles.ts
    src/hooks/useSync.ts
  </files>
  <action>
Read-only commands use `useQuery` which auto-fires. We need to wrap query functions to optionally log.

**Strategy:** Create a helper that checks the verbose setting and conditionally logs. Since `useQuery` queryFn runs outside React render, use `useOperationStore.getState().addOutputLine` for logging inside queryFn. For the verbose check, load the setting from the store.

Add a small helper at the top of each file (or create a shared utility). The simplest approach: create a shared utility.

Create NO new files. Instead, add a `getVerboseLogging` export to `src/lib/settings.ts`:
```ts
export async function getVerboseLogging(): Promise<boolean> {
  const store = await getStore();
  return (await store.get<boolean>('verboseLogging')) ?? false;
}
```

Then in each read-only query location, wrap the queryFn to conditionally log:

**Pattern for useQuery locations:**
```ts
queryFn: async () => {
  const result = await invokeP4Xxx(...);
  // Verbose logging
  const verbose = await getVerboseLogging();
  if (verbose) {
    const { addOutputLine } = useOperationStore.getState();
    addOutputLine('p4 xxx ...', false);
    // Log abbreviated result (e.g., count of items)
    addOutputLine(`... returned ${Array.isArray(result) ? result.length + ' items' : 'ok'}`, false);
  }
  return result;
},
```

Actually, to avoid async overhead on every query, check verbose BEFORE the invoke and log command, then log result. This is cleaner:

```ts
queryFn: async () => {
  const { addOutputLine } = useOperationStore.getState();
  const verbose = await getVerboseLogging();
  if (verbose) addOutputLine('p4 xxx', false);
  const result = await invokeP4Xxx(...);
  if (verbose) addOutputLine(`... ${Array.isArray(result) ? result.length + ' items' : 'ok'}`, false);
  return result;
},
```

Apply this pattern to ALL read-only queries:

1. **useChangelists.ts** - `invokeP4Changes` (log `p4 changes -s pending`), `invokeP4Opened` (log `p4 opened`), `invokeP4DescribeShelved` (log `p4 describe -S {id}`)
2. **useFileTree.ts** - `invokeP4Info` (log `p4 info`), `invokeP4Fstat` (log `p4 fstat {depotPath}`)
3. **useSearch.ts** - `invokeP4ChangesSubmitted` (log `p4 changes -s submitted`)
4. **useFileHistory.ts** - `invokeP4Filelog` (log `p4 filelog {depotPath}`)
5. **useDiff.ts** - `invokeP4PrintToFile` (log `p4 print {depotPath}#{rev}`)
6. **useReconcile.ts** - `invokeP4Info` (log `p4 info`), `invokeP4ReconcilePreview` (log `p4 reconcile -n`). NOTE: `invokeP4ReconcileApply` is mutating -- add ALWAYS logging for it here too (was missed from Task 2).
7. **useSettings.ts** - `invokeP4Info` for connection test (log `p4 info`)
8. **useShelvedFiles.ts** - `useShelvedFilesQuery` uses `invokeP4DescribeShelved` as read-only query (log `p4 describe -S {changelistId}`)
9. **useSync.ts** - `invokeP4Info` query (log `p4 info`)

Import `getVerboseLogging` from `@/lib/settings` and `useOperationStore` from `@/store/operation` in each file.

For `useReconcile.ts` reconcileApply mutation (mutating, always log): add `addOutputLine('p4 reconcile {filePaths.join(" ")}', false)` before invoke and `addOutputLine(result, false)` on success, `addOutputLine('Error: ' + error, true)` on error.
  </action>
  <verify>Run `npm run build` -- no type errors. With verbose OFF: mutating commands still log, read-only commands do NOT log. With verbose ON: all commands log to output panel.</verify>
  <done>Read-only commands log to output panel only when verbose logging is enabled. Reconcile apply (mutating) always logs.</done>
</task>

</tasks>

<verification>
1. `npm run build` passes with no errors
2. Open app, perform a mutating operation (e.g., create changelist) -- output panel shows command and result
3. Open app, with verbose OFF, trigger a read-only query (e.g., switch views to trigger fstat) -- output panel does NOT show read-only commands
4. Enable verbose logging in Settings, trigger read-only queries -- output panel shows read-only commands with results
5. Restart app, verify verbose setting persisted
</verification>

<success_criteria>
- All mutating P4 commands (shelve, unshelve, delete shelf, reopen, create change, delete change, edit description, reconcile apply) always log to output panel
- All read-only P4 commands log to output panel only when verbose logging is enabled
- Verbose logging toggle exists in Settings dialog and persists across restarts
- No build errors
</success_criteria>

<output>
After completion, create `.planning/quick/004-audit-fix-p4-command-output-logging/004-SUMMARY.md`
</output>
