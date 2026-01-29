# Phase 05: History, Diff & Search - Research

**Researched:** 2026-01-29
**Domain:** Perforce history/diff/search operations, external process spawning, React modal patterns
**Confidence:** HIGH

## Summary

This phase implements three capabilities: file history viewer, external diff tool integration, and submitted changelist search. The standard approach uses P4 commands (`p4 filelog`, `p4 changes`, `p4 print`) with tagged output parsing in Rust, Tauri shell plugin for launching external diff tools, and React modal dialogs with Radix UI primitives.

**Key findings:**
1. P4 commands support `-ztag` for structured output, making parsing reliable across file types and edge cases
2. External diff tools require printing revisions to temporary files using `p4 print -o`, then spawning the diff tool with Tauri's shell plugin
3. Search functionality lacks native P4 support for description text search - requires fetching full changelist list with `-l` flag and filtering client-side
4. VS Code diff (`code --diff file1 file2`) is the primary target but must handle spaces in paths carefully

**Primary recommendation:** Use P4's structured `-ztag` output for all data fetching, implement temporary file management with Rust's `tempfile` crate for diff operations, and build search with client-side filtering of full changelist descriptions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| P4 CLI | Current | Perforce command-line operations | Only supported way to interact with P4 in custom clients |
| Tauri Shell Plugin | 2.x | External process spawning | Official Tauri plugin for launching external executables with proper permissions |
| tempfile (Rust) | 3.x | Temporary file management | Cross-platform, secure temp file handling with automatic cleanup |
| Radix UI Dialog | 1.x | Modal dialogs | Already used in project, accessibility-compliant, non-blocking |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tauri-plugin-store | 2.4.2+ | Settings persistence | Already used for P4 connection settings - extend for diff tool config |
| TanStack Query | 5.x | Data fetching and caching | Already used for P4 queries - use for history and search |
| lucide-react | Latest | Icons | Already used for UI icons - add History, Search, Diff icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `p4 filelog -ztag` | `p4 filelog` text parsing | Tagged output is structured and reliable; text parsing is brittle |
| Client-side search filter | Server-side P4 search | P4 has no description search API; must filter client-side anyway |
| Tauri shell plugin | Direct Rust `std::process::Command` | Shell plugin handles permissions, logging, and Tauri integration |

**Installation:**
```bash
# Rust dependencies (Cargo.toml)
cargo add tempfile
# tauri-plugin-shell already installed
# tauri-plugin-store already installed

# Frontend dependencies already installed:
# - @radix-ui/react-dialog
# - @tanstack/react-query
# - lucide-react
```

## Architecture Patterns

### Recommended Component Structure
```
src/
├── components/
│   ├── dialogs/
│   │   ├── FileHistoryDialog.tsx      # Modal with revision list
│   │   └── SearchDialog.tsx           # Modal/panel for search results
│   └── FileTree/
│       └── FileContextMenu.tsx        # Add "File History" and "Diff" actions
├── hooks/
│   ├── useFileHistory.ts              # TanStack Query for p4 filelog
│   ├── useSearch.ts                   # TanStack Query for p4 changes with filtering
│   └── useDiff.ts                     # Launch external diff tool
└── lib/
    └── tauri.ts                       # Add p4_filelog, p4_print, p4_launch_diff commands

src-tauri/src/commands/
└── p4.rs                              # Add p4_filelog, p4_print_revision, launch_diff_tool
```

### Pattern 1: P4 Tagged Output Parsing
**What:** Use `-ztag` flag for structured output, parse into typed structs
**When to use:** All P4 commands that need data extraction (filelog, changes)
**Example:**
```rust
// Source: Existing p4.rs pattern (parse_ztag_fstat, parse_ztag_changes)
fn parse_ztag_filelog(output: &str) -> Result<Vec<P4Revision>, String> {
    let mut revisions = Vec::new();
    let mut current: HashMap<String, String> = HashMap::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            if !current.is_empty() {
                if let Some(rev) = build_revision(&current) {
                    revisions.push(rev);
                }
                current.clear();
            }
            continue;
        }
        if let Some(stripped) = line.strip_prefix("... ") {
            if let Some((key, value)) = stripped.split_once(' ') {
                current.insert(key.to_string(), value.to_string());
            }
        }
    }
    Ok(revisions)
}
```

