# Phase 06: Shelve & Reconcile - Research

**Researched:** 2026-01-29
**Domain:** Perforce shelving/unshelving and workspace reconciliation workflows
**Confidence:** HIGH

## Summary

This phase implements Perforce shelving (temporary server-side storage of pending changes) and reconcile (detect offline workspace modifications). The research focused on P4 CLI commands for shelve/unshelve operations, conflict detection during unshelve, reconcile preview workflows, and UI patterns for displaying shelved files alongside pending files in changelists.

**Key findings:**
- `p4 shelve -c <cl>` stores pending files on server without submitting; files remain checked out in workspace
- `p4 unshelve -s <cl>` retrieves shelved files, creating unresolved conflicts if workspace files differ
- `p4 reconcile -n` previews offline changes (adds/edits/deletes) before opening files
- Shelved files queried via `p4 describe -S -ztag <cl>` for structured output
- Reconcile has no `-ztag` support; output must be parsed from human-readable format
- UI pattern: shelved files appear in separate collapsible section below pending files within same changelist

**Primary recommendation:** Use Tauri async commands wrapping `p4 shelve/unshelve/reconcile` with `-ztag` where available. Display shelved files in dedicated "Shelved Files" section within changelist tree nodes. Show reconcile preview in dialog with checkboxes for individual file selection before applying changes. Implement unshelve conflict warning using P4 file status checks before executing unshelve operation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri 2.0 | 2.x | Backend for P4 CLI commands | Existing project foundation; async commands for non-blocking operations |
| React 19 | 19.x | Frontend UI framework | Existing project foundation; concurrent features for responsive UI |
| TanStack Query | 5.x | Data fetching & caching | Existing; query invalidation pattern for refreshing shelved file state |
| react-arborist | 3.4.3 | Tree virtualization | Existing; ChangelistPanel already uses for changelist/file hierarchy |
| shadcn/ui + Radix | various | UI components | Existing; AlertDialog for reconcile preview, Collapsible for shelved sections |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | 7.71.1 | Form validation | Already in project; validate reconcile file selections if needed |
| zod | 4.3.6 | Schema validation | Already in project; validate P4 command outputs during parsing |
| lucide-react | 0.563.0 | Icons | Already in project; icons for shelve/unshelve actions in context menus |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate reconcile dialog | Inline preview panel | Dialog matches existing pattern (FileHistoryDialog, SubmitDialog); inline would complicate main layout |
| Auto-reconcile on launch | Manual button only | Context decisions mandate on-demand only; auto-reconcile can surprise users |
| Partial unshelve | All-or-nothing unshelve | Context decisions mandate all-or-nothing; simplifies conflict handling |

**Installation:**
No new dependencies required. All necessary libraries already installed in project.

## Architecture Patterns

### Recommended Project Structure
```
src-tauri/src/commands/
└── p4.rs                  # Add p4_shelve, p4_unshelve, p4_reconcile commands

src/
├── components/
│   ├── ChangelistPanel/
│   │   ├── ChangelistNode.tsx       # Extend to show shelved files section
│   │   └── ShelvedFilesSection.tsx  # New: collapsible shelved files UI
│   └── dialogs/
│       └── ReconcilePreviewDialog.tsx  # New: reconcile preview with checkboxes
├── hooks/
│   ├── useShelvedFiles.ts       # New: query shelved files for a changelist
│   └── useReconcile.ts          # New: reconcile preview and apply
└── types/
    └── p4.ts                    # Extend P4Changelist to include shelvedFiles

```

