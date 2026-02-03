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


---
---

# Architecture Research: P4V Parity Features for v4.0

## Executive Summary

The six P4V parity features integrate cleanly into P4Now's existing architecture with minimal structural changes. All features follow established patterns: new Rust commands in `p4.rs`, corresponding TypeScript invocations in `tauri.ts`, TanStack Query hooks for data fetching, and UI components in the detail pane. The primary architectural consideration is build order—file annotations and content viewer are foundational features that other features depend on, while bookmarks is fully independent.

## Existing Architecture Overview

**Backend (Rust/Tauri):**
- `ProcessManager` spawns p4.exe processes
- `commands/p4.rs` contains all p4 command wrappers with `-ztag` output parsing
- Connection args (server/user/client) injected at invoke layer via `getConnectionArgs()`

**Frontend (React):**
- TanStack Query for server data caching and invalidation
- Zustand stores for UI state (detailPane, fileTree, changelist, connection, searchFilter, command)
- react-arborist for virtualized trees (FileTree, ChangelistTree, DepotBrowser)
- Discriminated union routing in DetailPane: `none | file | changelist | revision | search`

**Data Flow Pattern:**
1. User action triggers hook (e.g., `useFileOperations`)
2. Hook invokes Tauri command via `tauri.ts` wrapper
3. Rust backend spawns p4.exe with connection args
4. Result parsed from `-ztag` output into typed struct
5. Frontend receives typed response, invalidates queries
6. TanStack Query refetches, UI updates automatically

## Component Analysis

### Feature 1: File Annotations (Blame)

**New Components:**
- `FileAnnotationView.tsx` — New detail pane view showing line-by-line blame
- `useFileAnnotations.ts` — TanStack Query hook for fetching annotations

**Modified Components:**
- `DetailPane.tsx` — Add `annotation` type to `DetailSelection` union
- `FileDetailView.tsx` — Add "Show Annotations" button to action bar
- `detailPaneStore.ts` — Add `drillToAnnotation()` action

**New Rust Commands:**
- `p4_annotate(depotPath: String, revision: Option<i32>) -> Vec<P4AnnotationLine>`
  - Returns: `{ line_number, revision, changelist, user, date, content }`
  - Uses: `p4 annotate -c -q <depotPath>#<revision>`
  - Flag: `-c` for changelist numbers, `-q` to suppress header

**New TypeScript APIs:**
- `invokeP4Annotate(depotPath: string, revision?: number): Promise<P4AnnotationLine[]>`
- Interface: `P4AnnotationLine { lineNumber, revision, changelist, user, date, content }`

**Integration Points:**
- FileDetailView action bar — New "Annotations" button next to "Diff"
- DetailPane routing — New `annotation` selection type
- Back navigation — Pressing Escape returns to FileDetailView

**Data Flow:**
1. User clicks "Show Annotations" in FileDetailView
2. `drillToAnnotation()` navigates to annotation view with depot path + revision
3. `useFileAnnotations` hook fetches via `invokeP4Annotate`
4. Rust spawns `p4 annotate -c -q //depot/path#5`
5. Parse output: each line is `... change 12345 //depot/path#5 - line content`
6. Component renders table with changelist, user, date (from changelist lookup), content

**Performance Considerations:**
- Perforce limits annotations to files under 10MB by default
- Frontend should show loading state (annotations can take 2-3 seconds for large files)
- Consider virtualized rendering for files with 1000+ lines

**Suggested Build Order:** **Phase 1** (foundational)

---

### Feature 2: Workspace File Tree with Sync Status

**New Components:**
- None (enhancement to existing FileTree)

**Modified Components:**
- `FileTree.tsx` — Add out-of-date badge rendering for files where `revision < headRevision`
- `FileStatusIcon.tsx` — Add new icon variant for "out of date" status
- `useFileTree.ts` — Modify to track sync status from fstat results

**Modified Rust Commands:**
- `p4_fstat()` already returns `head_revision` field — no changes needed

