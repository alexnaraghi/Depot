---
phase: quick
plan: 006
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/commands/p4.rs
  - src/layouts/MainLayout.tsx
  - src/components/CommandPalette.tsx
  - src/hooks/useSync.ts
  - src/hooks/useShelvedFiles.ts
  - src/hooks/useResolve.ts
  - src/hooks/useReconcile.ts
  - src/hooks/useFileOperations.ts
  - src/components/DepotContextMenu.tsx
  - src/components/ChangelistPanel.tsx
  - src/components/ChangelistContextMenu.tsx
  - src/components/EditDescriptionDialog.tsx
autonomous: true
must_haves:
  truths:
    - "p4_submit uses apply_connection_args instead of manual arg setting"
    - "No window.__queryClient global exists anywhere in codebase"
    - "parse_ztag_records() is a single shared function replacing 12 duplicated patterns"
    - "useSync progress callback does not capture stale closure values"
    - "All multi-invalidation sites use batched invalidation"
  artifacts:
    - path: "src-tauri/src/commands/p4.rs"
      provides: "apply_connection_args in p4_submit, parse_ztag_records extraction"
    - path: "src/hooks/useSync.ts"
      provides: "Ref-based progress counters"
  key_links: []
---

<objective>
Fix 5 short-term architecture issues from the architecture report: inconsistent connection args in p4_submit, window.__queryClient global, duplicated ztag parsing, stale closure in useSync, and sequential query invalidation.

Purpose: Code quality improvements — reduce duplication, fix bugs, remove anti-patterns.
Output: Cleaner codebase with no behavioral changes.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src-tauri/src/commands/p4.rs
@src/layouts/MainLayout.tsx
@src/components/CommandPalette.tsx
@src/hooks/useSync.ts
@src/hooks/useShelvedFiles.ts
@src/hooks/useResolve.ts
@src/hooks/useReconcile.ts
@src/hooks/useFileOperations.ts
@src/components/DepotContextMenu.tsx
@src/components/ChangelistPanel.tsx
@src/components/ChangelistContextMenu.tsx
@src/components/EditDescriptionDialog.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix p4_submit to use apply_connection_args</name>
  <files>src-tauri/src/commands/p4.rs</files>
  <action>
    In the p4_submit function (~lines 594-634), find the two code paths (default CL and named CL) that manually set -p, -u, -c args on the command. Replace both manual arg-setting blocks with a single call to apply_connection_args(&mut cmd, &server, &user, &client) — the same helper every other command function uses.
  </action>
  <verify>cargo build --manifest-path src-tauri/Cargo.toml compiles without errors. Grep p4_submit for manual "-p"/"-u"/"-c" arg setting — should find none.</verify>
  <done>p4_submit uses apply_connection_args consistently with all other commands.</done>
</task>

<task type="auto">
  <name>Task 2: Kill window.__queryClient global</name>
  <files>src/layouts/MainLayout.tsx, src/components/CommandPalette.tsx</files>
  <action>
    1. In MainLayout.tsx, delete the line `(window as any).__queryClient = queryClient;` (~line 96).
    2. In CommandPalette.tsx, replace `const queryClient = (window as any).__queryClient;` (~line 67) with `const queryClient = useQueryClient();`. Add the useQueryClient import from @tanstack/react-query if not already present.
    CommandPalette is rendered inside MainLayout's QueryClientProvider tree, so useQueryClient() works.
  </action>
  <verify>npm run build succeeds. Grep entire src/ for "__queryClient" — zero results.</verify>
  <done>No global queryClient reference exists. CommandPalette uses useQueryClient() hook.</done>
</task>

