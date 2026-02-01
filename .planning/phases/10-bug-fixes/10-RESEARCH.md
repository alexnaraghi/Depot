# Phase 10: Bug Fixes - Research

**Researched:** 2026-01-31
**Domain:** React state management, drag-and-drop reliability, Perforce command workflows
**Confidence:** HIGH

## Summary

Phase 10 addresses five critical bugs affecting the reliability of existing features: drag-and-drop file movement between changelists, default changelist description editing behavior, unshelving to specific changelists, resolve dialog triggering after unshelve conflicts, and manual refresh functionality.

The core issues stem from three areas:
1. **React-arborist drag-and-drop** - potential race conditions between UI updates and backend operations
2. **Perforce command semantics** - missing `-c` flag for unshelve target changelist, and proper handling of files when editing default CL
3. **TanStack Query invalidation timing** - ensuring query cache invalidation happens at the right time to prevent stale UI

These are not library bugs but implementation gaps in how the app coordinates async operations with UI state. The standard stack (react-arborist 3.4.3, TanStack Query 5.x, react-dnd 14.x) is solid and well-suited for the fixes.

**Primary recommendation:** Use optimistic UI updates with proper rollback patterns, add missing Perforce command flags, implement query invalidation with refetchType: 'all' for manual refresh, and add conflict detection before triggering resolve dialog.

## Standard Stack

The existing stack is correct for this phase. No new libraries needed.

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-arborist | 3.4.3 | Virtualized tree with drag-and-drop | Industry standard for large tree views with 10,000+ nodes, built-in react-dnd integration |
| react-dnd | 14.0.5 | Drag-and-drop primitives | De facto standard for React DnD, used by react-arborist internally |
| @tanstack/react-query | 5.90.20 | Server state management | Best-in-class async state with invalidation patterns, 3x faster sync than Redux |
| zustand | 5.0.10 | UI state management | Lightweight, minimal re-renders, perfect complement to TanStack Query |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hot-toast | 2.6.0 | User feedback | Already used for operation success/error messages |
| Tauri invoke | 2.x | Rust backend commands | Already used for all P4 operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-arborist | dnd-kit + custom tree | Lower-level control but lose virtualization and tree logic |
| TanStack Query | SWR | Less powerful invalidation API, no built-in optimistic updates |
| Manual refresh button | Auto-refresh only | Users want manual control for immediate feedback |

**Installation:**
No new packages needed. All fixes use existing dependencies.

## Architecture Patterns

### Pattern 1: Optimistic UI with Rollback
**What:** Update UI immediately on drag, rollback if backend fails
**When to use:** Any operation that modifies server state (drag files, edit CL, unshelve)
**Example:**
```typescript
// Source: TanStack Query optimistic updates pattern
const handleMove: MoveHandler<ChangelistTreeNode> = useCallback(async ({ dragIds, parentId }) => {
  const queryClient = useQueryClient();

  // Cancel outgoing refetches (prevent race conditions)
  await queryClient.cancelQueries({ queryKey: ['p4', 'opened'] });

  // Snapshot previous value
  const previousOpened = queryClient.getQueryData(['p4', 'opened']);

  try {
    // Optimistically update UI
    queryClient.setQueryData(['p4', 'opened'], (old) => {
      // ... update logic
      return newData;
    });

    // Perform backend operation
    await invokeP4Reopen(filePaths, targetClId, ...);

    // On success, invalidate to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
    queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });
  } catch (error) {
    // Rollback on error
    queryClient.setQueryData(['p4', 'opened'], previousOpened);
    toast.error(`Failed to move files: ${error}`);
  }
}, [...]);
```

### Pattern 2: Conditional Backend Operations
**What:** Check current state before executing Perforce commands
**When to use:** Operations that depend on current file/CL state (default CL edit, unshelve target)
**Example:**
```typescript
// Source: Current EditDescriptionDialog pattern (needs enhancement)
const handleSubmit = async () => {
  if (changelist.id === 0) {
    // Special case: default CL creates numbered CL
    const newClId = await invokeP4CreateChange(description, ...);

    // NEW: Move files from default CL to new numbered CL
    const openedFiles = await invokeP4Opened(...);
    const defaultClFiles = openedFiles.filter(f => f.changelist === 0);
    if (defaultClFiles.length > 0) {
      await invokeP4Reopen(
        defaultClFiles.map(f => f.depot_path),
        newClId,
        ...
      );
    }
  } else {
    // Normal case: edit existing numbered CL
    await invokeP4EditChangeDescription(changelist.id, description, ...);
  }
};
```

