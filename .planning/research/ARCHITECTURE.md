# Architecture Research: v3.0 Feature Integration

**Domain:** Tauri 2.0 + React 19 Desktop GUI for Perforce (P4Now v3.0)
**Researched:** 2026-01-29
**Confidence:** HIGH

## Integration with Existing Architecture

### Current System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (src/)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   FileTree   │  │  Changelist  │  │    Search    │      │
│  │  Component   │  │    Panel     │  │    Panel     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │              │
│  ┌──────┴─────────────────┴─────────────────┴───────┐      │
│  │          TanStack Query Layer                     │      │
│  │  (useFileTree, useChangelists, useSearch)         │      │
│  └────────────────────┬──────────────────────────────┘      │
│                       │                                      │
├───────────────────────┼──────────────────────────────────────┤
│                    Tauri IPC                                 │
├───────────────────────┼──────────────────────────────────────┤
│                  Rust Backend (src-tauri/src/)               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │              P4 Commands Module                      │    │
│  │  (p4_fstat, p4_opened, p4_sync, p4_edit, etc.)      │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │                                      │
│  ┌────────────────────┴────────────────────────────────┐    │
│  │          ProcessManager (tokio::sync::Mutex)         │    │
│  │  - Process tracking with UUIDs                       │    │
│  │  - Cancellation support (taskkill on Windows)        │    │
│  │  - Channel for streaming output                      │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                        P4 CLI Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ p4.exe   │  │ p4.exe   │  │ p4.exe   │                   │
│  │ (spawn)  │  │ (spawn)  │  │ (spawn)  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘

