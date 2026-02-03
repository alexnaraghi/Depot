# Phase 18: Table Stakes UI Features - Research

**Researched:** 2026-02-03
**Domain:** Perforce workspace sync status visualization and submitted changelist file lists
**Confidence:** HIGH

## Summary

Phase 18 implements two critical UI features: workspace sync status overlays in the file tree and complete file lists for submitted changelists. The project has already made key architectural decisions documented in STATE.md:
- Use `p4 have` + `p4 files` instead of `p4 fstat` for sync status (10-100x faster)
- Use `p4 describe -s` to suppress diffs for submitted changelists (critical for large CLs)

Research validates these decisions and reveals the standard patterns for implementation. The existing codebase already has the foundational pieces: icon overlay pattern (used for conflict indicators), file tree aggregation via `buildFileTree()`, and action badge styling in ChangelistDetailView. The architecture uses react-arborist for virtualized tree rendering, Zustand for state management, and TanStack Query for data fetching with caching.

The main challenge is efficiently computing folder-level sync status without expanding folders, which requires traversing file data and bubbling up "out-of-date" status to parent folders during tree construction.

**Primary recommendation:** Extend the existing tree building pattern to compute and attach sync status metadata to folder nodes, add icon overlays using the established AlertTriangle pattern, and implement `p4 describe -s` backend command for submitted changelist file lists.

## Standard Stack

The codebase already uses the correct stack for these features. No new libraries needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-arborist | 3.4.3 | Tree view component | Already in use, supports virtualization, custom node rendering |
| lucide-react | 0.563.0 | Icon library | Already in use, provides overlay icons (AlertTriangle pattern exists) |
| zustand | 5.0.10 | State management | Already in use for file tree state, supports derived/computed state |
| @tanstack/react-query | 5.90.20 | Data fetching | Already in use, provides caching for expensive p4 operations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwind-merge | 3.4.0 | CSS class composition | Already in use for conditional styling (cn() utility) |
| class-variance-authority | 0.7.1 | Component variants | Already in use for badge variants (action indicators) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual folder status aggregation | Zustand computed middleware | Computed middleware adds complexity; manual aggregation during tree build is simpler and matches existing pattern |
| Separate sync status query | Combine with existing fstat | `p4 have` + `p4 files` is 10-100x faster per STATE.md research |

**Installation:**
No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
Current structure already correct:
```
src/
├── components/
│   ├── FileTree/           # File tree visualization
│   │   ├── FileTree.tsx    # Main tree component
│   │   ├── FileNode.tsx    # Node renderer with icon overlays
│   │   └── useFileTree.ts  # Data fetching hook
│   └── DetailPane/         # Detail views
│       ├── ChangelistDetailView.tsx  # Already has file list pattern
│       └── RevisionDetailView.tsx    # Has p4_describe TODO comment
├── utils/
│   └── treeBuilder.ts      # Tree construction logic
└── stores/
    └── fileTreeStore.ts    # File tree state management
src-tauri/src/commands/
└── p4.rs                   # Perforce command wrappers
```

### Pattern 1: Icon Overlay for Status Indicators
**What:** Position secondary status icon at corner of primary icon using absolute positioning
**When to use:** Showing additional state (conflicts, sync status) without replacing main icon
**Example:**
```typescript
// Source: src/components/FileTree/FileNode.tsx (lines 83-89)
// Existing conflict overlay pattern - REUSE THIS
<div className="relative flex-shrink-0">
  <File className="w-4 h-4 text-muted-foreground" />
  {/* Conflict overlay icon */}
  {isConflicted && (
    <AlertTriangle className="w-3 h-3 text-yellow-500 absolute -bottom-1 -right-1" />
  )}
</div>
```

**Pattern 2:** Add similar overlay for sync status on folders and files
```typescript
// Proposed pattern for sync status overlay
<div className="relative flex-shrink-0">
  {isFolder ? <Folder /> : <File />}
  {isOutOfDate && (
    <ArrowDown className="w-3 h-3 text-orange-500 absolute -bottom-1 -right-1" />
  )}
</div>
```

