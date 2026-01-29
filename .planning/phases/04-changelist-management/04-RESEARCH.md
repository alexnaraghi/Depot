# Phase 04: Changelist Management - Research

**Researched:** 2026-01-29
**Domain:** React tree UI components, Perforce changelist operations, drag-and-drop interactions
**Confidence:** HIGH

## Summary

Phase 04 implements a full-featured changelist management UI using react-arborist for tree visualization with drag-and-drop, Perforce P4 commands for changelist CRUD operations, and either Radix UI Context Menu (new) or custom context menus (existing pattern) for file actions. The research confirms that all required functionality is well-supported by the existing tech stack.

React-arborist (already in package.json at v3.4.3) provides robust accordion-style tree display, multi-select, and drag-and-drop with validation hooks. Perforce commands (`p4 change`, `p4 reopen`) handle all changelist CRUD and file movement operations. The app already has established patterns for custom context menus (FileContextMenu) that can be extended, or Radix UI Context Menu can be added as a more accessible alternative.

**Primary recommendation:** Continue using react-arborist with accordion-style layout, use `p4 change -i/-o` for changelist CRUD, `p4 reopen -c` for file movement, and extend the existing custom context menu pattern for consistency with v1.0.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-arborist | 3.4.3 | Tree UI with drag-and-drop | Already in project, actively maintained, virtualized performance, built-in multi-select and DnD |
| Perforce P4 CLI | current | Changelist operations | Native CLI is the official API, no wrapper libraries needed |
| Radix UI Collapsible | 1.1.12 | Accordion sections | Already in project (though not used in current changelist implementation) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-context-menu | latest (2.x) | Accessible context menus | If replacing custom context menu for better accessibility |
| lucide-react | 0.563.0 | Icons for actions | Already in project, consistent with v1.0 |
| react-hot-toast | 2.6.0 | User feedback | Already in project for operation feedback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-arborist | react-complex-tree | More opinionated styling, similar features but would require migration |
| Custom context menu | Radix UI Context Menu | Radix provides better accessibility and keyboard nav, but custom menu already works and is styled consistently |
| P4 CLI commands | p4api.net or p4python | Wrappers add complexity, CLI is universal and already implemented |

**Installation:**
```bash
# Only if replacing custom context menu with Radix UI
npm install @radix-ui/react-context-menu
```

## Architecture Patterns

### Recommended Project Structure
```
src/components/ChangelistPanel/
├── ChangelistPanel.tsx      # Main panel with Tree component
├── ChangelistNode.tsx        # Node renderer (changelist headers + file rows)
├── ChangelistContext.tsx     # Context menu component (new)
├── CreateChangelistDialog.tsx # Dialog for creating new CLs (new)
├── EditDescriptionDialog.tsx  # Dialog for editing CL descriptions (new)
├── SubmitDialog.tsx          # Existing submit dialog
└── useChangelists.ts         # Data fetching hook (existing)

src-tauri/src/commands/
└── p4.rs                     # Add p4_create_change, p4_delete_change, p4_reopen
```

### Pattern 1: Accordion-Style Tree with react-arborist
**What:** Use Tree component with accordion behavior where changelist headers are collapsible sections
**When to use:** For hierarchical data with parent-child relationships (changelists contain files)
**Example:**
```typescript
// Source: Existing ChangelistPanel.tsx pattern + react-arborist docs
<Tree<ChangelistTreeNode>
  data={treeData}
  width="100%"
  height={400}
  indent={16}
  rowHeight={32}
  openByDefault={true}  // Expand changelists by default
  disableDrag={(node) => node.data.type === 'changelist'}  // Only files draggable
  disableDrop={({ parentNode }) => parentNode.data.type === 'file'}  // Only drop on CL headers
  onMove={handleMove}  // Triggered when files dropped on new changelist
>
  {({ node, style, dragHandle }) => (
    <ChangelistNode node={node} style={style} dragHandle={dragHandle} />
  )}
</Tree>
```

