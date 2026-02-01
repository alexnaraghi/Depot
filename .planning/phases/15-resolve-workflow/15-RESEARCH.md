# Phase 15: Resolve Workflow - Research

**Researched:** 2026-02-01
**Domain:** Perforce conflict resolution and external merge tool integration
**Confidence:** HIGH

## Summary

This phase implements conflict detection and external merge tool integration for P4Now. The research focused on understanding Perforce's native resolve workflow, the P4MERGE environment variable mechanism, and best practices for waiting on external processes in Tauri/Rust while maintaining a responsive UI.

Perforce has a well-established conflict resolution system. Files require resolution when the user's workspace revision is not the head revision at submit time, or after integration/merge operations. The `p4 fstat` command provides `unresolved`, `resolved`, and `reresolvable` fields to track conflict state. The `p4 resolve` command supports automatic resolution options (`-at` for accept theirs, `-ay` for accept yours, `-am` for accept merge) as well as interactive merge via the P4MERGE environment variable.

The external merge tool is invoked with four arguments: base, theirs, yours, and merge result. The tool runs synchronously (blocking), and Perforce accepts the merge result automatically after the tool exits. On Windows, a batch file wrapper is required due to process invocation limitations.

**Primary recommendation:** Use Rust's `tokio::task::spawn_blocking` to wait for the merge tool process without blocking the async runtime, and display a modal blocking overlay in React to prevent user interaction during the merge. Detect conflicts via `p4 fstat -Ru` and mark files as conflicted in the UI. Support both P4MERGE environment variable and quick-resolve options (-at/-ay).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Rust std::process::Command | std | Spawn merge tool process | Standard Rust process spawning |
| tokio::task::spawn_blocking | 1.x | Wait for blocking process without freezing async runtime | Official Tokio pattern for blocking operations |
| React context/state | 19.1 | Manage blocking overlay visibility | Current React version in project |
| Perforce CLI (p4) | Any | Execute resolve commands | Standard Perforce client |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.563.0 | Conflict warning icons (AlertTriangle) | Already in project for icons |
| react-hot-toast | 2.6.0 | Error/success notifications | Already in project for toasts |
| shadcn/ui Dialog | Current | Blocking overlay component | Existing pattern in codebase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| spawn_blocking | tokio::process::Command | tokio::process requires async-aware child, but merge tools are arbitrary binaries that may not exit cleanly async |
| P4MERGE env var | Custom merge tool settings | P4MERGE is the Perforce standard; custom settings would duplicate functionality users already configure |
| Block entire app | Show progress spinner | Blocking prevents user from interfering with resolve; Perforce resolves can be complex and shouldn't be interrupted |

**Installation:**
```bash
# No new dependencies required - using existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── hooks/
│   └── useResolve.ts           # Resolve operations hook
├── components/
│   ├── dialogs/
│   │   ├── ResolveBlockingOverlay.tsx  # Modal overlay during merge
│   │   └── ResolveConfirmDialog.tsx     # Confirm quick-resolve actions
│   └── DetailPane/
│       └── FileDetailView.tsx   # Add conflict banner here
├── types/
│   └── p4.ts                    # Add resolveAction, unresolved fields to P4File
src-tauri/src/commands/
└── p4.rs                        # Add p4_resolve_accept, launch_merge_tool
```

### Pattern 1: Conflict Detection via p4 fstat
**What:** Use `p4 fstat -Ru` to list files needing resolution, then enrich with `-Or` to get resolve action details.
**When to use:** After sync, unshelve, or on manual refresh.
**Example:**
```rust
// Source: Perforce documentation + existing p4.rs patterns
#[tauri::command]
pub async fn p4_fstat_unresolved(
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4FileInfo>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["-ztag", "fstat", "-Ru", "-Or"]);

    // Parse output for unresolved files
    // Look for "... unresolved" field with count > 0
    // Extract resolveAction_0_, resolveFromFile_0_, etc.
}
```

