# Phase 20: Bug Fixes & UI Polish - Research

**Researched:** 2026-02-03
**Domain:** Bug investigation and root cause analysis
**Confidence:** HIGH

## Summary

This is a bug fix and UI polish phase focused on 12 specific issues discovered during testing of v4.0 features. Unlike typical research phases, the research here involves **codebase investigation** to find root causes of bugs rather than exploring new technologies.

All bugs have been investigated and root causes identified. The issues fall into three categories:

1. **Query invalidation bugs** - Operations succeed but UI doesn't update (shelve/unshelve)
2. **Conditional logic bugs** - Wrong conditions for showing UI elements (connection dialog, depot query)
3. **Layout/UX bugs** - CSS/component order issues (toolbar order, accordion headers, scrollability)

**Primary recommendation:** Fix bugs in dependency order (some share code paths). Start with foundational issues (connection dialog, depot accordion) then tackle operation feedback issues (shelve/unshelve, CL details).

## Bug Investigation Findings

### Bug 1: Connection Dialog Shows on Startup (Even with Saved Connection)

**Location:** `src/components/MainLayout.tsx` line 188-192

**Root Cause:**
```tsx
// Auto-open connection dialog when disconnected on mount
useEffect(() => {
  if (connectionStatus === 'disconnected') {
    setConnectionDialogOpen(true);
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

This useEffect runs on mount and checks if `connectionStatus === 'disconnected'`. However, on mount the status is **always** `'disconnected'` initially (see `connectionStore.ts:31`), even when there's a saved connection. The `useSettings` hook tests the connection asynchronously, but this check happens before that completes.

**Fix Approach:** Change condition to only open dialog if connection **fails** after attempting to connect, not just if status is disconnected on mount. Need to distinguish between "never tried to connect" vs "tried and failed".

**Files:**
- `src/components/MainLayout.tsx` - Remove auto-open on mount
- `src/hooks/useSettings.ts` - Add flag to track if connection was attempted

**Risk:** LOW - Simple conditional change

---

### Bug 2: Shelve/Unshelve Do Not Update UI

**Location:** `src/hooks/useShelvedFiles.ts` lines 58-66 and 128-138

**Root Cause:**
The mutations call `queryClient.invalidateQueries()` but do NOT `await` the Promise:

```tsx
onSuccess: (data, variables) => {
  addOutputLine(String(data), false);
  toast.success(`Shelved ${variables.filePaths.length} file(s)`);
  Promise.all([  // ⚠️ NOT AWAITED
    queryClient.invalidateQueries({ queryKey: ['p4', 'shelved'] }),
    queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] }),
    queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] }),
  ]);
},
```

The invalidations are fire-and-forget. While TanStack Query will eventually refetch, there's no guarantee of timing.

**Secondary Issue:** The shelved files query is only enabled for numbered CLs (`enabled: changelistId > 0`), which is correct. However, the query key pattern `['p4', 'shelved']` without a specific CL ID might not match the actual queries being made (`['p4', 'shelved', changelistId]`).

**Fix Approach:**
1. Change invalidations to use more specific query key patterns or use `refetchType: 'all'`
2. Ensure invalidations properly await (though onSuccess doesn't need to return a Promise, the invalidations should use `await queryClient.invalidateQueries()`)
3. Alternative: Use `onMutate` optimistic updates for instant feedback

**Files:**
- `src/hooks/useShelvedFiles.ts` - Fix query invalidation patterns

**Risk:** LOW - Standard TanStack Query fix

---

### Bug 3: CL Details Panel Shows 0 Files (Regression)

**Location:** `src/components/DetailPane/ChangelistDetailView.tsx` line 165

**Root Cause:**
The component displays file count as `({changelist.files.length})` but this count is for **pending** changelists. For **submitted** changelists, files come from a separate query (`useChangelistFiles`).

Looking at the code:
```tsx
const hasFiles = changelist.files.length > 0;  // Line 45 - only checks pending files

