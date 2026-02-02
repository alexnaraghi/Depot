---
phase: quick
plan: "007"
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/tauri.ts
  - src/stores/connectionStore.ts
  - src/stores/commandStore.ts
  - src/hooks/useFileOperations.ts
  - src/components/CommandPalette.tsx
  - src/components/MainLayout.tsx
  - src/components/SyncToolbar.tsx
  - src/components/SearchBar.tsx
  - src/components/ConnectionStatus.tsx
  - src/components/FileTree/FileTree.tsx
  - src/components/ChangelistPanel/ChangelistPanel.tsx
  - src/components/DepotBrowser/DepotContextMenu.tsx
  - src/components/DepotBrowser/useDepotTree.ts
  - src/components/FileTree/useFileTree.ts
  - src/components/FileTree/FileContextMenu.tsx
  - src/components/ChangelistPanel/useChangelists.ts
  - src/components/ChangelistPanel/ChangelistContextMenu.tsx
  - src/components/ChangelistPanel/EditDescriptionDialog.tsx
  - src/components/ChangelistPanel/CreateChangelistDialog.tsx
  - src/components/DetailPane/SearchResultsView.tsx
  - src/components/DetailPane/ChangelistDetailView.tsx
  - src/components/dialogs/ReconcilePreviewDialog.tsx
  - src/hooks/useDiff.ts
  - src/hooks/useFileHistory.ts
  - src/hooks/useReconcile.ts
  - src/hooks/useShelvedFiles.ts
  - src/hooks/useSync.ts
  - src-tauri/src/commands/p4.rs
autonomous: true
must_haves:
  truths:
    - "No invoke wrapper function takes server/user/client params"
    - "No call site passes p4port/p4user/p4client to invoke wrappers"
    - "No window.dispatchEvent or window.addEventListener for p4now: events exist"
    - "A typed commandStore with all command types exists"
    - "Rust ztag parsers have unit tests with real P4 output samples"
    - "checkout/revert/submit share a single operation helper, no duplicated ceremony"
  artifacts:
    - path: "src/lib/tauri.ts"
      provides: "Connection-injecting invoke wrappers"
    - path: "src/stores/commandStore.ts"
      provides: "Typed Zustand command store replacing window events"
    - path: "src-tauri/src/commands/p4.rs"
      provides: "Unit tests for parse_ztag_* functions"
    - path: "src/hooks/useFileOperations.ts"
      provides: "Shared operation helper, no duplication"
  key_links: []
---

<objective>
Address all 4 "now" architecture improvements from the architecture report. These are independent refactors that each improve code quality with no behavioral changes.