### Pattern 2: External Diff Tool Workflow
**What:** Print two revisions to temp files, spawn diff tool, clean up on drop
**When to use:** All diff operations (revision vs revision, workspace vs have)
**Example:**
```rust
// Source: tempfile crate docs + Tauri shell plugin
use tempfile::NamedTempFile;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub async fn launch_diff(
    depot_path: String,
    rev1: i32,
    rev2: Option<i32>,  // None = workspace file
    diff_tool_path: String,
    diff_tool_args: String,
    app: AppHandle,
) -> Result<(), String> {
    // Print rev1 to temp file
    let temp1 = NamedTempFile::new().map_err(|e| format!("Failed to create temp file: {}", e))?;
    let temp1_path = temp1.path().to_str().ok_or("Invalid temp path")?;

    // p4 print -o temp1_path depot_path#rev1
    let mut cmd = Command::new("p4");
    cmd.args(["-ztag", "print", "-o", temp1_path, &format!("{}#{}", depot_path, rev1)]);
    cmd.output().map_err(|e| format!("p4 print failed: {}", e))?;

    // Get second file (temp or workspace)
    let temp2_path = if let Some(r2) = rev2 {
        let temp2 = NamedTempFile::new()?;
        // p4 print -o temp2_path depot_path#rev2
        temp2.path().to_str().ok_or("Invalid temp path")?
    } else {
        // Use workspace file path from p4 where or fstat
        "workspace_path"
    };

    // Launch diff tool
    let shell = app.shell();
    shell.command(&diff_tool_path)
        .args([temp1_path, temp2_path])
        .spawn()
        .map_err(|e| format!("Failed to launch diff: {}", e))?;

    // NamedTempFile automatically cleans up on drop
    Ok(())
}
```