// ...later at line 165:
<h3 className="text-sm font-semibold mb-2 text-muted-foreground">
  FILES ({changelist.files.length})  // ⚠️ Always shows pending count
</h3>
```

For submitted CLs, `changelist.files` is likely empty (it's only populated by `p4 changes -l` which doesn't include file lists). The actual files come from `submittedCLData` (line 41-44).

**However**, the submitted CL section (lines 204-251) correctly shows `{submittedCLData ? `(${submittedCLData.files.length})` : ''}`, so this is working for submitted CLs.

**Actual Bug:** The bug report says "CL details panel shows 0 files". Need to check if this is about **pending** CLs showing 0 when they shouldn't. This could be a data issue from `useChangelists` not properly mapping files to CLs.

**Alternative Root Cause:** Check `src/components/ChangelistPanel/useChangelists.ts` to see if files are being properly associated with changelist objects.

**Fix Approach:** Investigate `useChangelists` hook to ensure files are properly mapped to changelist objects. The `P4Changelist` type should have a `files` array populated.

**Files:**
- `src/components/ChangelistPanel/useChangelists.ts` - Check file-to-CL mapping
- `src/types/p4.ts` - Verify P4Changelist type structure

**Risk:** MEDIUM - Requires understanding data flow from backend to UI

---

### Bug 4: Depot Browser Disappears After Accordion Collapse/Expand

**Location:** `src/components/DepotBrowser/useDepotTree.ts` lines 31-51

**Root Cause:**
The depot query has `enabled: isConnected` but there's no dependency on accordion state. When the depot accordion collapses, the component may unmount or re-render, and if `isConnected` transiently changes, the query could be disabled.

Looking at the code:
```tsx
const { isLoading, error } = useQuery({
  queryKey: ['depot', 'roots', p4port, p4user],
  queryFn: async () => {
    const depots = await invokeP4Depots();
    const roots: DepotNodeData[] = depots.map(depot => ({
      id: `//${depot.name}`,
      name: depot.name,
      isFolder: true,
      isDepotRoot: true,
      children: [], // Empty until expanded
    }));

    loadedPaths.current.clear();
    setTreeData(roots);
    return roots;
  },
  enabled: isConnected,  // ⚠️ Could become false during render
  staleTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
});
```

The issue is that `setTreeData(roots)` is called inside `queryFn`, which means if the query is re-run or the component re-mounts with cached data, `setTreeData` might not be called.

**Fix Approach:**
1. Move `setTreeData` to `onSuccess` callback or use the query `data` directly
2. Ensure `treeData` state persists across accordion toggles
3. Consider using TanStack Query's `placeholderData` or `initialData` to preserve data during re-renders

**Files:**
- `src/components/DepotBrowser/useDepotTree.ts` - Fix data persistence
- `src/components/DepotBrowser/DepotBrowser.tsx` - Ensure component doesn't fully unmount

**Risk:** MEDIUM - State management issue with accordion interaction

---

### Bug 5: File Click Does Not Update Contextual Toolbar Icons

**Location:** Multiple files - toolbar reads from `useFileTreeStore(s => s.selectedFile)`

**Root Cause:**
The toolbar in `MainLayout.tsx` only reads from `useFileTreeStore` (lines 53, 131-145). File clicks in other panels (depot browser, changelist panel) may not update this shared store.

Checking file selection code:
- `FileTree` likely updates `fileTreeStore.setSelectedFile` ✓
- `DepotNode` may not update `fileTreeStore.setSelectedFile` ✗
- `ChangelistNode` may not update `fileTreeStore.setSelectedFile` ✗

**Fix Approach:**
1. Ensure all file click handlers call `useFileTreeStore.getState().setSelectedFile(file)`
2. OR create a global selection store that all panels write to
3. OR have toolbar read from multiple sources (workspace, depot, CL panel selections)

**Files:**
- `src/components/DepotBrowser/DepotNode.tsx` - Add selection update on click
- `src/components/ChangelistPanel/ChangelistNode.tsx` - Add selection update on click
- `src/components/MainLayout.tsx` - Toolbar already reads from fileTreeStore

**Risk:** LOW - Add missing store updates

---

### Bug 6: Client Spec Fails to Load - Missing Root Field

**Location:** `src-tauri/src/commands/p4.rs` line 2232

**Root Cause:**
The parser requires the "Root" field to be present:

```rust
let root = fields.get("Root").ok_or("Missing Root field")?.clone();
```

This is case-sensitive. P4 might return "root" (lowercase) in some configurations or versions. The parser should be case-insensitive or handle both.

**Alternative:** The field might genuinely be missing in some client specs (e.g., stream-based workspaces with virtual roots).

**Fix Approach:**
1. Make field lookup case-insensitive
2. Make Root field optional with fallback to empty string
3. Add debug logging to see what fields are actually returned

**Files:**
- `src-tauri/src/commands/p4.rs` - Fix parse_ztag_client_spec function

**Risk:** LOW - Simple parser fix

---

### Bug 7: Top Toolbar Layout Order Wrong

**Location:** `src/components/MainLayout.tsx` lines 250-254

**Root Cause:**
Current order in the header:
```tsx
<div className="flex items-center gap-6">
  <WorkspaceSwitcher />  // ⚠️ Should be second
  <StreamSwitcher />     // ⚠️ Should be first
