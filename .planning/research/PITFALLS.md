# Pitfalls Research: v3.0 Feature Additions

**Domain:** Perforce GUI - Adding Resolve, Depot Browser, Workspace/Stream Switching, Auto-Refresh, E2E Testing to Existing System
**Researched:** 2026-01-29
**Confidence:** HIGH

This document focuses on pitfalls specific to adding v3.0 features to the existing P4Now v2.0 codebase (~55k LOC). For v2.0 pitfalls, see the previous version of this document.

---

## Critical Pitfalls

### Pitfall 1: Resolve State Inconsistency After External Merge Tool

**What goes wrong:**
External merge tool (P4Merge, Beyond Compare) completes successfully with exit code 0, but the file remains in "needs resolve" state in Perforce. User clicks "Mark Resolved" button but UI doesn't update. The file appears in both "conflicted" and "resolved" lists. Manual refresh required to see actual state.

**Why it happens:**
Spawning external merge tool with `.spawn()` returns immediately without waiting for tool to close. When tool finishes:
1. No callback triggers to detect completion
2. No `p4 resolve -am <file>` command runs to mark file resolved server-side
3. TanStack Query cache still shows "needs resolve" state
4. Query invalidation never fires because the operation "completed" before merge tool opened

Perforce's resolve workflow is a state machine:
1. `p4 sync` or `p4 unshelve` creates conflict → file enters "needs resolve" state
2. User runs merge tool to resolve conflicts → file still "needs resolve" (manual step)
3. User runs `p4 resolve -am <file>` → server marks file as resolved
4. `p4 opened` now shows file as "edit" without resolve flag

The pitfall: Developers assume launching merge tool = resolving file. It doesn't. You must run `p4 resolve -am` after merge tool exits.

**How to avoid:**
1. **Wait for merge tool to complete:**
   ```rust
   let mut child = Command::new(merge_tool).args([left, right, result]).spawn()?;
   let exit_status = child.wait()?; // BLOCKS until tool closes
   ```
2. **Capture exit code to distinguish save vs. cancel:**
   - Exit 0 = saved, proceed to mark resolved
   - Exit 1 = cancelled, do not mark resolved
   - Timeout after 1 hour = show "Merge tool still open?" notification
3. **After successful merge, run `p4 resolve -am <file>`:**
   ```rust
   if exit_status.success() {
       Command::new("p4").args(["resolve", "-am", &depot_path]).output()?;
   }
   ```
4. **Invalidate file queries immediately after resolve completes:**
   ```typescript
   await invoke('p4_resolve', { filePath, mergeTool });
   queryClient.invalidateQueries(['files', 'opened']);
   queryClient.invalidateQueries(['changelist', changelistId]);
   ```
5. **Show progress states:**
   - "Launching P4Merge..."
   - "Waiting for merge tool to close..."
   - "Marking file as resolved..."
   - "Resolved"

**Warning signs:**
- External merge tool closes but UI shows "needs resolve"
- "Mark Resolved" button remains enabled after clicking
- File appears in multiple states simultaneously
- Refresh button required to see resolved state
- `p4 opened` in terminal shows different state than UI

**Phase to address:**
**Phase 1 - Resolve Workflow Foundation.** This is core to the feature working at all. Without proper wait/resolve/invalidate cycle, resolve workflow is unusable.

---

### Pitfall 2: Query Invalidation Race Conditions During Auto-Refresh

**What goes wrong:**
Auto-refresh polling (every 30s) triggers `queryClient.invalidateQueries(['files'])`. Meanwhile, user starts a long sync operation. During sync:
1. Auto-refresh timer fires → invalidates queries → starts `p4 fstat`
2. Sync completes → invalidates queries → starts another `p4 fstat`
3. Both `p4 fstat` processes run concurrently, race to update cache
4. Stale data from auto-refresh overwrites fresh data from sync mutation
5. UI shows incorrect file states
6. Multiple `p4.exe` processes pile up in Task Manager
7. Memory grows as zombie processes accumulate

After 10 minutes of auto-refresh with active development: 20+ `p4.exe` processes, 500MB+ memory, UI flickers constantly.

**Why it happens:**
TanStack Query v4+ has `invalidateQueries` with `cancelRefetch: true` by default, which should cancel in-flight requests. BUT:
1. Cancellation only works at HTTP level (fetch/axios)
2. Rust backend spawns `p4.exe` as OS process, not HTTP request
3. Query cancellation doesn't reach ProcessManager to kill process
4. Old `p4.exe` process keeps running, eventually completes, writes to cache
5. Meanwhile new query started, creating race condition

Additionally, `refetchInterval` in query config runs independently of mutation invalidations, creating duplicate refetches.

**How to avoid:**
1. **Disable auto-refresh during active operations:**
   ```typescript
   // In Zustand store
   const useOperationStore = create((set) => ({
     isOperationActive: false,
     activeOperations: new Set<string>(),
     startOperation: (name: string) => set((state) => ({
       activeOperations: new Set(state.activeOperations).add(name),
       isOperationActive: true
     })),
     endOperation: (name: string) => set((state) => {
       const ops = new Set(state.activeOperations);
       ops.delete(name);
       return { activeOperations: ops, isOperationActive: ops.size > 0 };
     })
   }));

   // In query config
   useQuery(['files'], fetchFiles, {
     enabled: !useOperationStore(s => s.isOperationActive),
     refetchInterval: autoRefreshEnabled ? 30000 : false
   });
   ```