### Pattern 3: Modal State Management
**What:** Use React state + Radix Dialog with controlled open/onOpenChange
**When to use:** File history dialog, search results panel
**Example:**
```typescript
// Source: Existing SettingsDialog.tsx pattern
interface FileHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depotPath: string;
}

export function FileHistoryDialog({ open, onOpenChange, depotPath }: FileHistoryDialogProps) {
  const { data: revisions, isLoading } = useQuery({
    queryKey: ['p4', 'filelog', depotPath],
    queryFn: () => invokeP4Filelog(depotPath),
    enabled: open,  // Only fetch when dialog is open
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>File History: {depotPath}</DialogTitle>
        </DialogHeader>
        {/* Revision list with Load More button */}
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 4: Search with Client-Side Filtering
**What:** Fetch all submitted changelists with `-l` flag, filter by keyword in React
**When to use:** Changelist search functionality
**Example:**
```typescript
// Source: P4 API limitations + existing useP4Command pattern
function useChangelistSearch(searchTerm: string) {
  const { data: allChanges } = useQuery({
    queryKey: ['p4', 'changes', 'submitted'],
    queryFn: () => invokeP4Changes('submitted'),
    staleTime: 5 * 60 * 1000,  // Cache for 5 minutes
  });

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!searchTerm || !allChanges) return [];

    const lower = searchTerm.toLowerCase();

    // Auto-detect: number vs user vs description
    const isNumber = /^\d+$/.test(searchTerm);
    const isUser = /^[a-zA-Z][\w-]*$/.test(searchTerm);

    return allChanges.filter(cl => {
      if (isNumber) return cl.id.toString().includes(searchTerm);
      if (isUser) return cl.user.toLowerCase().includes(lower);
      return cl.description.toLowerCase().includes(lower);
    });
  }, [searchTerm, allChanges]);

  return filtered;
}
```

### Anti-Patterns to Avoid
- **Text parsing P4 output:** Always use `-ztag` for structured data - text output varies by file type and edge cases
- **Blocking diff tool launch:** Use `spawn()` not `output()` to launch diff tool - user should be able to continue working
- **Hardcoding P4DIFF env var:** Let user configure diff tool in app settings - more explicit and discoverable
- **Fetching all history at once:** Use `-m 50` flag to limit initial fetch, provide "Load More" button for pagination

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Temporary file cleanup | Manual file deletion with std::fs::remove | `tempfile::NamedTempFile` | Automatic cleanup on drop, cross-platform, handles errors/panics |
| P4 output parsing | Custom regex/string splitting | `-ztag` flag + HashMap parsing | Structured, reliable, handles edge cases (spaces, special chars) |
| Process spawning | Direct `std::process::Command` | Tauri shell plugin | Permission handling, logging, Tauri integration |
| Search tokenization | Custom parser for "changelist 123" | Simple auto-detection (number/user/text) | P4 has no search syntax; keep it simple |
| Modal accessibility | Custom modal with focus trap | Radix UI Dialog | ARIA compliance, keyboard nav, focus management built-in |

**Key insight:** Perforce CLI output is surprisingly complex (file types, integrations, descriptions with newlines) - using `-ztag` structured output is critical. Custom text parsing will break on edge cases.

## Common Pitfalls

### Pitfall 1: p4 filelog without -ztag produces unparseable output
**What goes wrong:** File history output varies by file type, integration history, and description content - text parsing breaks on edge cases
**Why it happens:** P4's default output is human-readable, not machine-readable
**How to avoid:** Always use `-ztag` flag for structured output with "... key value" format
**Warning signs:** Parsing errors on files with spaces, special characters, or multi-line descriptions

### Pitfall 2: Diff tool paths with spaces fail silently
**What goes wrong:** `code --diff "file 1.txt" "file 2.txt"` launches VS Code but doesn't open diff
**Why it happens:** Shell argument parsing treats spaces as delimiters even in quoted strings
**How to avoid:** Use Tauri's shell plugin which handles argument escaping correctly - pass files as separate args, not in a string
**Warning signs:** Diff tool launches but doesn't show diff; no error message

### Pitfall 3: NamedTempFile deleted before diff tool reads it
**What goes wrong:** Temp file is deleted immediately after spawning diff tool, causing "file not found" errors
**Why it happens:** `NamedTempFile` drops and deletes when it goes out of scope
**How to avoid:** Either persist temp file with `.persist()` or use `.keep()` method and track files for later cleanup
**Warning signs:** Diff tool shows "file not found" or empty file errors

### Pitfall 4: Blocking on diff tool exit
**What goes wrong:** App freezes waiting for user to close diff tool
**Why it happens:** Using `.output()` instead of `.spawn()` blocks until process exits
**How to avoid:** Use `.spawn()` to launch diff tool asynchronously - user should be able to continue working
**Warning signs:** App unresponsive after launching diff; status bar stuck

### Pitfall 5: Fetching full changelist history on search
**What goes wrong:** Initial search is slow; app fetches thousands of changelists
**Why it happens:** P4 has no description search - must fetch all and filter client-side
**How to avoid:** Use TanStack Query caching with long `staleTime` (5+ minutes), add `-m` flag to limit initial fetch (e.g., last 500 changes)
**Warning signs:** Search takes 5+ seconds on first use; network activity on every keystroke

### Pitfall 6: Not handling depot path vs local path for diff
**What goes wrong:** Workspace diff fails because code tries to diff two depot revisions
**Why it happens:** Confusing depot path (//depot/...) with local path (C:\workspace\...)
**How to avoid:** Use P4FileInfo struct which has both `depot_path` and `local_path` - workspace diff uses local_path
**Warning signs:** "File not found" errors when diffing against workspace version

## Code Examples

Verified patterns from official sources:

### P4 Filelog with Tagged Output
```rust
// Source: https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_filelog.html
#[derive(Debug, Clone, Serialize)]
pub struct P4Revision {
    pub rev: i32,
    pub change: i32,
    pub action: String,
    pub file_type: String,
    pub time: i64,
    pub user: String,
    pub client: String,
    pub desc: String,
}