### Pattern 2: P4 Changelist Creation via Form I/O
**What:** Use `p4 change -o` to get template, modify, pipe to `p4 change -i`
**When to use:** Creating new numbered changelists with descriptions
**Example:**
```rust
// P4 changelist creation pattern
pub async fn p4_create_change(
    description: String,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<i32, String> {
    // Get changelist template
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["change", "-o"]);
    let output = cmd.output()?;
    let template = String::from_utf8_lossy(&output.stdout);

    // Modify description field
    let mut new_form = String::new();
    for line in template.lines() {
        if line.starts_with("Description:") {
            new_form.push_str("Description:\n");
            new_form.push_str(&format!("\t{}\n", description));
        } else if !line.starts_with('\t') || !in_description {
            new_form.push_str(line);
            new_form.push('\n');
        }
    }

    // Submit form via stdin
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["change", "-i"]);
    cmd.stdin(Stdio::piped());
    let mut child = cmd.spawn()?;
    child.stdin.take().unwrap().write_all(new_form.as_bytes())?;
    let result = child.wait_with_output()?;

    // Parse "Change 12345 created." output
    let changelist_number = parse_change_number(&result.stdout)?;
    Ok(changelist_number)
}
```

### Pattern 3: File Movement via P4 Reopen
**What:** Use `p4 reopen -c <target_cl>` to move already-opened files between changelists
**When to use:** Drag-and-drop file movement, context menu "Move to Changelist"
**Example:**
```rust
// Already partially implemented in p4_edit (which acts as reopen for opened files)
// Best practice: Add explicit p4_reopen command for clarity
pub async fn p4_reopen(
    depot_paths: Vec<String>,
    target_changelist: i32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<String>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.arg("reopen");
    cmd.args(["-c", &target_changelist.to_string()]);
    cmd.args(&depot_paths);

    let output = cmd.output()?;
    // Parse output to confirm which files moved
    let moved_files = parse_reopen_output(&output.stdout)?;
    Ok(moved_files)
}
```

### Pattern 4: Multi-Select with Ctrl/Shift
**What:** Use react-arborist's built-in multi-select with Tree API methods
**When to use:** Selecting multiple files for batch operations (move, revert, etc.)
**Example:**
```typescript
// Tree API provides selection methods automatically
// In node renderer, check node.isSelected for styling
<div className={cn(
  'flex items-center gap-2 px-2 py-1',
  node.isSelected && 'bg-blue-900/50'
)}>
  {/* file content */}
</div>

// In drag handler, dragIds array contains all selected node IDs
const handleMove: MoveHandler<ChangelistTreeNode> = async ({ dragIds, parentId }) => {
  // dragIds automatically includes all selected nodes
  const depotPaths = dragIds.map(id => extractDepotPath(id));
  await invokeP4Reopen(depotPaths, targetChangelist);
};
```

### Pattern 5: Context Menu with Submenu for "Move to Changelist"
**What:** Right-click file shows menu with submenu listing available changelists
**When to use:** Alternative to drag-and-drop for moving files
**Example:**
```typescript
// Custom context menu pattern (existing in project)
interface FileContextMenuProps {
  file: P4File;
  changelists: P4Changelist[];
  x: number;
  y: number;
  onClose: () => void;
}

export function FileContextMenu({ file, changelists, x, y, onClose }: FileContextMenuProps) {
  const [submenuOpen, setSubmenuOpen] = useState(false);

  return (
    <div className="fixed z-50 min-w-48 bg-slate-900 border" style={{ left: x, top: y }}>
      <button onMouseEnter={() => setSubmenuOpen(true)}>
        Move to Changelist ›
      </button>
      {submenuOpen && (
        <div className="absolute left-full top-0 ml-1">
          {changelists.map(cl => (
            <button key={cl.id} onClick={() => handleMove(file, cl.id)}>
              {cl.id === 0 ? 'Default' : `#${cl.id} — ${cl.description}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Using p4 edit for file movement:** While p4 edit acts as reopen for already-opened files, use explicit `p4 reopen` for clarity and intent