Purpose: Reduce boilerplate, add type safety, add test coverage, improve readability.
Output: Cleaner codebase, typed command dispatch, tested parsers, DRY operations.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/tauri.ts
@src/stores/connectionStore.ts
@src/hooks/useFileOperations.ts
@src/components/CommandPalette.tsx
@src/components/MainLayout.tsx
@src/components/SyncToolbar.tsx
@src/components/SearchBar.tsx
@src/components/ConnectionStatus.tsx
@src/components/FileTree/FileTree.tsx
@src/components/ChangelistPanel/ChangelistPanel.tsx
@src-tauri/src/commands/p4.rs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Inject connection args at invoke layer</name>
  <files>src/lib/tauri.ts, src/stores/connectionStore.ts, and all 18 consumer files</files>
  <action>
    The goal: No invoke wrapper function should accept server/user/client params. Instead, each wrapper reads connection args from the Zustand store directly.

    Step 1: In `src/lib/tauri.ts`, import `useConnectionStore` from `@/stores/connectionStore`. Add a helper function at the top:

    ```ts
    function getConnectionArgs() {
      const { p4port, p4user, p4client } = useConnectionStore.getState();
      return {
        server: p4port ?? undefined,
        user: p4user ?? undefined,
        client: p4client ?? undefined,
      };
    }
    ```

    Step 2: Remove `server?: string, user?: string, client?: string` params from ALL invoke wrapper functions that have them (there are ~25 functions). Instead, inside each function body, call `const { server, user, client } = getConnectionArgs()` and pass those to the invoke call.

    Functions to update: invokeP4Info, invokeP4Fstat, invokeP4Opened, invokeP4Changes, invokeP4Edit, invokeP4Revert, invokeP4Submit, invokeP4Sync, invokeP4CreateChange, invokeP4DeleteChange, invokeP4Reopen, invokeP4EditChangeDescription, invokeP4Filelog, invokeP4PrintToFile, invokeP4ChangesSubmitted, invokeP4Shelve, invokeP4DescribeShelved, invokeP4Unshelve, invokeP4DeleteShelf, invokeP4ReconcilePreview, invokeP4ReconcileApply, invokeP4ResolvePreview, invokeP4Files, invokeP4ListStreams, invokeP4GetClientSpec, invokeP4UpdateClientStream, invokeP4Depots, invokeP4Dirs.

    EXCEPTION: invokeListWorkspaces and invokeTestConnection take explicit server/user/client because they're called BEFORE connection is established (during settings/connection dialog). Keep their signatures as-is.

    Step 3: Update all 18 call-site files. Remove `p4port ?? undefined, p4user ?? undefined, p4client ?? undefined` args from every invoke call. Remove `const { p4port, p4user, p4client } = useConnectionStore()` from hooks/components that ONLY used it for invoke calls (check if they use p4port/p4user/p4client for anything else first). Remove the useConnectionStore import if no longer needed.

    Files to update (grep confirmed):
    - src/components/ChangelistPanel/EditDescriptionDialog.tsx
    - src/components/ChangelistPanel/ChangelistContextMenu.tsx
    - src/components/ChangelistPanel/ChangelistPanel.tsx
    - src/components/ChangelistPanel/CreateChangelistDialog.tsx
    - src/components/ChangelistPanel/useChangelists.ts
    - src/components/DepotBrowser/DepotContextMenu.tsx
    - src/components/DepotBrowser/useDepotTree.ts
    - src/components/FileTree/useFileTree.ts
    - src/components/FileTree/FileContextMenu.tsx
    - src/components/DetailPane/SearchResultsView.tsx
    - src/components/DetailPane/ChangelistDetailView.tsx
    - src/components/dialogs/ReconcilePreviewDialog.tsx
    - src/hooks/useFileOperations.ts
    - src/hooks/useReconcile.ts
    - src/hooks/useShelvedFiles.ts
    - src/hooks/useSync.ts
    - src/hooks/useDiff.ts
    - src/hooks/useFileHistory.ts

    Also remove p4port/p4user/p4client from useCallback dependency arrays in these files.

    IMPORTANT: invokeP4Sync has a different signature pattern — its server/user/client are positional, not optional keyword. Update it to also use getConnectionArgs() internally and remove the positional params. Update src/hooks/useSync.ts accordingly.
  </action>
  <verify>
    `npm run build` succeeds.
    Grep `src/lib/tauri.ts` for `server?: string, user?: string, client?: string` — should only appear in invokeTestConnection and invokeListWorkspaces.
    Grep `src/` for `p4port ?? undefined, p4user ?? undefined, p4client ?? undefined` — zero results.
  </verify>
  <done>All invoke wrappers (except test/list) read connection args from store. No call site passes connection triplet. All 18 consumer files cleaned up.</done>
</task>

