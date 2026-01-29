# Architecture: v2.0 Feature Integration

**Project:** P4Now
**Researched:** 2026-01-28
**Overall confidence:** HIGH (based on direct codebase analysis of existing implementation)

## Current Architecture Snapshot

```
React 19 Frontend (src/)              Rust Backend (src-tauri/src/)
==============================        ==============================
App.tsx                               lib.rs
  QueryClientProvider                   plugins: opener, shell
    AppContent                          managed state: ProcessManager
      useP4Events()                     invoke_handler: 12 commands
      MainLayout
        SyncToolbar                   commands/
        FileTree (react-arborist)       p4.rs (~710 lines, 8 commands)
        ChangelistPanel                 process.rs (spawn, kill)
      OutputPanel                       mod.rs (re-exports)
      StatusBar
      Toaster                         state/
                                        process_manager.rs
Stores (Zustand):
  changelistStore (Map<id, CL>)
  fileTreeStore (Map<depotPath, File>)
  operationStore

Queries (TanStack):
  ['p4','changes','pending']
  ['p4','opened']

IPC: Tauri invoke() + Channel (streaming) + Emitter (push events)
```

**Existing Rust commands:** `p4_info`, `p4_fstat`, `p4_opened`, `p4_changes`, `p4_edit`, `p4_revert`, `p4_submit`, `p4_sync`, `spawn_p4_command`, `p4_command`, `kill_process`, `kill_all_processes`

**Existing events emitted from Rust:** `file-status-changed`, `changelist-submitted`

---

## 1. New Rust Backend Commands

### Commands to add

| Command | P4 CLI | Args | Returns | Complexity |
|---------|--------|------|---------|------------|
| `p4_reopen` | `p4 reopen -c CL paths...` | paths: Vec<String>, changelist: i32 | Result<Vec<P4FileInfo>> | Low |
| `p4_change_new` | `p4 change -i` (pipe form with description) | description: String | Result<i32> (new CL id) | Med |
| `p4_change_delete` | `p4 change -d CL` | changelist: i32 | Result<()> | Low |
| `p4_filelog` | `p4 -ztag filelog -l path` | depot_path: String, max_revs: Option<i32> | Result<Vec<P4FileRevision>> | Med |
| `p4_shelve` | `p4 shelve -c CL` | changelist: i32 | Result<String> | Low |
| `p4_unshelve` | `p4 unshelve -s CL -c target` | source_cl: i32, target_cl: Option<i32> | Result<Vec<P4FileInfo>> | Med |
| `p4_delete_shelve` | `p4 shelve -d -c CL` | changelist: i32 | Result<()> | Low |
| `p4_reconcile` | `p4 reconcile paths...` | paths: Vec<String>, on_progress: Channel | Result<String> | Med (streaming) |
| `p4_diff_external` | spawn diff tool | local_path: String, tool_path: String, tool_args: String | Result<()> | Low (fire-and-forget) |
| `p4_describe` | `p4 -ztag describe -s CL` | changelist: i32 | Result<P4ChangelistDetail> | Med |
| `p4_changes_search` | `p4 -ztag changes -s submitted -l -m N` | query: Option<String>, max: Option<i32> | Result<Vec<P4Changelist>> | Low |
| `p4_set` | `p4 set` | None | Result<HashMap<String,String>> | Low |
| `p4_set_var` | `p4 set VAR=VAL` | key: String, value: String | Result<()> | Low |

### New Rust structs needed

```rust
#[derive(Debug, Clone, Serialize)]
pub struct P4FileRevision {
    pub depot_path: String,
    pub revision: i32,
    pub change: i32,
    pub action: String,
    pub file_type: String,
    pub date: String,
    pub user: String,
    pub client: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct P4ChangelistDetail {
    pub id: i32,
    pub description: String,
    pub user: String,
    pub client: String,
    pub status: String,
    pub date: String,
    pub files: Vec<P4DescribeFile>,
}

#[derive(Debug, Clone, Serialize)]
pub struct P4DescribeFile {
    pub depot_path: String,
    pub action: String,
    pub file_type: String,
    pub revision: i32,
}
```

### Recommended: Split `p4.rs` into modules