- **Deleting changelists with files:** P4 will reject this operation; UI should disable/hide delete button for non-empty changelists
- **Editing default changelist description inline:** This silently creates a new numbered changelist in P4; UI should explicitly prompt user that this creates a new CL
- **Manually managing tree expand/collapse state:** Let react-arborist handle this via `node.isOpen` and `node.toggle()` to avoid state sync issues

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree virtualization | Custom windowing logic for large trees | react-arborist (already has react-window built-in) | Handles variable row heights, scrolling, and 10k+ nodes efficiently |
| Multi-select state management | Manual tracking of Ctrl/Shift key combos | react-arborist Tree API (`selectedIds`, `selectMulti`, `selectContiguous`) | Handles platform differences (Cmd vs Ctrl), focus management, keyboard navigation |
| Drag-and-drop validation | Custom drop zone detection | react-arborist `disableDrop` callback | Receives parentNode, dragNodes, index for granular control |
| P4 form parsing | Custom parser for `p4 change -o` output | Existing update_changelist_description pattern in p4.rs | Already handles multiline descriptions, field ordering, tab indentation |
| Context menu positioning | Manual coordinate calculation for viewport bounds | Custom useContextMenu hook or Radix UI (handles viewport overflow) | Repositions menu if too close to edge, handles scrolling container |

**Key insight:** React-arborist handles the complex tree UI concerns (virtualization, selection, DnD) that would take weeks to implement correctly. P4 CLI commands are the official API and more reliable than parsing P4V's XML configs.

## Common Pitfalls

### Pitfall 1: Forgetting to Refresh After P4 Operations
**What goes wrong:** Drag-and-drop or delete succeeds on server, but UI still shows old state
**Why it happens:** P4 operations mutate server state; frontend cache is now stale
**How to avoid:** Invalidate TanStack Query cache after mutations
**Warning signs:** User performs action, toast shows success, but changelist panel unchanged
**Solution:**
```typescript
const queryClient = useQueryClient();
await invokeP4Reopen(files, targetCL);
toast.success('Files moved');
// Invalidate both changelists and opened files queries
queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });
```

### Pitfall 2: Deleting Default Changelist (CL 0)
**What goes wrong:** User tries to delete default CL, P4 rejects operation
**Why it happens:** Default changelist is special in P4 and cannot be deleted
**How to avoid:** Disable delete button/action for changelist with id === 0
**Warning signs:** Delete button visible on default CL, clicking shows error toast
**Solution:**
```typescript
// In changelist header renderer
const canDelete = changelist.id !== 0 && changelist.fileCount === 0;
<button disabled={!canDelete} onClick={handleDelete}>Delete</button>
```

### Pitfall 3: Race Condition in Drag-and-Drop with Slow P4
**What goes wrong:** User drags file, drop animation completes, but P4 command times out or fails - file appears to have moved but actually didn't
**Why it happens:** react-arborist `onMove` handler is async but tree updates optimistically
**How to avoid:** Show loading state during P4 operation, revert UI on error
**Warning signs:** Files "jump back" to original CL after appearing to move
**Solution:**
```typescript
const handleMove: MoveHandler = async ({ dragIds, parentId }) => {
  try {
    await invokeP4Reopen(files, targetCL);
    queryClient.invalidateQueries(['p4', 'opened']);
  } catch (error) {
    toast.error('Move failed: ' + error);
    // Query invalidation will refetch and show correct state
    queryClient.invalidateQueries(['p4', 'opened']);
  }
};
```

### Pitfall 4: Editing Default CL Description Silently Creates Numbered CL
**What goes wrong:** User edits description on default CL thinking they're just adding notes, but P4 creates a new numbered changelist and moves all files to it
**Why it happens:** This is core P4 behavior - default CL has no editable description field
**How to avoid:** Don't show "edit description" action for default CL, or show dialog explaining the behavior
**Warning signs:** User confused why CL number appeared after "editing" default
**Solution:**
```typescript
// In changelist header context menu
{changelist.id === 0 ? (
  <button onClick={() => setShowCreateFromDefaultDialog(true)}>
    Create Numbered Changelist
  </button>
) : (
  <button onClick={() => setShowEditDialog(true)}>
    Edit Description
  </button>
)}
```

