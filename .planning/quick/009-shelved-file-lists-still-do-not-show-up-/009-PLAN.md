---
phase: quick
plan: 009
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/commands/p4.rs
  - src/components/ChangelistPanel/useChangelists.ts
  - src/hooks/useShelvedFiles.ts
autonomous: true

must_haves:
  truths:
    - "Pending changelists with shelved files show a 'Shelved Files (N)' section in the changelist tree"
    - "Clicking a pending CL with shelved files shows shelved files in the detail pane"
    - "Shelved files appear on app startup without requiring user action"
  artifacts:
    - path: "src-tauri/src/commands/p4.rs"
      provides: "Robust p4_describe_shelved that handles edge cases and logs output"
    - path: "src/components/ChangelistPanel/useChangelists.ts"
      provides: "Shelved file queries with error resilience"
    - path: "src/hooks/useShelvedFiles.ts"
      provides: "Shelved file query with retry and error handling"
  key_links:
    - from: "src-tauri/src/commands/p4.rs"
      to: "p4 describe -S"
      via: "Command execution and ztag parsing"
      pattern: "p4_describe_shelved"
    - from: "src/components/ChangelistPanel/useChangelists.ts"
      to: "src-tauri/src/commands/p4.rs"
      via: "invokeP4DescribeShelved"
      pattern: "useQueries.*shelved"
---

<objective>
Fix shelved file lists not appearing in the pending changelist panel or detail pane.

Purpose: The shelved file pipeline (backend command -> query -> tree builder -> renderer) appears structurally correct but shelved files never display. The root cause is likely in one of three areas: (1) the backend `p4 describe -S` command returning errors or unexpected output format, (2) the frontend queries failing silently, or (3) the error handling masking the actual issue. This plan diagnoses and fixes the data flow.

Output: Shelved files appear in both the changelist tree (as collapsible "Shelved Files (N)" sections) and the changelist detail pane whenever a pending CL has shelved files.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src-tauri/src/commands/p4.rs (p4_describe_shelved function, lines 1610-1681)
@src/components/ChangelistPanel/useChangelists.ts (shelved query integration, lines 146-198)
@src/hooks/useShelvedFiles.ts (useShelvedFilesQuery hook)
@src/utils/treeBuilder.ts (buildChangelistTree with shelvedFilesMap)
@src/components/ChangelistPanel/ChangelistNode.tsx (shelved-section and shelved-file rendering)
@src/components/DetailPane/ChangelistDetailView.tsx (shelved files display in detail pane)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix backend p4_describe_shelved error handling and add diagnostic logging</name>
  <files>src-tauri/src/commands/p4.rs</files>
  <action>
The `p4_describe_shelved` command (line 1612) has two likely failure modes:

**Problem A: Non-zero exit code for CLs without shelved files.**
`p4 describe -S <CL>` may return a non-zero exit code with stderr like "Change NNN has no shelved files" for CLs that have no shelved data. The current code returns `Err(stderr)` which puts every non-shelved CL query into error state, causing retries.

Fix: In `p4_describe_shelved`, check stderr for "no shelved files" patterns BEFORE the exit code check. If stderr contains "no shelved files" or similar, return `Ok(vec![])` instead of `Err(...)`.

```rust
let stdout = String::from_utf8_lossy(&output.stdout);
let stderr = String::from_utf8_lossy(&output.stderr);

// CLs without shelved files may return non-zero exit with "no shelved files" message
// Treat this as empty result, not error
if !output.status.success() {
    let stderr_lower = stderr.to_lowercase();
    if stderr_lower.contains("no shelved files")
        || stderr_lower.contains("not shelved")
        || stderr_lower.contains("no shelf")
        || stdout.trim().is_empty() && stderr.trim().is_empty()
    {
        return Ok(vec![]);
    }
    return Err(stderr.to_string());
}
```

**Problem B: Potential parsing failure for empty output.**
If `p4 describe -S` succeeds but returns no `depotFile0` fields (just CL metadata), the parser correctly returns empty vec. This is fine. But add `eprintln!` diagnostic logging to help debug:

Add temporary diagnostic logging at the top of `p4_describe_shelved` and in the parser:

```rust
// In p4_describe_shelved, after getting output:
eprintln!("[shelved] CL {}: exit={}, stdout_len={}, stderr_len={}",
    changelist_id, output.status.success(), stdout.len(), stderr.len());

// In parse_ztag_describe_shelved, log the number of files found:
eprintln!("[shelved] parsed {} shelved files", files.len());
```

Also add `-s` flag to suppress diffs (performance improvement and reduces output noise):
Change the command from `p4 -ztag describe -S <CL>` to `p4 -ztag describe -s -S <CL>`. The `-s` (lowercase) suppresses diff output which is irrelevant for shelved file listing and can make the output very large.

```rust
cmd.arg("-ztag");
cmd.arg("describe");
cmd.arg("-s");  // suppress diffs
cmd.arg("-S");  // show shelved files
cmd.arg(changelist_id.to_string());
```
  </action>
  <verify>
Run `cargo build` in `src-tauri/` to confirm the Rust code compiles. Verify the error handling logic and logging are correct by reading the modified function.
  </verify>
  <done>
`p4_describe_shelved` returns `Ok(vec![])` instead of `Err(...)` for CLs without shelved files, includes `-s` flag to suppress diffs, and has diagnostic `eprintln!` logging to help debug shelved file parsing issues.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add error resilience to frontend shelved file queries</name>
  <files>src/hooks/useShelvedFiles.ts, src/components/ChangelistPanel/useChangelists.ts</files>
  <action>