### Pattern 3: Manual Refresh with Full Invalidation
**What:** Invalidate all relevant queries with immediate refetch
**When to use:** User-triggered refresh button
**Example:**
```typescript
// Source: TanStack Query invalidation documentation
const handleManualRefresh = useCallback(async () => {
  const queryClient = useQueryClient();

  // Invalidate with refetchType: 'all' to force refetch even if inactive
  await queryClient.invalidateQueries({
    queryKey: ['p4', 'opened'],
    refetchType: 'all'
  });
  await queryClient.invalidateQueries({
    queryKey: ['p4', 'changes'],
    refetchType: 'all'
  });
  await queryClient.invalidateQueries({
    queryKey: ['p4', 'shelved'],
    refetchType: 'all'
  });

  toast.success('Workspace refreshed');
}, []);
```

### Pattern 4: Perforce Command Flag Completion
**What:** Add missing flags to Perforce commands for correct behavior
**When to use:** Unshelve to specific changelist, detect conflicts
**Example:**
```rust
// Source: Perforce p4 unshelve documentation
// CURRENT (wrong - unshelves to source CL):
pub async fn p4_unshelve(
    changelist_id: i32,  // Source changelist with shelf
    file_paths: Option<Vec<String>>,
    ...
) -> Result<String, String> {
    let mut cmd = Command::new("p4");
    cmd.arg("unshelve");
    cmd.arg("-s");
    cmd.arg(changelist_id.to_string());
    cmd.arg("-c");
    cmd.arg(changelist_id.to_string());  // BUG: Always same as source
    // ...
}

// FIXED (correct - allows target CL):
pub async fn p4_unshelve(
    source_changelist_id: i32,      // Source CL with shelf
    target_changelist_id: i32,      // Target CL to unshelve into
    file_paths: Option<Vec<String>>,
    ...
) -> Result<String, String> {
    let mut cmd = Command::new("p4");
    cmd.arg("unshelve");
    cmd.arg("-s");
    cmd.arg(source_changelist_id.to_string());
    cmd.arg("-c");
    cmd.arg(target_changelist_id.to_string());  // FIXED: Use target
    // ...
}
```

### Anti-Patterns to Avoid
- **Invalidating queries without cancelling outgoing refetches:** Creates race conditions where old data overwrites optimistic updates
- **Not checking operation success before showing success toast:** User sees "success" but operation failed
- **Assuming drag-and-drop onMove is atomic:** Backend operation can fail after UI updates
- **Forgetting to invalidate related queries:** E.g., moving files invalidates both 'opened' and 'changes' queries

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async operation state tracking | Custom useState flags for loading/error/success | TanStack Query useMutation | Handles race conditions, retry logic, error boundaries automatically |
| Drag-and-drop conflict detection | Custom collision detection logic | react-arborist's disableDrop prop | Already handles tree hierarchy constraints |
| Query cache updates | Manual state management with useEffect | queryClient.setQueryData + invalidateQueries | Prevents stale closures, automatic dependency tracking |
| Conflict detection after unshelve | Parse P4 output strings for "resolve" keywords | Check for unresolved files via p4 resolve -n | Official Perforce way to detect pending resolves |

**Key insight:** React state + async operations = race conditions. TanStack Query's mutation patterns solve this with cancellation, optimistic updates, and rollback. Don't recreate these primitives.

## Common Pitfalls

### Pitfall 1: Drag-and-Drop Race Condition
**What goes wrong:** User drags file, UI updates immediately, backend fails, but UI shows old optimistic state
**Why it happens:** react-arborist's onMove handler fires before backend operation completes. If queries invalidate too early, fresh data overwrites the failed optimistic update.
**How to avoid:** Cancel outgoing queries before optimistic update, snapshot previous data, rollback on error
**Warning signs:** Files appear to move but snap back after a delay, or files "disappear" and reappear elsewhere