2. **Track process types in ProcessManager:**
   ```rust
   pub struct ProcessManager {
       processes: Arc<Mutex<HashMap<String, (Child, ProcessType)>>>,
   }
   pub enum ProcessType { Sync, Reconcile, Query, Resolve }
   pub async fn has_active_operation(&self) -> bool {
       let processes = self.processes.lock().await;
       processes.values().any(|(_, t)| matches!(t, ProcessType::Sync | ProcessType::Reconcile))
   }
   ```

3. **Use staleTime to prevent excessive refetches:**
   ```typescript
   useQuery(['files'], fetchFiles, {
     staleTime: 30_000, // Don't refetch if data <30s old
     refetchInterval: 60_000, // Poll every 60s, not 30s
     keepPreviousData: true // Prevent UI flicker
   });
   ```

4. **Coordinate auto-refresh with mutations:**
   ```typescript
   const syncMutation = useMutation({
     mutationFn: syncFiles,
     onMutate: () => {
       operationStore.startOperation('sync');
       queryClient.cancelQueries(['files']); // Cancel auto-refresh in-flight
     },
     onSettled: () => {
       operationStore.endOperation('sync');
       queryClient.invalidateQueries(['files']);
     }
   });
   ```

5. **Cleanup zombie processes:**
   - In ProcessManager, track process start time
   - Background task kills processes >5 minutes old
   - On app shutdown, `kill_all()` (already implemented)

**Warning signs:**
- Task Manager shows 10+ `p4.exe` processes
- UI shows loading spinner every 30 seconds even when idle
- Memory usage grows from 100MB to 500MB+ over 10 minutes
- Query DevTools shows same query refetching multiple times per minute
- File list "flashes" or briefly shows stale data during auto-refresh
- CPU usage spikes every 30 seconds

**Phase to address:**
**Phase 5 - Auto-Refresh Implementation.** Must coordinate with existing mutation/invalidation pattern established in v2.0.

---

### Pitfall 3: Numbered Changelist Files Block Stream Switching

**What goes wrong:**
User has files checked out in numbered changelist #12345. They click "Switch to Stream Y". UI shows "Switching..." for 2 seconds, then fails with error: "Cannot switch streams. Files opened in numbered changelist."

Workspace is now in inconsistent state:
- `p4 info` shows old stream (switch failed)
- File queries start failing with "not in client view"
- User doesn't know what to do next

Worse case: Partial switch occurs (some files reverted, stream half-switched), leaving workspace unusable.

**Why it happens:**
Perforce stream switching behavior differs by changelist type:

**Default changelist (CL 0):**
- P4V/CLI auto-shelves files before switch
- Auto-unshelves when switching back
- Switch succeeds automatically

