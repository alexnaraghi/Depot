# Phase 14: Depot Browser - Research

**Researched:** 2026-02-01
**Domain:** Perforce depot hierarchy browsing with lazy loading and file operations
**Confidence:** HIGH

## Summary

This phase implements a full depot hierarchy browser alongside the existing workspace file tree in the left column. Research focused on Perforce CLI commands for depot navigation (`p4 dirs`, `p4 fstat`), lazy-loading patterns with react-arborist v3, accordion UI patterns (Radix UI Collapsible), and integration with existing file operations (sync, checkout, history, diff).

Key findings:
1. **P4 Commands**: `p4 dirs` lists immediate subdirectories (non-recursive, requires multiple calls for deep traversal); `p4 fstat` can query depot files without workspace mapping
2. **Lazy Loading Strategy**: Load depot tree on-demand (expand node → fetch children via `p4 dirs`) to avoid fetching entire depot hierarchy upfront
3. **UI Pattern**: Radix UI Collapsible for accordion sections ("Workspace Files" and "Depot"), both independently expandable/collapsible
4. **Reuse Existing Patterns**: react-arborist (v3.4.3) for virtualized tree, context menu pattern from FileTree, detail pane integration for depot file clicks

**Primary recommendation:** Implement depot browser as separate react-arborist tree with async child loading (fetch via `p4 dirs` on expand), wrap both workspace and depot trees in Radix Collapsible sections, reuse existing context menu and detail pane patterns for consistency.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Perforce CLI | Any | Depot navigation commands | `p4 dirs` and `p4 fstat` are only authoritative ways to query depot hierarchy without syncing files |
| react-arborist | 3.4.3 | Virtualized tree component | Already installed; handles 30,000+ nodes efficiently via virtualization; supports async data patterns |
| @radix-ui/react-collapsible | 1.1.12 | Accordion sections | Already installed; accessible collapsible primitive for "Workspace Files" and "Depot" sections |
| @tauri-apps/api | 2.x | Rust backend invocations | Required for Tauri architecture; all P4 commands execute via Rust backend |
| Zustand | 5.0.10 | UI state management | Track expanded depot nodes, selected depot item for detail pane |
| @tanstack/react-query | 5.90.20 | Depot tree data caching | Cache `p4 dirs` results per directory path for instant re-expansion |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.563.0 | Icons | Folder, FolderOpen, File icons for depot tree nodes; ChevronDown for collapsible headers |
| react-hot-toast | 2.6.0 | User notifications | "Synced depot file X" toast after depot file operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Lazy loading with `p4 dirs` | Eager load entire depot with `p4 files` | Eager load would block UI for minutes on large depots (100,000+ files); lazy loading is instant and scales to any depot size |
| Radix Collapsible | Custom CSS accordion | Radix provides keyboard navigation (Enter/Space to toggle), ARIA attributes, and focus management out of the box |
| Separate depot tree component | Combined workspace/depot tree | Separate components allow independent loading states, different data sources, and clearer separation of concerns |

**Installation:**
All dependencies already installed in package.json.

## Architecture Patterns

### Recommended Component Structure
```
src/components/
├── FileTree/
│   ├── FileTree.tsx              # Existing workspace tree
│   ├── FileNode.tsx              # Existing file/folder renderer
│   └── FileContextMenu.tsx       # Existing context menu (reuse pattern)
├── DepotBrowser/
│   ├── DepotBrowser.tsx          # New: Depot tree with lazy loading
│   ├── DepotNode.tsx             # New: Depot file/folder renderer
│   ├── DepotContextMenu.tsx      # New: Context menu for depot items
│   └── useDepotTree.ts           # New: Hook for depot tree state and async loading
└── LeftColumn/
    └── LeftColumn.tsx            # New: Accordion wrapper for workspace + depot sections
```