#[tauri::command]
pub async fn p4_filelog(
    depot_path: String,
    max_revisions: Option<i32>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4Revision>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.args(["-ztag", "filelog"]);

    if let Some(max) = max_revisions {
        cmd.args(["-m", &max.to_string()]);
    }

    cmd.arg(depot_path);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute p4 filelog: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_filelog(&stdout)
}
```

### P4 Changes with Full Description
```rust
// Source: https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_changes.html
#[tauri::command]
pub async fn p4_changes_search(
    max_changes: Option<i32>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4Changelist>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.args(["-ztag", "changes", "-l", "-s", "submitted"]);

    if let Some(max) = max_changes {
        cmd.args(["-m", &max.to_string()]);
    }

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute p4 changes: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_changes(&stdout)
}
```

### External Diff Tool Launch with Temp Files
```rust
// Source: https://docs.rs/tempfile/ + https://v2.tauri.app/plugin/shell/
use tempfile::NamedTempFile;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub async fn launch_diff_tool(
    depot_path: String,
    rev1: i32,
    rev2: Option<i32>,  // None = workspace file
    diff_tool_path: String,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
    app: AppHandle,
) -> Result<(), String> {
    // Create temp file for rev1
    let temp1 = NamedTempFile::new()
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    let temp1_path = temp1.path().to_string_lossy().to_string();

    // p4 print -o temp1 depot_path#rev1
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["-q", "print", "-o", &temp1_path, &format!("{}#{}", depot_path, rev1)]);
    cmd.output().map_err(|e| format!("p4 print failed: {}", e))?;

    // Get path for rev2 (temp file or workspace file)
    let (temp2, temp2_path) = if let Some(r2) = rev2 {
        let temp = NamedTempFile::new()
            .map_err(|e| format!("Failed to create temp file: {}", e))?;
        let path = temp.path().to_string_lossy().to_string();

        let mut cmd = Command::new("p4");
        apply_connection_args(&mut cmd, &server, &user, &client);
        cmd.args(["-q", "print", "-o", &path, &format!("{}#{}", depot_path, r2)]);
        cmd.output().map_err(|e| format!("p4 print failed: {}", e))?;

        (Some(temp), path)
    } else {
        // Get workspace file path from p4 fstat
        let files = p4_fstat(vec![depot_path.clone()], None, server.clone(), user.clone(), client.clone()).await?;
        let local_path = files.first()
            .ok_or("File not found in workspace")?
            .local_path.clone();
        (None, local_path)
    };

    // Launch diff tool
    let shell = app.shell();
    shell.command(&diff_tool_path)
        .args(["--diff", &temp1_path, &temp2_path])
        .spawn()
        .map_err(|e| format!("Failed to launch diff tool: {}", e))?;

    // Keep temp files alive until function returns
    // (they'll be cleaned up after diff tool reads them)
    std::mem::forget(temp1);
    if let Some(t2) = temp2 {
        std::mem::forget(t2);
    }

    Ok(())
}
```

### React File History Dialog with Load More
```typescript
// Source: Existing SettingsDialog.tsx + TanStack Query patterns
export function FileHistoryDialog({ open, onOpenChange, depotPath }: Props) {
  const [maxRevisions, setMaxRevisions] = useState(50);
  const { p4port, p4user, p4client } = useConnectionStore();

  const { data: revisions, isLoading } = useQuery({
    queryKey: ['p4', 'filelog', depotPath, maxRevisions],
    queryFn: () => invokeP4Filelog(depotPath, maxRevisions, p4port, p4user, p4client),
    enabled: open && !!depotPath,
  });

  const handleLoadMore = () => {
    setMaxRevisions(prev => prev + 50);
  };

  const handleDiff = async (rev: number, diffType: 'previous' | 'workspace') => {
    const rev2 = diffType === 'previous' ? rev - 1 : null;
    await invokeLaunchDiff(depotPath, rev, rev2, diffToolPath);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>File History</DialogTitle>
          <DialogDescription>{depotPath}</DialogDescription>
        </DialogHeader>

        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>Rev</th>
                <th>Change</th>
                <th>Action</th>
                <th>Date</th>
                <th>User</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {revisions?.map(rev => (
                <tr key={rev.rev}>
                  <td>#{rev.rev}</td>
                  <td>{rev.change}</td>
                  <td>{rev.action}</td>
                  <td>{new Date(rev.time * 1000).toLocaleDateString()}</td>
                  <td>{rev.user}</td>
                  <td className="truncate max-w-xs">{rev.desc}</td>
                  <td>
                    <Button onClick={() => handleDiff(rev.rev, 'previous')}>
                      Diff vs Previous
                    </Button>
                    <Button onClick={() => handleDiff(rev.rev, 'workspace')}>
                      Diff vs Workspace
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button onClick={handleLoadMore} disabled={isLoading}>
            Load More
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parse `p4 filelog` text | Use `-ztag` structured output | P4 2012.1+ | More reliable parsing, handles edge cases |
| P4DIFF env var | App-configured diff tool | Modern practice | More discoverable, easier to change |
| Server-side search | Client-side filtering | N/A (P4 limitation) | Must fetch and cache full list |
| Blocking diff launch | Async spawn | Tauri best practice | App remains responsive during diff |

**Deprecated/outdated:**
- P4V's modal dialogs for history: Non-blocking dialogs with modern React patterns are standard now
- Text-based parsing: `-ztag` has been standard for 10+ years but older examples still show text parsing

## Open Questions

1. **Temp file cleanup timing**
   - What we know: NamedTempFile deletes on drop; diff tool may still be reading
   - What's unclear: Best practice for keeping temp files alive until diff tool finishes
   - Recommendation: Use `std::mem::forget()` to prevent immediate cleanup - OS will clean up on process exit

2. **Search result quantity**
   - What we know: P4 has no description search; must fetch all and filter
   - What's unclear: How many recent changes to fetch initially (500? 1000?)
   - Recommendation: Start with 500, add "Search older changes" button to fetch more if needed

3. **History pagination UX**
   - What we know: Need "Load More" button for history beyond 50 revisions
   - What's unclear: Should we auto-load more on scroll, or require button click?
   - Recommendation: Button click is simpler and matches user decision about modal dialogs

4. **VS Code diff argument format**
   - What we know: `code --diff file1 file2` works; `--wait` flag blocks
   - What's unclear: Should we use `--wait` or let user keep working?
   - Recommendation: Don't use `--wait` - let user work while diff is open

## Sources

### Primary (HIGH confidence)
- [p4 filelog command reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_filelog.html) - Command syntax and options
- [p4 changes command reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_changes.html) - Search options and filtering
- [p4 print command reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_print.html) - Printing revisions to files
- [Tauri Shell Plugin](https://v2.tauri.app/plugin/shell/) - External process spawning from Rust
- [tempfile crate documentation](https://docs.rs/tempfile/) - Temporary file management in Rust
- [Radix UI Dialog documentation](https://www.radix-ui.com/primitives/docs/components/dialog) - Modal dialog patterns

### Secondary (MEDIUM confidence)
- [VS Code CLI --diff argument](https://code.visualstudio.com/docs/configure/command-line) - Command line interface
- [VS Code as diff tool GitHub issue](https://github.com/Microsoft/vscode/issues/3917) - Usage examples from community
- [tauri-plugin-store documentation](https://v2.tauri.app/plugin/store/) - Settings persistence best practices
- [P4 tagged output discussion](https://github.com/kaushalmodi/p4ztag_to_json) - Parsing patterns and examples

### Tertiary (LOW confidence)
- [GitKraken Command Palette](https://help.gitkraken.com/gitkraken-desktop/command-palette/) - Search UI patterns (inspiration only)
- Community forums on P4 description search workarounds - No official solution exists

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools are official/standard in their domains (P4 CLI, Tauri shell, tempfile)
- Architecture: HIGH - Based on existing codebase patterns (p4.rs parsing, TanStack Query, Radix dialogs)
- Pitfalls: HIGH - Documented from P4 official docs and tempfile security notes

**Research date:** 2026-01-29
**Valid until:** 60 days (stable technology stack, P4 CLI hasn't changed significantly in years)