**Integration Points:**
- FileTree node rendering — Display badge when `file.revision < file.headRevision`
- FileStatusIcon component — New color/icon for out-of-date status (orange badge with down-arrow)
- Existing sync flow — Already updates tree via query invalidation

**Data Flow:**
1. `useFileTree` fetches via `invokeP4Fstat()` (already happens)
2. Rust `p4_fstat` command already returns `revision` (have) and `head_revision` (depot)
3. Frontend compares: if `revision < headRevision`, file is out-of-date
4. `FileNode` component renders out-of-date badge
5. User clicks sync button → existing sync flow updates `revision` → badge disappears

**UI Design:**
- Out-of-date files: Orange badge with "↓" icon and count (e.g., "↓3" for 3 revisions behind)
- Hover tooltip: "Out of date: #5 (you have) vs #8 (depot)"
- Consistent with existing status badges (green checkmark for synced, blue pencil for edited)

**Suggested Build Order:** **Phase 2** (table stakes feature, depends on existing infrastructure)

---

### Feature 3: File Content Viewer

**New Components:**
- `FileContentView.tsx` — New detail pane view showing file content at specific revision
- `useFileContent.ts` — Hook for fetching file content via `p4 print`

**Modified Components:**
- `RevisionDetailView.tsx` — Add "View Content" button to action bar
- `DetailPane.tsx` — Add `content` type to `DetailSelection` union
- `detailPaneStore.ts` — Add `drillToContent()` action

**New Rust Commands:**
- `p4_print(depotPath: String, revision: i32) -> String`
  - Returns: File content as UTF-8 string
  - Uses: `p4 print -q <depotPath>#<revision>`
  - Flag: `-q` to suppress header (only content)

**New TypeScript APIs:**
- `invokeP4Print(depotPath: string, revision: number): Promise<string>`

**Integration Points:**
- RevisionDetailView — New "View Content" button next to "Diff"
- FileDetailView — "View Current Revision" button
- DetailPane routing — New `content` selection type with depot path + revision
- Syntax highlighting — Use existing code editor library (Monaco or Prism.js)

**Data Flow:**
1. User clicks "View Content" in RevisionDetailView (or FileDetailView)
2. `drillToContent()` navigates with depot path + revision
3. `useFileContent` fetches via `invokeP4Print(path, rev)`
4. Rust spawns `p4 print -q //depot/path#5`
5. Return content as string
6. Component renders in code viewer with syntax highlighting

**Performance Considerations:**
- Large files (>1MB) should show size warning with "View Anyway" confirmation
- Consider streaming for very large files (requires Rust channel pattern like sync)
- Binary files: Show hex viewer or "Binary file (X MB) - cannot display"

**Suggested Build Order:** **Phase 1** (foundational, enables submit preview)

---

### Feature 4: Submit Dialog Preview

**New Components:**
- None (enhancement to existing SubmitDialog)

**Modified Components:**
- `SubmitDialog.tsx` — Expand file list section to show diffs inline or link to content view
- No new data fetching needed — files already in `changelist.files`

**Integration Points:**
- SubmitDialog file list — Each file becomes clickable
- Click behavior: Opens FileContentView in modal overlay OR drills to FileDetailView
- Depends on: File content viewer (Feature 3) for "preview changes"

**Data Flow:**
1. User opens SubmitDialog (already happens)
2. Dialog displays `changelist.files` (already happens)
3. NEW: Each file is clickable
4. Click → Opens FileContentView in overlay OR navigates to FileDetailView
5. User can review changes before confirming submit

**UI Options:**
- **Option A:** Open FileDetailView in side panel (keeps dialog open)
- **Option B:** Open FileContentView as modal overlay on dialog
- **Option C:** Expand file row to show diff inline (like GitHub PR view)

**Suggested Build Order:** **Phase 3** (enhancement to existing feature, depends on Feature 3)

---

### Feature 5: Submitted Changelist File List