Current `p4.rs` is ~710 lines with 8 commands. Adding 13 more would make it ~1500+ lines. Split into:

```
src-tauri/src/commands/
  mod.rs              (re-exports everything)
  process.rs          (existing: spawn, kill)
  p4/
    mod.rs            (re-exports all p4 commands)
    info.rs           (p4_info, p4_set, p4_set_var)
    files.rs          (p4_fstat, p4_opened, p4_edit, p4_revert, p4_reconcile)
    changelists.rs    (p4_changes, p4_change_new, p4_change_delete, p4_describe, p4_changes_search)
    sync.rs           (p4_sync)
    shelve.rs         (p4_shelve, p4_unshelve, p4_delete_shelve)
    history.rs        (p4_filelog, p4_diff_external)
    submit.rs         (p4_submit + update_changelist_description)
    parser.rs         (parse_ztag_fstat, parse_ztag_changes, build_file_info, etc.)
```

Shared parsing logic (the `-ztag` parser) moves to `parser.rs`. Each module imports from it.

---

## 2. New React Components and Views

### New components

| Component | Path | Purpose |
|-----------|------|---------|
| `SettingsDialog` | `components/dialogs/SettingsDialog.tsx` | P4PORT, P4USER, P4CLIENT, diff tool config |
| `FileHistoryPanel` | `components/FileHistory/FileHistoryPanel.tsx` | Table of revisions for selected file |
| `ConnectionIndicator` | `components/ConnectionIndicator.tsx` | Green/red dot in StatusBar |
| `SearchPanel` | `components/SearchPanel/SearchPanel.tsx` | Search submitted changelists |
| `SearchResultItem` | `components/SearchPanel/SearchResultItem.tsx` | Single search result row |
| `KeyboardShortcutHelp` | `components/dialogs/KeyboardShortcutHelp.tsx` | Modal listing all shortcuts |
| `ContextMenuPrimitive` | `components/ui/context-menu.tsx` | Shared context menu with submenu support |

### Modified existing components

| Component | What changes |
|-----------|-------------|
| `StatusBar.tsx` | Add ConnectionIndicator, repo/stream display from p4_info data |
| `FileContextMenu.tsx` | Refactor to use ContextMenuPrimitive; add History, Diff, Move to CL, Shelve items |
| `ChangelistPanel.tsx` | Add DnD drop targets, new CL button, shelve/unshelve buttons per CL |
| `ChangelistNode.tsx` | Add drag source behavior, right-click context menu |
| `MainLayout.tsx` | Add keyboard shortcut provider, settings button in header, tabbed right panel |
| `App.tsx` | Add DndContext wrapper, settings initialization |
| `SyncToolbar.tsx` | Add reconcile button |

### Layout evolution

Current layout is: Header | FileTree (left) | ChangelistPanel (right sidebar) | OutputPanel | StatusBar

Proposed v2.0 layout:

```
+-------------------------------------------------------------+
| P4Now  [//stream/main]              [Search] [Settings] [Sync] [Reconcile] |
+-------------------------------------------------------------+
|                       |                                      |
|   File Tree           |  [Changelists] [History] [Search]    |  <- tabs
|   (existing)          |  +---------------------------------+ |
|                       |  | Tab content here                | |
|                       |  | (changelist panel / history /   | |
|                       |  |  search results)                | |
|                       |  +---------------------------------+ |
+-------------------------------------------------------------+
| [Output Panel - collapsible]                                 |
+-------------------------------------------------------------+
| [green dot] Connected | //depot/stream/main | user@server    |
+-------------------------------------------------------------+
```

The right sidebar becomes tabbed. History and Search are new tabs alongside the existing Changelists tab. This avoids layout disruption -- same panel area, just tabbed content.

---

## 3. State Management Changes

### New TanStack Query keys

| Query Key | Command | Trigger | staleTime |
|-----------|---------|---------|-----------|
| `['p4','filelog', depotPath]` | `p4_filelog` | File selected + history tab open | 60s |
| `['p4','describe', clId]` | `p4_describe` | CL clicked in search results | 60s |
| `['p4','changes','submitted', {query, max}]` | `p4_changes_search` | Search input debounced | 30s |
| `['p4','connection']` | `p4_info` | Polling every 30s | 0 (always refetch) |
| `['p4','set']` | `p4_set` | Settings dialog opened | Infinity (manual) |