### Pattern 1: Query Shelved Files with p4 describe -S
**What:** Fetch shelved files for a specific changelist using P4 describe command
**When to use:** When expanding a changelist that may have shelved files
**Example:**
```rust
// src-tauri/src/commands/p4.rs
#[tauri::command]
pub async fn p4_describe_shelved(
    changelist_id: i32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>
) -> Result<Vec<P4FileInfo>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["-ztag", "describe", "-S", &changelist_id.to_string()]);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute p4 describe -S: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("p4 describe -S failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_describe_shelved(&stdout)
}

// Parse -ztag output looking for depotFile0, depotFile1, etc.
fn parse_ztag_describe_shelved(output: &str) -> Result<Vec<P4FileInfo>, String> {
    let mut files = Vec::new();
    let mut fields: HashMap<String, String> = HashMap::new();

    for line in output.lines() {
        if let Some(stripped) = line.strip_prefix("... ") {
            if let Some((key, value)) = stripped.split_once(' ') {
                fields.insert(key.to_string(), value.to_string());
            }
        }
    }

    // Extract indexed fields (depotFile0, action0, type0, rev0, etc.)
    let mut i = 0;
    loop {
        let depot_key = format!("depotFile{}", i);
        if let Some(depot_path) = fields.get(&depot_key) {
            let action = fields.get(&format!("action{}", i)).cloned();
            let file_type = fields.get(&format!("type{}", i))
                .cloned()
                .unwrap_or_else(|| "text".to_string());
            let revision = fields.get(&format!("rev{}", i))
                .and_then(|s| s.parse::<i32>().ok())
                .unwrap_or(0);

            files.push(P4FileInfo {
                depot_path: depot_path.clone(),
                local_path: String::new(), // Shelved files may not have local path
                status: "shelved".to_string(),
                action,
                revision,
                head_revision: revision,
                changelist: None,
                file_type,
            });
            i += 1;
        } else {
            break;
        }
    }

    Ok(files)
}
```

### Pattern 2: Shelve Selected Files
**What:** Shelve specific files from a changelist using p4 shelve command
**When to use:** User selects files in pending changes and clicks "Shelve" in context menu
**Example:**
```rust
// src-tauri/src/commands/p4.rs
#[tauri::command]
pub async fn p4_shelve(
    changelist_id: i32,
    file_paths: Vec<String>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>
) -> Result<String, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    // p4 shelve -c <cl> <files...>
    cmd.arg("shelve");
    cmd.args(["-c", &changelist_id.to_string()]);

    if !file_paths.is_empty() {
        cmd.args(&file_paths);
    }

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute p4 shelve: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("p4 shelve failed: {}", stderr));
    }

    Ok("Files shelved successfully".to_string())
}
```

### Pattern 3: Unshelve with Conflict Detection
**What:** Check for local modifications before unshelving to warn user about potential conflicts
**When to use:** User clicks "Unshelve" on shelved files
**Example:**
```typescript
// src/hooks/useShelvedFiles.ts
export function useShelvedFiles() {
  const { p4port, p4user, p4client } = useConnectionStore();
  const queryClient = useQueryClient();

  const unshelve = useMutation({
    mutationFn: async ({ changelistId, depotPaths }: {
      changelistId: number;
      depotPaths: string[]
    }) => {
      // First check if files are already opened or modified locally
      const openedFiles = await invokeP4Opened(p4port, p4user, p4client);
      const conflicts = depotPaths.filter(path =>
        openedFiles.some(f => f.depotPath === path)
      );

      if (conflicts.length > 0) {
        // Warn user about conflicts - requires p4 resolve after unshelve
        const confirm = window.confirm(
          `${conflicts.length} file(s) are already opened. ` +
          `Unshelving will create conflicts that need resolution. Continue?`
        );
        if (!confirm) {
          throw new Error('Unshelve cancelled by user');
        }
      }

      // Execute unshelve
      return invokeP4Unshelve(changelistId, p4port, p4user, p4client);
    },
    onSuccess: () => {
      toast.success('Files unshelved successfully');
      queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
      queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });
    },
    onError: (error) => {
      toast.error(`Failed to unshelve: ${error}`);
    }
  });

  return { unshelve };
}
```