### Pattern 2: Folder Status Aggregation
**What:** Compute folder-level status by examining all descendant files during tree construction
**When to use:** Displaying aggregate state on folders without expanding to examine children
**Example:**
```typescript
// Extend FileTreeNode interface to include sync metadata
export interface FileTreeNode {
  id: string;
  name: string;
  isFolder: boolean;
  file?: P4File;
  children?: FileTreeNode[];
  // NEW: Sync status metadata for folders
  hasOutOfDateFiles?: boolean;  // Any descendant is out of date
  outOfDateCount?: number;       // Count of out-of-date files
}

// During tree construction (in buildFileTree):
// After adding all children, aggregate status upward
function aggregateFolderStatus(node: FileTreeNode): void {
  if (!node.isFolder || !node.children) return;

  // Recursively aggregate children first
  node.children.forEach(aggregateFolderStatus);

  // Bubble up status: folder is out-of-date if ANY child is
  node.hasOutOfDateFiles = node.children.some(child =>
    child.isFolder ? child.hasOutOfDateFiles :
    child.file?.status === FileStatus.OutOfDate
  );

  // Count for tooltip/badge display
  node.outOfDateCount = node.children.reduce((count, child) =>
    count + (child.isFolder ? (child.outOfDateCount || 0) :
    child.file?.status === FileStatus.OutOfDate ? 1 : 0), 0
  );
}
```

### Pattern 3: TanStack Query for Expensive Operations
**What:** Wrap expensive p4 commands in useQuery hooks with appropriate caching
**When to use:** Any operation that queries Perforce server (have, files, describe)
**Example:**
```typescript
// Source: Existing pattern in useFileTree.ts
export function useSyncStatus() {
  const { data: haveRevisions } = useQuery({
    queryKey: ['p4', 'have'],
    queryFn: async () => {
      const result = await invokeP4Have();
      return result;
    },
    staleTime: 30000,  // Fresh for 30s
    refetchOnWindowFocus: true,  // Refresh when user returns
  });

  // Combine with head revisions from p4 files
  const { data: headRevisions } = useQuery({
    queryKey: ['p4', 'files'],
    queryFn: async () => invokeP4Files('//...'),
    staleTime: 30000,
  });

  return { haveRevisions, headRevisions };
}
```

### Pattern 4: Action Badge Color Mapping
**What:** Consistent color scheme for file actions (add/edit/delete/integrate)
**When to use:** Displaying file actions in lists (already implemented for pending CLs)
**Example:**
```typescript
// Source: src/components/DetailPane/ChangelistDetailView.tsx (lines 81-99)
// REUSE THIS EXACT FUNCTION for submitted CL file lists
const getActionBadgeColor = (action?: FileAction): string => {
  switch (action) {
    case FileAction.Edit:
      return 'bg-blue-900/30 text-blue-300';
    case FileAction.Add:
      return 'bg-green-900/30 text-green-300';
    case FileAction.Delete:
      return 'bg-red-900/30 text-red-300';
    case FileAction.Branch:
      return 'bg-purple-900/30 text-purple-300';
    case FileAction.Integrate:
      return 'bg-yellow-900/30 text-yellow-300';
    case FileAction.MoveAdd:
    case FileAction.MoveDelete:
      return 'bg-orange-900/30 text-orange-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
};
```

### Anti-Patterns to Avoid
- **Using `p4 fstat` for sync status:** STATE.md research shows this is 10-100x slower than `p4 have` + `p4 files`. With 30,000 files, fstat blocks server operations.
- **Fetching p4 describe without -s flag:** Large submitted changelists will include full diffs, causing timeout and memory issues. Always use `-s` to suppress diffs.
- **Computing folder status on-demand:** React will re-compute on every render. Compute once during tree construction and store in node metadata.
- **Separate state for sync status:** Reuse existing FileTreeNode structure, extend with metadata rather than creating parallel state.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree status aggregation | Custom recursive component state | Compute during tree build in `buildFileTree()` | Tree already constructed recursively; aggregate in same pass. Avoid re-computation on every render. |
| Icon overlay positioning | Manual CSS calculations | Absolute positioning with `relative` parent | Existing pattern in FileNode.tsx for conflict overlays works perfectly. |
| Action badge styling | Custom color logic | Existing `getActionBadgeColor()` function | Already implemented and tested in ChangelistDetailView. Consistent colors across pending/submitted CLs. |
| P4 command output parsing | Custom string parsing | Existing `-ztag` parser pattern | Project already has `parse_ztag_records()` in Rust backend. Structured data is safer than regex. |