### New Zustand stores

**`stores/settingsStore.ts`** -- persisted via tauri-plugin-store

```typescript
interface SettingsState {
  p4port: string;
  p4user: string;
  p4client: string;
  diffToolPath: string;
  diffToolArgs: string;  // e.g. "%1 %2"
  setConnection: (p4port: string, p4user: string, p4client: string) => void;
  setDiffTool: (path: string, args: string) => void;
}
```

**`stores/uiStore.ts`** -- ephemeral UI state

```typescript
interface UIState {
  activeRightTab: 'changelists' | 'history' | 'search';
  selectedFilePath: string | null;  // depot path of currently selected file
  searchQuery: string;
  setActiveRightTab: (tab: string) => void;
  setSelectedFile: (path: string | null) => void;
  setSearchQuery: (query: string) => void;
}
```

### Modified stores

**`changelistStore.ts`** -- add these actions:

```typescript
// New actions for v2.0
moveFile: (fromCl: number, toCl: number, depotPath: string) => void;  // optimistic DnD
createChangelist: (cl: P4Changelist) => void;  // optimistic add
deleteChangelist: (id: number) => void;  // optimistic remove
```

### Query invalidation map

| Mutation | Invalidate these queries |
|----------|------------------------|
| `p4_reopen` (move file between CLs) | `['p4','opened']`, `['p4','changes']` |
| `p4_shelve` | `['p4','opened']`, `['p4','changes']` |
| `p4_unshelve` | `['p4','opened']`, `['p4','changes']` |
| `p4_reconcile` | `['p4','opened']`, `['p4','fstat']` |
| `p4_change_new` | `['p4','changes']` |
| `p4_change_delete` | `['p4','changes']` |
| `p4_set_var` | `['p4','set']`, `['p4','connection']` |
| `p4_submit` | `['p4','opened']`, `['p4','changes']` (already done) |

---

## 4. Settings Persistence

### Recommendation: `tauri-plugin-store`

Use `tauri-plugin-store` for all app settings. It writes a JSON file to the OS app data directory, handles atomic writes, and has a simple get/set API.

**Add to Cargo.toml:**
```toml
tauri-plugin-store = "2"
```

**Add to lib.rs:**
```rust
.plugin(tauri_plugin_store::Builder::new().build())
```

**Frontend usage:**
```typescript
import { Store } from '@tauri-apps/plugin-store';

const store = await Store.load('settings.json');
await store.set('connection.p4port', 'ssl:server:1666');
await store.save();
const port = await store.get<string>('connection.p4port');
```

**Hybrid approach for P4 connection vars:** When user changes P4PORT/P4USER/P4CLIENT:
1. Save to `tauri-plugin-store` (for UI display on next launch)
2. Call `p4_set_var` to set as P4 environment variables (so spawned `p4.exe` picks them up)

This ensures both the UI and the backend stay in sync.

**Settings schema:**
```json
{
  "connection": { "p4port": "", "p4user": "", "p4client": "" },
  "diffTool": { "path": "", "args": "%1 %2" },
  "ui": { "sidebarWidth": 320 }
}
```

---

## 5. Drag-and-Drop for Changelist File Moves

### Recommendation: `@dnd-kit/core`

**Why:** Lightweight, accessible, actively maintained. `react-beautiful-dnd` is deprecated.

**Architecture:**

Wrap ChangelistPanel in DndContext. Each changelist is a Droppable. Each file node is a Draggable.

```
<DndContext onDragEnd={handleDragEnd}>
  <SortableContext>  {/* optional: for reordering within CL */}
    <ChangelistPanel>
      <DroppableChangelist id="cl-0">
        <DraggableFile id="file-//depot/a.txt" />
        <DraggableFile id="file-//depot/b.txt" />
      </DroppableChangelist>
      <DroppableChangelist id="cl-12345">
        ...
      </DroppableChangelist>
    </ChangelistPanel>
  </SortableContext>
  <DragOverlay>
    <FileDragPreview />  {/* ghost showing filename + count if multi-select */}
  </DragOverlay>
</DndContext>
```

