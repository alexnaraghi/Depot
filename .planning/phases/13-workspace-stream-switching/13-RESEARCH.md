# Phase 13: Workspace & Stream Switching - Research

**Researched:** 2026-02-01
**Domain:** Perforce workspace and stream switching with UI state management
**Confidence:** HIGH

## Summary

This phase implements fast workspace and stream switching via header dropdowns in a Tauri/React/TypeScript application. Research focused on Perforce CLI commands for workspace/stream management, React state management patterns for connection switching, confirmation dialogs for data safety (shelving), and non-blocking UI patterns during P4 operations.

Key findings:
1. **P4 Commands**: Existing `p4_list_workspaces` command available; need `p4 streams` and `p4 client -o` for stream listing and client spec viewing
2. **State Management**: Connection state stored in Zustand (`connectionStore`), requires atomic updates during switch operations
3. **UI Patterns**: Radix UI Select/DropdownMenu components already integrated; Dialog pattern established for confirmations
4. **Shelving Safety**: Must use `p4 shelve` before stream switches when default CL has files to prevent work loss

**Primary recommendation:** Implement workspace switcher using Radix Select with connection store updates, stream switcher similarly with shelve confirmation dialog, and client spec viewer as read-only dialog with searchable/copyable fields.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Perforce CLI | Any | Workspace/stream operations | Native P4 command-line interface - only authoritative way to query/modify client specs and switch streams |
| @tauri-apps/api | 2.x | Rust backend invocations | Required for Tauri app architecture; handles all P4 command execution via Rust backend |
| Zustand | 5.0.10 | Global state management | Already used for connectionStore; lightweight, no Provider needed, perfect for workspace/stream state |
| @radix-ui/react-select | 2.2.6 | Accessible dropdowns | Installed UI primitive; keyboard-navigable, ARIA-compliant selects for workspace/stream pickers |
| @radix-ui/react-dialog | 1.1.15 | Modal confirmations | Installed; used for shelve confirmation and client spec viewer |
| react-hot-toast | 2.6.0 | User notifications | Installed; established pattern for "Switched to workspace X" toast messages |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.90.20 | P4 query caching | Invalidate all queries after workspace switch to force refresh |
| lucide-react | 0.563.0 | Icons | ChevronDown for dropdowns, FileText for client spec viewer button |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix Select | HTML native `<select>` | Native select has poor styling control and no search/filter support; Radix provides accessible, styleable dropdowns |
| Zustand | React Context | Context requires Provider wrapper and causes more re-renders; Zustand is already established in codebase |
| Shelve confirmation dialog | Silent auto-shelve | Dialog gives user visibility into what will be shelved and chance to cancel; aligns with "no surprises" UX principle |

**Installation:**
All dependencies already installed in package.json.

## Architecture Patterns

### Recommended Component Structure
```
src/components/
├── Header/                    # New folder for header components
│   ├── WorkspaceSwitcher.tsx  # Workspace dropdown
│   ├── StreamSwitcher.tsx     # Stream dropdown
│   └── ClientSpecDialog.tsx   # Read-only client spec viewer
└── dialogs/
    └── ShelveConfirmDialog.tsx # Confirmation before stream switch with pending files
```