### Pitfall 2: Default CL Edit Doesn't Move Files
**What goes wrong:** User edits default CL description (creating numbered CL), but files stay in default CL
**Why it happens:** `p4 change -i` creates a new changelist but doesn't move files. Files must be explicitly reopened with `p4 reopen -c <newCL>`
**How to avoid:** After creating numbered CL from default, query opened files in default CL and reopen them to the new CL
**Warning signs:** User creates numbered CL but files don't move, requiring manual drag-and-drop

### Pitfall 3: Unshelve Always Goes to Source CL
**What goes wrong:** User unshelves from CL 123, expects files in current CL 456, but they go to CL 123
**Why it happens:** Current Rust code uses same changelist ID for both `-s` (source) and `-c` (target) flags
**How to avoid:** Separate source_changelist_id and target_changelist_id parameters, add UI for selecting target CL
**Warning signs:** Unshelved files always appear in the shelf's original CL, never in user's active CL

### Pitfall 4: No Resolve Dialog After Unshelve Conflicts
**What goes wrong:** Unshelve creates conflicts (files already open), but user sees success toast and no resolve prompt
**Why it happens:** Current code checks conflicts before unshelve but doesn't detect what Perforce actually flagged for resolve
**How to avoid:** After unshelve, run `p4 resolve -n` to list pending resolves, show dialog if any exist
**Warning signs:** Files show as opened but have merge conflicts that block submit, user doesn't know until submit fails

### Pitfall 5: Manual Refresh Button Doesn't Refetch
**What goes wrong:** User clicks refresh, sees "refreshed" toast, but UI data is stale
**Why it happens:** Query invalidation without `refetchType: 'all'` only marks queries as stale; inactive queries don't refetch
**How to avoid:** Use `refetchType: 'all'` to force immediate refetch of all queries regardless of status
**Warning signs:** Refresh button seems to do nothing, data updates only when user navigates or performs operation

## Code Examples

Verified patterns from official sources and current codebase:

### Drag-and-Drop with Optimistic Update
```typescript
// Source: Current ChangelistPanel.tsx + TanStack Query patterns
const handleMove: MoveHandler<ChangelistTreeNode> = useCallback(async ({ dragIds, parentId }) => {
  if (!parentId) return;

  const targetClId = parseInt(parentId, 10);
  if (isNaN(targetClId)) return;

  const filePaths = dragIds.map(id => id.split('-').slice(1).join('-'));
  if (filePaths.length === 0) return;

  // Cancel outgoing refetches to prevent race conditions
  await queryClient.cancelQueries({ queryKey: ['p4', 'opened'] });
  await queryClient.cancelQueries({ queryKey: ['p4', 'changes'] });

  // Snapshot current data for rollback
  const previousOpened = queryClient.getQueryData(['p4', 'opened']);
  const previousChanges = queryClient.getQueryData(['p4', 'changes']);

  try {
    // Log operation start
    addOutputLine(`p4 reopen -c ${targetClId} ${filePaths.join(' ')}`, false);

    // Execute backend operation
    const result = await invokeP4Reopen(
      filePaths,
      targetClId,
      p4port ?? undefined,
      p4user ?? undefined,
      p4client ?? undefined
    );

    addOutputLine(result.join('\n'), false);
    toast.success(`Moved ${filePaths.length} file(s) to changelist ${targetClId}`);

    // Invalidate queries to refetch fresh data
    queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
    queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });
  } catch (error) {
    // Rollback optimistic update
    queryClient.setQueryData(['p4', 'opened'], previousOpened);
    queryClient.setQueryData(['p4', 'changes'], previousChanges);

    addOutputLine(`Error: ${error}`, true);
    toast.error(`Failed to move files: ${error}`);
  }
}, [p4port, p4user, p4client, queryClient, addOutputLine]);
```