<task type="auto">
  <name>Task 3: Extract parse_ztag_records() in Rust</name>
  <files>src-tauri/src/commands/p4.rs</files>
  <action>
    Create a shared function:
    ```rust
    fn parse_ztag_records(output: &str) -> Vec<HashMap<String, String>> {
        let mut records = Vec::new();
        let mut current: HashMap<String, String> = HashMap::new();
        for line in output.lines() {
            if line.starts_with("... ") {
                let rest = &line[4..];
                if let Some(pos) = rest.find(' ') {
                    let key = rest[..pos].to_string();
                    let value = rest[pos+1..].to_string();
                    current.insert(key, value);
                } else {
                    current.insert(rest.to_string(), String::new());
                }
            } else if line.trim().is_empty() && !current.is_empty() {
                records.push(std::mem::take(&mut current));
            }
        }
        if !current.is_empty() {
            records.push(current);
        }
        records
    }
    ```

    Then refactor these 12 functions to call parse_ztag_records() and map over results with their specific builder logic: parse_ztag_info, parse_ztag_fstat, parse_ztag_changes, parse_ztag_clients, parse_ztag_filelog, parse_ztag_describe_shelved, parse_ztag_streams, parse_ztag_client_spec, parse_ztag_depots, parse_ztag_dirs, parse_ztag_fstat_unresolved, launch_merge_tool.

    Each refactored function becomes: call parse_ztag_records(), then .into_iter().map(|record| build_specific_struct(record)).collect(). Some functions (like parse_ztag_filelog) have nested sub-records — handle these by post-processing the flat records.

    IMPORTANT: Carefully check each function for edge cases. Some may handle "... " prefix slightly differently (e.g., multi-value keys with numeric suffixes like rev0, rev1). Preserve all existing behavior.
  </action>
  <verify>cargo build --manifest-path src-tauri/Cargo.toml compiles. cargo test --manifest-path src-tauri/Cargo.toml passes (if tests exist). Grep for the old duplicated pattern (lines matching `if line.starts_with("... ")` inside parse_ztag_ functions) — should only appear in parse_ztag_records itself.</verify>
  <done>Single parse_ztag_records() function exists. All 12 parse functions delegate to it.</done>
</task>

<task type="auto">
  <name>Task 4: Fix stale closure in useSync progress</name>
  <files>src/hooks/useSync.ts</files>
  <action>
    The progress callback in useSync captures stale totalFiles/syncedFiles values from useState.

    Fix: Create useRef counterparts for totalFiles and syncedFiles. In the progress callback, read/write the ref values. After processing, call the setState setters from the ref values so the UI still re-renders. Specifically:
    - Add `const totalFilesRef = useRef(0)` and `const syncedFilesRef = useRef(0)`
    - In the progress callback, increment syncedFilesRef.current and read totalFilesRef.current
    - After updating refs, call setTotalFiles(totalFilesRef.current) and setSyncedFiles(syncedFilesRef.current) to trigger renders
    - Where totalFiles is set initially (line ~127 area), also set totalFilesRef.current
  </action>
  <verify>npm run build succeeds. Read useSync.ts and confirm the progress callback references .current refs, not closure-captured state.</verify>
  <done>Progress callback reads from refs, not stale closure state. UI still updates via setState calls.</done>
</task>

<task type="auto">
  <name>Task 5: Batch query invalidation across all hooks</name>
  <files>src/hooks/useShelvedFiles.ts, src/hooks/useResolve.ts, src/hooks/useReconcile.ts, src/hooks/useFileOperations.ts, src/components/DepotContextMenu.tsx, src/components/ChangelistPanel.tsx, src/components/ChangelistContextMenu.tsx, src/components/EditDescriptionDialog.tsx</files>
  <action>
    In each file, find sequential `await queryClient.invalidateQueries(...)` calls and wrap them in `await Promise.all([...])`.

    Specific locations:
    - useShelvedFiles.ts: lines ~73-75 and ~157-159
    - useResolve.ts: lines ~90-93
    - useReconcile.ts: lines ~89-91
    - DepotContextMenu.tsx: lines ~71-72
    - ChangelistPanel.tsx: lines ~234-235
    - ChangelistContextMenu.tsx: lines ~99-100
    - EditDescriptionDialog.tsx: lines ~91-92 and ~104
    - useFileOperations.ts: sequential awaits to Promise.all

    Pattern: Replace
    ```ts
    await queryClient.invalidateQueries({ queryKey: ['a'] });
    await queryClient.invalidateQueries({ queryKey: ['b'] });
    ```
    With:
    ```ts
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['a'] }),
      queryClient.invalidateQueries({ queryKey: ['b'] }),
    ]);
    ```
  </action>
  <verify>npm run build succeeds. Grep for consecutive invalidateQueries lines not wrapped in Promise.all — should find none.</verify>
  <done>All multi-invalidation sites use Promise.all for concurrent execution.</done>
</task>

</tasks>

<verification>
- `cargo build --manifest-path src-tauri/Cargo.toml` compiles
- `npm run build` succeeds
- Grep confirms: no `__queryClient`, no manual args in p4_submit, no duplicated ztag parsing, no sequential invalidations
</verification>

<success_criteria>
All 5 architecture report items resolved. No behavioral changes, only structural improvements.
</success_criteria>

<output>
After completion, create `.planning/quick/006-architecture-report-short-term-fixes/006-SUMMARY.md`
</output>