### Pattern 4: Reconcile Preview with File Selection
**What:** Preview offline changes before applying reconcile using p4 reconcile -n
**When to use:** User clicks "Reconcile" toolbar button
**Example:**
```rust
// src-tauri/src/commands/p4.rs
#[derive(Debug, Clone, Serialize)]
pub struct ReconcilePreview {
    pub depot_path: String,
    pub local_path: String,
    pub action: String,  // add, edit, delete
}

#[tauri::command]
pub async fn p4_reconcile_preview(
    server: Option<String>,
    user: Option<String>,
    client: Option<String>
) -> Result<Vec<ReconcilePreview>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    // p4 reconcile -n (preview mode)
    cmd.args(["reconcile", "-n"]);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute p4 reconcile: {}", e))?;

    // Parse human-readable output (no -ztag support for reconcile)
    // Format: "//depot/path/file.txt#1 - opened for add"
    //         "//depot/path/file2.txt#2 - opened for edit"
    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_reconcile_output(&stdout)
}

fn parse_reconcile_output(output: &str) -> Result<Vec<ReconcilePreview>, String> {
    let mut results = Vec::new();

    for line in output.lines() {
        // Match pattern: "//depot/path#rev - opened for <action>"
        if let Some(opened_idx) = line.find(" - opened for ") {
            let path_part = &line[..opened_idx];
            let action_part = &line[opened_idx + 14..]; // " - opened for " = 14 chars

            // Extract depot path (remove #rev suffix)
            let depot_path = if let Some(hash_idx) = path_part.rfind('#') {
                path_part[..hash_idx].to_string()
            } else {
                path_part.to_string()
            };

            let action = action_part.trim().to_string();

            results.push(ReconcilePreview {
                depot_path: depot_path.clone(),
                local_path: String::new(), // Would need fstat to get local path
                action,
            });
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn p4_reconcile_apply(
    selected_paths: Vec<String>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>
) -> Result<String, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    // p4 reconcile <selected_paths...>
    cmd.arg("reconcile");
    cmd.args(&selected_paths);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute p4 reconcile: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("p4 reconcile failed: {}", stderr));
    }

    Ok("Reconcile completed successfully".to_string())
}
```

### Pattern 5: Shelved Files Section in Changelist Tree
**What:** Display shelved files in collapsible section below pending files within changelist node
**When to use:** Changelist has both pending and shelved files
**Example:**
```typescript
// src/components/ChangelistPanel/ChangelistNode.tsx
export function ChangelistNode({ node, style }: NodeRendererProps<ChangelistTreeNode>) {
  const cl = node.data.data as P4Changelist;

  // ... existing pending files rendering ...

  // Shelved files section (if any)
  if (cl.shelvedFiles && cl.shelvedFiles.length > 0) {
    return (
      <>
        {/* Pending files ... */}

        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger className="flex items-center gap-2 text-slate-400 text-sm">
            <ChevronRight className="w-4 h-4" />
            <span>Shelved Files ({cl.shelvedFiles.length})</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {cl.shelvedFiles.map((file) => (
              <div key={file.depotPath} className="pl-8 py-1 flex items-center gap-2">
                <FileIcon className="w-4 h-4 text-purple-400" />
                <span className="text-slate-300">{file.depotPath.split('/').pop()}</span>
                <span className="text-slate-500 text-xs">({file.action})</span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </>
    );
  }
}
```

### Anti-Patterns to Avoid
- **Don't shelve default changelist automatically:** Shelving requires explicit user action; never auto-shelve on operations
- **Don't parse reconcile output with regex only:** Use structured parsing with line-by-line validation; P4 output format can vary
- **Don't unshelve without conflict warning:** Always check for opened files at same depot path before unshelve
- **Don't auto-reconcile on launch:** Context decisions mandate manual trigger only; respects user workflow

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree node expansion state | Custom state tracking | react-arborist built-in state | Arborist already manages open/closed state; custom tracking duplicates logic |
| File path display | String manipulation | Existing depot path splitting | ChangelistPanel already has path display logic; reuse pattern |
| Dialog with checkboxes | Custom modal + form | shadcn AlertDialog + react-hook-form | Project uses these for all dialogs (SubmitDialog, CreateChangelistDialog) |
| Toast notifications | Custom UI | react-hot-toast | Already used throughout project for success/error messages |