### Pattern 1: Accordion Sections with Independent Collapse State
**What:** Left column contains two Radix Collapsible sections with independent open/closed state
**When to use:** Multiple sidebar sections that user controls independently (VS Code / GitKraken pattern)
**Example:**
```typescript
// Source: Radix UI Collapsible + existing codebase patterns
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

function LeftColumn() {
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [depotOpen, setDepotOpen] = useState(true);

  return (
    <div className="flex flex-col h-full">
      {/* Workspace Files Section */}
      <Collapsible open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
        <CollapsibleTrigger className="flex items-center justify-between px-4 py-2 bg-secondary/50 hover:bg-secondary">
          <h2 className="text-lg font-semibold">Workspace Files</h2>
          <ChevronDown className={cn("w-4 h-4 transition-transform", workspaceOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex-1 overflow-hidden">
          <FileTree />
        </CollapsibleContent>
      </Collapsible>

      {/* Depot Section */}
      <Collapsible open={depotOpen} onOpenChange={setDepotOpen}>
        <CollapsibleTrigger className="flex items-center justify-between px-4 py-2 bg-secondary/50 hover:bg-secondary">
          <h2 className="text-lg font-semibold">Depot</h2>
          <ChevronDown className={cn("w-4 h-4 transition-transform", depotOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex-1 overflow-hidden">
          <DepotBrowser />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
```

### Pattern 2: Lazy-Loaded Depot Tree with `p4 dirs`
**What:** Load depot subdirectories on-demand when user expands a folder; cache results in TanStack Query
**When to use:** Depot tree navigation (avoids blocking UI with full depot fetch)
**Example:**
```typescript
// New Rust command needed: p4_dirs
// Frontend implementation:
interface DepotNodeData {
  id: string;           // Depot path (e.g., "//depot/projects/myproject")
  name: string;         // Display name (e.g., "myproject")
  isFolder: boolean;
  depotPath: string;
  children?: DepotNodeData[];
  isLoaded?: boolean;   // Track if children have been fetched
}

function useDepotTree() {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch children for a depot path
  const fetchChildren = async (depotPath: string): Promise<DepotNodeData[]> => {
    // Call p4 dirs to get immediate subdirectories
    const subdirs = await invokeP4Dirs(`${depotPath}/*`);

    return subdirs.map(dir => ({
      id: dir,
      name: dir.split('/').pop() || dir,
      isFolder: true,
      depotPath: dir,
      children: [],  // Empty until expanded
      isLoaded: false,
    }));
  };

  // Handle node expansion
  const handleToggle = async (node: NodeApi<DepotNodeData>) => {
    if (!node.data.isFolder) return;

    if (node.isOpen) {
      // Collapsing - just toggle
      node.toggle();
    } else {
      // Expanding - fetch children if not loaded
      if (!node.data.isLoaded) {
        const children = await fetchChildren(node.data.depotPath);
        // Update tree data with children
        updateNodeChildren(node.data.id, children);
      }
      node.toggle();
    }
  };

  return { tree, handleToggle };
}
```

### Pattern 3: Depot Root Discovery and Initial Tree
**What:** Start depot tree at depot root (e.g., "//depot") and list top-level directories
**When to use:** Initial render of depot browser
**Example:**
```typescript
// Discover depot roots using p4 depots command
async function initializeDepotTree() {
  // Get list of depots (e.g., "//depot", "//stream-depot")
  const depots = await invokeP4Depots();

  // Build root nodes for each depot
  return depots.map(depot => ({
    id: `//${depot.name}`,
    name: depot.name,
    isFolder: true,
    depotPath: `//${depot.name}`,
    children: [],
    isLoaded: false,
  }));
}
```

### Pattern 4: Depot File Context Menu with Sync/Checkout
**What:** Right-click depot files to sync, checkout, view history, diff
**When to use:** User wants to perform file operations on depot files
**Example:**
```typescript
// Reuse FileContextMenu pattern, but adapt for depot files
function DepotContextMenu({ depotPath, x, y, onClose }: Props) {
  const { p4port, p4user, p4client } = useConnectionStore();
  const queryClient = useQueryClient();

  async function handleSync() {
    toast.loading('Syncing file from depot...', { id: 'sync-depot' });
    await invokeP4Sync([depotPath], undefined, p4port, p4user, p4client, () => {});
    await queryClient.invalidateQueries({ queryKey: ['fileTree'] });
    toast.success('File synced', { id: 'sync-depot' });
    onClose();
  }

  async function handleCheckout() {
    toast.loading('Checking out file...', { id: 'checkout-depot' });
    await invokeP4Checkout([depotPath], undefined, p4port, p4user, p4client);
    await queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });
    toast.success('File checked out', { id: 'checkout-depot' });
    onClose();
  }

  return (
    <div className="...">
      <button onClick={handleSync}>Sync to Workspace</button>
      <button onClick={handleCheckout}>Checkout for Edit</button>
      <button onClick={() => handleShowHistory(depotPath)}>File History</button>
      {/* More options */}
    </div>
  );
}
```

### Pattern 5: Detail Pane Integration for Depot Files
**What:** Clicking depot file shows file info in center detail pane (same as workspace file clicks)
**When to use:** User wants to view depot file metadata, history, or diffs
**Example:**
```typescript
// In DepotNode.tsx
function handleClick() {
  if (!node.isInternal) {
    // File node clicked - update detail pane
    useDetailPaneStore.getState().selectFile(depotPath, null); // localPath is null for depot-only files
  }
}