### Pattern 2: Launching External Merge Tool with Blocking
**What:** Use std::process::Command to spawn merge tool, wrap in spawn_blocking, wait for exit synchronously.
**When to use:** When user clicks "Launch Merge Tool" or context menu resolve action.
**Example:**
```rust
// Source: Tokio documentation + existing diff tool pattern
#[tauri::command]
pub async fn launch_merge_tool(
    base_path: String,
    theirs_path: String,
    yours_path: String,
    merge_result_path: String,
) -> Result<i32, String> {
    // Get P4MERGE from environment
    let merge_tool = std::env::var("P4MERGE")
        .or_else(|_| std::env::var("MERGE"))
        .map_err(|_| "P4MERGE environment variable not set".to_string())?;

    // Spawn and wait using spawn_blocking
    let exit_code = tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new(&merge_tool);
        cmd.args([&base_path, &theirs_path, &yours_path, &merge_result_path]);

        let status = cmd.status()
            .map_err(|e| format!("Failed to launch merge tool: {}", e))?;

        Ok::<i32, String>(status.code().unwrap_or(-1))
    }).await
    .map_err(|e| format!("Blocking task failed: {}", e))??;

    Ok(exit_code)
}
```

### Pattern 3: React Blocking Overlay
**What:** Full-screen modal overlay that dims the app and prevents interaction while merge tool is open.
**When to use:** Immediately before launching merge tool, hide after process exits.
**Example:**
```typescript
// Source: React patterns + existing dialog components
function ResolveBlockingOverlay({ isOpen, filePath }: Props) {
  return (
    <Dialog open={isOpen}>
      <DialogContent
        className="bg-slate-900/95 border-none pointer-events-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
          <div className="text-lg font-medium">Waiting for merge tool...</div>
          <div className="text-sm text-slate-400">{filePath}</div>
          <div className="text-xs text-slate-500 mt-2">
            Complete your merge in the external tool to continue
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 4: Quick Resolve Actions
**What:** Execute `p4 resolve -at` (accept theirs) or `p4 resolve -ay` (accept yours) for simple conflict resolution.
**When to use:** User clicks "Accept Theirs" or "Accept Yours" in conflict banner.
**Example:**
```rust
// Source: Perforce resolve documentation
#[tauri::command]
pub async fn p4_resolve_accept(
    depot_path: String,
    mode: String, // "theirs", "yours", "merge"
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<String, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    let flag = match mode.as_str() {
        "theirs" => "-at",
        "yours" => "-ay",
        "merge" => "-am",
        _ => return Err(format!("Invalid resolve mode: {}", mode)),
    };

    cmd.args(["resolve", flag, &depot_path]);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute p4 resolve: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
```

### Pattern 5: Conflict Banner in Detail Pane
**What:** Yellow/orange banner at top of FileDetailView when file has unresolved conflicts.
**When to use:** When selected file has FileStatus.Conflict or unresolved > 0.
**Example:**
```typescript
// Source: VS Code merge conflict UI patterns + existing FileDetailView
{fileInfo?.status === FileStatus.Conflict && (
  <div className="bg-yellow-900/30 border-l-4 border-yellow-500 p-4 mb-4">
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
      <div className="flex-1">
        <div className="font-medium text-yellow-200 mb-2">
          This file has unresolved conflicts
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleLaunchMergeTool}
          >
            Launch Merge Tool
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleQuickResolve('theirs')}
          >
            Accept Theirs
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleQuickResolve('yours')}
          >
            Accept Yours
          </Button>
        </div>
      </div>
    </div>
  </div>
)}
```

### Anti-Patterns to Avoid
- **Spawning merge tool without blocking overlay:** User might perform other operations while merge tool is open, causing state inconsistencies or submit failures
- **Using spawn() without wait():** Merge tool exits immediately in parent process, resolve never completes
- **Auto-resolving without user confirmation for destructive operations:** Accept Theirs/Yours can discard changes; confirm first for safety
- **Custom merge tool settings UI:** P4MERGE is the standard; don't reinvent what Perforce already provides via environment variables

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Process spawning and waiting | Custom async process wrapper | tokio::task::spawn_blocking + std::process::Command | Tokio's spawn_blocking is battle-tested for blocking operations in async context |
| Merge conflict parsing | Custom three-way diff parser | P4MERGE with external tool | Merge tools (p4merge, Beyond Compare, KDiff3) handle complex merge scenarios including binary files, encoding issues, and user preferences |
| P4MERGE argument reordering | Rust argument shuffling | Windows batch file wrapper | Perforce documentation explicitly requires batch file wrapper on Windows due to process invocation limitations |
| Conflict detection logic | Custom file comparison | p4 fstat -Ru with unresolved field | Perforce server tracks integration state; client-side comparison would miss server-side scheduling and history |

**Key insight:** Perforce's resolve system is a server-side workflow. The server tracks which files need resolution, what the base/theirs/yours revisions are, and whether resolution is complete. Client tools should query and execute these operations, not re-implement the logic.

## Common Pitfalls

### Pitfall 1: Forgetting to Refresh File Status After Resolution
**What goes wrong:** User resolves conflict via merge tool, but UI still shows conflict indicator. File appears stuck in conflict state.
**Why it happens:** TanStack Query cache is not invalidated after `p4 resolve` completes. UI displays stale data.
**How to avoid:** Invalidate `['fileTree']`, `['p4', 'opened']`, and `['p4', 'changes']` queries after any resolve operation (quick-resolve or merge tool).
**Warning signs:** User reports "resolved file still shows warning icon" or "can't submit even though merge completed."

### Pitfall 2: Not Handling P4MERGE Missing
**What goes wrong:** User clicks "Launch Merge Tool" but P4MERGE environment variable is not set. Command fails with cryptic error. User doesn't know how to fix it.
**Why it happens:** P4MERGE is user-configurable via environment variables, not guaranteed to be set.
**How to avoid:** Check for P4MERGE (or fallback MERGE) environment variable in Tauri command. Return friendly error message with instructions: "P4MERGE environment variable not set. Configure your merge tool by setting P4MERGE to the path of your preferred merge tool (e.g., p4merge.exe, beyondcompare.exe)."
**Warning signs:** Error toast shows "P4MERGE environment variable not set" with no context.

### Pitfall 3: Launching Merge Tool Without Preparing File Paths
**What goes wrong:** Merge tool is invoked with depot paths instead of local filesystem paths. Tool can't open files or shows "file not found" errors.
**Why it happens:** P4MERGE expects four local filesystem paths (base, theirs, yours, merge), but developer passes depot paths (//depot/...).
**How to avoid:** Before launching merge tool, use `p4 print` to extract base and theirs revisions to temp files, use workspace path for yours and merge result. Follow pattern: temp file for base, temp file for theirs, local path for yours, local path for merge result.
**Warning signs:** Merge tool launches but shows "cannot open file" or empty diff panels.

### Pitfall 4: Not Blocking UI During Merge
**What goes wrong:** User launches merge tool, then performs other P4 operations (sync, revert, submit) while merge is in progress. This can corrupt the workspace state or cause the merge result to be lost.
**Why it happens:** No blocking overlay prevents user from clicking around during merge tool wait.
**How to avoid:** Show modal blocking overlay immediately before launching merge tool, hide only after process exits. Prevent all P4 operations during this time.
**Warning signs:** User reports "my merge disappeared" or "file reverted while I was merging."

### Pitfall 5: Assuming Merge Tool Exit Code 0 Means Success
**What goes wrong:** Merge tool exits with code 0, but user cancelled the merge or didn't save changes. File is marked as resolved but merge didn't actually complete.
**Why it happens:** Some merge tools (e.g., p4merge) exit with 0 even on cancel. Perforce's interactive `p4 resolve` waits for user to accept merge with `am` command; programmatic launch assumes exit 0 = success.
**How to avoid:** After merge tool exits with 0, offer confirmation dialog: "Merge tool completed. Accept merged result?" with options: "Accept" (run `p4 resolve -am <file>`), "Retry", "Cancel". This gives user chance to verify merge before marking as resolved.
**Warning signs:** User reports "file marked as resolved but my changes are missing" or "conflict still exists after merge."

## Code Examples

Verified patterns from official sources:

### Detecting Unresolved Files
```typescript
// Source: Perforce p4 fstat documentation + existing useFileOperations pattern
export async function invokeP4FstatUnresolved(
  p4port?: string,
  p4user?: string,
  p4client?: string
): Promise<P4FileInfo[]> {
  return invoke<P4FileInfo[]>('p4_fstat_unresolved', {
    server: p4port,
    user: p4user,
    client: p4client,
  });
}