</div>
```

Desired order: Stream → Workspace → Client Spec

But Client Spec button is inside `WorkspaceSwitcher.tsx` (lines 135-145), not in MainLayout.

**Fix Approach:** Simple reordering of components

**Files:**
- `src/components/MainLayout.tsx` - Swap WorkspaceSwitcher and StreamSwitcher order

**Risk:** TRIVIAL - Just swap two components

---

### Bug 8: Unify Async Loading Indicators

**Location:** Status bar exists but not all operations use it

**Root Cause:**
The app has a `StatusBar` component (`src/components/StatusBar.tsx`) that shows current operation from `useOperationStore`. However, not all async operations update this store.

**Current State:**
- Status bar shows operation from `useOperationStore().currentOperation`
- Some operations (sync, depot loading) may not set this properly
- Need to audit all async operations and ensure they update operation store

**Fix Approach:**
1. Audit all async operations (depot loading, shelve, unshelve, client spec load, etc.)
2. Ensure they all call `useOperationStore.getState().setOperation()` on start
3. Call `clearOperation()` on completion
4. Add loading indicators to slow operations (depot directory loading mentioned specifically)

**Files:**
- Multiple hooks and components that perform async operations
- `src/store/operation.ts` - Operation store (already exists)
- `src/components/DepotBrowser/useDepotTree.ts` - Add operation tracking for directory loads

**Risk:** MEDIUM - Requires touching many files, but pattern is consistent

---

### Bug 9: Depot Directory Loading Shows No Progress

**Location:** `src/components/DepotBrowser/useDepotTree.ts` line 61-120

**Root Cause:**
The `loadChildren` function tracks loading state in local state (`loadingPaths`), but this isn't connected to the global operation store that the status bar reads from.

```tsx
setLoadingPaths(prev => new Set(prev).add(depotPath));  // Local only
// ... fetch ...
setLoadingPaths(prev => {
  const next = new Set(prev);
  next.delete(depotPath);
  return next;
});
```

**Fix Approach:**
Add operation store updates:
```tsx
const { setOperation, clearOperation } = useOperationStore.getState();
setOperation('running', `Loading ${depotPath}...`);
// ... fetch ...
clearOperation();
```

**Files:**
- `src/components/DepotBrowser/useDepotTree.ts` - Add operation store updates

**Risk:** LOW - Add operation tracking

---

### Bug 10: Settings Menu Not Scrollable

**Location:** `src/components/SettingsDialog.tsx` line 94

**Root Cause:**
The DialogContent has `max-h-[80vh] overflow-y-auto` but the form content inside might not respect this.

```tsx
<DialogContent className="sm:max-w-[525px]">  // ⚠️ No max-height
  <DialogHeader>...</DialogHeader>
  <Form {...form}>
    <form className="space-y-4">  // ⚠️ Could overflow