### Pitfall 5: Node ID Collisions in Tree Data
**What goes wrong:** react-arborist throws errors about duplicate IDs, drag-and-drop breaks
**Why it happens:** Node IDs must be unique across entire tree, but file depot paths aren't unique across changelists if file is opened multiple times (impossible in P4, but data structure allows it)
**How to avoid:** Use composite ID: `${changelist.id}-${file.depotPath}` for file nodes
**Warning signs:** Console warnings about duplicate keys, DnD target detection fails
**Solution:**
```typescript
// In tree builder
function buildChangelistTree(changelists: P4Changelist[]): ChangelistTreeNode[] {
  return changelists.map(cl => ({
    id: String(cl.id),  // Changelist uses just ID
    name: cl.description,
    children: cl.files.map(file => ({
      id: `${cl.id}-${file.depotPath}`,  // Composite ID for uniqueness
      name: file.depotPath,
      data: file,
    })),
  }));
}
```

## Code Examples

Verified patterns from official sources and existing codebase:

### Creating a New Changelist
```typescript
// Frontend invocation
async function createChangelist(description: string) {
  const changelistId = await invokeP4CreateChange(description);
  toast.success(`Created changelist #${changelistId}`);
  queryClient.invalidateQueries(['p4', 'changes']);
}

// Rust command (new, follows existing p4_submit pattern)
#[tauri::command]
pub async fn p4_create_change(
    description: String,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<i32, String> {
    // Get template with: p4 change -o
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["change", "-o"]);
    let output = cmd.output()
        .map_err(|e| format!("Failed to get changelist template: {}", e))?;

    let template = String::from_utf8_lossy(&output.stdout);
    let modified_form = update_description_field(&template, &description);

    // Submit with: p4 change -i
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["change", "-i"]);
    cmd.stdin(Stdio::piped());

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn p4 change: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(modified_form.as_bytes())
            .map_err(|e| format!("Failed to write form: {}", e))?;
    }

    let result = child.wait_with_output()
        .map_err(|e| format!("Failed to create changelist: {}", e))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(stderr.to_string());
    }

    // Parse "Change 12345 created." output
    let stdout = String::from_utf8_lossy(&result.stdout);
    let changelist_id = stdout
        .lines()
        .find(|line| line.contains("Change") && line.contains("created"))
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|s| s.parse::<i32>().ok())
        .ok_or_else(|| "Failed to parse changelist number".to_string())?;

    Ok(changelist_id)
}
```

### Deleting an Empty Changelist
```typescript
// Frontend with validation
async function deleteChangelist(id: number, fileCount: number) {
  if (id === 0) {
    toast.error('Cannot delete default changelist');
    return;
  }
  if (fileCount > 0) {
    toast.error('Cannot delete changelist with files');
    return;
  }

  await invokeP4DeleteChange(id);
  toast.success(`Deleted changelist #${id}`);
  queryClient.invalidateQueries(['p4', 'changes']);
}

// Rust command
#[tauri::command]
pub async fn p4_delete_change(
    changelist: i32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<(), String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["change", "-d", &changelist.to_string()]);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute p4 change -d: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}
```

### Moving Files via Context Menu with Submenu
```typescript
// Custom context menu approach (consistent with existing FileContextMenu.tsx)
interface ChangelistContextMenuProps {
  file: P4File;
  changelists: P4Changelist[];
  x: number;
  y: number;
  onClose: () => void;
}