**Key insight:** Shelve/reconcile operations map directly to existing patterns (file operations use toast notifications, query invalidation refreshes UI, dialogs follow AlertDialog component structure). No custom UI primitives needed.

## Common Pitfalls

### Pitfall 1: Assuming Shelved Files Have Local Paths
**What goes wrong:** `p4 describe -S` returns depot paths but not local paths for shelved files
**Why it happens:** Shelved files are server-side copies; may have been shelved from different workspace
**How to avoid:** Use depot path only for shelved file display; fetch local path with `p4 fstat` only when needed (e.g., before unshelve)
**Warning signs:** Crashes when accessing `localPath` on shelved file objects

### Pitfall 2: Reconcile Output Parsing Without Validation
**What goes wrong:** P4 reconcile output format is human-readable with no `-ztag` support; naive parsing breaks on edge cases
**Why it happens:** Output format: `//depot/path#rev - opened for <action>` varies with P4 server version
**How to avoid:** Parse line-by-line with explicit checks for " - opened for " delimiter; fallback to error if format doesn't match
**Warning signs:** Reconcile preview shows garbled paths or missing files

### Pitfall 3: Unshelve Overwrites Without Warning
**What goes wrong:** `p4 unshelve -f` force option overwrites writable files, losing uncommitted local changes
**Why it happens:** Force flag bypasses P4's safety checks for opened files
**How to avoid:** Never use `-f` flag; check for opened files with `p4 opened` before unshelve; warn user about conflicts
**Warning signs:** Users report lost work after unshelve operation

### Pitfall 4: Shelve/Delete Shelf Confusion
**What goes wrong:** Users expect "Delete Shelf" to also revert pending files (like deleting changelist)
**Why it happens:** Shelving and pending files are independent; shelf is server-side copy, pending files remain in workspace
**How to avoid:** Clear UI labeling: "Delete Shelf" removes server copy only, files remain checked out
**Warning signs:** User confusion about why files still appear after deleting shelf

### Pitfall 5: Reconcile Applies All Changes Without Preview
**What goes wrong:** Direct reconcile without preview opens hundreds of unintended files (e.g., IDE temp files)
**Why it happens:** Reconcile scans entire workspace by default; no way to exclude paths except P4IGNORE
**How to avoid:** Always show preview dialog with checkboxes; require explicit user confirmation before applying
**Warning signs:** Submitted changelists contain unexpected files (build artifacts, IDE config)

## Code Examples

Verified patterns from official sources:

### Shelve Files in Changelist
```bash
# Shelve specific files
p4 shelve -c 12345 //depot/project/file1.cpp //depot/project/file2.h

# Shelve all files in changelist
p4 shelve -c 12345
```
Source: [Perforce p4 shelve Documentation](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_shelve.html)

### Delete Shelved Files
```bash
# Delete all shelved files from changelist
p4 shelve -d -c 12345

# Delete specific shelved file
p4 shelve -d -c 12345 //depot/project/file1.cpp
```
Source: [Perforce p4 shelve Documentation](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_shelve.html)

### Unshelve Files
```bash
# Unshelve all files from changelist 12345 to default changelist
p4 unshelve -s 12345

# Unshelve to specific target changelist
p4 unshelve -s 12345 -c 67890

# Preview unshelve without applying
p4 unshelve -n -s 12345
```
Source: [Perforce p4 unshelve Documentation](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_unshelve.html)