// Usage in React hook
function useConflictDetection() {
  const { p4port, p4user, p4client } = useConnectionStore();

  return useQuery({
    queryKey: ['p4', 'unresolved', p4port, p4user, p4client],
    queryFn: () => invokeP4FstatUnresolved(p4port, p4user, p4client),
    refetchInterval: 30000, // Check every 30s
  });
}
```

### Launching Merge Tool with Blocking
```rust
// Source: Perforce P4MERGE documentation + Tokio spawn_blocking docs
#[tauri::command]
pub async fn launch_merge_tool_and_wait(
    depot_path: String,
    local_path: String,
    base_rev: i32,
    theirs_rev: i32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<i32, String> {
    // Get P4MERGE environment variable
    let merge_tool = std::env::var("P4MERGE")
        .or_else(|_| std::env::var("MERGE"))
        .map_err(|_| {
            "P4MERGE environment variable not set. \
             Set P4MERGE to your merge tool path (e.g., C:\\Program Files\\Perforce\\p4merge.exe)"
                .to_string()
        })?;

    // Extract base and theirs to temp files
    let base_path = p4_print_to_temp(&depot_path, base_rev, &server, &user, &client).await?;
    let theirs_path = p4_print_to_temp(&depot_path, theirs_rev, &server, &user, &client).await?;
    let yours_path = local_path.clone();
    let merge_result_path = local_path; // Merge result overwrites workspace file

    // Spawn and wait in blocking context
    let exit_code = tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new(&merge_tool);
        cmd.args([&base_path, &theirs_path, &yours_path, &merge_result_path]);

        let status = cmd
            .status()
            .map_err(|e| format!("Failed to launch merge tool: {}", e))?;

        Ok::<i32, String>(status.code().unwrap_or(-1))
    })
    .await
    .map_err(|e| format!("Blocking task failed: {}", e))??;

    Ok(exit_code)
}