The frontend queries shelved files in two places:
1. `useChangelists.ts` line 154: `useQueries` for ALL numbered CLs (for the tree)
2. `useShelvedFiles.ts` line 21: `useShelvedFilesQuery` for a single CL (for the detail pane)

**Fix 1: In `useChangelists.ts` (line 154-172), add `retry: false` and error handling to the shelved queries.**

Most CLs won't have shelved files, and the backend now returns `Ok(vec![])` for those. But for defensive coding, set `retry: 1` (reduce from default 3) and add a `select` transform to ensure we always get an array:

```typescript
queries: numberedClIds.map(clId => ({
  queryKey: ['p4', 'shelved', clId],
  queryFn: async () => {
    const { addOutputLine } = useOperationStore.getState();
    const verbose = await getVerboseLogging();
    if (verbose) addOutputLine(`p4 describe -S ${clId}`, false);
    try {
      const result = await invokeP4DescribeShelved(clId);
      if (verbose) addOutputLine(`... returned ${result.length} shelved items`, false);
      return result;
    } catch (error) {
      // CL may not have shelved files - return empty array instead of throwing
      if (verbose) addOutputLine(`... no shelved files (${error})`, false);
      return [] as P4ShelvedFile[];
    }
  },
  enabled: isConnected,
  staleTime: 30000,
  refetchOnWindowFocus: false,
  refetchInterval: refetchIntervalValue,
  retry: 1,
})),
```

The key change: wrap `invokeP4DescribeShelved` in try/catch within queryFn, returning `[]` on error. This prevents TanStack Query from entering error state for CLs without shelved files, which was causing unnecessary retries and potentially blocking the entire query batch behavior.

**Fix 2: In `useShelvedFiles.ts` (line 21-36), apply the same try/catch pattern:**

```typescript
export function useShelvedFilesQuery(changelistId: number) {
  const { p4port, p4user, p4client } = useConnectionStore();

  return useQuery<P4ShelvedFile[]>({
    queryKey: ['p4', 'shelved', changelistId],
    queryFn: async () => {
      const { addOutputLine } = useOperationStore.getState();
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine(`p4 describe -S ${changelistId}`, false);
      try {
        const result = await invokeP4DescribeShelved(changelistId);
        if (verbose) addOutputLine(`... returned ${result.length} shelved items`, false);
        return result;
      } catch (error) {
        if (verbose) addOutputLine(`... no shelved files (${error})`, false);
        return [];
      }
    },
    enabled: changelistId > 0 && !!p4port && !!p4user && !!p4client,
    retry: 1,
  });
}
```

**Fix 3: In `useChangelists.ts`, improve `shelvedFilesMap` useMemo to be more robust.**

The current code at line 175-184 checks `query?.data && query.data.length > 0`. Add a console.log to track shelved file map state for debugging:

```typescript
const shelvedFilesMap = useMemo(() => {
  const map = new Map<number, P4ShelvedFile[]>();
  numberedClIds.forEach((clId, index) => {
    const query = shelvedQueries[index];
    if (query?.data && query.data.length > 0) {
      map.set(clId, query.data);
    }
  });
  if (map.size > 0) {
    console.log(`[shelved] ${map.size} CL(s) have shelved files:`, [...map.entries()].map(([id, files]) => `CL ${id}: ${files.length} files`));
  }
  return map;
}, [numberedClIds, shelvedQueries]);
```

This logging helps verify whether the data is making it through the pipeline. The console.log can be removed once the issue is confirmed fixed.
  </action>
  <verify>
Run `npx tsc --noEmit` from the project root to confirm TypeScript compiles without errors. Check that both `useShelvedFilesQuery` and the `useQueries` in `useChangelists` have try/catch in their queryFn.
  </verify>
  <done>
Frontend shelved file queries catch errors gracefully (returning `[]` instead of throwing), reducing retry noise. Diagnostic logging added to trace shelved file data through the pipeline. Both `useShelvedFiles.ts` and `useChangelists.ts` are resilient to backend errors.
  </done>
</task>

</tasks>

<verification>
1. Build backend: `cd src-tauri && cargo build` -- should compile without errors
2. Build frontend: `npx tsc --noEmit` -- should have no TypeScript errors
3. Run the app: `cargo tauri dev` -- app launches, changelist panel loads
4. Create a numbered CL, shelve some files to it, verify "Shelved Files (N)" section appears in the changelist tree
5. Click the CL in the tree, verify shelved files appear in the detail pane
6. Check terminal/console output for `[shelved]` diagnostic messages to confirm data flow

If shelved files STILL don't show up after these fixes, the diagnostic logging will reveal exactly where the pipeline breaks:
- Backend `eprintln!` shows whether `p4 describe -S` returns data
- Frontend `console.log` shows whether the data reaches the shelvedFilesMap
- If backend returns data but frontend doesn't display, the issue is in tree building or rendering
- If backend returns empty, the issue is in the `p4 describe -S` command or parsing
</verification>

<success_criteria>
- Shelved files appear in the changelist tree as "Shelved Files (N)" sections under their respective CLs
- Shelved files appear in the changelist detail pane when a CL with shelved files is selected
- CLs without shelved files do not cause query errors or retries
- Diagnostic logging provides clear visibility into the shelved file data pipeline
</success_criteria>

<output>
After completion, create `.planning/quick/009-shelved-file-lists-still-do-not-show-up-/009-SUMMARY.md`
</output>