### Reconcile Preview and Apply
```bash
# Preview all offline changes
p4 reconcile -n

# Preview only adds
p4 reconcile -n -a

# Preview only edits
p4 reconcile -n -e

# Preview only deletes
p4 reconcile -n -d

# Apply reconcile to specific path
p4 reconcile //depot/project/...
```
Source: [Perforce p4 reconcile Documentation](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_reconcile.html)

### Query Shelved Files
```bash
# List all pending changelists (may include shelved)
p4 changes -s pending

# Describe shelved files in changelist
p4 describe -S 12345

# Describe with -ztag for structured parsing
p4 -ztag describe -S 12345
```
Source: [Perforce p4 changes Documentation](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_changes.html)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `p4 unshelve` to default CL only | `p4 unshelve -c <target>` | P4 2014.1+ | Can unshelve to specific changelist; context decisions use original CL only |
| Manual conflict detection | `p4 resolve` after unshelve | Always available | Unshelve creates unresolved files automatically; must run resolve |
| `p4 reconcile` preview parsing | No `-ztag` support | Still current | Must parse human-readable output; no structured format available |
| Shelved files visible in `p4 changes` | Separate `p4 describe -S` query | Always required | Shelved files not returned by `p4 opened`; need separate command |

**Deprecated/outdated:**
- **`p4 submit -e shelvedChange`:** Submit shelved files directly without unshelving (P4 2014.2+). This feature exists but out of scope for phase (submission always from pending files).

## Open Questions

Things that couldn't be fully resolved:

1. **Reconcile local path resolution**
   - What we know: `p4 reconcile -n` returns depot paths only
   - What's unclear: How to efficiently map depot paths to local paths for UI display
   - Recommendation: Run `p4 fstat <depot_paths...>` after reconcile preview to get local paths; batch request for performance

2. **Shelved file status indicators**
   - What we know: Shelved files need distinct visual styling from pending files
   - What's unclear: Best color/icon to differentiate shelved vs pending without introducing new theme colors
   - Recommendation: Use purple accent (existing in FileHistoryDialog for 'branch' action) with shelf icon from lucide-react

3. **Reconcile progress feedback**
   - What we know: Reconcile scans entire workspace; can take 30+ seconds on large repos
   - What's unclear: Whether to show progress spinner in toolbar button or status bar
   - Recommendation: Use existing loading pattern (spinner in toolbar button during operation); matches sync/submit patterns

4. **Unshelve conflict resolution workflow**
   - What we know: Unshelve creates unresolved files requiring `p4 resolve`
   - What's unclear: Whether to auto-launch resolve UI or require manual resolve command
   - Recommendation: Show toast notification with "Resolve conflicts" action button; resolve UI implementation deferred to future phase

## Sources

### Primary (HIGH confidence)
- [Perforce p4 shelve Command Reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_shelve.html) - Official command syntax and options
- [Perforce p4 unshelve Command Reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_unshelve.html) - Unshelve workflow and conflict handling
- [Perforce p4 reconcile Command Reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_reconcile.html) - Reconcile command and preview mode
- [Perforce Shelving Guide](https://help.perforce.com/helix-core/server-apps/p4guide/current/Content/P4Guide/shelve-changelists.html) - Shelving workflows and best practices
- [Perforce p4 changes Command Reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_changes.html) - Querying pending/shelved changelists

### Secondary (MEDIUM confidence)
- Existing codebase patterns in ChangelistPanel.tsx, FileContextMenu.tsx, FileHistoryDialog.tsx
- Project decisions documented in STATE.md (D-04-01-02: p4_reopen pattern, D-05-01-01: indexed field parsing)

### Tertiary (LOW confidence)
- None - all claims verified against official documentation or existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies already in project
- Architecture: HIGH - Patterns directly extend existing ChangelistPanel and dialog structures
- Pitfalls: HIGH - Verified against official P4 documentation and common user error scenarios

**Research date:** 2026-01-29
**Valid until:** 60 days (stable P4 CLI commands; UI patterns established in project)