**Drop handler flow:**
1. `onDragEnd` fires with `active` (file) and `over` (target CL)
2. Extract: `fromCl` from file's current changelist, `toCl` from drop target id, `depotPath` from file id
3. Optimistic: `changelistStore.moveFile(fromCl, toCl, depotPath)`
4. Backend: `invoke('p4_reopen', { paths: [depotPath], changelist: toCl })`
5. On success: invalidate `['p4','opened']` and `['p4','changes']` to confirm
6. On failure: rollback optimistic update, toast error

**Multi-select:** Track selected files in uiStore or changelistStore. When dragging one selected file, all selected files move together.

---

## 6. Context Menu Integration

### Refactor to shared primitive

Current `FileContextMenu` is a standalone component with hardcoded items. Extend to a reusable primitive.

**Create `components/ui/context-menu.tsx`:**

```typescript
interface MenuItem {
  label: string;
  icon?: ReactNode;
  action?: () => void;
  children?: MenuItem[];  // submenu
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  items: MenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}
```

**File context menu items (v2.0):**

```
Checkout for Edit         (existing)
Revert Changes            (existing)
---
Show History              (new: sets activeRightTab='history', selectedFile)
Diff Against Depot        (new: invokes p4_diff_external)
---
Move to Changelist >      (new: submenu listing pending CLs)
  Default Changelist
  CL 12345 - "fix bug"
  New Changelist...
---
Shelve                    (new: if file is opened)
---
Copy Local Path           (existing)
Copy Depot Path           (new)
```

**Changelist context menu (new):**

```
Edit Description          (inline rename or dialog)
Submit...                 (existing via SubmitDialog)
---
Shelve All Files          (invokes p4_shelve)
Unshelve Files            (invokes p4_unshelve)
---
Delete Changelist         (only if empty, invokes p4_change_delete)
```

**Integration with react-arborist:** The existing FileTree uses `onContextMenu` on nodes. Same pattern applies -- right-click sets `contextMenu` state with position + target data, render the context menu component.

---

## 7. Keyboard Shortcut System

### Recommendation: Custom hook (no library needed)

A `useKeyboardShortcuts` hook is ~30 lines and avoids adding a dependency.

```typescript
// hooks/useKeyboardShortcuts.ts
interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  action: () => void;
  when?: () => boolean;  // conditional activation
}

function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      for (const s of shortcuts) {
        if (
          e.key.toLowerCase() === s.key.toLowerCase() &&
          !!e.ctrlKey === !!s.ctrl &&
          !!e.shiftKey === !!s.shift &&
          (!s.when || s.when())
        ) {
          e.preventDefault();
          s.action();
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
```

**Shortcut map:**

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Ctrl+S` | Sync workspace | Global |
| `Ctrl+Shift+S` | Submit selected CL | Global |
| `Ctrl+E` | Checkout selected file | File selected |
| `Ctrl+Z` | Revert selected file | File selected |
| `Ctrl+Shift+N` | New changelist | Global |
| `Ctrl+F` | Focus search | Global |
| `Ctrl+H` | Show file history | File selected |
| `Ctrl+D` | External diff | File selected |
| `?` | Show shortcut help | Global |
| `Escape` | Close dialog/menu | Global |

Register in `MainLayout` or `App.tsx`. The `when` condition checks `uiStore.selectedFilePath` for file-specific shortcuts.

---

## 8. Connection Monitoring

### Polling with existing `p4_info`

No new Rust command needed. Reuse `p4_info` -- it already returns server, user, client, stream. It is fast (local `p4 info` call).

```typescript
// hooks/useConnectionStatus.ts
function useConnectionStatus() {
  const { data, error, isError } = useQuery({
    queryKey: ['p4', 'connection'],
    queryFn: () => invokeP4Info(),
    refetchInterval: 30_000,  // poll every 30s
    staleTime: 0,             // always refetch
    retry: false,             // don't retry on failure (it means disconnected)
  });

  return {
    isConnected: !isError && !!data,
    serverInfo: data,
    error,
  };
}
```

**StatusBar display:**
```
[green dot] Connected | //stream/main | jsmith@ssl:server:1666
[red dot]   Disconnected
```

**Reconnection behavior:** When transitioning disconnected -> connected, invalidate all queries to refresh stale data:
```typescript
queryClient.invalidateQueries();
```

---

## Suggested Build Order (Dependency-Aware)

```
Phase 1: Backend Infrastructure
  1a. Split p4.rs into modules (refactor, no new features)
  1b. Add tauri-plugin-store (Cargo.toml + lib.rs)
  1c. Add p4_reopen, p4_change_new, p4_change_delete commands
  1d. Add p4_filelog command + P4FileRevision struct
  1e. Add p4_shelve, p4_unshelve, p4_delete_shelve commands
  1f. Add p4_reconcile command (streaming)
  1g. Add p4_describe, p4_changes_search commands
  1h. Add p4_set, p4_set_var, p4_diff_external commands