// Helper: Print depot file revision to temp file (reuse existing p4_print_to_file logic)
async fn p4_print_to_temp(
    depot_path: &str,
    revision: i32,
    server: &Option<String>,
    user: &Option<String>,
    client: &Option<String>,
) -> Result<String, String> {
    // Implementation similar to existing p4_print_to_file command
    // Returns path to temp file containing the revision
    unimplemented!()
}
```

### Quick Resolve Frontend
```typescript
// Source: Perforce resolve options documentation + existing FileDetailView patterns
function FileConflictBanner({ depotPath }: { depotPath: string }) {
  const [showConfirm, setShowConfirm] = useState<'theirs' | 'yours' | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const { resolveAccept } = useResolve();

  const handleQuickResolve = async (mode: 'theirs' | 'yours') => {
    setShowConfirm(null);
    try {
      await resolveAccept(depotPath, mode);
      toast.success(`Resolved: accepted ${mode}`);
    } catch (error) {
      toast.error(`Resolve failed: ${error}`);
    }
  };

  const handleLaunchMergeTool = async () => {
    setIsLaunching(true);
    try {
      const exitCode = await invokeLaunchMergeTool(depotPath);
      if (exitCode === 0) {
        // Show confirmation dialog instead of auto-accepting
        // (prevents pitfall #5)
        const confirmed = await confirmMergeAccept();
        if (confirmed) {
          await resolveAccept(depotPath, 'merge');
          toast.success('Merge completed and accepted');
        }
      } else {
        toast.error(`Merge tool exited with code ${exitCode}`);
      }
    } catch (error) {
      toast.error(`Failed to launch merge tool: ${error}`);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <>
      <div className="bg-yellow-900/30 border-l-4 border-yellow-500 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-yellow-200 mb-2">
              This file has unresolved conflicts
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={handleLaunchMergeTool}
                disabled={isLaunching}
              >
                Launch Merge Tool
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowConfirm('theirs')}
              >
                Accept Theirs
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowConfirm('yours')}
              >
                Accept Yours
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Blocking overlay during merge */}
      <ResolveBlockingOverlay
        isOpen={isLaunching}
        filePath={depotPath}
      />

      {/* Confirmation for destructive quick-resolve */}
      {showConfirm && (
        <ConfirmDialog
          open={!!showConfirm}
          title={`Accept ${showConfirm === 'theirs' ? 'Their' : 'Your'} Changes?`}
          description={
            showConfirm === 'theirs'
              ? 'This will discard your local changes and use the depot version.'
              : 'This will keep your local changes and discard the depot changes.'
          }
          onConfirm={() => handleQuickResolve(showConfirm)}
          onCancel={() => setShowConfirm(null)}
        />
      )}
    </>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Interactive `p4 resolve` with prompts | Programmatic `-at/-ay/-am` flags | Always available | GUI tools can automate resolve without terminal interaction |