<task type="auto">
  <name>Task 2: Replace window event bus with typed Zustand command store</name>
  <files>src/stores/commandStore.ts, src/components/CommandPalette.tsx, src/components/MainLayout.tsx, src/components/SyncToolbar.tsx, src/components/SearchBar.tsx, src/components/ConnectionStatus.tsx, src/components/FileTree/FileTree.tsx, src/components/ChangelistPanel/ChangelistPanel.tsx</files>
  <action>
    Step 1: Create `src/stores/commandStore.ts`:

    ```ts
    import { create } from 'zustand';

    export type AppCommand =
      | 'sync'
      | 'reconcile'
      | 'new-changelist'
      | 'submit'
      | 'checkout-selected'
      | 'diff-selected'
      | 'revert-selected'
      | 'history-selected'
      | 'focus-search'
      | 'open-settings'
      | 'open-connection';

    interface CommandState {
      /** Monotonically increasing counter to distinguish repeated same-command dispatches */
      seq: number;
      /** The pending command, or null if none */
      pendingCommand: AppCommand | null;
      dispatch: (command: AppCommand) => void;
      clear: () => void;
    }

    export const useCommandStore = create<CommandState>((set) => ({
      seq: 0,
      pendingCommand: null,
      dispatch: (command) => set((s) => ({ pendingCommand: command, seq: s.seq + 1 })),
      clear: () => set({ pendingCommand: null }),
    }));
    ```

    Step 2: Update DISPATCHERS (components that fire events):

    **CommandPalette.tsx:** Replace all `window.dispatchEvent(new CustomEvent('p4now:XXX'))` with `useCommandStore.getState().dispatch('XXX')`. Import useCommandStore. There are 10 dispatch calls.

    **MainLayout.tsx:** Replace dispatch calls (~lines 125, 158, 164, 168, 172, 176) with `useCommandStore.getState().dispatch(...)`. Remove the two `window.addEventListener('p4now:open-settings/open-connection', ...)` useEffect blocks and replace with a single useEffect that subscribes to the command store:

    ```ts
    useEffect(() => {
      const unsub = useCommandStore.subscribe((state, prev) => {
        if (state.seq === prev.seq) return;
        if (state.pendingCommand === 'open-settings') {
          setShowSettings(true);
          state.clear();
        } else if (state.pendingCommand === 'open-connection') {
          setShowConnection(true);
          state.clear();
        }
      });
      return unsub;
    }, []);
    ```

    **ConnectionStatus.tsx:** Replace `window.dispatchEvent(new CustomEvent('p4now:open-connection'))` with `useCommandStore.getState().dispatch('open-connection')`.

    Step 3: Update LISTENERS (components that listen for events):

    **SyncToolbar.tsx:** Replace the two `window.addEventListener` useEffect blocks for 'p4now:sync' and 'p4now:reconcile' with a single useCommandStore.subscribe effect:

    ```ts
    useEffect(() => {
      const unsub = useCommandStore.subscribe((state, prev) => {
        if (state.seq === prev.seq) return;
        if (state.pendingCommand === 'sync') { handleSync(); state.clear(); }
        if (state.pendingCommand === 'reconcile') { handleReconcile(); state.clear(); }
      });
      return unsub;
    }, [/* same deps as before */]);
    ```

    **SearchBar.tsx:** Replace window.addEventListener for 'p4now:focus-search' with useCommandStore.subscribe.

    **FileTree.tsx:** Replace the 4 window.addEventListener calls for diff-selected, history-selected, revert-selected, checkout-selected with a single useCommandStore.subscribe effect.

    **ChangelistPanel.tsx:** Replace the 2 window.addEventListener calls for new-changelist and submit with a single useCommandStore.subscribe effect.

    Step 4: Remove all `window.dispatchEvent(new CustomEvent('p4now:` and `window.addEventListener('p4now:` and `window.removeEventListener('p4now:` from the entire codebase.

    IMPORTANT: The subscribe pattern uses Zustand's subscribe with selector. Each listener should call `state.clear()` after handling its command to prevent other subscribers from also handling it. If multiple components need the same command, DON'T clear — but in this codebase each command has exactly one handler.

    ALSO IMPORTANT: The `seq` counter ensures that dispatching the same command twice in a row (e.g., sync, sync) creates two distinct state changes. Without it, Zustand wouldn't notify subscribers if pendingCommand was already 'sync'.
  </action>
  <verify>
    `npm run build` succeeds.
    Grep entire `src/` for `p4now:` — zero results.
    Grep entire `src/` for `CustomEvent` — zero results.
    Grep entire `src/` for `dispatchEvent` — zero results.
    `src/stores/commandStore.ts` exists with AppCommand type union.
  </verify>
  <done>All 11 custom events replaced with typed Zustand command store. No untyped string matching. Full type safety and discoverability.</done>
</task>

<task type="auto">
  <name>Task 3: Test the Rust ztag parsers</name>
  <files>src-tauri/src/commands/p4.rs</files>
  <action>
    Add a `#[cfg(test)] mod tests` block at the bottom of p4.rs with unit tests for the key parse functions. Use real P4 output samples as test input.

    Tests to write (at minimum):

    1. **parse_ztag_records** — test with multi-record output, empty input, single record, record with empty-value key.

    2. **parse_ztag_info** — test with a real `p4 -ztag info` output sample:
    ```
    ... userName testuser
    ... clientName testclient
    ... clientRoot /home/testuser/workspace
    ... serverAddress ssl:perforce:1666
    ... clientStream //depot/main
    ```

    3. **parse_ztag_fstat** — test with 2-file output including all fields (depotFile, clientFile, headAction, headRev, haveRev, action, change, type).

    4. **parse_ztag_changes** — test with 2 changelists output (change, user, client, status, time, desc, file count via shelvedChange or similar).

    5. **parse_ztag_filelog** — test with a file having 2 revisions, each with rev/change/action/type/time/user/client/desc fields.

    6. **parse_ztag_clients** — test with 2 workspaces output.

    7. **parse_ztag_streams** — test with stream output including type, parent, name.

    8. **parse_ztag_describe_shelved** — test with shelved file output.

    For each test:
    - Construct a realistic multiline string literal matching real P4 ztag output format
    - Call the parse function
    - Assert the returned structs have correct field values
    - Test edge case: empty output returns empty vec (or appropriate error)

    Use `#[test]` attribute on each test function. Keep tests focused — one assert concern per test, but batch related assertions.

    IMPORTANT: The parse functions are NOT public. They're private helper functions. Either:
    (a) Add `#[cfg(test)]` to make them pub(crate) for testing, OR
    (b) Place the tests module inside the same file so it has access to private functions (preferred — already the plan since tests go in p4.rs).

    Since the tests module is inside the same file, private functions are accessible.
  </action>
  <verify>
    `cargo test --manifest-path src-tauri/Cargo.toml` — all tests pass.
    At least 8 test functions exist (one per parser listed above).
  </verify>
  <done>Rust ztag parsers have comprehensive unit tests with real P4 output samples. Zero-to-tested in one step.</done>