### Edit Default CL with File Movement
```typescript
// Source: Current EditDescriptionDialog.tsx (enhanced)
const handleSubmit = async () => {
  if (!changelist || !description.trim()) return;

  setIsSubmitting(true);
  try {
    if (changelist.id === 0) {
      // Create numbered CL from default
      addOutputLine('p4 change -o (new changelist)', false);
      const newClId = await invokeP4CreateChange(
        description,
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );
      addOutputLine(`Change ${newClId} created.`, false);

      // NEW: Move all files from default CL to new CL
      const openedFiles = await invokeP4Opened(
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );
      const defaultClFiles = openedFiles.filter(f => f.changelist === 0);

      if (defaultClFiles.length > 0) {
        addOutputLine(`p4 reopen -c ${newClId} (${defaultClFiles.length} files)`, false);
        await invokeP4Reopen(
          defaultClFiles.map(f => f.depot_path),
          newClId,
          p4port ?? undefined,
          p4user ?? undefined,
          p4client ?? undefined
        );
        addOutputLine(`Moved ${defaultClFiles.length} files to changelist ${newClId}`, false);
      }

      toast.success(`Created changelist #${newClId} with ${defaultClFiles.length} files`);
    } else {
      // Edit existing numbered CL
      addOutputLine(`p4 change -i (edit changelist ${changelist.id})`, false);
      await invokeP4EditChangeDescription(
        changelist.id,
        description,
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );
      addOutputLine(`Change ${changelist.id} updated.`, false);
      toast.success(`Updated changelist #${changelist.id}`);
    }

    queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
    queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });
    onOpenChange(false);
  } catch (error) {
    addOutputLine(`Error: ${error}`, true);
    toast.error(`Failed to update changelist: ${error}`);
  } finally {
    setIsSubmitting(false);
  }
};
```

### Unshelve with Target Changelist
```rust
// Source: Perforce p4 unshelve documentation
#[tauri::command]
pub async fn p4_unshelve(
    source_changelist_id: i32,      // CL with shelved files
    target_changelist_id: i32,      // CL to unshelve into
    file_paths: Option<Vec<String>>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<String, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("unshelve");
    cmd.arg("-s");
    cmd.arg(source_changelist_id.to_string());
    cmd.arg("-c");
    cmd.arg(target_changelist_id.to_string());  // Target can differ from source

    if let Some(paths) = file_paths {
        for path in paths {
            cmd.arg(path);
        }
    }

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute p4 unshelve: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Combine stdout and stderr for conflict info
    let mut result = stdout.to_string();
    if !stderr.is_empty() {
        result.push_str("\n");
        result.push_str(&stderr);
    }

    if !output.status.success() {
        return Err(result);
    }

    Ok(result)
}
```

### Detect Conflicts After Unshelve
```typescript
// Source: Perforce resolve workflow patterns
const handleUnshelve = async (sourceClId: number, targetClId: number) => {
  try {
    // Unshelve files
    const result = await invokeP4Unshelve(
      sourceClId,
      targetClId,
      filePaths,
      p4port ?? undefined,
      p4user ?? undefined,
      p4client ?? undefined
    );

    addOutputLine(result, false);

    // Check for pending resolves
    const resolveCheck = await invokeP4ResolvePreview(
      p4port ?? undefined,
      p4user ?? undefined,
      p4client ?? undefined
    );

    if (resolveCheck.length > 0) {
      // Show resolve dialog
      setResolveDialog({
        files: resolveCheck,
        source: 'unshelve',
      });
    } else {
      toast.success('Unshelved files successfully');
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['p4', 'shelved'] });
    queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });
    queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
  } catch (error) {
    addOutputLine(`Error: ${error}`, true);
    toast.error(`Failed to unshelve: ${error}`);
  }
};
```

### Manual Refresh Button
```typescript
// Source: TanStack Query invalidation documentation
const handleManualRefresh = useCallback(async () => {
  const queryClient = useQueryClient();

  try {
    // Show loading state
    setIsRefreshing(true);

    // Invalidate all workspace queries with immediate refetch
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['p4', 'opened'],
        refetchType: 'all'  // Force refetch even if inactive
      }),
      queryClient.invalidateQueries({
        queryKey: ['p4', 'changes'],
        refetchType: 'all'
      }),
      queryClient.invalidateQueries({
        queryKey: ['p4', 'shelved'],
        refetchType: 'all'
      }),
    ]);

    toast.success('Workspace refreshed');
  } catch (error) {
    toast.error(`Refresh failed: ${error}`);
  } finally {
    setIsRefreshing(false);
  }
}, []);

// In toolbar component:
<Button
  onClick={handleManualRefresh}
  disabled={isRefreshing}
  title="Refresh workspace state"
>
  <RefreshCw className={isRefreshing ? 'animate-spin' : ''} />
  Refresh