```

The content sections have multiple border separators and growing content. The dialog needs explicit height constraints.

**Fix Approach:**
1. Add `max-h-[80vh]` to DialogContent
2. Add `overflow-y-auto` to the form container
3. Ensure DialogHeader and DialogFooter are sticky/fixed
4. Or use Radix Dialog's built-in scrollable content area

**Files:**
- `src/components/SettingsDialog.tsx` - Add scrollable container
- Possibly `src/components/ui/dialog.tsx` - Check if base component needs fixes

**Risk:** LOW - CSS layout fix

---

### Bug 11: Accordion Headers Always Visible

**Location:** `src/components/MainLayout.tsx` lines 381-400

**Root Cause:**
The accordion headers are inside `Collapsible` components with `flex` layout. When content expands, it pushes headers out of view.

```tsx
<Collapsible open={workspaceOpen} onOpenChange={setWorkspaceOpen}
  className="flex flex-col min-h-0"
  style={{ flex: workspaceOpen ? '1 1 0%' : '0 0 auto' }}>  // ⚠️ Flex can shrink header
  <CollapsibleTrigger className="...">
    <span>Workspace Files</span>
  </CollapsibleTrigger>
  <CollapsibleContent className="flex-1 min-h-0 overflow-hidden">
    <FileTree />
  </CollapsibleContent>
</Collapsible>
```

When both accordions are open and content is large, flex layout might shrink one accordion's header out of view.

**Fix Approach:**
1. Make CollapsibleTrigger sticky with `position: sticky; top: 0; z-index: 10`
2. Or ensure minimum height for collapsed state
3. Or change flex layout to prevent header shrinkage

**Files:**
- `src/components/MainLayout.tsx` - Fix accordion header visibility

**Risk:** LOW - CSS layout fix

---

### Bug 12: Default CL Description Edit Should Move Files

**Location:** `src/components/ChangelistPanel/EditDescriptionDialog.tsx` lines 54-76

**Root Cause:**
This is actually **already implemented**! Lines 62-76 show that when editing the default CL (id === 0), it:
1. Creates a new numbered changelist
2. Gets all opened files from default CL
3. Reopens them to the new CL

```tsx
if (changelist.id === 0) {
  addOutputLine('p4 change -o (new changelist)', false);
  const newClId = await invokeP4CreateChange(description);
  addOutputLine(`Change ${newClId} created.`, false);

  // Move files from default CL to new numbered CL
  const openedFiles = await invokeP4Opened();
  const defaultClFiles = openedFiles.filter(f => f.changelist === 0);

  if (defaultClFiles.length > 0) {
    addOutputLine(`p4 reopen -c ${newClId} (${defaultClFiles.length} files)`, false);
    await invokeP4Reopen(
      defaultClFiles.map(f => f.depot_path),
      newClId
    );
    // ...
  }
}
```

**Status:** ALREADY WORKING - This might be a false positive bug report, or the issue is that the UI doesn't update after the operation completes.

**Fix Approach:**
If this is actually broken:
1. Verify the query invalidations (lines 79-82) are working
2. Check if `invokeP4Reopen` is implemented correctly in backend
3. Add better feedback/confirmation after the operation

**Files:**
- `src/components/ChangelistPanel/EditDescriptionDialog.tsx` - Verify invalidations
- `src/lib/tauri.ts` - Verify invokeP4Reopen exists

**Risk:** LOW - Might already be fixed, just needs verification

## Standard Stack

This phase doesn't introduce new libraries. All fixes use existing stack:

### Core Technologies
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| React | 18.x | UI framework | Existing |
| TypeScript | 5.x | Type safety | Existing |
| TanStack Query | 5.x | Data fetching/caching | Query invalidation fixes needed |
| Zustand | 4.x | State management | File selection shared state |
| Radix UI | Latest | Component primitives | Dialog, Collapsible fixes |
| Tailwind CSS | 3.x | Styling | Layout fixes for scrollability |

### Debugging Tools Needed
| Tool | Purpose |
|------|---------|
| React DevTools | Inspect component state and re-renders |
| TanStack Query DevTools | Monitor query states and invalidations |
| Browser DevTools | CSS layout debugging for accordion/scroll issues |
| Rust debug logging | Backend field parsing investigation |

## Architecture Patterns

### Pattern 1: Query Invalidation After Mutations

**Current (Broken):**
```tsx
onSuccess: () => {
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ['p4', 'shelved'] }),
    // ...
  ]); // Not awaited
}
```

**Fixed:**
```tsx
onSuccess: async () => {
  await queryClient.invalidateQueries({
    queryKey: ['p4', 'shelved'],
    refetchType: 'all'  // Ensure all matching queries refetch
  });
}
```

### Pattern 2: Shared Selection State

**Current (Broken):** Multiple panels have selection but don't update shared store

**Fixed:** All panels update a single source of truth:
```tsx
// In any file click handler (FileTree, DepotNode, ChangelistNode)
const handleFileClick = (file: P4File) => {
  useFileTreeStore.getState().setSelectedFile(file);
  // ... rest of click handling
};
```

### Pattern 3: Operation Tracking for Status Bar

**Standard pattern for async operations:**
```tsx
const doAsyncOperation = async () => {
  const { setOperation, clearOperation } = useOperationStore.getState();

  try {
    setOperation('running', 'Loading depot files...');
    const result = await someAsyncCall();
    clearOperation();
    return result;
  } catch (error) {
    setOperation('error', `Failed: ${error}`);
    throw error;
  }
};
```

### Pattern 4: Conditional Dialog Display

**Current (Broken):** Check status immediately on mount

**Fixed:** Track connection attempt state:
```tsx
const [connectionAttempted, setConnectionAttempted] = useState(false);