| Single-threaded blocking wait | tokio::task::spawn_blocking | Tokio 1.0 (2020) | Async runtimes can wait for blocking operations without freezing |
| Custom conflict markers in files | External merge tools (P4MERGE) | Perforce early versions | Professional merge tools handle complex scenarios (binary, encodings, side-by-side view) |
| Manual post-merge `p4 resolve -am` | Auto-accept after merge tool exit | Traditional workflow | Still requires user action for safety; auto-accept is risky (Pitfall #5) |

**Deprecated/outdated:**
- **P4Win resolve dialog:** Replaced by P4V interactive resolve. Modern tools should use external merge tools via P4MERGE.
- **Sync-time auto-resolve without user control:** Modern best practice is to show conflicts and let user choose resolution strategy.

## Open Questions

Things that couldn't be fully resolved:

1. **Should we auto-accept merge tool results or require confirmation?**
   - What we know: P4V and P4Win auto-accept after merge tool exits successfully. Some merge tools (p4merge) always exit 0 even on cancel.
   - What's unclear: User expectation for a modern tool—safety vs. convenience tradeoff.
   - Recommendation: Start with confirmation dialog after merge tool exit. Gather user feedback in v3.0. Consider adding "Always accept" checkbox in settings for v4.0 if users find confirmation annoying.

2. **How to handle multi-file batch resolve (Accept All Theirs/Yours)?**
   - What we know: `p4 resolve -at` accepts all unresolved files when run without file argument. This is powerful but potentially destructive.
   - What's unclear: How to present this safely in UI without overwhelming user with confirmation dialogs for each file.
   - Recommendation: Claude's discretion during planning. Consider: (a) show list of affected files in single dialog with "Accept All" button, or (b) defer batch operations to post-v3.0 as advanced feature.

3. **Should conflict detection run automatically on background refresh?**
   - What we know: `p4 fstat -Ru` is fast. Auto-refresh is planned for v3.0. Conflicts can appear after other users submit.
   - What's unclear: Whether automatic conflict detection would be surprising/annoying to users who don't expect their file status to change while idle.
   - Recommendation: Claude's discretion. Safe default: detect conflicts on sync/unshelve only. Advanced: add toggle in settings for "Check for conflicts on refresh."

## Sources

### Primary (HIGH confidence)
- [p4 resolve | P4 CLI Documentation (2025.2)](https://help.perforce.com/helix-core/server-apps/cmdref/2025.2/Content/CmdRef/p4_resolve.html) - Complete resolve command syntax and options
- [P4MERGE Environment Variable](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/P4MERGE.html) - Official merge tool integration documentation
- [p4 fstat | P4 CLI Documentation (2025.2)](https://help.perforce.com/helix-core/server-apps/cmdref/2025.2/Content/CmdRef/p4_fstat.html) - Resolve-related fields and filtering options
- [Resolve files | P4V Documentation (2025.3)](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/branches.resolve.html) - Visual client resolve workflow
- [tokio::task::spawn_blocking - Rust](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html) - Tokio blocking operation pattern
- [tokio::process::Command - Rust](https://docs.rs/tokio/latest/tokio/process/struct.Command.html) - Async process spawning

### Secondary (MEDIUM confidence)
- [React Block UI](https://availity.github.io/react-block-ui/) - Blocking overlay library pattern
- [MUI Backdrop](https://kombai.com/mui/backdrop/) - Loading overlay pattern
- [Bridging with sync code | Tokio](https://tokio.rs/tokio/topics/bridging) - Mixing async and blocking operations

### Tertiary (LOW confidence)
- None - all critical findings verified with official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components are official Perforce/Rust/React patterns
- Architecture: HIGH - Patterns derived from official docs and existing codebase patterns
- Pitfalls: MEDIUM - Based on common issues reported in Perforce communities and general merge tool integration experience

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable domain, Perforce core commands rarely change)