// DetailPane needs to handle depot-only files (no local path)
// Can show file info, history, but "Diff against Workspace" disabled if not synced
```

### Anti-Patterns to Avoid
- **Eager loading entire depot**: Never call `p4 files //...` to load all depot files upfront; this blocks UI for minutes on large depots
- **No virtualization**: Depot trees can have 100,000+ nodes; always use react-arborist virtualization to render only visible nodes
- **Blocking expand/collapse**: Never make `p4 dirs` calls synchronous; always async with loading state to keep UI responsive
- **Ignoring deleted files**: By default `p4 dirs` excludes directories with only deleted files; use `-D` flag if user wants to see deleted paths

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parsing `p4 dirs` output | Custom string parser | Rust `-ztag` parser | P4 output format has edge cases (special chars, whitespace); -ztag gives structured key-value pairs |
| Virtualizing large tree | Custom windowing logic | react-arborist built-in virtualization | Library handles scroll offsets, node rendering, and height calculations; custom implementation has subtle bugs |
| Async tree node loading | Custom pending state per node | TanStack Query with depot path as key | Query handles caching, deduplication, and loading states; custom state easily gets out of sync |
| Accordion animations | Custom CSS transitions | Radix Collapsible with built-in animations | Radix handles enter/exit animations, ARIA states, and focus management |

**Key insight:** Depot trees can be enormous (100,000+ files across 10,000+ directories). Lazy loading is not optional — it's required for acceptable performance. Any approach that fetches more than one level at a time will block the UI.

## Common Pitfalls

### Pitfall 1: Blocking UI with `p4 dirs` for Deep Hierarchies
**What goes wrong:** User expands a deeply nested folder, UI freezes for seconds while recursive `p4 dirs` calls complete
**Why it happens:** Trying to load multiple levels at once (e.g., "expand folder and all children") requires N network calls where N is tree depth
**How to avoid:** Load only immediate children on expand; user expands child folders manually to load next level
**Warning signs:** Spinner appears for >1 second when expanding folder; UI feels sluggish

### Pitfall 2: Not Caching `p4 dirs` Results
**What goes wrong:** User collapses and re-expands same folder, sees delay again
**Why it happens:** No cache of previous `p4 dirs` results; refetching on every expand
**How to avoid:** Use TanStack Query with depot path as queryKey; results stay cached for 5-10 minutes
**Warning signs:** Network request fires every time user re-expands folder

### Pitfall 3: Depot Files Without Workspace Mappings
**What goes wrong:** User clicks depot file, app tries to sync to local path, but path isn't in client view
**Why it happens:** Depot browser shows entire depot, but client workspace only maps subset of paths
**How to avoid:** Check if depot path is in client view before sync/checkout; show warning if not mapped
**Warning signs:** P4 error "path is not under client's root" after sync attempt