useEffect(() => {
  // Only show dialog if connection was attempted and failed
  if (connectionAttempted && connectionStatus === 'error') {
    setConnectionDialogOpen(true);
  }
}, [connectionAttempted, connectionStatus]);
```

## Common Pitfalls

### Pitfall 1: Query Invalidation Without Await

**What goes wrong:** Invalidations are fire-and-forget, UI updates are unpredictable

**Why it happens:** `queryClient.invalidateQueries()` returns a Promise but it's easy to forget to await it

**How to avoid:** Always use `await` with invalidations, or ensure `refetchType: 'all'` is set

**Warning signs:** UI doesn't update after mutations, requires manual refresh

### Pitfall 2: State Stored in queryFn

**What goes wrong:** Component state (like `setTreeData`) inside `queryFn` doesn't run when using cached data

**Why it happens:** TanStack Query caches results and won't re-run queryFn on subsequent mounts

**How to avoid:** Use query `data` directly or move state updates to `onSuccess`

**Warning signs:** Data disappears after component remount or navigation

### Pitfall 3: Case-Sensitive Field Parsing

**What goes wrong:** Parser expects "Root" but p4 returns "root"

**Why it happens:** Different p4 versions or configurations may use different casing

**How to avoid:** Always do case-insensitive field lookups for external data

**Warning signs:** Parsing errors that work for some users but not others

### Pitfall 4: Accordion Flex Layout Shrinkage

**What goes wrong:** Flex children can shrink below their minimum content size, hiding headers

**Why it happens:** CSS flex algorithm allows shrinkage unless explicitly prevented

**How to avoid:** Use `flex-shrink-0` for critical elements or `position: sticky` for headers

**Warning signs:** Elements disappear when sibling content grows

### Pitfall 5: Shared State Not Updated Across Panels

**What goes wrong:** File selection in one panel doesn't update toolbar state

**Why it happens:** Each panel might manage its own selection state independently

**How to avoid:** Define a single source of truth (Zustand store) and have all panels write to it

**Warning signs:** Toolbar doesn't react to selections in some panels

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Manual scroll containers | Custom overflow handling | Radix Dialog's built-in scroll area | Handles accessibility, keyboard nav |
| Custom loading state | Local useState for each operation | Shared operation store | Centralized tracking, status bar integration |
| File selection per panel | Separate selection state | Single Zustand store | Single source of truth, reactive updates |

## Code Examples

### Example 1: Fix Query Invalidation (Bug 2)

**Before:**
```tsx
onSuccess: (data, variables) => {
  toast.success('Operation complete');
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ['p4', 'shelved'] }),
  ]);
},
```

**After:**
```tsx
onSuccess: async (data, variables) => {
  toast.success('Operation complete');
  await queryClient.invalidateQueries({
    queryKey: ['p4', 'shelved'],
    refetchType: 'all'
  });
},
```

### Example 2: Fix Connection Dialog Display (Bug 1)

**Before (MainLayout.tsx):**
```tsx
useEffect(() => {
  if (connectionStatus === 'disconnected') {
    setConnectionDialogOpen(true);
  }
}, []);
```

**After (useSettings.ts):**
```tsx
// Add state to track connection attempt
const [connectionAttempted, setConnectionAttempted] = useState(false);