**Numbered changelists (CL #123):**
- `p4 switch` fails immediately with error
- No auto-shelving occurs
- User must manually shelve, switch, then unshelve

The code's existing `apply_connection_args()` handles env var isolation, but there's no pre-flight check for open files before switching.

**How to avoid:**
1. **Pre-flight validation before any stream/workspace switch:**
   ```typescript
   async function validateSwitchPreconditions(targetStream: string): Promise<ValidationResult> {
     // Check for open files in numbered CLs
     const openedFiles = await invoke('p4_opened');
     const numberedCLFiles = openedFiles.filter(f => f.changelist !== 0);

     if (numberedCLFiles.length > 0) {
       const clNumbers = [...new Set(numberedCLFiles.map(f => f.changelist))];
       return {
         canSwitch: false,
         reason: 'FILES_IN_NUMBERED_CL',
         affectedCLs: clNumbers,
         action: 'SHELVE_FIRST'
       };
     }

     return { canSwitch: true };
   }
   ```

2. **Show shelve-and-switch dialog:**
   ```tsx
   <Dialog>
     <DialogTitle>Cannot Switch Streams</DialogTitle>
     <DialogContent>
       You have {fileCount} files in changelist #{clNumber}.
       Perforce requires shelving these files before switching streams.
     </DialogContent>
     <DialogActions>
       <Button onClick={cancel}>Cancel</Button>
       <Button onClick={shelveAndSwitch}>Shelve & Switch</Button>
     </DialogActions>
   </Dialog>
   ```

3. **Implement atomic shelve-and-switch:**
   ```typescript
   async function shelveAndSwitch(clNumbers: number[], targetStream: string) {
     try {
       // Step 1: Shelve all numbered CLs
       for (const cl of clNumbers) {
         await invoke('p4_shelve', { changelistId: cl });
       }

       // Step 2: Switch stream
       await invoke('p4_switch', { stream: targetStream });

       // Step 3: Verify switch succeeded
       const info = await invoke('p4_info');
       if (info.client_stream !== targetStream) {
         throw new Error(`Switch failed. Still on ${info.client_stream}`);
       }

       // Step 4: Invalidate ALL queries (entire cache may be wrong)
       queryClient.clear();
       queryClient.invalidateQueries();

     } catch (err) {
       // Rollback: attempt to switch back to original stream
       await invoke('p4_switch', { stream: originalStream });
       throw err;
     }
   }
   ```

4. **Handle partial failures:**
   - If `p4 switch` fails mid-operation, detect with `p4 info`
   - Show recovery dialog: "Switch failed. Options: (1) Retry (2) Revert to previous stream (3) Manual fix"
   - Provide "Show P4 Info" debug button to see actual state

5. **Update cache aggressively after switch:**
   ```typescript
   // After successful switch, entire file tree changes
   queryClient.removeQueries(['files']); // Clear cache
   queryClient.removeQueries(['changelists']);
   queryClient.removeQueries(['opened']);
   queryClient.invalidateQueries(['p4-info']); // Refetch immediately
   ```

**Warning signs:**
- `p4 switch` command returns non-zero exit code
- `p4 info` shows `clientStream` doesn't match expected stream
- File operations fail with "not in client view" after switch
- UI shows empty file list or missing changelists after switch
- Queries return errors like "path is not under client's root"

**Phase to address:**
**Phase 3 - Stream Switching.** Pre-flight checks are essential, not optional. Without them, users will corrupt workspace state.

---

### Pitfall 4: Depot Tree Browser Loads Entire Depot Into Memory

**What goes wrong:**
User clicks "Browse Depot" to explore depot hierarchy. App runs `p4 dirs //...` or `p4 files //...` to fetch entire depot structure (50,000+ files). UI freezes for 30 seconds while:
1. `p4 dirs` executes (15s on slow network)
2. Parsing 50k lines of output in Rust (5s)
3. Sending 5MB JSON blob to frontend (2s)
4. Building tree data structure in React (8s)

App uses 800MB memory (was 100MB). react-arborist tries to virtualize, but building parent/child pointers for 50k nodes consumes 200MB before rendering starts. UI becomes unresponsive, scrolling is janky, app may crash with OOM.

**Why it happens:**
Eager loading anti-pattern: Query entire depot structure upfront instead of lazy-loading on expansion. Even with virtualization, you're:
1. Spawning massive `p4.exe` process
2. Allocating memory for all nodes in Rust
3. Serializing/deserializing huge JSON payload
4. Building in-memory tree with circular references
5. Rendering (even if virtualized, tree metadata is in memory)

The existing `p4_fstat` command already handles depot paths (e.g., `//stream/main/...`), but there's no incremental loading pattern.

**How to avoid:**
1. **Lazy load on folder expand (architectural requirement):**
   ```typescript
   // Root level: Only load top-level depots
   const rootQuery = useQuery(['depot', 'root'], async () => {
     return await invoke('p4_dirs', { path: '//*', depth: 1 });
     // Returns: ["//depot1", "//depot2", "//depot3"]
   });

   // On expand: Load children of specific folder
   const childrenQuery = useQuery(['depot', 'children', path], async () => {
     return await invoke('p4_dirs', { path: `${path}/*`, depth: 1 });
     // Returns: ["//depot1/subfolder1", "//depot1/subfolder2"]
   }, {
     enabled: isExpanded // Only fetch when user expands
   });
   ```

2. **Add new Rust command for scoped directory queries:**
   ```rust
   #[tauri::command]
   pub async fn p4_dirs_scoped(
       path: String,
       depth: Option<i32>,
       server: Option<String>,
       user: Option<String>,
       client: Option<String>,
   ) -> Result<Vec<String>, String> {
       let mut cmd = Command::new("p4");
       apply_connection_args(&mut cmd, &server, &user, &client);

       // Use -D flag to limit depth (prevents recursive scan)
       if let Some(d) = depth {
           cmd.args(["-D", &d.to_string()]);
       }

       cmd.args(["dirs", &path]);

       let output = cmd.output()
           .map_err(|e| format!("Failed to execute p4 dirs: {}", e))?;

       // Parse output into Vec<String>
       let stdout = String::from_utf8_lossy(&output.stdout);
       let dirs: Vec<String> = stdout.lines().map(|s| s.to_string()).collect();

       Ok(dirs)
   }
   ```

3. **Virtualize with react-arborist (already in project):**
   ```tsx
   <Tree
     data={treeData}
     openByDefault={false} // Don't auto-expand all nodes
     width={600}
     height={800}
     rowHeight={36}
     overscanCount={10} // Only render visible + 10 buffer
   >
     {Node}
   </Tree>
   ```

4. **Cache directory listings with long staleTime:**
   ```typescript
   useQuery(['depot-dirs', path], fetchDirs, {
     staleTime: 5 * 60 * 1000, // 5 minutes
     cacheTime: 30 * 60 * 1000, // 30 minutes
     // Depot structure changes infrequently
   });
   ```

5. **Show loading indicator per folder:**
   ```tsx
   {isExpanded && isFetching ? (
     <div className="pl-4 text-muted-foreground">
       <Spinner className="h-4 w-4" /> Loading...
     </div>
   ) : null}
   ```

6. **Limit initial depth:**
   - Load only root depots on mount: `//depot1`, `//depot2`
   - Load first level children when depot expanded: `//depot1/folder1`
   - Continue loading on-demand as user explores
   - Never query `//...` (entire depot)

7. **Add search-to-jump feature:**
   ```tsx
   <Input
     placeholder="Jump to depot path: //depot/main/..."
     onSubmit={async (path) => {
       // Expand tree to show this path
       const parts = path.split('/').filter(Boolean);
       for (let i = 0; i < parts.length; i++) {
         const partialPath = '//' + parts.slice(0, i + 1).join('/');
         await expandNode(partialPath);
       }
     }}
   />
   ```

**Warning signs:**
- Initial depot browser open takes >5 seconds
- Memory usage spikes 500MB+ when opening depot view
- Scrolling tree is janky (not 60fps)
- `p4 dirs //...` or `p4 files //...` in command log (entire depot query)
- UI thread blocks during tree construction
- react-arborist profiler shows 50k+ nodes in tree data

**Phase to address:**
**Phase 2 - Depot Browser Foundation.** Lazy loading must be architectural from day 1. Retrofitting later requires complete rewrite.

---

### Pitfall 5: Workspace Switching Doesn't Clear P4 Environment Inheritance

**What goes wrong:**
User switches from Workspace A (`P4CLIENT=workspace-a`) to Workspace B (`P4CLIENT=workspace-b`). App updates settings in Tauri store, but:
1. `p4 fstat` still returns files from Workspace A
2. File operations fail with "file(s) not in client view"
3. UI shows files from wrong workspace
4. Connection indicator shows Workspace B but data is from Workspace A

The app is in a split-brain state: Settings say Workspace B, but Perforce commands use Workspace A.

**Why it happens:**
The existing `apply_connection_args()` in `p4.rs` (lines 13-37) does clear `P4CONFIG` and `P4ROOT` when explicit args provided:
```rust
if has_explicit {
    cmd.env("P4CONFIG", "");
    cmd.env("P4ROOT", "");
}
```

BUT there's a gap:
1. If the Rust process inherits `P4CLIENT` from system environment, and you switch to a workspace with an empty client string (`client: Some("")`), the check `client.as_ref().filter(|s| !s.is_empty())` fails, so `P4CLIENT` env var is NOT cleared.
2. If `P4CONFIG` file exists in workspace root and sets `P4CLIENT=old-workspace`, Perforce may prefer that over the `-c` flag (depends on P4 version).
3. After workspace switch, cached queries still contain old workspace data, so UI shows stale state.

**How to avoid:**
1. **Always clear P4CLIENT when switching workspaces:**
   ```rust
   fn apply_connection_args(cmd: &mut Command, server: &Option<String>, user: &Option<String>, client: &Option<String>) {
       // ALWAYS clear these, even if new values are empty
       cmd.env("P4CONFIG", "");
       cmd.env("P4ROOT", "");
       cmd.env("P4CLIENT", ""); // ADD THIS - clear old value

       if let Some(s) = server.as_ref().filter(|s| !s.is_empty()) {
           cmd.args(["-p", s]);
           cmd.env("P4PORT", s);
       }
       if let Some(u) = user.as_ref().filter(|s| !s.is_empty()) {
           cmd.args(["-u", u]);
           cmd.env("P4USER", u);
       }
       if let Some(c) = client.as_ref().filter(|s| !s.is_empty()) {
           cmd.args(["-c", c]);
           cmd.env("P4CLIENT", c); // Set new value
       }
   }
   ```

2. **Verify switch succeeded with p4 info:**
   ```typescript
   async function switchWorkspace(newWorkspace: string) {
     // Update settings
     await updateSettings({ client: newWorkspace });

     // Verify switch
     const info = await invoke('p4_info', {
       server: settings.server,
       user: settings.user,
       client: newWorkspace
     });

     if (info.client_name !== newWorkspace) {
       throw new Error(
         `Workspace switch failed. Expected ${newWorkspace}, got ${info.client_name}`
       );
     }

     return info;
   }
   ```

3. **Clear ALL query cache after workspace switch:**
   ```typescript
   // Workspace switch invalidates EVERYTHING
   queryClient.clear(); // Remove all cached queries
   queryClient.invalidateQueries(); // Refetch active queries

   // Or more surgical:
   queryClient.removeQueries({ predicate: (query) => {
       // Remove workspace-specific data
       return ['files', 'changelists', 'opened', 'shelved'].includes(query.queryKey[0]);
   }});
   ```

4. **Show connection state in UI during transition:**
   ```tsx
   {isSwitching ? (
     <div>Switching to {targetWorkspace}...</div>
   ) : (
     <div>Connected: {currentWorkspace}</div>
   )}
   ```

5. **Test with P4CONFIG file present:**
   - Create test workspace with P4CONFIG file in root
   - Set `P4CLIENT=test-workspace` in P4CONFIG
   - Attempt to switch to different workspace via app
   - Verify `p4 info` shows new workspace (not P4CONFIG value)

**Warning signs:**
- `p4 info` returns different client name than UI displays
- File queries return data from wrong workspace after switch
- Operations fail with "not in client view" after switch
- Inconsistent behavior: Fresh app start works, runtime switch fails
- P4CONFIG file in workspace root causes switch to fail silently

**Phase to address:**
**Phase 3 - Workspace Switching.** Environment isolation is critical for multi-workspace workflows. Without it, users cannot trust workspace switches.

---

### Pitfall 6: E2E Tests Can't Interact With Native System Dialogs

**What goes wrong:**
E2E test clicks "Browse Depot" button. Test triggers Tauri's file picker dialog (`dialog.open()`). Native Windows file picker opens. WebdriverIO test runner waits for dialog to close. Test cannot interact with native dialog (no WebDriver API for OS-level dialogs). Test hangs for 30 seconds, then times out.

Even with mocked dialogs in test mode, tests can't verify:
- Actual Tauri IPC communication works
- File picker returns correct path
- Error handling for cancelled dialogs
- Integration between Rust backend and WebView

Tests pass but don't validate the most critical integration points.

**Why it happens:**
WebdriverIO automates the WebView2 browser instance, not the native Windows application shell. Tauri's dialog APIs (`dialog::open`, `dialog::save`, `dialog::message`) spawn native OS dialogs outside the WebView. These dialogs are separate Win32 windows, not DOM elements. WebDriver protocol has no access to them.

Additionally, tauri-driver (WebDriver bridge for Tauri apps) has known issues:
- `.click()` and `.setValue()` return `500 Internal Server Error: unsupported operation` (GitHub issue #6541)
- Workaround requires `browser.execute()` to simulate clicks via JavaScript
- File picker dialogs can't be automated; must pre-configure selected path
- Edge WebView2 version must match Edge WebDriver version exactly or tests fail

**How to avoid:**
1. **Define E2E test scope clearly (architectural decision):**
   ```markdown
   ## What E2E Tests Cover
   - UI component rendering
   - User interaction flows (click, type, drag-drop)
   - State management (Zustand stores)
   - Route navigation
   - Error boundary handling

   ## What E2E Tests DON'T Cover
   - Native Tauri dialog APIs (file picker, save dialog)
   - Tauri IPC communication (invoke/emit)
   - Rust backend command execution
   - External tool spawning (diff tool, merge tool)
   - OS-level permissions and notifications

   ## Coverage Strategy
   - E2E: UI logic and user flows
   - Unit tests: Rust backend commands (cargo test)
   - Integration tests: Mock Tauri APIs, test IPC layer
   ```

2. **Inject test mode for dialog mocking:**
   ```typescript
   // In test setup
   if (import.meta.env.VITE_TEST_MODE) {
     window.__TAURI_MOCK__ = {
       dialog: {
         open: async () => 'C:\\test\\selected\\file.txt',
         save: async () => 'C:\\test\\saved\\file.txt',
         message: async () => true,
       },
       invoke: async (cmd, args) => {
         // Mock Tauri commands in tests
         return testMockBackend[cmd](args);
       }
     };
   }

   // In production code
   async function openFilePicker() {
     if (window.__TAURI_MOCK__) {
       return await window.__TAURI_MOCK__.dialog.open();
     }
     return await dialog.open({ directory: true });
   }
   ```

3. **Use browser.execute() workaround for WebdriverIO:**
   ```javascript
   // DON'T: await button.click(); // Returns 500 error

   // DO:
   await browser.execute(() => {
     document.querySelector('[data-testid="browse-depot-btn"]').click();
   });

   // For inputs:
   await browser.execute((value) => {
     const input = document.querySelector('[data-testid="search-input"]');
     input.value = value;
     input.dispatchEvent(new Event('input', { bubbles: true }));
   }, 'search term');
   ```

4. **Match WebView2 and WebDriver versions:**
   ```json
   // package.json
   {
     "devDependencies": {
       "wdio-edgedriver-service": "^8.39.1"
     }
   }
   ```

   ```javascript
   // wdio.conf.js
   export const config = {
     services: [
       ['edgedriver', {
         version: '131.0.2903.112' // Must match WebView2 Runtime
       }]
     ]
   }
   ```

   Check WebView2 version: `edge://version/` → Match in CI

5. **Cleanup lifecycle management:**
   ```javascript
   // wdio.conf.js
   export const config = {
     afterEach: async function () {
       // Cleanup runs even if test fails
       await browser.execute(() => {
         window.localStorage.clear();
         window.sessionStorage.clear();
       });
     },
     afterSession: async function () {
       // Cleanup runs even if session fails to start
       // Kill any spawned processes
       if (tauriProcess) {
         tauriProcess.kill('SIGTERM');
       }
     }
   }
   ```

6. **Document E2E test limitations:**
   ```typescript
   // tests/e2e/depot-browser.spec.ts
   /**
    * E2E Test: Depot Browser UI Flow
    *
    * Tests the UI interaction flow for depot browsing.
    * NOTE: This test uses mocked Tauri dialog APIs.
    * Actual file picker integration is tested in Rust integration tests.
    */
   test('should open depot browser and expand folder', async () => {
     // Test UI flow with mocks
   });
   ```

7. **Separate Rust backend integration tests:**
   ```rust
   // src-tauri/tests/integration_test.rs
   #[cfg(test)]
   mod tests {
       use super::*;

       #[tokio::test]
       async fn test_p4_dirs_scoped() {
           let result = p4_dirs_scoped(
               "//depot/*".to_string(),
               Some(1),
               Some("localhost:1666".to_string()),
               Some("testuser".to_string()),
               Some("testclient".to_string())
           ).await;

           assert!(result.is_ok());
       }
   }
   ```

**Warning signs:**
- E2E tests hang on any Tauri dialog API call
- `.click()` or `.setValue()` returns 500 errors in test logs
- Tests pass locally but fail in CI with "GL context" errors
- Tests run but don't validate Tauri backend integration
- Coverage report shows high frontend coverage but 0% backend coverage
- Flaky tests that timeout randomly

**Phase to address:**
**Phase 6 - E2E Testing Setup.** Define scope early: What CAN be tested vs. what SHOULD be unit tested instead. Wrong scope = brittle, unmaintainable test suite.

---

### Pitfall 7: Unshelve to Same CL Conflicts With Stream-Switch Auto-Shelve

**What goes wrong:**
User flow:
1. Has files in numbered CL #1234 on Stream A
2. Switches to Stream B (Perforce auto-shelves default CL, but NOT numbered CLs)
3. Clicks "Unshelve CL #1234" from shelf list
4. Expected: Files go to CL #1234 on Stream B
5. Actual: Files go to default CL, OR CL #1234 doesn't exist on Stream B so command fails

User now confused: "Where did my files go?"

**Why it happens:**
Perforce's `p4 unshelve` behavior is subtle:
- `p4 unshelve -s 1234` → Unshelves to DEFAULT changelist (not #1234)
- `p4 unshelve -s 1234 -c 1234` → Unshelves to CL #1234, but CL must exist first
- After stream switch, numbered CLs from Stream A don't exist on Stream B
- Stream switching auto-shelves DEFAULT CL only, not numbered CLs

The existing `p4_unshelve` command (lines 1429-1472 in p4.rs) does use `-c` flag:
```rust
cmd.arg("-s");
cmd.arg(changelist_id.to_string());
cmd.arg("-c");
cmd.arg(changelist_id.to_string());
```

But this fails if CL doesn't exist in target workspace/stream.

**How to avoid:**
1. **Pre-flight check: Does target CL exist?**
   ```typescript
   async function unshelveToSameCL(changelistId: number) {
     // Check if CL exists in current workspace
     const changelists = await invoke('p4_changes', {
       status: 'pending',
       client: settings.client
     });

     const clExists = changelists.some(cl => cl.id === changelistId);

     if (!clExists) {
       // Show dialog
       const action = await showDialog({
         title: 'Changelist Does Not Exist',
         message: `CL #${changelistId} doesn't exist in this workspace. Where should files be unshelved?`,
         options: [
           { label: 'Create CL #' + changelistId, value: 'create' },
           { label: 'Unshelve to Default CL', value: 'default' },
           { label: 'Cancel', value: 'cancel' }
         ]
       });

       if (action === 'create') {
         // Create CL with same number (if possible) or same description
         const shelf = await invoke('p4_describe_shelved', { changelistId });
         await invoke('p4_create_change', { description: shelf.description });
       } else if (action === 'default') {
         changelistId = 0; // Unshelve to default
       } else {
         return; // Cancel
       }
     }

     await invoke('p4_unshelve', { changelistId });
   }
   ```

2. **Show context after stream switch:**
   ```tsx
   {switchedStream && hasShelvedCLs && (
     <Alert variant="info">
       You have shelved changelistsNumbers from Stream A.
       To unshelve them here, we'll create matching CLs or unshelve to default.
       <Button onClick={viewShelvedCLs}>View Shelved CLs</Button>
     </Alert>
   )}
   ```

3. **Detect conflicts before unshelve:**
   ```rust
   #[tauri::command]
   pub async fn p4_unshelve_preview(
       changelist_id: i32,
       server: Option<String>,
       user: Option<String>,
       client: Option<String>,
   ) -> Result<UnshelvePreview, String> {
       // Run p4 unshelve -n (preview mode)
       let mut cmd = Command::new("p4");
       apply_connection_args(&mut cmd, &server, &user, &client);
       cmd.args(["unshelve", "-n", "-s", &changelist_id.to_string()]);

       let output = cmd.output()
           .map_err(|e| format!("Failed to preview unshelve: {}", e))?;

       let stdout = String::from_utf8_lossy(&output.stdout);
       let has_conflicts = stdout.contains("must resolve");

       Ok(UnshelvePreview {
           has_conflicts,
           affected_files: parse_unshelve_output(&stdout),
       })
   }
   ```

4. **After unshelve, immediately trigger resolve workflow if conflicts:**
   ```typescript
   const result = await invoke('p4_unshelve', { changelistId });

   if (result.includes('must resolve')) {
     // Extract conflicted files
     const conflicted = parseConflictedFiles(result);

     // Show resolve dialog immediately
     showResolveDialog({
       files: conflicted,
       onResolved: () => queryClient.invalidateQueries(['files'])
     });
   }
   ```

5. **Track CL metadata across streams:**
   ```typescript
   // When shelving, store metadata
   const shelvedCLs = {
     [changelistId]: {
       description: clDescription,
       stream: currentStream,
       workspace: currentWorkspace,
       shelvedAt: Date.now()
     }
   };

   // When unshelving, show context
   const originalContext = shelvedCLs[changelistId];
   if (originalContext.stream !== currentStream) {
     showWarning(`This shelf is from ${originalContext.stream}. You're on ${currentStream}.`);
   }
   ```

**Warning signs:**
- Files appear in default CL after unshelving numbered CL
- "Changelist #1234 does not exist" errors when unshelving after stream switch
- Files split between multiple CLs unexpectedly after unshelve
- Unshelve succeeds but file count doesn't match expected
- No resolve dialog appears despite conflicts in unshelve output

**Phase to address:**
**Phase 4 - Bug Fixes (unshelve to same CL).** This bug requires understanding the interaction between numbered CLs, shelving, and stream switching. Can't fix in isolation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Spawn merge tool without waiting | Faster UI response, non-blocking | Resolve state never updates, requires manual refresh | **Never** - breaks resolve workflow entirely |
| Load entire depot tree upfront | Simpler code (one query) | Memory exhaustion, 30s freeze on large depots | Only for tiny demos (<100 files) |
| Auto-refresh with no operation gating | Always fresh data | Process leaks, race conditions, memory growth | **Never** - causes instability over time |
| Skip pre-flight checks for stream switch | Faster switch operation | Silent failures, corrupted workspace state | **Never** - failures are catastrophic |
| Mock all Tauri APIs in E2E tests | Fast, reliable tests | Not testing actual integration | **Acceptable** if Rust integration tests exist |
| Use relative paths in Tauri commands | Shorter code | Breaks when cwd changes between calls | **Never** - Tauri resets cwd per command |
| Invalidate all queries after every mutation | Simple invalidation logic | Excessive refetches, poor performance | Only during prototyping, refine for production |
| Global refetchInterval in QueryClient | Consistent auto-refresh across app | Refetches inactive/background queries | **Never** - use per-query `enabled` flag |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| External merge tool | Spawn without waiting for exit | Use `child.wait()`, capture exit code, verify result file exists before `p4 resolve -am` |
| P4 resolve state | Click "Mark Resolved" without `p4 resolve -am` | Always run `p4 resolve -am <file>` after merge tool succeeds |
| WebdriverIO + Tauri | Use `.click()` and `.setValue()` | Use `browser.execute()` workaround, match WebView2/WebDriver versions exactly |
| Stream switching | Run `p4 switch` without checking open files | Pre-flight: detect numbered CL files, prompt to shelve first, verify success with `p4 info` |
| Workspace switching | Update settings, assume p4 uses them | Clear `P4CLIENT` env var explicitly, verify with `p4 info`, clear query cache |
| TanStack Query polling | Set `refetchInterval` globally | Disable during mutations with `enabled` flag, use `staleTime` to prevent thrashing |
| Depot tree loading | `p4 dirs //...` to load full tree | Lazy load on expand (1 level at a time), virtualize with react-arborist |
| Unshelve after stream switch | `p4 unshelve -s CL` assumes CL exists | Check CL exists first, offer to create or unshelve to default, detect conflicts |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Eager depot tree loading | 30s freeze, 500MB+ memory spike | Lazy load on folder expand, limit to 1-2 levels per query | Depots >1,000 files |
| Concurrent p4.exe processes | Memory growth, 10+ p4.exe in Task Manager | Gate auto-refresh during operations, track in ProcessManager | Auto-refresh + long sync |
| Query invalidation storms | UI flickers, constant loading spinners | Use `staleTime: 30s`, disable polling during mutations, `keepPreviousData: true` | `refetchInterval` <30s with active mutations |
| Non-virtualized tree rendering | Janky scrolling, slow expand/collapse | Use react-arborist (already in project) with `openByDefault: false` | Tree >1,000 visible nodes |
| Unbounded file history queries | 10s load time, 100MB response for old files | Use `p4 filelog -m 100` to limit revisions, paginate with "Load More" | Files >500 revisions |
| Polling without cleanup | Memory leaks, zombie processes | Clear intervals on unmount, `ProcessManager.kill_all()` on app close | Long sessions >30 min |
| Waiting for external tool with `.wait()` | App freezes until tool closes | Spawn in background, show "Waiting..." UI, allow cancel | Merge tool open >1 minute |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent stream switch failures | User thinks they switched, operations fail with cryptic errors | Pre-flight validation, show shelve prompt for numbered CLs, verify success with `p4 info` |
| Merge tool spawns with no feedback | User doesn't know tool launched, clicks button again, spawns duplicate | Show "P4Merge is open. Waiting for you to close it..." with disable button state |
| Depot browser loads entire depot | 30s freeze, "Application Not Responding" dialog | Lazy load with skeleton loaders per folder, show "Loading..." per expanded node |
| Auto-refresh with no indicator | User confused when data changes unexpectedly | Show "Updated 5s ago" timestamp, subtle pulse animation during refresh |
| Resolve state not reflected in UI | File shows "needs resolve" after resolving in merge tool | Invalidate file queries immediately after `p4 resolve -am`, optimistic update in UI |
| Unshelve goes to wrong CL | User loses track of which CL contains what | Confirm dialog: "Unshelve CL #1234 to: [Dropdown: Default / Create #1234 / Cancel]" |
| Search results not actionable | User finds file but can't do anything with it | Context menu on results: View History, Diff, Open in Explorer, Checkout, Sync |
| No visual feedback during switch | User clicks "Switch Stream", waits, nothing happens | Loading overlay: "Shelving files... Switching stream... Refreshing workspace..." |

## "Looks Done But Isn't" Checklist

- [ ] **Resolve workflow:** Often missing `p4 resolve -am` after merge tool closes — Verify: Close merge tool, run `p4 opened`, file shows as "edit" not "resolve"
- [ ] **Stream switching:** Often missing pre-flight check for numbered CLs — Verify: Open file in CL #123, switch stream, shelve prompt appears
- [ ] **Auto-refresh:** Often missing operation gating — Verify: Start sync, auto-refresh pauses, memory stable over 10 minutes
- [ ] **Depot browser:** Often missing lazy loading — Verify: 10k file depot, initial load <1s, folders expand on-demand
- [ ] **Workspace switching:** Often missing env var clearing — Verify: P4CONFIG file present, switch works, `p4 info` shows new workspace
- [ ] **E2E tests:** Often missing Tauri API mocking — Verify: Tests don't hang on `dialog.open()`, test mode uses mocks
- [ ] **External merge tool:** Often missing exit code validation — Verify: Cancel merge tool (exit 1), file NOT marked resolved
- [ ] **Query invalidation:** Often missing mutation coordination — Verify: No duplicate `p4.exe` processes during auto-refresh
- [ ] **Unshelve destination:** Often missing CL existence check — Verify: Unshelve from different stream, prompted for CL creation

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Resolve state stuck | **LOW** | Show "Force Refresh" button → runs `p4 opened`, invalidates all file queries |
| Auto-refresh process leak | **MEDIUM** | Add "Kill All P4 Processes" debug command, restart auto-refresh interval |
| Depot tree OOM crash | **HIGH** | **Requires app restart** — prevention is critical (lazy loading from day 1) |
| Stream switch partial failure | **MEDIUM** | Detect with `p4 info` mismatch, offer "Revert to previous stream" or "Complete switch" |
| Workspace switch env pollution | **HIGH** | **Requires app restart** to clear inherited env vars — prevention is critical |
| E2E test hang on dialog | **LOW** | Kill test process, add test timeout, enable mock mode (`TEST_MODE=true`) |
| Query invalidation race | **LOW** | Manual refresh button, or wait for next auto-refresh cycle to self-heal |
| Unshelve wrong destination | **LOW** | Run `p4 reopen -c <correct-cl>` to move files, show recovery toast with action |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification Method |
|---------|------------------|---------------------|
| Resolve state inconsistency | **Phase 1 - Resolve Workflow** | Test: Merge file, close tool, verify `p4 opened` shows resolved, UI updates without refresh |
| Auto-refresh race conditions | **Phase 5 - Auto-Refresh** | Test: Start 5-minute sync, verify polling stops, check Task Manager for single p4.exe, memory stable |
| Numbered CL blocks stream switch | **Phase 3 - Stream Switching** | Test: Open file in CL #123, click switch stream, verify shelve prompt appears with CL list |
| Depot tree loads entire depot | **Phase 2 - Depot Browser** | Test: 10k file depot, measure initial load <1s, memory delta <50MB, folders lazy-load |
| Workspace switch env pollution | **Phase 3 - Workspace Switching** | Test: Create P4CONFIG file with P4CLIENT, switch workspace via app, verify `p4 info` shows new client |
| E2E tests hang on dialogs | **Phase 6 - E2E Testing Setup** | Test: Enable `TEST_MODE=true`, verify Tauri APIs mocked, tests complete without timeouts |
| Unshelve wrong CL destination | **Phase 4 - Bug Fixes** | Test: Shelve CL #123, switch stream, unshelve, verify destination prompt with options |
| Query invalidation during mutation | **Phase 5 - Auto-Refresh** | Test: Enable auto-refresh, trigger sync, verify queries disabled during operation, re-enabled after |

## Sources

**Perforce Resolve Workflows:**
- [Perforce: Resolving Conflicts](https://www.perforce.com/perforce/doc.091/manuals/p4guide/05_resolve.html) - Official resolve workflow documentation
- [p4 resolve Command Reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_resolve.html) - Command syntax and flags
- [Merging to resolve conflicts](https://help.perforce.com/helix-core/server-apps/p4guide/2024.2/Content/P4Guide/merging-to-resolve-conflicts.html) - Conflict resolution patterns

**Tauri E2E Testing:**
- [WebdriverIO | Tauri v2 Docs](https://v2.tauri.app/develop/tests/webdriver/example/webdriverio/) - Official WebdriverIO integration guide
- [WebDriver Tauri GitHub Issue #10670](https://github.com/tauri-apps/tauri/issues/10670) - WebDriver setup issues and workarounds
- [tauri-driver .click() bug #6541](https://github.com/tauri-apps/tauri/issues/6541) - Known limitation requiring browser.execute() workaround

**TanStack Query Invalidation:**
- [Query Invalidation | TanStack Query Docs](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) - Official invalidation guide
- [useQuery + invalidateQueries stale UI Discussion #6953](https://github.com/TanStack/query/discussions/6953) - Race condition discussion
- [refetch vs invalidating query Discussion #2468](https://github.com/TanStack/query/discussions/2468) - Difference between invalidate and refetch

**Stream/Workspace Switching:**
- [Perforce: Switch between streams](https://www.perforce.com/manuals/dvcs/Content/DVCS/streams.switch.html) - Stream switching documentation
- [p4 switch Command Reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_switch.html) - Command syntax and constraints
- [Create and manage workspaces](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/using.workspaces.html) - Workspace management

**Tree Virtualization:**
- [Rendering 10000 Items in React Efficiently](https://namastedev.com/blog/rendering-10000-items-in-react-efficiently/) - Virtualization techniques
- [React Tree View Components 2026](https://reactscript.com/best-tree-view/) - Library comparison including react-arborist
- [Handling 1M DOM Nodes with Virtualization](https://medium.com/@bhagyarana80/handling-1m-dom-nodes-in-react-virtualization-without-sacrificing-ux-99c5bec3914b) - Performance patterns

**Depot Performance:**
- [Tuning Perforce for Performance](https://www.perforce.com/perforce/doc.092/manuals/p4sag/07_perftune.html) - Server performance tuning
- [10 Tips To Supercharge Perforce Performance](https://get.assembla.com/blog/how-to-maximize-perforce-performance/) - Client-side optimization

**Auto-Refresh and Memory:**
- [Preventing Memory Leaks in Windows Applications](https://learn.microsoft.com/en-us/windows/win32/win7appqual/preventing-memory-leaks-in-windows-applications) - Windows memory management
- [Top Mobile App Performance Metrics 2026](https://medium.com/@testwithblake/top-mobile-app-performance-metrics-every-product-team-should-monitor-in-2026-bb7cc4f45136) - Performance monitoring including memory and CPU

**External Tool Integration:**
- [Integrating with Source Control - Araxis Merge](https://www.araxis.com/merge/documentation-windows/integrating-with-other-applications.en) - External tool integration patterns
- [Custom Merge Tool Bug #2529](https://github.com/fork-dev/TrackerWin/issues/2529) - Exit code handling issues

---
*Pitfalls research for: P4Now v3.0 feature additions to existing v2.0 system*
*Researched: 2026-01-29*
*Focus: Integration pitfalls when adding resolve, depot browser, workspace/stream switching, auto-refresh, and E2E testing*