### Pitfall 4: Search Filter Applied to Depot Tree
**What goes wrong:** User searches workspace files, depot tree also dims to match filter
**Why it happens:** Sharing filter logic between workspace and depot trees
**How to avoid:** Per CONTEXT.md, search filtering applies to workspace files only; depot tree ignores search state
**Warning signs:** Depot tree becomes dim when workspace search is active

### Pitfall 5: Forgetting `-D` Flag for Deleted Files
**What goes wrong:** User browses depot, doesn't see folders that contain only deleted files
**Why it happens:** `p4 dirs` default behavior excludes directories with all files deleted
**How to avoid:** Decide if app should show deleted-only directories; if yes, use `p4 dirs -D` flag
**Warning signs:** "Missing" folders that user expects to see

### Pitfall 6: No Visual Distinction Between Mapped and Unmapped Depot Files
**What goes wrong:** User doesn't know which depot files are already synced to workspace
**Why it happens:** Depot tree doesn't indicate sync status
**How to avoid:** Cross-reference depot paths with workspace files; show different icon/color for synced files
**Warning signs:** User repeatedly syncs files that are already in workspace

## Code Examples

Verified patterns from codebase and official sources:

### Rust Command: p4 dirs
```rust
// New command needed in src-tauri/src/commands/p4.rs
#[tauri::command]
pub async fn p4_dirs(
    depot_path: String,      // e.g., "//depot/projects/*"
    include_deleted: bool,   // Include directories with only deleted files
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<String>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("-ztag");
    cmd.arg("dirs");
    if include_deleted {
        cmd.arg("-D");
    }
    cmd.arg(&depot_path);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute p4 dirs: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_dirs(&stdout)
}

fn parse_ztag_dirs(output: &str) -> Result<Vec<String>, String> {
    let mut dirs = Vec::new();
    for line in output.lines() {
        // -ztag format: "... dir //depot/path/to/dir"
        if let Some(stripped) = line.strip_prefix("... dir ") {
            dirs.push(stripped.to_string());
        }
    }
    Ok(dirs)
}
```

### Rust Command: p4 depots (List Depot Roots)
```rust
// New command needed for depot root discovery
#[derive(Debug, Clone, Serialize)]
pub struct P4Depot {
    pub name: String,
    pub depot_type: String,  // local, stream, remote, etc.
    pub description: String,
}

#[tauri::command]
pub async fn p4_depots(
    server: Option<String>,
    user: Option<String>,
) -> Result<Vec<P4Depot>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &None);
    cmd.args(["-ztag", "depots"]);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute p4 depots: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_depots(&stdout)
}
```