useEffect(() => {
  const initSettings = async () => {
    try {
      const loaded = await loadSettings();
      setSettings(loaded);
      await testConnection(loaded);
    } catch (error) {
      setError(error);
    } finally {
      setConnectionAttempted(true);  // Mark as attempted
    }
  };
  initSettings();
}, []);

return { settings, connectionAttempted };
```

**After (MainLayout.tsx):**
```tsx
const { connectionAttempted } = useSettings();

useEffect(() => {
  // Only open if connection was attempted and failed/disconnected
  if (connectionAttempted && connectionStatus === 'error') {
    setConnectionDialogOpen(true);
  }
}, [connectionAttempted, connectionStatus]);
```

### Example 3: Fix Depot Data Persistence (Bug 4)

**Before (useDepotTree.ts):**
```tsx
const { isLoading, error } = useQuery({
  queryKey: ['depot', 'roots', p4port, p4user],
  queryFn: async () => {
    const depots = await invokeP4Depots();
    const roots: DepotNodeData[] = depots.map(/* ... */);
    loadedPaths.current.clear();
    setTreeData(roots);  // ⚠️ Won't run on cached data
    return roots;
  },
  enabled: isConnected,
});
```

**After:**
```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['depot', 'roots', p4port, p4user],
  queryFn: async () => {
    const depots = await invokeP4Depots();
    const roots: DepotNodeData[] = depots.map(/* ... */);
    return roots;
  },
  enabled: isConnected,
});

// Update state when data changes
useEffect(() => {
  if (data) {
    loadedPaths.current.clear();
    setTreeData(data);
  }
}, [data]);
```

### Example 4: Fix File Selection Updates (Bug 5)

**Add to DepotNode.tsx:**
```tsx
import { useFileTreeStore } from '@/stores/fileTreeStore';

const handleClick = (node: DepotNodeData) => {
  if (!node.isFolder) {
    // Update shared selection state
    useFileTreeStore.getState().setSelectedFile({
      depotPath: node.id,
      localPath: '', // Depot files don't have local paths
      // ... other P4File fields
    });

    // Then navigate to detail view
    drillToFile(node.id, '');
  }
};
```

### Example 5: Fix Client Spec Parsing (Bug 6)

**Before (Rust - p4.rs):**
```rust
let root = fields.get("Root").ok_or("Missing Root field")?.clone();
```

**After:**
```rust
// Case-insensitive lookup
let root = fields.get("Root")
    .or_else(|| fields.get("root"))
    .ok_or("Missing Root field")?
    .clone();