**New Components:**
- None (enhancement to existing ChangelistDetailView)

**Modified Components:**
- `ChangelistDetailView.tsx` — Add file list section for submitted changelists
- `useChangelists.ts` — May need to fetch files for submitted CLs on demand

**New Rust Commands:**
- `p4_describe(changelist: i32) -> P4ChangelistDetail`
  - Returns: `{ id, description, user, client, time, files: Vec<P4DescribeFile> }`
  - Uses: `p4 describe -s <changelist>` (shallow, no diffs)
  - `-s` flag omits diffs (only file list)

**New TypeScript APIs:**
- `invokeP4Describe(changelist: number): Promise<P4ChangelistDetail>`
- Interface: `P4DescribeFile { depotPath, action, fileType, revision }`

**Integration Points:**
- ChangelistDetailView — Check `changelist.status === 'submitted'`
- If submitted: Fetch via `useQuery(['p4', 'describe', clId])`
- Display file list same as pending CLs (but read-only, no actions)
- File clicks → Navigate to RevisionDetailView for that changelist's revision

**Data Flow:**
1. User selects submitted changelist from SearchResultsView
2. ChangelistDetailView detects `status === 'submitted'`
3. `useQuery` fetches via `invokeP4Describe(clId)`
4. Rust spawns `p4 describe -s 12345`
5. Parse output into structured file list
6. Component renders files (same UI as pending CL)
7. Click file → Navigate to RevisionDetailView