**Key insight:** The codebase already has 90% of the patterns needed. This phase is about applying existing patterns to new data sources (sync status, submitted CL files) rather than inventing new architectures.

## Common Pitfalls

### Pitfall 1: Performance Degradation with Large Workspaces
**What goes wrong:** Using `p4 fstat` for sync status on 30,000+ file workspaces causes 30+ second delays
**Why it happens:** `p4 fstat` scans the have list and verifies alignment with depot, even when only sync status is needed
**How to avoid:** Use `p4 have` (local operation, instant) + `p4 files` (server operation, but lightweight). Cross-reference the results to compute have-rev vs head-rev.
**Warning signs:** File tree takes >10 seconds to load, "Loading..." state persists, server appears unresponsive

**Source:** [Efficient scripting - Perforce documentation](https://help.perforce.com/helix-core/server-apps/p4sag/current/Content/P4SAG/performance.prevention.scripting.html)

### Pitfall 2: Memory Issues with Large Submitted Changelists
**What goes wrong:** Calling `p4 describe` without `-s` flag on CLs with hundreds of files causes timeout or out-of-memory errors
**Why it happens:** Default `p4 describe` includes full diffs for every file. A 500-file changelist with 100KB diffs each = 50MB of data the frontend doesn't need.
**How to avoid:** Always use `p4 describe -s` which excludes diffs and returns only metadata + file list. "Display a shortened output that excludes the diffs of the files."
**Warning signs:** describe command times out, frontend freezes during CL selection, browser tab crashes

**Source:** [p4 describe - Perforce Command Reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_describe.html)

### Pitfall 3: Incorrect Folder Status When Children Not Loaded
**What goes wrong:** Folder shows "synced" status even though it contains out-of-date files in unloaded subtree
**Why it happens:** React-arborist doesn't load children until folder is expanded. Status computed only on visible nodes.
**How to avoid:** Compute folder status from raw file data during tree construction, before react-arborist virtualization. Store status in node metadata, not component state.
**Warning signs:** Folder status changes when expanded, status doesn't match file list, inconsistent indicators across tree

### Pitfall 4: Stale Sync Status After Operations
**What goes wrong:** User syncs a file, but tree still shows orange "out of date" icon
**Why it happens:** TanStack Query cache isn't invalidated after sync operation
**How to avoid:** In sync operation handlers, invalidate the relevant query keys: `queryClient.invalidateQueries({ queryKey: ['p4', 'have'] })`. Follow pattern already used in other mutation handlers.
**Warning signs:** Icons don't update after sync, refresh button needed to see changes, status lags behind actual state

### Pitfall 5: Mixing Depot Paths and Local Paths
**What goes wrong:** `p4 have` returns depot paths, file tree uses local paths, comparison fails
**Why it happens:** Different p4 commands use different path formats. Need to normalize or maintain mapping.
**How to avoid:** Use depot path as the key (it's unique and canonical). Store mapping in FileTreeStore: `files: Map<string, P4File>` already uses depot path as key. Cross-reference by depot path, not local path.
**Warning signs:** Sync status always shows "unknown", can't match have-rev to files, empty status overlays

## Code Examples

Verified patterns from codebase and Perforce documentation:

### p4 have Command Output Parsing
```rust
// Source: Perforce documentation - p4 have returns depot paths with revisions
// Expected output format:
// //depot/path/to/file.cpp#5 - /home/user/workspace/path/to/file.cpp

// Backend command (new - needs implementation)
#[tauri::command]
pub async fn p4_have(
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<HashMap<String, i32>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.arg("have");

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 have: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse output: //depot/path#rev - /local/path
    let mut have_map = HashMap::new();
    for line in stdout.lines() {
        if let Some((path_rev, _local)) = line.split_once(" - ") {
            if let Some((depot_path, rev_str)) = path_rev.rsplit_once('#') {
                if let Ok(revision) = rev_str.parse::<i32>() {
                    have_map.insert(depot_path.to_string(), revision);
                }
            }
        }
    }

    Ok(have_map)
}
```

### p4 describe -s for Submitted Changelists
```rust
// Source: src-tauri/src/commands/p4.rs - extend with new command
// Use -ztag for structured parsing, -s to suppress diffs

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct P4DescribeFile {
    pub depot_path: String,
    pub revision: i32,
    pub action: String,  // add, edit, delete, integrate, branch
    pub file_type: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct P4ChangelistDescription {
    pub id: i32,
    pub user: String,
    pub client: String,
    pub time: i64,
    pub description: String,
    pub files: Vec<P4DescribeFile>,
}

#[tauri::command]
pub async fn p4_describe(
    changelist_id: i32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<P4ChangelistDescription, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["-ztag", "describe", "-s", &changelist_id.to_string()]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 describe: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_describe_output(&stdout)
}

// Parse -ztag describe output using existing parse_ztag_records pattern
fn parse_describe_output(output: &str) -> Result<P4ChangelistDescription, String> {
    let records = parse_ztag_records(output);
    // ztag describe returns one record with fields:
    // change, user, client, time, desc
    // depotFile0, rev0, action0, type0
    // depotFile1, rev1, action1, type1
    // ... (numbered fields for each file)

    // Implementation follows existing parse_ztag_* pattern
    // Build P4ChangelistDescription from fields
    // Extract numbered file fields and build P4DescribeFile array
}
```

### Sync Status Computation Hook
```typescript
// Source: Combine patterns from useFileTree.ts and existing TanStack Query usage
// Frontend hook to compute sync status from p4 have + p4 files

import { useQuery } from '@tanstack/react-query';
import { useConnectionStore } from '@/stores/connectionStore';

export function useSyncStatus() {
  const { p4port, p4user, p4client } = useConnectionStore();

  // Get have revisions (what's in workspace)
  const { data: haveMap } = useQuery({
    queryKey: ['p4', 'have', p4port, p4user, p4client],
    queryFn: async () => {
      // Returns Map<depotPath, haveRev>
      return await invokeP4Have();
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  // Head revisions already available in existing file tree data
  // P4FileInfo has both haveRev and headRev
  // Sync status = (haveRev < headRev) ? outOfDate : synced

  return { haveMap };
}
```

### Extending Tree Builder for Sync Status
```typescript
// Source: src/utils/treeBuilder.ts - extend existing pattern
// Add sync status aggregation to buildFileTree function

export interface FileTreeNode {
  id: string;
  name: string;
  isFolder: boolean;
  file?: P4File;
  children?: FileTreeNode[];
  // NEW: Sync status metadata
  hasOutOfDateFiles?: boolean;
  outOfDateCount?: number;
}

export function buildFileTree(
  files: P4File[],
  rootPath: string
): FileTreeNode[] {
  // ... existing tree construction logic ...

  // After building tree structure, aggregate sync status
  function aggregateSyncStatus(node: FileTreeNode): void {
    if (!node.isFolder || !node.children || node.children.length === 0) {
      return;
    }

    // Recursively process children first (bottom-up)
    node.children.forEach(aggregateSyncStatus);

    // Aggregate: folder has out-of-date files if any descendant does
    node.hasOutOfDateFiles = node.children.some(child => {
      if (child.isFolder) {
        return child.hasOutOfDateFiles || false;
      } else {
        return child.file?.status === FileStatus.OutOfDate;
      }
    });

    // Count for display (optional)
    node.outOfDateCount = node.children.reduce((count, child) => {
      if (child.isFolder) {
        return count + (child.outOfDateCount || 0);
      } else {
        return count + (child.file?.status === FileStatus.OutOfDate ? 1 : 0);
      }
    }, 0);
  }

  // Apply aggregation to all top-level nodes
  const tree = /* existing tree construction result */;
  tree.forEach(aggregateSyncStatus);

  return tree;
}
```

### Icon Overlay in FileNode
```typescript
// Source: src/components/FileTree/FileNode.tsx - extend existing pattern

export function FileNode({ node, style, dragHandle }: NodeRendererProps<FileNodeData>) {
  const { name, isFolder, file, hasOutOfDateFiles, outOfDateCount } = node.data;

  // Determine if out-of-date icon should show
  const showOutOfDate = isFolder
    ? hasOutOfDateFiles  // Folder: show if any descendant is out of date
    : file?.status === FileStatus.OutOfDate;  // File: show if this file is out of date

  return (
    <div className="flex items-center gap-2">
      {/* Icon with overlay */}
      <div className="relative flex-shrink-0">
        {isFolder ? (
          isOpen ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />
        ) : (
          <File className="w-4 h-4" />
        )}

        {/* Out-of-date overlay */}
        {showOutOfDate && (
          <ArrowDown className="w-3 h-3 text-orange-500 absolute -bottom-1 -right-1" />
        )}
      </div>

      {/* ... rest of node rendering ... */}

      {/* Optional: show count badge on folders */}
      {isFolder && outOfDateCount && outOfDateCount > 0 && (
        <Badge variant="outline" className="text-xs text-orange-500">
          {outOfDateCount}
        </Badge>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `p4 fstat` for all file queries | `p4 have` + `p4 files` for sync status | STATE.md research | 10-100x faster, eliminates blocking on large workspaces |
| `p4 describe` with diffs | `p4 describe -s` suppress diffs | Phase 18 decision | Prevents timeout/memory issues with large CLs |
| Manual file list in RevisionDetailView | Fetch from `p4 describe` | Phase 18 implementation | Removes TODO comment, provides complete sibling file list |
| Status computed in component state | Status computed during tree build | Phase 18 pattern | Avoids re-computation on every render, more efficient |

**Deprecated/outdated:**
- **RevisionDetailView TODO comment**: Lines 158-161 note "Sibling files not yet available (needs p4 describe backend)". This phase resolves that tech debt.
- **P4FileInfo fileSize field absence**: STATE.md notes "P4FileInfo struct doesn't include fileSize — parse p4 -ztag fstat directly in frontend hooks". Same pattern applies to describe: parse -ztag output for complete metadata.

## Open Questions

Things that couldn't be fully resolved:

1. **Should sync status update automatically on file system changes?**
   - What we know: TanStack Query supports polling and refetchInterval
   - What's unclear: How frequently to poll without impacting performance. P4 doesn't have file watchers.
   - Recommendation: Start with refetchOnWindowFocus (existing pattern), add manual refresh button, defer polling to future enhancement

2. **What icon to use for folder sync status overlay?**
   - What we know: ArrowDown (lucide-react) used for FileStatus.OutOfDate on files
   - What's unclear: Is same icon appropriate for folders, or should folders use different indicator?
   - Recommendation: Use same ArrowDown for consistency. If UX feedback suggests folder needs distinction, can use CloudOff or DownloadCloud

3. **Should out-of-date count be visible or tooltip-only?**
   - What we know: ChangelistDetailView shows file count in section header: "FILES (12)"
   - What's unclear: Does showing count badge clutter tree UI? Is tooltip sufficient?
   - Recommendation: Start without count badge (cleaner), rely on icon overlay. Can add count in tooltip or on hover if user feedback requests it

4. **Performance threshold for sync status refresh?**
   - What we know: `p4 have` is local (fast), `p4 files` queries server (variable speed)
   - What's unclear: At what workspace size does background refresh become too expensive?
   - Recommendation: Implement same staleTime pattern as existing queries (30s). Monitor performance with verbose logging. If issues arise, increase staleTime or make refresh opt-in.

## Sources

### Primary (HIGH confidence)
- [p4 describe - Perforce Command Reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_describe.html) - Official documentation for `-s` flag
- [Efficient scripting - Perforce documentation](https://help.perforce.com/helix-core/server-apps/p4sag/current/Content/P4SAG/performance.prevention.scripting.html) - Performance guidance for p4 commands
- Project codebase: src/components/FileTree/FileNode.tsx (icon overlay pattern), src/utils/treeBuilder.ts (tree construction), src/components/DetailPane/ChangelistDetailView.tsx (action badge pattern)

### Secondary (MEDIUM confidence)
- [React Arborist GitHub](https://github.com/brimdata/react-arborist) - Tree component documentation, custom rendering patterns
- [W3C ARIA Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) - Accessibility best practices for tree views
- STATE.md research notes - Prior performance analysis of p4 commands

### Tertiary (LOW confidence)
- WebSearch results on tree view icon overlay patterns - General UI/UX guidance, not specific to Perforce or this stack
- WebSearch results on zustand computed state - Tool unavailable, relied on existing knowledge

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, verified in package.json
- Architecture: HIGH - Patterns extracted directly from existing codebase
- Pitfalls: HIGH - Based on official Perforce documentation and STATE.md research
- Code examples: HIGH - Adapted from existing project patterns and official p4 command reference

**Research date:** 2026-02-03
**Valid until:** 60 days (stack is stable, Perforce commands are well-established)