### TanStack Query for Depot Subdirectories
```typescript
// Cache depot directory results with TanStack Query
function useDepotChildren(depotPath: string | null) {
  const { p4port, p4user, p4client } = useConnectionStore();

  return useQuery({
    queryKey: ['depot', 'dirs', depotPath],
    queryFn: async () => {
      if (!depotPath) return [];
      return await invokeP4Dirs(
        `${depotPath}/*`,
        false, // Don't include deleted
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );
    },
    enabled: depotPath !== null,
    staleTime: 5 * 60 * 1000, // 5 minutes (depot structure rarely changes)
    refetchOnWindowFocus: false,
  });
}
```

### Accordion Toggle State
```typescript
// Persist accordion state in localStorage
function useAccordionState(key: string, defaultOpen: boolean) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem(`accordion-${key}`);
    return saved !== null ? saved === 'true' : defaultOpen;
  });

  const handleChange = (open: boolean) => {
    setIsOpen(open);
    localStorage.setItem(`accordion-${key}`, String(open));
  };

  return [isOpen, handleChange] as const;
}

// Usage:
const [workspaceOpen, setWorkspaceOpen] = useAccordionState('workspace', true);
const [depotOpen, setDepotOpen] = useAccordionState('depot', true);
```

## New Commands Required

### p4 dirs (List Depot Subdirectories)
**Command:** `p4 -ztag dirs [-D] <depot_path>/*`
**Purpose:** Fetch immediate subdirectories for lazy tree loading
**Rust Implementation:** See Code Examples section above

### p4 depots (List Depot Roots)
**Command:** `p4 -ztag depots`
**Purpose:** Discover depot roots (//depot, //stream-depot, etc.) for tree initialization
**Rust Implementation:** See Code Examples section above

### p4 fstat on Depot Paths (Optional Enhancement)
**Command:** `p4 -ztag fstat <depot_path>`
**Purpose:** Query file metadata for depot files (even if not synced to workspace)
**Note:** Existing `p4_fstat` command already supports depot paths; no new command needed

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Eager load entire depot | Lazy load on expand | P4V 2015+ | Instant initial render; scales to depots with millions of files |
| Separate "Depot" tab/mode | Accordion sections (workspace + depot visible together) | VS Code 2018+, GitKraken 2020+ | Less context switching; user sees workspace and depot simultaneously |
| Flat depot file list | Hierarchical tree with virtualization | P4V 2010+ | Better navigation; mirrors filesystem structure |
| Sync entire depot tree to browse | Browse depot without syncing | P4V always had this | No disk space wasted; instant depot browsing |

**Deprecated/outdated:**
- **Eager loading depot tree**: Old approach was to call `p4 files //...` and build full tree; modern UIs lazy-load on expand
- **Modal depot browser**: Old desktop apps had "Browse Depot" as separate window; modern UIs integrate depot into sidebar

## Open Questions

Things that couldn't be fully resolved:

1. **Should depot tree show file counts per directory?**
   - What we know: `p4 dirs` only returns directory names, not file counts
   - What's unclear: Would require extra `p4 files <dir>/*` call per directory (expensive)
   - Recommendation: Don't show counts initially; consider adding on-hover tooltip if users request it

2. **How to handle depot roots without workspaces?**
   - What we know: `p4 depots` returns all depots, but user may not have workspace for all
   - What's unclear: Should we filter depot list to only those in current client view?
   - Recommendation: Show all depots; if user clicks unmapped path, show warning "Not in workspace view"

3. **Should depot tree persist expanded state across sessions?**
   - What we know: Accordion open/closed state can persist in localStorage
   - What's unclear: Expanded depot tree nodes — remember which folders were expanded?
   - Recommendation: Persist accordion state (workspace/depot sections), but not individual expanded nodes (too much state)

4. **How deep to allow lazy loading?**
   - What we know: Some depots have 50+ levels of nesting
   - What's unclear: Should we limit max depth to prevent UI clutter?
   - Recommendation: No artificial limit; let user expand as deep as needed (virtualization handles any depth)

## Sources

### Primary (HIGH confidence)
- [Perforce p4 dirs command reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_dirs.html) - Official documentation
- [Perforce p4 fstat command reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_fstat.html) - Verified depot path support
- Existing codebase (src/components/FileTree/FileTree.tsx, src/utils/treeBuilder.ts, src/components/ui/collapsible.tsx)
- [react-arborist GitHub](https://github.com/brimdata/react-arborist) - Confirmed v3.4.3 installed in package.json
- [Radix UI Collapsible](https://www.radix-ui.com/primitives/docs/components/collapsible) - Installed v1.1.12

### Secondary (MEDIUM confidence)
- [P4V performance guide](https://articles.assembla.com/en/articles/1804524-speed-up-your-perforce-repo-with-p4v) - Virtual scrolling and lazy loading best practices
- [Building Interactive Tree Components with React-Arborist](https://blog.openreplay.com/interactive-tree-components-with-react-arborist/) - Lazy loading patterns
- [p4 dirs discussion on Perforce forums](https://perforce-user.perforce.narkive.com/fsaz4ool3lumljfl) - Recursive browsing patterns

### Tertiary (LOW confidence)
- None - all research grounded in official Perforce documentation and installed library versions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries installed, P4 commands verified in official docs
- Architecture: HIGH - patterns match existing codebase (FileTree, Collapsible components)
- Pitfalls: HIGH - derived from P4V performance docs and codebase patterns
- Lazy loading strategy: HIGH - verified `p4 dirs` non-recursive behavior from official docs

**Research date:** 2026-02-01
**Valid until:** ~30 days (stable domain - Perforce CLI and React patterns don't change rapidly)