### Pattern 1: Workspace Switcher with Connection State Update
**What:** Dropdown that fetches available workspaces for current server/user, allows selection, updates connection state atomically
**When to use:** Workspace switching (P4CLIENT change)
**Example:**
```typescript
// Source: Existing p4_list_workspaces command + connectionStore pattern
function WorkspaceSwitcher() {
  const { p4port, p4user, workspace, setConnected } = useConnectionStore();
  const [workspaces, setWorkspaces] = useState<P4Workspace[]>([]);

  // Fetch workspaces on mount
  useEffect(() => {
    if (p4port && p4user) {
      invokeListWorkspaces(p4port, p4user).then(setWorkspaces);
    }
  }, [p4port, p4user]);

  const handleSwitch = async (newClient: string) => {
    // Test connection with new client
    const info = await invokeP4Info(p4port, p4user, newClient);

    // Update connection store (atomic - all fields together)
    setConnected({
      workspace: info.client_name,
      stream: info.client_stream,
      server: info.server_address,
      user: info.user_name,
      p4port, p4user,
      p4client: newClient
    });

    // Invalidate all queries to trigger refresh
    queryClient.invalidateQueries();

    // Reset detail pane to workspace summary
    setDetailView({ type: 'workspace-summary' });

    toast.success(`Switched to workspace ${newClient}`);
  };

  return (
    <Select value={workspace} onValueChange={handleSwitch}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {workspaces.map(ws => (
          <SelectItem key={ws.name} value={ws.name}>
            {ws.name}
            {ws.root && <span className="text-xs text-muted-foreground ml-2">{ws.root}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Pattern 2: Stream Switcher with Pre-Switch Shelving
**What:** Check for opened files in default CL before switch; show confirmation dialog listing files to shelve; shelve on confirm
**When to use:** Stream switching (modifies client spec's Stream field)
**Example:**
```typescript
// Requires new Rust command: p4 client -i to modify client spec
async function switchStream(newStream: string) {
  // 1. Check for pending files in default CL
  const openedFiles = await invokeP4Opened(p4port, p4user, p4client);
  const defaultClFiles = openedFiles.filter(f => !f.changelist || f.changelist === 0);

  // 2. Show confirmation if default CL has files
  if (defaultClFiles.length > 0) {
    const confirmed = await showShelveConfirmDialog(defaultClFiles);
    if (!confirmed) return;

    // 3. Create temp CL and shelve
    const tempCl = await invokeP4CreateChange('Auto-shelve before stream switch');
    await invokeP4Reopen(defaultClFiles.map(f => f.depot_path), tempCl);
    await invokeP4Shelve(tempCl, []);
  }

  // 4. Modify client spec Stream field
  await invokeP4UpdateClientStream(p4client, newStream);

  // 5. Re-run p4 info to get updated state
  const info = await invokeP4Info(p4port, p4user, p4client);
  setConnected({...currentState, stream: info.client_stream});

  // 6. Invalidate queries and reset UI
  queryClient.invalidateQueries();
  setDetailView({ type: 'workspace-summary' });
  toast.success(`Switched to stream ${newStream}`);
}
```

### Pattern 3: Non-Blocking Loading State
**What:** Show loading indicator but keep UI responsive; allow cancel or close app during operation
**When to use:** All switch operations (they may be slow on large workspaces)
**Example:**
```typescript
// Use existing operation store pattern from useP4Command
function WorkspaceSwitcher() {
  const [isSwitching, setIsSwitching] = useState(false);

  const handleSwitch = async (newClient: string) => {
    setIsSwitching(true);
    try {
      await switchWorkspace(newClient);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <Select disabled={isSwitching} ...>
      {isSwitching && <Loader2 className="animate-spin" />}
    </Select>
  );
}
```

### Pattern 4: Client Spec Viewer (Read-Only Dialog)
**What:** Fetch `p4 client -o <workspace>`, parse form fields, display in searchable dialog with copy buttons
**When to use:** User wants to inspect workspace configuration (root, view mappings, options)
**Example:**
```typescript
// New command needed: p4 client -o
interface ClientSpec {
  Client: string;
  Root: string;
  Stream?: string;
  Owner: string;
  Description: string;
  View: string[];
  Options: Record<string, string>;
}

function ClientSpecDialog({ workspace }: Props) {
  const [spec, setSpec] = useState<ClientSpec | null>(null);

  useEffect(() => {
    if (open) {
      invokeP4ClientSpec(workspace).then(setSpec);
    }
  }, [open, workspace]);

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Client Spec: {workspace}</DialogTitle>
        </DialogHeader>

        {/* Show key fields with copy buttons */}
        <div className="space-y-4">
          <Field label="Root" value={spec?.Root} copyable />
          <Field label="Stream" value={spec?.Stream} copyable />
          <Field label="Owner" value={spec?.Owner} />

          {/* View mappings in monospace with line numbers */}
          <div>
            <Label>View</Label>
            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
              {spec?.View.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Anti-Patterns to Avoid
- **Direct P4PORT/P4USER env var manipulation**: Always use connection store + Tauri command args; env vars can be stale or conflict with settings
- **Switching without query invalidation**: Must invalidate all TanStack Query caches after switch; otherwise UI shows stale workspace data
- **Modal blocking during switch**: Never block UI thread during P4 operations; use async with loading state
- **Switching streams without shelve check**: Perforce will ERROR if default CL has files and you change Stream field; must shelve first

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parsing `p4 client -o` output | Custom string parser | Rust `-ztag` parser or manual form parsing | P4 form format is whitespace-sensitive and has edge cases (multiline descriptions, special chars) |
| Dropdown filtering | Custom fuzzy search | Radix Select with built-in search or cmdk | Radix handles keyboard nav, ARIA, and filtering; cmdk used elsewhere in codebase |
| Stream list caching | Manual cache with timeout | TanStack Query | Query already handles stale-while-revalidate, deduping, and cache invalidation |
| Workspace change detection | Custom comparison logic | Zustand selector with shallow equality | Zustand handles change detection and only re-renders components that use changed slices |

**Key insight:** Perforce client specs are complex forms with nested data (View mappings can have hundreds of lines). Don't try to build a parser from scratch - use P4's `-ztag` or existing form parsing utilities.

## Common Pitfalls

### Pitfall 1: Stale UI After Workspace Switch
**What goes wrong:** User switches workspace, but file tree still shows old workspace files
**Why it happens:** TanStack Query cache isn't invalidated after connection state changes; queries keep serving stale data
**How to avoid:** Always call `queryClient.invalidateQueries()` after updating connectionStore
**Warning signs:** UI doesn't refresh; "Workspace refreshed" toast without visual change

### Pitfall 2: Stream Switch Fails with "Files Open in Default Changelist"
**What goes wrong:** User tries to switch streams, P4 rejects with error because default CL has pending files
**Why it happens:** Changing client spec's Stream field is like re-syncing - P4 won't allow it if local edits exist
**How to avoid:** Always check for default CL files before switch; shelve them to a numbered CL first
**Warning signs:** Error message "Can't switch streams - submit or revert files in changelist default first"

### Pitfall 3: Race Condition Between Switch and Query Refresh
**What goes wrong:** Switch operation completes, but queries fire with OLD connection args, then UI shows wrong data
**Why it happens:** TanStack Query hooks read connection args from store; if queries refetch before store update commits, they use stale values
**How to avoid:** Update connectionStore atomically in single `setConnected()` call (not individual fields); then invalidate queries
**Warning signs:** Flicker where UI briefly shows old workspace data before correcting

### Pitfall 4: Numbered Changelists During Stream Switch
**What goes wrong:** User has opened files in numbered CLs, switches streams, files disappear or become orphaned
**Why it happens:** Stream switch modifies client View, which can make depot paths unreachable from new stream
**How to avoid:** Show confirmation listing ALL opened files (default + numbered CLs), shelve ALL before switch
**Warning signs:** User reports "lost work" after stream switch

### Pitfall 5: P4CONFIG Interference
**What goes wrong:** Switch operation succeeds but UI still shows old workspace; CLI commands outside app show different workspace
**Why it happens:** P4CONFIG file in working directory overrides P4CLIENT env var
**How to avoid:** Rust commands already clear P4CONFIG env var when explicit args provided (see `apply_connection_args` in p4.rs)
**Warning signs:** P4 CLI and app UI disagree on current workspace

## Code Examples

Verified patterns from codebase analysis:

### Connection State Management
```typescript
// Source: src/stores/connectionStore.ts (existing pattern)
interface ConnectionState {
  workspace: string | null;
  stream: string | null;
  p4port: string | null;
  p4user: string | null;
  p4client: string | null;
  setConnected: (info: {...}) => void;
}

// Atomic update - all fields together
setConnected({
  workspace: info.client_name,
  stream: info.client_stream,
  server: info.server_address,
  user: info.user_name,
  p4port: savedSettings.p4port,
  p4user: savedSettings.p4user,
  p4client: savedSettings.p4client,
});
```

### Toast Notification Pattern
```typescript
// Source: Multiple files in codebase
import toast from 'react-hot-toast';

// Success pattern
toast.success('Switched to workspace my-workspace');

// Error pattern
toast.error(`Failed to switch workspace: ${error}`);

// With ID for deduplication
toast.success('Operation complete', { id: 'workspace-switch' });
```

### Query Invalidation After State Change
```typescript
// Source: src/components/MainLayout.tsx (refresh pattern)
await Promise.all([
  queryClient.invalidateQueries({ queryKey: ['p4', 'opened'], refetchType: 'all' }),
  queryClient.invalidateQueries({ queryKey: ['p4', 'changes'], refetchType: 'all' }),
]);

// Simpler: invalidate ALL P4 queries
queryClient.invalidateQueries();
```

### Detail Pane Reset
```typescript
// Source: src/stores/detailPaneStore.ts
const setDetailView = useDetailPaneStore(s => s.setDetailView);

// After switch, reset to workspace summary
setDetailView({ type: 'workspace-summary' });
```

## New Commands Required

### p4 streams (List Available Streams)
**Command:** `p4 -ztag streams`
**Purpose:** Fetch list of streams for dropdown
**Rust Implementation:**
```rust
#[tauri::command]
pub async fn p4_list_streams(
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4Stream>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["-ztag", "streams"]);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute p4 streams: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_streams(&stdout)
}

#[derive(Debug, Clone, Serialize)]
pub struct P4Stream {
    pub name: string,
    pub stream: String,      // Full stream path (//streamdepot/main)
    pub parent: Option<String>,
    pub type_: String,       // mainline, development, release
    pub description: String,
}
```

### p4 client -o (Get Client Spec)
**Command:** `p4 -ztag client -o <workspace>`
**Purpose:** Fetch client spec for read-only viewer
**Rust Implementation:**
```rust
#[tauri::command]
pub async fn p4_get_client_spec(
    workspace: String,
    server: Option<String>,
    user: Option<String>,
) -> Result<P4ClientSpec, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &None);
    cmd.args(["-ztag", "client", "-o", &workspace]);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute p4 client -o: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_client_spec(&stdout)
}

#[derive(Debug, Clone, Serialize)]
pub struct P4ClientSpec {
    pub client: String,
    pub root: String,
    pub stream: Option<String>,
    pub owner: String,
    pub description: String,
    pub options: HashMap<String, String>,  // allwrite, clobber, compress, etc.
    pub view: Vec<String>,  // View mapping lines
}
```

### p4 client -i (Update Client Spec - Stream Switch)
**Command:** `p4 client -i` with modified form
**Purpose:** Change client's Stream field to switch streams
**Rust Implementation:**
```rust
#[tauri::command]
pub async fn p4_update_client_stream(
    workspace: String,
    new_stream: String,
    server: Option<String>,
    user: Option<String>,
) -> Result<(), String> {
    // 1. Get current client spec
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &Some(workspace.clone()));
    cmd.args(["client", "-o", &workspace]);

    let output = cmd.output()
        .map_err(|e| format!("Failed to get client spec: {}", e))?;

    let form = String::from_utf8_lossy(&output.stdout);

    // 2. Modify Stream field in form
    let mut new_form = String::new();
    for line in form.lines() {
        if line.starts_with("Stream:") {
            new_form.push_str(&format!("Stream:\t{}\n", new_stream));
        } else {
            new_form.push_str(line);
            new_form.push('\n');
        }
    }

    // 3. Submit modified form via p4 client -i
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &Some(workspace));
    cmd.args(["client", "-i"]);
    cmd.stdin(Stdio::piped());

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn p4 client -i: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(new_form.as_bytes())
            .map_err(|e| format!("Failed to write form: {}", e))?;
    }

    let result = child.wait_with_output()
        .map_err(|e| format!("Failed to update client: {}", e))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Settings modal for workspace change | Header dropdown switcher | 2024+ (modern Git UIs) | Faster switching, less cognitive overhead |
| Sync all files after stream switch | Smart View-based sync | P4 2016+ | Only syncs files in new stream's View, faster switches |
| Manual shelve before switch | Auto-shelve with confirmation | UX best practice | Prevents work loss, reduces friction |
| Read-only client spec in terminal | In-app spec viewer with search/copy | Modern desktop apps | Better discoverability, no context switching |

**Deprecated/outdated:**
- **Direct env var manipulation**: Old approach was to set P4CLIENT env var globally; modern approach uses `-c` flag per-command for isolation
- **Blocking UI during switch**: Old desktop apps froze UI; modern apps use async with progress indicators

## Open Questions

Things that couldn't be fully resolved:

1. **Should we auto-sync after stream switch?**
   - What we know: P4 doesn't auto-sync; stream switch just changes View mapping
   - What's unclear: Does user expect files to update immediately, or sync manually?
   - Recommendation: Don't auto-sync (could be slow); show toast "Stream switched - sync to get latest files" with Sync button. Let user control timing.

2. **How to handle numbered CLs during stream switch?**
   - What we know: Numbered CLs can have files that may not exist in new stream's View
   - What's unclear: Should we shelve numbered CL files too, or only default CL?
   - Recommendation: Show confirmation listing ALL opened files (default + numbered); shelve all to prevent data loss. Better safe than sorry.

3. **Should workspace dropdown show only stream workspaces, or all workspaces?**
   - What we know: `p4_list_workspaces` returns all workspaces for user, including non-stream workspaces
   - What's unclear: Should we filter to only stream-capable workspaces?
   - Recommendation: Show all workspaces; disable stream switcher if current workspace has no Stream field. Gives user full visibility.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis (src/stores/connectionStore.ts, src/components/MainLayout.tsx, src-tauri/src/commands/p4.rs)
- Perforce Command Reference (p4 client, p4 streams, p4 shelve commands) - verified via existing command implementations

### Secondary (MEDIUM confidence)
- Radix UI documentation (Select, Dialog components) - installed versions confirmed in package.json
- TanStack Query patterns - observed in existing code (invalidateQueries usage)

### Tertiary (LOW confidence)
- None - all research grounded in existing codebase patterns and verified P4 command capabilities

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and in use
- Architecture: HIGH - patterns observed directly from codebase
- Pitfalls: HIGH - derived from P4 command behavior and existing codebase patterns

**Research date:** 2026-02-01
**Valid until:** ~30 days (stable domain - Perforce CLI and React patterns don't change rapidly)