Settings: tauri-plugin-store (settings.json)
State: Zustand stores (connectionStore, fileTreeStore, operationStore)
UI: shadcn/ui components, react-arborist for trees
Events: Custom Tauri event system for file-status-changed
```

## v3.0 Feature Integration Points

### Feature 1: Resolve Workflow

**What:** Detect merge conflicts, launch external merge tool, apply resolutions

**Integration Points:**
- **Backend (Rust):** New commands in `src-tauri/src/commands/p4.rs`
  - `p4_resolve_preview()` - Runs `p4 resolve -n` to detect conflicts (similar to `p4_reconcile_preview`)
  - `p4_resolve_accept()` - Runs `p4 resolve -am/-at/-ay` to accept resolutions
  - `launch_merge_tool()` - Launches P4MERGE tool (similar to existing `launch_diff_tool`)
  - Reuses existing `-ztag` parsing patterns from `parse_ztag_fstat`

- **Frontend (React):** New components in `src/components/dialogs/`
  - `ResolvePreviewDialog.tsx` - Similar to existing `ReconcilePreviewDialog.tsx`
  - Shows conflict list with depot paths and conflict types
  - Buttons: "Accept Yours", "Accept Theirs", "Merge", "Skip"
  - Reuses existing dialog patterns from `FileHistoryDialog.tsx`

- **Data Flow:**
  1. User triggers sync or submit → Backend returns conflict error
  2. Frontend detects error, calls `p4_resolve_preview` → Gets conflict list
  3. User selects files, clicks "Merge" → `launch_merge_tool` spawns P4MERGE
  4. User completes merge → Clicks "Accept Merge" → `p4_resolve_accept -am`
  5. Invalidate changelist queries → UI updates

**New Components:**
- `src-tauri/src/commands/resolve.rs` (or extend `p4.rs`)
- `src/hooks/useResolve.ts` (TanStack Query hook)
- `src/components/dialogs/ResolveDialog.tsx`

**Modified Components:**
- `src/hooks/useSync.ts` - Add conflict detection after sync
- `src/components/ChangelistPanel/SubmitDialog.tsx` - Detect pre-submit conflicts

---

### Feature 2: Depot Tree Browser

**What:** Browse depot hierarchy with lazy-loading directories

**Integration Points:**
- **Backend (Rust):** New commands in `src-tauri/src/commands/p4.rs`
  - `p4_dirs(path: String)` - Returns immediate subdirectories
  - Runs `p4 dirs <path>/*` to get directory list
  - Returns `Vec<String>` of depot paths
  - Note: `p4 dirs` computes directories, doesn't track them in DB
  - Does NOT support "..." wildcard, only "*"
  - Use `-D` flag to include directories with only deleted files

- **Frontend (React):** Reuse react-arborist pattern
  - `src/components/DepotBrowser/DepotTree.tsx` - Clone of `FileTree.tsx`
  - Lazy load: On node expand → call `p4_dirs` for children
  - File list: On directory select → call `p4_files <path>/*` for files
  - Reuse `FileStatusIcon.tsx` for file status display
  - Double-click file → Show in workspace tree (navigate to local path)

- **Data Flow:**
  1. Component mounts → Load root directories `p4 dirs //depot/*`
  2. User expands node → `p4 dirs //depot/subdir/*` → Cache in TanStack Query
  3. User selects directory → `p4 files //depot/subdir/*` → Show file list
  4. Click "Sync This" → Call existing `p4_sync` with depot path

**New Components:**
- `src/components/DepotBrowser/` directory
  - `DepotTree.tsx` (lazy-loading tree)
  - `DepotNode.tsx` (tree node renderer)
  - `DepotContextMenu.tsx` (sync, view history)
- `src/hooks/useDepotTree.ts` (TanStack Query with lazy loading)

**Modified Components:**
- `src/components/MainLayout.tsx` - Add DepotBrowser panel to layout
- Add panel toggle button to toolbar

**Key Pattern:**
```typescript
// Lazy load on expand
const { data: subdirs } = useQuery({
  queryKey: ['depotDirs', depotPath],
  queryFn: () => invokeP4Dirs(depotPath),
  enabled: isExpanded, // Only fetch when node expanded
  staleTime: Infinity, // Depot structure rarely changes
});
```

---

### Feature 3: Workspace/Stream Switching

**What:** Switch P4CLIENT or stream without restarting app

**Integration Points:**
- **Backend (Rust):** New commands
  - `p4_switch_stream(stream_name: String)` - Runs `p4 switch <stream>`
  - Workflow: `p4 switch` automatically reconciles → shelves → switches → syncs → unshelves
  - Returns success/error, no additional parsing needed
  - NOTE: Cannot switch if numbered changelists are open (constraint)

- **Frontend (React):** Settings dialog extension
  - Add "Switch Workspace" button to `SettingsDialog.tsx`
  - Dropdown with workspace list from `p4_list_workspaces` (already exists)
  - On switch → Update connectionStore state → Invalidate ALL queries
  - Add "Switch Stream" button if workspace has stream
  - Dropdown with streams from `p4 streams` (new query)

- **State Management (Critical):**
  - Update `connectionStore` with new workspace/stream
  - Call `queryClient.invalidateQueries()` to refresh ALL data
  - Pattern: connectionStore change → trigger global refetch
  - Use `useEffect` to watch connectionStore and invalidate

- **Data Flow:**
  1. User clicks "Switch Workspace" → Shows workspace picker
  2. User selects workspace → `saveSettings({ p4client: newClient })`
  3. Settings save → `connectionStore.setConnected()` with new client
  4. Effect detects change → `queryClient.invalidateQueries()`
  5. All hooks refetch with new P4CLIENT → UI updates

**New Components:**
- `src/hooks/useWorkspaceSwitcher.ts` - Manages switch logic and invalidation
- Add workspace/stream picker to `src/components/SettingsDialog.tsx`

**Modified Components:**
- `src/stores/connectionStore.ts` - Add stream switching methods
- `src/lib/settings.ts` - Add stream persistence
- `src/App.tsx` - Add useEffect to watch connection changes and invalidate

**Critical Pattern:**
```typescript
// In App.tsx or layout
useEffect(() => {
  if (connectionStore.p4client) {
    queryClient.invalidateQueries(); // Refresh all data
  }
}, [connectionStore.p4client, connectionStore.stream]);
```

---

### Feature 4: Actionable Search Results

**What:** Make search results clickable with navigation to changelist/file

**Integration Points:**
- **Frontend Only:** Modify existing components
  - `SearchResultsPanel.tsx` already displays changelist cards
  - Add onClick handlers to navigate
  - Navigation target: Expand changelist in ChangelistPanel
  - If submitted changelist → Show FileHistoryDialog for files

- **Navigation Implementation:**
  - Use Zustand store method to expand specific changelist
  - `changelistStore.setExpandedChangelist(id)`
  - Scroll changelist into view with `scrollIntoView()`
  - Highlight changelist with temporary CSS class animation

- **Data Flow:**
  1. User clicks search result changelist #12345
  2. Check if pending or submitted
  3. If pending → `changelistStore.setExpandedChangelist(12345)` + scroll
  4. If submitted → Open FileHistoryDialog with changelist details
  5. Clear search (optional) → Focus moves to changelist

**Modified Components:**
- `src/components/SearchResultsPanel.tsx` - Add onClick handlers
- `src/stores/changelistStore.ts` - Add `setExpandedChangelist` method
- `src/components/ChangelistPanel/ChangelistPanel.tsx` - Add scroll-to logic

**No New Backend:** Reuses existing data, pure UI enhancement

---

### Feature 5: Auto-Refresh

**What:** Automatically refetch key queries on interval

**Integration Points:**
- **Frontend Only:** TanStack Query configuration
  - Add `refetchInterval` to critical queries
  - Changelist query: `refetchInterval: 30000` (30s)
  - File tree query: `refetchInterval: 60000` (60s)
  - Search query: `refetchInterval: 300000` (5min)
  - Use `refetchIntervalInBackground: false` to pause when minimized

- **User Control:**
  - Add "Auto-refresh" toggle to SettingsDialog
  - Store setting in tauri-plugin-store
  - Pass setting to hooks as `enabled` prop
  - Dynamic interval: `refetchInterval: autoRefresh ? 30000 : false`

- **Optimization:**
  - Only enable for connected state: `enabled: isConnected && autoRefresh`
  - Use `refetchOnWindowFocus: true` for manual refresh fallback
  - Don't refresh during active operations (check operationStore)

**Modified Components:**
- `src/components/ChangelistPanel/useChangelists.ts` - Add `refetchInterval`
- `src/components/FileTree/useFileTree.ts` - Add `refetchInterval`
- `src/hooks/useSearch.ts` - Add `refetchInterval`
- `src/types/settings.ts` - Add `autoRefresh: boolean`
- `src/components/SettingsDialog.tsx` - Add toggle control

**Pattern:**
```typescript
const { data, refetch } = useQuery({
  queryKey: ['changelists'],
  queryFn: fetchChangelists,
  enabled: isConnected && autoRefreshEnabled,
  refetchInterval: autoRefreshEnabled ? 30000 : false,
  refetchIntervalInBackground: false, // Pause when minimized
});
```

**No Backend Changes:** Pure TanStack Query configuration

---

### Feature 6: E2E Testing

**What:** WebdriverIO + tauri-driver for end-to-end tests

**Integration Points:**
- **Testing Infrastructure:** New directory structure
  - `e2e-tests/` directory at project root
  - `wdio.conf.js` - WebdriverIO configuration
  - `test/specs/` - Test files
  - Uses `@crabnebula/tauri-driver` package

- **Platform Requirements:**
  - **Windows:** Microsoft Edge Driver (must match Edge version)
  - **Linux:** WebKitWebDriver (check `which WebKitWebDriver`)
  - **macOS:** NOT SUPPORTED (no WKWebView driver)
  - CI: Use windows-latest or ubuntu-latest runners

- **Test Structure:**
  - Unit tests: Component logic with Vitest (existing)
  - Integration tests: Hook behavior with Mock Service Worker
  - E2E tests: Full app workflows with WebdriverIO

- **Setup Process:**
  1. `npm install --save-dev webdriverio @wdio/cli @crabnebula/tauri-driver`
  2. Configure `wdio.conf.js` to launch tauri-driver
  3. Build app before tests: `npm run tauri build`
  4. Run tests: `npm run test:e2e`

- **Test Coverage (Initial):**
  - Connection workflow: Settings → Test Connection → Success
  - File operations: Check out → Edit → Revert
  - Changelist: Create → Add files → Delete
  - Search: Type query → Click result → Verify navigation

**New Components:**
- `e2e-tests/wdio.conf.js` - Main config
- `e2e-tests/test/specs/connection.spec.js` - Connection tests
- `e2e-tests/test/specs/changelist.spec.js` - Changelist tests
- `e2e-tests/helpers/` - Test utilities
- `package.json` - Add scripts: `test:e2e`, `test:e2e:headless`

**CI Integration:**
- `.github/workflows/test.yml` - Add E2E job
- Matrix: `[windows-latest, ubuntu-latest]` (skip macOS)
- Requires: Build app → Install Edge Driver → Run tests

**Known Compatibility:**
- May need to downgrade to WebdriverIO v7 for tauri-driver compat
- TypeScript types may require manual definitions
- tauri-driver acts as proxy for native WebDriver servers

**No Application Code Changes:** Pure testing infrastructure

---

## Component Dependency Map

### New Components Needed

| Component | Dependencies | Integrates With |
|-----------|--------------|-----------------|
| `ResolveDialog.tsx` | TanStack Query, shadcn/ui | ChangelistPanel, SyncToolbar |
| `DepotTree.tsx` | react-arborist, TanStack Query | MainLayout (new panel) |
| `useResolve.ts` | `invokeP4ResolvePreview`, `invokeP4ResolveAccept` | ResolveDialog |
| `useDepotTree.ts` | `invokeP4Dirs`, `invokeP4Files` | DepotTree |
| `useWorkspaceSwitcher.ts` | connectionStore, queryClient | SettingsDialog |
| `p4_resolve_*` (Rust) | Existing p4 module patterns | Frontend hooks |
| `p4_dirs` (Rust) | Existing p4 module patterns | useDepotTree |
| `e2e-tests/` | WebdriverIO, tauri-driver | CI pipeline |

### Modified Components

| Component | Modifications | Reason |
|-----------|---------------|--------|
| `useChangelists.ts` | Add `refetchInterval` option | Auto-refresh |
| `useFileTree.ts` | Add `refetchInterval` option | Auto-refresh |
| `useSearch.ts` | Add `refetchInterval` option | Auto-refresh |
| `SearchResultsPanel.tsx` | Add onClick navigation | Actionable search |
| `changelistStore.ts` | Add `setExpandedChangelist` method | Search navigation |
| `SettingsDialog.tsx` | Add workspace/stream switcher, auto-refresh toggle | Settings UI |
| `connectionStore.ts` | Add stream switching methods | State management |
| `App.tsx` | Add query invalidation on connection change | Workspace switching |
| `useSync.ts` | Add conflict detection | Resolve workflow trigger |
| `SubmitDialog.tsx` | Add pre-submit conflict check | Resolve workflow trigger |

---

## Data Flow Patterns

### Pattern 1: Query Invalidation Cascade

**What:** When workspace/stream changes, invalidate all queries to refetch

**When to use:** Workspace switching, stream switching, major setting changes

**Trade-offs:**
- **Pro:** Simple, comprehensive, ensures consistency
- **Pro:** Reuses existing TanStack Query cache keys
- **Con:** Refetches everything, brief loading state

**Implementation:**
```typescript
// In App.tsx or similar
const queryClient = useQueryClient();
const { p4client, stream } = useConnectionStore();

useEffect(() => {
  if (p4client) {
    // Invalidate all queries when workspace changes
    queryClient.invalidateQueries();
  }
}, [p4client, stream, queryClient]);
```

### Pattern 2: Lazy Loading with Enabled Flag

**What:** Load data only when UI element expands

**When to use:** Depot tree, nested file lists, expandable panels

**Trade-offs:**
- **Pro:** Reduces initial load, only fetches needed data
- **Pro:** Perfect for hierarchical/tree structures
- **Con:** Brief loading spinner on first expand

**Implementation:**
```typescript
const { data: subdirs, isLoading } = useQuery({
  queryKey: ['depotDirs', depotPath],
  queryFn: () => invokeP4Dirs(depotPath),
  enabled: isExpanded, // Only fetch when expanded
  staleTime: Infinity, // Depot structure rarely changes
});
```

### Pattern 3: Conditional Auto-Refresh

**What:** Refetch on interval only when enabled and connected

**When to use:** Real-time updates for changelist/file status

**Trade-offs:**
- **Pro:** Keeps UI fresh without manual refresh
- **Pro:** User can disable to reduce load
- **Con:** Increased server requests
- **Con:** Can cause conflicts with user edits

**Implementation:**
```typescript
const { data } = useQuery({
  queryKey: ['changelists'],
  queryFn: fetchChangelists,
  enabled: isConnected && autoRefreshEnabled,
  refetchInterval: autoRefreshEnabled ? 30000 : false,
  refetchIntervalInBackground: false, // Pause when minimized
});
```

### Pattern 4: State-Based Navigation

**What:** Update Zustand store to trigger UI changes, scroll to element

**When to use:** Search result click, deep linking, programmatic navigation

**Trade-offs:**
- **Pro:** Reactive, works across components
- **Pro:** Can be triggered from anywhere (keyboard shortcuts, search)
- **Con:** Requires store method and scroll logic

**Implementation:**
```typescript
// In store
setExpandedChangelist: (id: number) => set({ expandedId: id }),

// In component
const handleNavigate = (id: number) => {
  changelistStore.setExpandedChangelist(id);

  // Scroll after state update
  setTimeout(() => {
    document.getElementById(`cl-${id}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }, 100);
};
```

---

## Architectural Recommendations

### Build Order (Suggested Phases)

**Phase 1: Foundation (Auto-Refresh)**
- Modify existing query hooks with `refetchInterval`
- Add settings UI for auto-refresh toggle
- Lowest risk, no new components, validates query patterns

**Phase 2: Navigation (Actionable Search)**
- Add navigation handlers to SearchResultsPanel
- Extend changelistStore with setExpandedChangelist
- Pure frontend, builds on existing search

**Phase 3: Workspace Management**
- Add workspace/stream switcher to settings
- Implement query invalidation on switch
- Tests existing architecture's flexibility

**Phase 4: Depot Browser**
- Implement `p4_dirs` and `p4_files` backend commands
- Build DepotTree component (clone FileTree pattern)
- Add lazy loading with TanStack Query enabled flag
- Larger feature, but self-contained

**Phase 5: Resolve Workflow**
- Implement `p4_resolve_*` backend commands
- Build ResolveDialog (clone ReconcilePreviewDialog)
- Integrate with sync and submit workflows
- Complex feature, touches multiple areas

**Phase 6: E2E Testing**
- Set up WebdriverIO and tauri-driver
- Write initial test specs
- Integrate with CI
- Independent, can run parallel with other phases

**Rationale:** Start simple (auto-refresh), validate patterns, build confidence. Progress to user-facing navigation, then larger features. E2E testing last to validate completed features.

---

## Integration Complexity Assessment

| Feature | Backend Complexity | Frontend Complexity | Integration Risk | Suggested Phase |
|---------|-------------------|---------------------|------------------|-----------------|
| Auto-Refresh | None (config only) | Low (query options) | Low | Phase 1 |
| Actionable Search | None | Low (handlers + store) | Low | Phase 2 |
| Workspace Switching | Low (existing commands) | Medium (invalidation) | Medium | Phase 3 |
| Depot Browser | Medium (new commands) | Medium (lazy tree) | Medium | Phase 4 |
| Resolve Workflow | Medium (new commands) | Medium (dialog + logic) | High | Phase 5 |
| E2E Testing | None | High (test infrastructure) | Low (isolated) | Phase 6 |

**Risk Definitions:**
- **Low:** Isolated change, established patterns, no cross-cutting concerns
- **Medium:** New patterns, touches multiple components, requires coordination
- **High:** Complex workflow, multiple integration points, potential edge cases

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Global Auto-Refresh Without User Control

**What people do:** Set `refetchInterval` on all queries without opt-out

**Why it's wrong:**
- Causes conflicts during user edits (file tree updates mid-operation)
- Wastes resources when user minimizes window
- Frustrating when user wants stable UI to read

**Do this instead:**
- Make auto-refresh opt-in via settings toggle
- Use `refetchIntervalInBackground: false` to pause when minimized
- Disable auto-refresh during active operations (check operationStore)
- Provide manual refresh button as fallback

### Anti-Pattern 2: Fetching All Depot Directories Upfront

**What people do:** Load entire depot hierarchy on mount

**Why it's wrong:**
- `p4 dirs` computes directories, very slow for large depots
- Wastes memory and network for data user may never view
- Blocks UI with loading spinner

**Do this instead:**
- Lazy load with `enabled: isExpanded` flag
- Fetch only immediate children when node expands
- Use `staleTime: Infinity` since depot structure rarely changes
- Show loading spinner only for expanded node, not whole tree

### Anti-Pattern 3: Invalidating Specific Queries on Workspace Switch

**What people do:** Manually list and invalidate each query key

**Why it's wrong:**
- Fragile, easy to miss new queries added later
- Inconsistent state if some queries missed
- Harder to maintain as app grows

**Do this instead:**
- Use `queryClient.invalidateQueries()` without filter to clear all
- Let TanStack Query's `enabled` flags prevent unnecessary refetches
- Simple, comprehensive, future-proof

### Anti-Pattern 4: Blocking E2E Tests on Full Feature Coverage

**What people do:** Wait until all features complete before starting E2E tests

**Why it's wrong:**
- Delays feedback on integration issues
- Harder to debug failures across large feature sets
- CI setup becomes rushed at end of project

**Do this instead:**
- Set up E2E infrastructure early (Phase 6 can start anytime)
- Write tests incrementally as features complete
- Run E2E in CI from day one, even with minimal tests
- Catch integration issues early

### Anti-Pattern 5: Calling `p4 resolve` Without Preview

**What people do:** Auto-resolve conflicts with `-am` flag immediately

**Why it's wrong:**
- User loses visibility into what conflicts existed
- Auto-merge can silently break code if conflicts are complex
- No chance to review before accepting

**Do this instead:**
- Always show ResolvePreviewDialog with conflict list
- Let user choose per-file: merge tool, accept yours, accept theirs
- Show conflict count and depot paths before resolution
- Provide "Resolve All" option but with confirmation

---

## Sources

### Perforce Resolve Workflow
- [Merging to resolve conflicts](https://help.perforce.com/helix-core/server-apps/p4guide/2024.2/Content/P4Guide/merging-to-resolve-conflicts.html)
- [p4 resolve](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_resolve.html)
- [Resolve files | P4 Visual Client (P4V) Documentation](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/branches.resolve.html)
- [How to resolve conflicts](https://www.perforce.com/manuals/p4guide/Content/P4Guide/resolve.howto.html)

### Perforce Depot Browser
- [p4 dirs | P4 Command Reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_dirs.html)
- [p4 dirs // P4 Command Reference](https://www.perforce.com/manuals/v15.2/cmdref/p4_dirs.html)

### Perforce Stream Switching
- [p4 switch | Helix Core Command-Line (P4) Reference 2024.2](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_switch.html)
- [Switch between streams | P4 Server Administration](https://help.perforce.com/helix-core/server-apps/p4sag/current/Content/DVCS/streams.switch.html)

### Tauri E2E Testing
- [WebdriverIO | Tauri](https://v2.tauri.app/develop/tests/webdriver/example/webdriverio/)
- [WebDriver | Tauri](https://v2.tauri.app/develop/tests/webdriver/)
- [@crabnebula/tauri-driver - npm](https://www.npmjs.com/package/@crabnebula/tauri-driver)
- [GitHub - Haprog/tauri-wdio-win-test](https://github.com/Haprog/tauri-wdio-win-test)

### TanStack Query Auto-Refresh
- [React TanStack Query Auto Refetching Example | TanStack Query Docs](https://tanstack.com/query/v4/docs/framework/react/examples/auto-refetching)
- [useQuery | TanStack Query React Docs](https://tanstack.com/query/v4/docs/react/reference/useQuery)
- [Automatically refetching with React Query - DEV Community](https://dev.to/dailydevtips1/automatically-refetching-with-react-query-1l0f)

---

*Architecture research for: P4Now v3.0 Feature Integration*
*Researched: 2026-01-29*