</Button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Invalidate queries after every mutation | Cancel queries + optimistic update + invalidate | TanStack Query v4+ (2022) | Eliminates race conditions, instant UI feedback |
| Single `p4 unshelve -s CL` command | Separate source and target with `-s SRC -c TGT` | Perforce 2014+ | Enables unshelving to different changelist than source |
| Manual query refetch on button click | `invalidateQueries({ refetchType: 'all' })` | TanStack Query v5+ (2024) | Forces immediate refetch regardless of query status |
| Parse P4 text output for conflicts | Use `p4 resolve -n` for structured conflict list | Always available | More reliable than regex parsing stderr |

**Deprecated/outdated:**
- **Direct `queryClient.refetchQueries()`**: Use `invalidateQueries` instead, which marks stale and refetches
- **Assuming drag onMove is synchronous**: React 19 + concurrent features make this unreliable, always use async patterns
- **Toast on operation start**: Show toast on success/error only, prevents confusing "syncing..." messages that never clear

## Open Questions

Things that couldn't be fully resolved:

1. **Should unshelve target CL default to current/default or source CL?**
   - What we know: Perforce's default is source CL when `-c` omitted
   - What's unclear: User expectation - do they want files in their active CL or the shelf's original CL?
   - Recommendation: Add UI selector (dropdown) to let user choose target CL, default to source CL to match Perforce behavior

2. **How to handle resolve dialog when external merge tool is not configured?**
   - What we know: Phase 15 implements full resolve workflow with external tool
   - What's unclear: Should Phase 10 show a "configure merge tool first" message or just list conflicts?
   - Recommendation: Show conflict list dialog with "Configure Merge Tool" button, don't block user

3. **Should manual refresh invalidate search results queries too?**
   - What we know: Search results cache submitted changelists separately
   - What's unclear: Does "refresh workspace" mean workspace state only, or all P4 data?
   - Recommendation: Refresh workspace state only (opened, changes, shelved), not search history

## Sources

### Primary (HIGH confidence)
- TanStack Query v5 Official Docs - Query Invalidation: https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation
- TanStack Query v4 Official Docs - Optimistic Updates: https://tanstack.com/query/v4/docs/react/guides/optimistic-updates
- Perforce Official Docs - p4 unshelve: https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_unshelve.html
- Perforce Official Docs - p4 shelve: https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_shelve.html
- Perforce Help Guide - Merging to resolve conflicts: https://help.perforce.com/helix-core/server-apps/p4guide/2024.2/Content/P4Guide/merging-to-resolve-conflicts.html
- Current codebase - src/components/ChangelistPanel/ChangelistPanel.tsx
- Current codebase - src/components/ChangelistPanel/EditDescriptionDialog.tsx
- Current codebase - src/hooks/useShelvedFiles.ts
- Current codebase - src-tauri/src/commands/p4.rs

### Secondary (MEDIUM confidence)
- TkDodo's Blog - Automatic Query Invalidation after Mutations: https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations
- React Query Cache Invalidation (Stackademic): https://blog.stackademic.com/react-query-cache-invalidation-why-your-mutations-work-but-your-ui-doesnt-update-a1ad23bc7ef1
- CoreUI - How to invalidate queries in React Query: https://coreui.io/answers/how-to-invalidate-queries-in-react-query/
- Codemzy - Force refetch with React Query: https://www.codemzy.com/blog/react-query-force-refetch
- Puck - Top 5 Drag-and-Drop Libraries for React in 2026: https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react
- Growin - React Performance Optimization 2025: https://www.growin.com/blog/react-performance-optimization-2025/

### Tertiary (LOW confidence)
- GitHub issues - react-arborist drag and drop: https://github.com/brimdata/react-arborist/issues/168, https://github.com/brimdata/react-arborist/issues/191
- TanStack Query GitHub Discussion #6333 - Optimistic Update method in v5: https://github.com/TanStack/query/discussions/6333

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries in current use, versions verified in package.json
- Architecture patterns: HIGH - patterns sourced from official TanStack Query and Perforce documentation
- Pitfalls: HIGH - derived from current codebase analysis and official docs on race conditions

**Research date:** 2026-01-31
**Valid until:** 2026-03-31 (60 days - stable libraries, slow-moving Perforce commands)