// Or make it optional:
let root = fields.get("Root")
    .or_else(|| fields.get("root"))
    .cloned()
    .unwrap_or_else(|| "".to_string());
```

### Example 6: Fix Accordion Header Visibility (Bug 11)

**Before (MainLayout.tsx):**
```tsx
<CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2 bg-secondary/50 cursor-pointer select-none">
  <span className="text-lg font-semibold">Workspace Files</span>
  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", workspaceOpen && "rotate-180")} />
</CollapsibleTrigger>
```

**After:**
```tsx
<CollapsibleTrigger className="sticky top-0 z-10 flex items-center justify-between w-full px-4 py-2 bg-secondary/50 cursor-pointer select-none">
  <span className="text-lg font-semibold">Workspace Files</span>
  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", workspaceOpen && "rotate-180")} />
</CollapsibleTrigger>
```

## State of the Art

This phase addresses technical debt and regressions, not new features. Current state:

| Area | Current State | Fix Needed |
|------|--------------|------------|
| Query invalidation | Fire-and-forget promises | Add await, refetchType |
| File selection | Panel-specific state | Shared Zustand store |
| Operation tracking | Partial coverage | Audit all async ops |
| Accordion layout | Flex shrinkage issues | Sticky headers or flex-shrink-0 |
| Parser robustness | Case-sensitive fields | Case-insensitive lookups |

## Open Questions

1. **Bug 3 (CL shows 0 files):** Need to verify if this is about pending or submitted CLs. The submitted CL path looks correct, so might be a data mapping issue in `useChangelists` hook.

2. **Bug 12 (Default CL file move):** Code shows this is already implemented. Is the bug report outdated, or is there a specific scenario where it fails? Need to test.

3. **Depot loading performance:** Bug 9 mentions "requires double-click" - is this about the loading indicator, or is there also a UX issue with single-click not loading? Need clarification.

4. **Settings dialog scrollability:** Need to verify which Radix Dialog version is in use and whether it has built-in scroll support or if we need custom implementation.

## Sources

### Primary (HIGH confidence)
- Codebase investigation: All files listed in bug findings
- TODO files: `.planning/todos/pending/2026-02-03-*.md`
- Roadmap: `.planning/ROADMAP.md` Phase 20 success criteria

### Secondary (MEDIUM confidence)
- React Query best practices: Based on TanStack Query v5 documentation patterns
- Zustand patterns: Based on existing store implementations in codebase
- Radix UI Dialog: Based on component usage in SettingsDialog.tsx

### Tertiary (LOW confidence)
- None - all findings based on direct code inspection

## Metadata

**Confidence breakdown:**
- Bug root causes: HIGH - Direct code inspection reveals clear issues
- Fix approaches: HIGH - Standard patterns, low complexity
- Risk assessment: HIGH - Most fixes are isolated and low-risk

**Research date:** 2026-02-03
**Valid until:** 30 days (bug fixes, not rapidly changing domain)

---

## Fix Priority Recommendation

Based on dependencies and risk:

**Tier 1 (Fix first - foundational):**
1. Bug 1: Connection dialog (blocks good UX on startup)
2. Bug 4: Depot disappearing (breaks core feature)
3. Bug 7: Toolbar order (trivial, high visibility)

**Tier 2 (Fix second - operation feedback):**
4. Bug 2: Shelve/unshelve UI update (breaks user trust)
5. Bug 3: CL file count (data integrity issue)
6. Bug 8: Unified loading (UX consistency)

**Tier 3 (Fix third - polish):**
7. Bug 5: File selection toolbar update (UX polish)
8. Bug 6: Client spec parsing (edge case)
9. Bug 9: Depot loading progress (specific to bug 8)
10. Bug 10: Settings scrollability (rare issue)
11. Bug 11: Accordion headers (layout polish)
12. Bug 12: Default CL move files (might already work)