**Caching Strategy:**
- Submitted changelists are immutable — cache indefinitely
- Query key: `['p4', 'describe', clId]` (won't refetch unless invalidated)
- Consider React Query `staleTime: Infinity` for submitted CLs

**Suggested Build Order:** **Phase 2** (table stakes feature, straightforward command wrapper)

---

### Feature 6: Bookmarks

**New Components:**
- `BookmarkManager.tsx` — UI for managing bookmarks (add/remove/rename)
- `BookmarkList.tsx` — Left sidebar section showing bookmarked paths
- `useBookmarks.ts` — Hook for bookmark CRUD operations

**Modified Components:**
- `FileTree.tsx` — Add "Bookmark" action to context menu
- `DepotBrowser.tsx` — Add "Bookmark" action to context menu
- `MainLayout.tsx` — Add BookmarkList to left sidebar (collapsible section)

**Storage:**
- Use existing `tauri-plugin-store` (same as settings)
- Store as `{ bookmarks: Array<{ id, name, depotPath, type }> }`
- Type: `'file' | 'folder'`

**Integration Points:**
- FileTree context menu — "Add Bookmark" option
- DepotBrowser context menu — "Add Bookmark" option
- Left sidebar — New collapsible "Bookmarks" section above or below Workspace
- Click bookmark → Navigate to file/folder in appropriate tree
- Settings dialog — "Manage Bookmarks" tab

**Data Flow:**
1. User right-clicks file/folder → "Add Bookmark"
2. Modal prompts for bookmark name (default: file/folder name)
3. Save to store: `{ id: uuid(), name, depotPath, type }`
4. BookmarkList re-renders with new bookmark
5. Click bookmark → Expand tree to path, select node, show in detail pane

**Persistence:**
- Bookmarks stored in `settings.json` alongside connection settings
- Load on app startup via `useSettings`
- Auto-save on add/remove/rename

**Suggested Build Order:** **Phase 4** (independent feature, no dependencies on other features)

---

## Suggested Build Order

### Phase 1: Foundational Features (Milestone 1)
**Rationale:** These features provide core building blocks for other features.

1. **File Content Viewer** (Feature 3)
   - Enables submit preview and revision browsing
   - Straightforward p4 print command wrapper
   - Adds new detail pane view type (pattern already established)
   - **Estimate:** 2-3 days (Rust command + React component + syntax highlighting)

2. **File Annotations** (Feature 1)
   - Independent feature, high value for developers
   - Follows same pattern as file content viewer
   - More complex UI (table with changelist lookup)
   - **Estimate:** 3-4 days (Rust command + React component + changelist data join)

### Phase 2: Table Stakes Features (Milestone 2)
**Rationale:** Features users expect from any P4 client.

3. **Submitted Changelist File List** (Feature 5)
   - Unblocks submitted CL exploration (currently only shows description)
   - Simple p4 describe command wrapper
   - Reuses existing ChangelistDetailView UI patterns
   - **Estimate:** 1-2 days (Rust command + React hook + UI integration)

4. **Workspace File Tree Sync Status** (Feature 2)
   - Visual indicator for out-of-date files
   - No new commands needed (fstat already returns data)
   - Minimal UI changes (badge rendering)
   - **Estimate:** 1 day (UI changes only)

### Phase 3: Enhancement Features (Milestone 3)
**Rationale:** Features that improve existing workflows.

5. **Submit Dialog Preview** (Feature 4)
   - Depends on file content viewer (Phase 1)
   - Enhances existing submit flow
   - Design decision needed: modal vs. side panel vs. inline
   - **Estimate:** 2-3 days (UI design + integration)

### Phase 4: Independent Features (Milestone 4)
**Rationale:** Features that stand alone and can be added anytime.

6. **Bookmarks** (Feature 6)
   - No dependencies on other features
   - Pure UI state management + persistence
   - Deferred to allow focus on core P4 functionality
   - **Estimate:** 2-3 days (storage + UI + tree navigation)

---

## Cross-Feature Integration Points

### Detail Pane Routing
All features extend the existing discriminated union pattern:

```typescript
// Current
type DetailSelection =
  | { type: 'none' }
  | { type: 'file'; depotPath: string; localPath: string }
  | { type: 'changelist'; changelist: P4Changelist }
  | { type: 'revision'; depotPath: string; localPath: string; revision: P4Revision }
  | { type: 'search'; searchType: 'submitted' | 'depot'; query: string }

// After v4.0
type DetailSelection =
  | ... (existing types)
  | { type: 'annotation'; depotPath: string; revision: number }  // Feature 1
  | { type: 'content'; depotPath: string; revision: number }      // Feature 3
```

### Query Invalidation
Features follow existing pattern — no changes needed:
- File operations invalidate: `['fileTree']`, `['p4', 'opened']`, `['p4', 'changes']`
- New queries add their own keys: `['p4', 'annotate', path]`, `['p4', 'print', path, rev]`

### Back Navigation
All detail pane views support Escape key navigation via `useDetailPaneStore.goBack()`:
- Annotation view → FileDetailView
- Content view → RevisionDetailView or FileDetailView
- Feature 4 and 5 don't add new views (modify existing)

---

## Architecture Patterns to Follow

### Pattern 1: Command Wrapper (Rust)
```rust
// Location: src-tauri/src/commands/p4.rs
#[tauri::command]
pub async fn p4_new_command(
    param: String,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<ResponseType, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["-ztag", "command", param]);

    let output = cmd.output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout);

    let records = parse_ztag_records(&stdout);
    // Parse into typed struct

    Ok(result)
}
```

### Pattern 2: Tauri Invocation (TypeScript)
```typescript
// Location: src/lib/tauri.ts
export interface P4NewType {
  field: string;
}

export async function invokeP4NewCommand(param: string): Promise<P4NewType[]> {
  return invoke<P4NewType[]>('p4_new_command', { param, ...getConnectionArgs() });
}
```

### Pattern 3: TanStack Query Hook (TypeScript)
```typescript
// Location: src/hooks/useNewFeature.ts
export function useNewFeature(param: string) {
  const { p4port, p4user, p4client } = useConnectionStore();

  return useQuery<P4NewType[]>({
    queryKey: ['p4', 'newfeature', param],
    queryFn: async () => {
      const { addOutputLine } = useOperationStore.getState();
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine(`p4 command ${param}`, false);
      const result = await invokeP4NewCommand(param);
      if (verbose) addOutputLine(`... returned ${result.length} items`, false);
      return result;
    },
    enabled: !!p4port && !!p4user && !!p4client,
  });
}
```

### Pattern 4: Detail Pane View (React)
```typescript
// Location: src/components/DetailPane/NewView.tsx
export function NewView({ param }: NewViewProps) {
  const { data, isLoading, error } = useNewFeature(param);

  if (isLoading) return <Loader2 className="animate-spin" />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        {/* Header with breadcrumb */}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {/* Content */}
      </div>
    </div>
  );
}
```

---

## Potential Architecture Improvements

### Improvement 1: Unified File Viewer Component
Current state: FileDetailView, RevisionDetailView, and new FileContentView have overlapping concerns.

**Suggestion:** Create `UnifiedFileViewer` that accepts `{ depotPath, revision, view: 'detail' | 'content' | 'annotation' }` and renders appropriate sub-view. Reduces duplication and simplifies navigation.

**Impact:** Moderate refactor, but cleaner long-term architecture.

### Improvement 2: P4 Command Result Caching
Current state: Each command invocation spawns p4.exe, even for immutable data (submitted CLs, file history).

**Suggestion:** Add Rust-side in-memory cache with TTL for immutable results. TanStack Query already caches frontend, but Rust cache avoids process spawns entirely.

**Impact:** Performance win for submitted CL browsing (Feature 5) and annotations (Feature 1).

### Improvement 3: Batch P4 Commands
Current state: Each file in submit preview requires separate p4 print invocation.

**Suggestion:** Add `p4_print_batch(files: Vec<(String, i32)>)` that spawns single p4 process with multiple file specs. Perforce supports `p4 print file1#5 file2#3 ...` syntax.

**Impact:** 10x faster submit preview for large changelists (Feature 4).

---

## Risk Assessment

### Low Risk
- **Feature 2 (Sync Status):** Pure UI change, no new commands
- **Feature 6 (Bookmarks):** Pure frontend state, no P4 interaction

### Medium Risk
- **Feature 3 (Content Viewer):** Large files may cause memory issues (mitigate with size warning)
- **Feature 5 (CL File List):** Submitted CLs with 1000+ files may slow UI (mitigate with virtualization)

### Medium-High Risk
- **Feature 1 (Annotations):** Perforce annotate can be slow for large/old files (mitigate with loading state + timeout)
- **Feature 4 (Submit Preview):** Fetching content for 50+ files could overwhelm backend (mitigate with batching, Improvement 3)

---

## Testing Strategy

### Unit Tests
- Rust: Test `-ztag` parsing for each new command
- TypeScript: Test hook state management and query invalidation

### Integration Tests
- Test complete flow: click action → fetch data → render view → navigate back
- Test error cases: connection lost, command timeout, file not found

### Performance Tests
- Large file content viewer (10MB text file)
- Annotations for 5000-line file with 200 revisions
- Submit preview with 100-file changelist

---

## Sources

**Perforce Command Documentation:**
- [p4 annotate | Helix Core Command-Line Reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_annotate.html)
- [p4 have command reference](https://www.perforce.com/manuals/v15.2/cmdref/p4_have.html)
- [p4 print | Helix Core Command-Line Reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_print.html)
- [p4 describe | Helix Core Command-Line Reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_describe.html)
- [Helix Core Command-Line (P4) Guide - Annotation](https://www.perforce.com/manuals/p4guide/Content/P4Guide/scripting.file-reporting.annotation.html)

**Existing Codebase Patterns:**
- `src-tauri/src/commands/p4.rs` — Command wrapper pattern with `-ztag` parsing
- `src/hooks/useFileHistory.ts` — TanStack Query hook pattern with pagination
- `src/components/DetailPane/FileDetailView.tsx` — Detail view component structure
- `src/stores/detailPaneStore.ts` — Navigation state management with discriminated unions

---

*Researched: 2026-02-03*