</task>

<task type="auto">
  <name>Task 4: Reduce hook operation boilerplate</name>
  <files>src/hooks/useFileOperations.ts</files>
  <action>
    The checkout, revert, and submit callbacks in useFileOperations.ts each duplicate ~30 lines of identical ceremony: generate operationId, startOperation, addOutputLine with command, try/catch with invoke, log results, completeOperation, invalidateQueries, toast success/error.

    Extract a shared helper inside the hook:

    ```ts
    const runOperation = useCallback(async <T>(opts: {
      name: string;
      command: string;
      invoke: () => Promise<T>;
      onSuccess: (result: T) => void;
      successMessage: (result: T) => string;
      errorPrefix: string;
    }): Promise<T> => {
      const operationId = `${opts.name}-${Date.now()}`;
      startOperation(operationId, opts.command);
      addOutputLine(opts.command, false);

      try {
        const result = await opts.invoke();
        opts.onSuccess(result);
        completeOperation(true);

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['fileTree'] }),
          queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] }),
          queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] }),
        ]);

        toast.success(opts.successMessage(result));
        return result;
      } catch (error) {
        addOutputLine(`Error: ${error}`, true);
        completeOperation(false, String(error));
        toast.error(`${opts.errorPrefix}: ${error}`);
        throw error;
      }
    }, [startOperation, completeOperation, addOutputLine, queryClient]);
    ```

    Then rewrite checkout/revert/submit to use it:

    ```ts
    const checkout = useCallback(async (paths: string[], changelist?: number) => {
      return runOperation({
        name: 'edit',
        command: `p4 edit ${paths.join(' ')}`,
        invoke: () => invokeP4Edit(paths, changelist),
        onSuccess: (result) => {
          for (const file of result) {
            addOutputLine(`${file.depot_path}#${file.revision} - opened for ${file.action || 'edit'}`, false);
          }
        },
        successMessage: (result) => `Checked out ${result.length} file(s)`,
        errorPrefix: 'Checkout failed',
      });
    }, [runOperation, addOutputLine]);
    ```

    Similar for revert (log each depotPath, message `Reverted N file(s)`) and submit (log `Change N submitted.`, message `Submitted as changelist N`).

    NOTE: After Task 1 completes, invokeP4Edit/Revert/Submit no longer take connection args. If executing in same session, use the updated signatures. If not, the old signatures still work since Task 1 removes the params.
  </action>
  <verify>
    `npm run build` succeeds.
    Read useFileOperations.ts — checkout/revert/submit each under 15 lines, no duplicated try/catch/toast/invalidate pattern.
  </verify>
  <done>Single runOperation helper handles all ceremony. checkout/revert/submit are thin wrappers specifying only their unique behavior. Adding new operations (lock, unlock, integrate) requires ~10 lines each.</done>
</task>

</tasks>

<verification>
- `npm run build` succeeds (frontend compiles)
- `cargo build --manifest-path src-tauri/Cargo.toml` compiles (Rust compiles)
- `cargo test --manifest-path src-tauri/Cargo.toml` passes (Rust tests pass)
- Grep `src/` for `p4port ?? undefined` — zero results
- Grep `src/` for `p4now:` — zero results
- Grep `src/` for `CustomEvent` — zero results
</verification>

<success_criteria>
All 4 "now" architecture improvements complete. No behavioral changes, only structural improvements. Codebase is cleaner, typed, tested, and DRY.
</success_criteria>

<output>
After completion, create `.planning/quick/007-address-now-architecture-improvements/007-SUMMARY.md`
</output>