export function ChangelistContextMenu({ file, changelists, x, y, onClose }: ChangelistContextMenuProps) {
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  async function handleMoveToChangelist(targetId: number) {
    try {
      await invokeP4Reopen([file.depotPath], targetId);
      toast.success(`Moved to changelist ${targetId}`);
      onClose();
    } catch (error) {
      toast.error('Move failed: ' + error);
    }
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-48 bg-slate-900 border border-slate-700 rounded-md shadow-xl py-1"
      style={{ left: x, top: y }}
    >
      <div
        className="relative"
        onMouseEnter={() => setShowMoveSubmenu(true)}
        onMouseLeave={() => setShowMoveSubmenu(false)}
      >
        <button className="w-full px-4 py-2 text-left text-sm hover:bg-slate-800 flex items-center justify-between">
          <span>Move to Changelist</span>
          <span className="text-slate-400">›</span>
        </button>

        {showMoveSubmenu && (
          <div className="absolute left-full top-0 ml-1 min-w-64 bg-slate-900 border border-slate-700 rounded-md shadow-xl py-1">
            {changelists
              .filter(cl => cl.id !== file.changelist)  // Hide current CL
              .map(cl => (
                <button
                  key={cl.id}
                  onClick={() => handleMoveToChangelist(cl.id)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-800"
                >
                  {cl.id === 0 ? (
                    <span className="text-slate-300">Default</span>
                  ) : (
                    <span className="text-slate-200">
                      #{cl.id} — {cl.description || '(no description)'}
                    </span>
                  )}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual tree DOM manipulation | react-arborist with virtualization | 2023+ | Handles 10k+ nodes efficiently, built-in DnD |
| Custom drag libraries (react-dnd, dnd-kit) | react-arborist built-in DnD | 2023+ | Tree-aware validation, multi-select DnD automatic |
| p4api.net/.cpp wrappers | P4 CLI via subprocess | Current project | Simpler, no binary deps, works on all platforms |
| Polling for P4 state changes | TanStack Query with manual invalidation | Current project | Cache management, deduplication, loading states |

**Deprecated/outdated:**
- **react-sortable-tree:** Unmaintained since 2019, use react-arborist instead
- **P4V XML config parsing:** Fragile, use P4 CLI commands instead
- **Custom context menu libraries:** Modern approach is Radix UI or custom with useEffect cleanup

## Open Questions

1. **Context menu library choice**
   - What we know: Project already has custom FileContextMenu pattern, works well, styled consistently
   - What's unclear: Whether Radix UI Context Menu accessibility benefits justify migration
   - Recommendation: Keep custom menu pattern for consistency with v1.0; migrate to Radix in future Phase 07 (Context Menus) if time allows

2. **Changelist creation flow (inline vs dialog)**
   - What we know: Phase context says "Claude's discretion"
   - What's unclear: User preference for inline input (like GitHub issue creation) vs dialog (like v1.0 submit)
   - Recommendation: Use dialog for consistency with SubmitDialog and EditDescriptionDialog patterns

3. **Default CL description editing UX**
   - What we know: Editing default CL description in P4 creates new numbered CL
   - What's unclear: Should UI hide "edit" action, or show dialog explaining behavior?
   - Recommendation: Replace "Edit Description" with "Create Numbered Changelist" action for default CL, show dialog explaining that description will create a new CL

## Sources

### Primary (HIGH confidence)
- [react-arborist GitHub](https://github.com/brimdata/react-arborist) - API reference, drag-and-drop, multi-select
- [Perforce p4 change command reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_change.html) - Create/edit/delete changelist syntax
- [Perforce p4 reopen command reference](https://help.perforce.com/helix-core/server-apps/p4guide/current/Content/P4Guide/move-files-between-changelists.html) - Move files between changelists
- Project codebase (p4.rs, ChangelistPanel.tsx) - Existing patterns and implementations

### Secondary (MEDIUM confidence)
- [Building Interactive Tree Components with React-Arborist](https://blog.openreplay.com/interactive-tree-components-with-react-arborist/) - Usage patterns, best practices
- [Radix UI Context Menu docs](https://www.radix-ui.com/primitives/docs/components/context-menu) - Context menu API if migrating
- [Perforce Changelists Guide](https://legacy-docs.perforce.com/doc.051/manuals/p4guide/07_changelists.html) - Default CL behavior

### Tertiary (LOW confidence)
- Web search results for react-arborist pitfalls - Community issues, not official docs
- Web search results for P4 default CL behavior - Confirmed by official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-arborist already in use, P4 commands verified in official docs
- Architecture: HIGH - Existing codebase patterns established, P4 form I/O pattern exists in p4_submit
- Pitfalls: MEDIUM - Based on common issues in react-arborist GitHub issues and P4 behavior docs

**Research date:** 2026-01-29
**Valid until:** 60 days (stable libraries, mature P4 commands)