Phase 2: Settings + Connection (depends on 1b, 1h)
  2a. settingsStore + SettingsDialog
  2b. Connection monitoring (useConnectionStatus hook)
  2c. Enhanced StatusBar with connection + repo/stream

Phase 3: Changelist Management (depends on 1c)
  3a. Changelist CRUD UI (new CL, delete CL, edit description)
  3b. @dnd-kit integration for file moves between CLs
  3c. Multi-select support in changelist file list

Phase 4: Context Menus + Shortcuts (depends on 1c, 1d, 1e)
  4a. ContextMenuPrimitive component
  4b. Enhanced FileContextMenu (history, diff, move-to-CL, shelve)
  4c. New ChangelistContextMenu
  4d. useKeyboardShortcuts hook + KeyboardShortcutHelp dialog

Phase 5: History + Search + Diff (depends on 1d, 1g, 1h)
  5a. Tabbed right panel (refactor MainLayout)
  5b. FileHistoryPanel
  5c. SearchPanel for submitted changelists
  5d. External diff tool launch

Phase 6: Advanced Operations (depends on 1e, 1f)
  6a. Shelve/unshelve UI (per-CL buttons + context menu)
  6b. Reconcile UI (toolbar button, streaming progress)
```

**Rationale:** Backend first (all frontend features need commands). Settings next (diff tool path needed for diff, connection needed for status). Changelist management next (most impactful UX improvement). Context menus and shortcuts span all features. History/search/diff are independent panels. Shelve/reconcile last (less common workflows).

**Parallelizable:** Phases 3, 4, and 5 are mostly independent once Phase 1 is complete.

---

## Anti-Patterns to Avoid

### 1. Synchronous `Command::new().output()` for long operations
The existing code uses synchronous `.output()` which is fine for quick commands (`p4 info`, `p4 edit`). But `p4 reconcile` on a large workspace can take minutes. Use the streaming Channel pattern (already established in `p4_sync`) for reconcile and any search command that might return thousands of results.

### 2. Over-polling the P4 server
Connection check (30s) + changelist refresh (30s staleTime) + opened files (30s) = 3 p4.exe spawns every 30s at baseline. Adding more polling queries compounds this. Use event-driven invalidation after user actions rather than adding more polling intervals.

### 3. DnD without optimistic updates
If the DnD handler waits for `p4 reopen` to complete before moving the file in the UI, there will be a visible 200-500ms delay where nothing happens. Always update the store first, then confirm with the backend.

### 4. Monolithic context menu
Do not keep adding items to `FileContextMenu` as a single component. The shared primitive approach keeps each menu composable and testable.

---

## Sources

- Direct codebase analysis of all files in `src-tauri/src/` and `src/` (HIGH confidence)
- Tauri 2.0 plugin ecosystem: `tauri-plugin-store` is an official Tauri plugin (HIGH confidence)
- `@dnd-kit`: Well-established React DnD library, actively maintained (HIGH confidence)
- `react-beautiful-dnd` deprecated status: confirmed by Atlassian (HIGH confidence)
- P4 command-line reference for `reopen`, `shelve`, `unshelve`, `reconcile`, `filelog`, `describe`, `set` (HIGH confidence -- stable CLI API)
