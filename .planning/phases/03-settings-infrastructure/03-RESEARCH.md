# Phase 03: Settings & Infrastructure - Research

**Researched:** 2026-01-28
**Domain:** Application settings persistence, P4 connection management, UI state indicators
**Confidence:** HIGH

## Summary

Phase 03 implements a settings UI for configuring and persisting Perforce connection parameters, browsing available workspaces, and displaying connection status. The standard approach uses Tauri's official plugin-store for persistence, shadcn/ui Dialog+Form components for the settings UI, and react-hook-form with Zod for validation. For displaying connection status and workspace info, a dedicated header component with status badges is the established pattern.

The core challenge is bridging Tauri's backend storage with React's state management while handling async P4 commands that can fail due to network issues. The research confirms that Tauri 2.0's plugin-store is production-ready, Zustand's persist middleware is overkill when Tauri Store exists, and P4's `-ztag` output format is essential for reliable parsing.

**Primary recommendation:** Use `tauri-plugin-store` for settings persistence (not localStorage or Zustand persist), implement connection testing with retry logic for flaky VPN scenarios, and use optimistic UI updates with rollback on validation failure.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tauri-apps/plugin-store | 2.4.2 | Persistent key-value storage for settings | Official Tauri plugin, platform-aware paths, async-safe |
| react-hook-form | Latest | Form state and validation | Industry standard for React forms, minimal re-renders |
| zod | Latest | Schema validation | Type-safe validation, shares schema with RHF resolver |
| @hookform/resolvers | Latest | Zod integration with RHF | Official resolver for zod schemas |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Dialog | Current | Settings dialog container | Already in stack, consistent with app design |
| shadcn/ui Form | Current | Form wrapper for RHF | Provides Form components for shadcn integration |
| shadcn/ui Badge | Current | Status indicators | Standard for connection status display |
| shadcn/ui Select | Current | Workspace picker | Dropdown for workspace browsing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tauri-plugin-store | localStorage | localStorage is browser-specific, doesn't respect platform config paths |
| tauri-plugin-store | Zustand persist | Zustand persist adds complexity; Tauri Store is purpose-built |
| react-hook-form + zod | Manual validation | Hand-rolling validation loses type safety and increases bugs |
| Dialog | Separate settings page | Dialog keeps settings accessible without navigation |

**Installation:**
```bash
# Rust backend
cargo add tauri-plugin-store

# Frontend
npm install @tauri-apps/plugin-store react-hook-form zod @hookform/resolvers
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── stores/
│   └── settingsStore.ts        # Zustand store for UI state (not persistence)
├── components/
│   ├── SettingsDialog.tsx      # Main settings dialog
│   ├── ConnectionStatus.tsx    # Status badge component
│   └── Header.tsx              # Displays workspace/stream info
├── hooks/
│   └── useSettings.ts          # Hook for loading/saving settings
└── types/
    └── settings.ts             # Settings schema and Zod validation
```

### Pattern 1: Tauri Store Integration

**What:** Use Tauri Store as single source of truth, sync to Zustand on load for reactive UI
**When to use:** For all persistent settings (connection config, user preferences)
**Example:**
```typescript
// Source: https://v2.tauri.app/plugin/store/
import { load } from '@tauri-apps/plugin-store';

// Load settings from Tauri Store
const store = await load('settings.json', { autoSave: false });

// Get connection settings
const server = await store.get<string>('p4port');
const user = await store.get<string>('p4user');
const workspace = await store.get<string>('p4client');

// Save settings
await store.set('p4port', 'ssl:perforce.example.com:1666');
await store.set('p4user', 'jdoe');
await store.set('p4client', 'jdoe-dev');
await store.save(); // CRITICAL: Must call save() for persistence
```

### Pattern 2: Settings Form with Validation

**What:** Use react-hook-form with Zod schema for type-safe validation
**When to use:** All settings forms
**Example:**
```typescript
// Source: https://www.freecodecamp.org/news/react-form-validation-zod-react-hook-form/
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const settingsSchema = z.object({
  p4port: z.string().min(1, 'Server is required'),
  p4user: z.string().min(1, 'User is required'),
  p4client: z.string().min(1, 'Workspace is required'),
});

type SettingsForm = z.infer<typeof settingsSchema>;

const { register, handleSubmit, formState: { errors } } = useForm<SettingsForm>({
  resolver: zodResolver(settingsSchema),
});

const onSubmit = async (data: SettingsForm) => {
  // Validate connection before saving
  const isValid = await testP4Connection(data);
  if (isValid) {
    await saveSettings(data);
  }
};
```

### Pattern 3: P4 Workspace Browsing

**What:** Use `p4 -ztag clients -u $P4USER` to list available workspaces
**When to use:** Workspace picker in settings
**Example:**
```typescript
// Source: https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_clients.html
// Backend Rust command
#[tauri::command]
pub async fn p4_list_workspaces(user: String) -> Result<Vec<P4Client>, String> {
    let output = Command::new("p4")
        .args(["-ztag", "clients", "-u", &user])
        .output()
        .map_err(|e| format!("Failed to list workspaces: {}", e))?;

    // Parse -ztag output
    parse_ztag_clients(&String::from_utf8_lossy(&output.stdout))
}

// Frontend usage
const workspaces = await invoke<P4Client[]>('p4_list_workspaces', { user: 'jdoe' });
```

### Pattern 4: Connection Status Management

**What:** Use Zustand store for connection state, update via P4 command results
**When to use:** Displaying real-time connection status
**Example:**
```typescript
interface ConnectionState {
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  errorMessage?: string;
  workspace?: string;
  stream?: string;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  setStatus: (status, errorMessage) => set({ status, errorMessage }),
  setWorkspaceInfo: (workspace, stream) => set({ workspace, stream }),
}));
```

### Pattern 5: Status Badge in Header

**What:** Fixed header with workspace/stream info and connection badge
**When to use:** Always visible at top of app
**Example:**
```tsx
// Source: https://ui.shadcn.com/docs/components/badge
import { Badge } from "@/components/ui/badge"

export function Header() {
  const { status, workspace, stream } = useConnectionStore();

  return (
    <header className="h-12 border-b flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <span className="font-semibold">{workspace || 'No workspace'}</span>
        {stream && <span className="text-sm text-slate-400">{stream}</span>}
      </div>
      <Badge variant={status === 'connected' ? 'default' : 'destructive'}>
        {status}
      </Badge>
    </header>
  );
}
```

### Anti-Patterns to Avoid

- **Using localStorage for settings:** Tauri Store respects platform config directories; localStorage doesn't
- **Saving settings on every keystroke:** Debounce or save only on submit to avoid file I/O thrashing
- **Not calling `store.save()`:** Tauri Store requires explicit save for persistence
- **Disabling submit button during validation:** Keep button enabled, show errors on submit (UX best practice)
- **Testing connection on every field change:** Only test on submit to avoid spamming P4 server

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation | Custom validators per field | react-hook-form + zod | Loses type safety, error-prone, 10x more code |
| P4 output parsing | String splitting for p4 clients | `-ztag` flag with structured parser | Plain text output varies by version, `-ztag` is stable |
| Settings persistence | Custom file I/O | tauri-plugin-store | Platform paths, atomic writes, async-safe |
| Connection retry logic | setTimeout loops | Exponential backoff library | Easy to create thundering herd, miss edge cases |
| Status indicators | Custom CSS animations | shadcn/ui Badge | Accessibility, consistency, testing |

**Key insight:** Settings management looks simple but has many edge cases (concurrent writes, partial failures, validation ordering). Use proven libraries that handle atomicity, platform differences, and error recovery.

## Common Pitfalls

### Pitfall 1: Forgetting to Call `store.save()`

**What goes wrong:** Settings appear to save but disappear on app restart
**Why it happens:** Tauri Store requires explicit `save()` for persistence (unless `autoSave: true`)
**How to avoid:** Always call `await store.save()` after `store.set()`, or enable `autoSave` in load options
**Warning signs:** Settings work during session but reset on restart

### Pitfall 2: P4 Environment Variable Conflicts

**What goes wrong:** Settings UI shows different values than P4 actually uses
**Why it happens:** P4 has complex precedence: command-line args > P4CONFIG files > environment vars > registry
**How to avoid:** Always pass settings as command-line args (`-p`, `-u`, `-c`) to P4 commands, don't rely on environment
**Warning signs:** User changes settings but P4 commands still use old values

### Pitfall 3: Validating Connection Without Retry

**What goes wrong:** Settings save fails due to transient VPN hiccup, user thinks settings are broken
**Why it happens:** VPN connections can drop for 1-2 seconds during reconnect
**How to avoid:** Implement exponential backoff retry for connection validation (3 attempts, 500ms/1s/2s delays)
**Warning signs:** Settings work sometimes but fail randomly, especially after VPN reconnect

### Pitfall 4: Not Handling Missing Workspace

**What goes wrong:** User selects workspace that was deleted on server, app crashes or shows cryptic error
**Why it happens:** Workspace list is cached, server state can change
**How to avoid:** When loading settings, verify workspace still exists with `p4 -ztag clients -e <workspace>`, fallback to empty if missing
**Warning signs:** App crashes on startup after workspace deleted

### Pitfall 5: Inline Validation Before Field Blur

**What goes wrong:** User sees "Required" error while still typing first character
**Why it happens:** Validation triggered on every keystroke instead of on blur/submit
**How to avoid:** Use react-hook-form's `mode: 'onBlur'` or `mode: 'onSubmit'`, not `onChange`
**Warning signs:** Users complain about "naggy" validation errors

### Pitfall 6: Storing Passwords in Plain Text

**What goes wrong:** P4 password visible in settings.json file
**Why it happens:** P4 tickets (auth tokens) should be used instead of passwords
**How to avoid:** Never store P4PASSWD; use `p4 login` to generate ticket, store ticket path
**Warning signs:** Security audit flags plain text credentials

## Code Examples

Verified patterns from official sources:

### Loading and Saving Settings

```typescript
// Source: https://v2.tauri.app/plugin/store/
import { load } from '@tauri-apps/plugin-store';

export async function loadSettings(): Promise<P4Settings> {
  const store = await load('settings.json', { autoSave: false });

  return {
    p4port: await store.get<string>('p4port') || '',
    p4user: await store.get<string>('p4user') || '',
    p4client: await store.get<string>('p4client') || '',
  };
}

export async function saveSettings(settings: P4Settings): Promise<void> {
  const store = await load('settings.json', { autoSave: false });

  await store.set('p4port', settings.p4port);
  await store.set('p4user', settings.p4user);
  await store.set('p4client', settings.p4client);

  // CRITICAL: Must call save for persistence
  await store.save();
}
```

### Settings Dialog Component

```tsx
// Source: https://ui.shadcn.com/docs/components/dialog
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: async () => await loadSettings(),
  });

  const onSubmit = async (data: SettingsForm) => {
    try {
      // Test connection before saving
      await testConnection(data);
      await saveSettings(data);
      onOpenChange(false);
      toast.success('Settings saved');
    } catch (error) {
      toast.error(`Connection failed: ${error}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>P4 Connection Settings</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FormField name="p4port" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Server</FormLabel>
                <FormControl>
                  <Input placeholder="ssl:perforce.example.com:1666" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {/* User and Workspace fields similar */}
            <Button type="submit">Save Settings</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

### P4 Workspace Browsing

```rust
// Source: https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_clients.html
use std::collections::HashMap;
use std::process::Command;

#[derive(serde::Serialize)]
pub struct P4Workspace {
    pub name: String,
    pub root: String,
    pub stream: Option<String>,
}

#[tauri::command]
pub async fn p4_list_workspaces(
    server: String,
    user: String,
) -> Result<Vec<P4Workspace>, String> {
    let output = Command::new("p4")
        .args([
            "-p", &server,
            "-u", &user,
            "-ztag",
            "clients",
            "-u", &user,
        ])
        .output()
        .map_err(|e| format!("Failed to execute p4 clients: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("p4 clients failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_clients(&stdout)
}

fn parse_ztag_clients(output: &str) -> Result<Vec<P4Workspace>, String> {
    let mut workspaces = Vec::new();
    let mut current: HashMap<String, String> = HashMap::new();

    for line in output.lines() {
        let line = line.trim();

        if line.is_empty() {
            if !current.is_empty() {
                if let (Some(name), Some(root)) = (
                    current.get("client"),
                    current.get("Root")
                ) {
                    workspaces.push(P4Workspace {
                        name: name.clone(),
                        root: root.clone(),
                        stream: current.get("Stream").cloned(),
                    });
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

    // Handle last record
    if !current.is_empty() {
        if let (Some(name), Some(root)) = (
            current.get("client"),
            current.get("Root")
        ) {
            workspaces.push(P4Workspace {
                name: name.clone(),
                root: root.clone(),
                stream: current.get("Stream").cloned(),
            });
        }
    }

    Ok(workspaces)
}
```

### Connection Status Hook

```typescript
// Pattern for managing connection state
import { create } from 'zustand';

interface ConnectionState {
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  workspace: string | null;
  stream: string | null;
  errorMessage: string | null;

  setConnecting: () => void;
  setConnected: (workspace: string, stream?: string) => void;
  setDisconnected: () => void;
  setError: (message: string) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  workspace: null,
  stream: null,
  errorMessage: null,

  setConnecting: () => set({ status: 'connecting', errorMessage: null }),
  setConnected: (workspace, stream) => set({
    status: 'connected',
    workspace,
    stream: stream || null,
    errorMessage: null,
  }),
  setDisconnected: () => set({
    status: 'disconnected',
    workspace: null,
    stream: null,
    errorMessage: null,
  }),
  setError: (message) => set({
    status: 'error',
    errorMessage: message,
  }),
}));

// Usage: Update on successful P4 command
export function useP4Info() {
  const { setConnected, setError } = useConnectionStore();

  useEffect(() => {
    async function fetchInfo() {
      try {
        const info = await invoke<P4ClientInfo>('p4_info');
        setConnected(info.client_name, info.client_stream);
      } catch (error) {
        setError(String(error));
      }
    }
    fetchInfo();
  }, []);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage for Tauri apps | tauri-plugin-store | Tauri 2.0 (2024) | Platform-aware paths, atomic writes, no browser dependency |
| Manual form validation | react-hook-form + zod | 2023-2024 | Type safety, less boilerplate, better DX |
| String parsing p4 output | `-ztag` flag | Always available | Reliable parsing, version-independent |
| Blocking connection tests | Async with timeout | Modern async patterns | Non-blocking UI, better UX |
| Plain text passwords | P4 tickets via `p4 login` | P4 2010+ | Security, SSO support |

**Deprecated/outdated:**
- **localStorage in Tauri:** Use tauri-plugin-store instead (respects platform config paths)
- **Formik:** Use react-hook-form (better performance, smaller bundle)
- **Yup for validation:** Use Zod (better TypeScript integration, smaller)

## Open Questions

1. **Should settings auto-save on blur or require explicit save button?**
   - What we know: Auto-save is convenient but can save invalid states
   - What's unclear: User expectation for desktop app vs web app behavior
   - Recommendation: Use explicit "Save" button with unsaved changes warning on close (desktop app pattern)

2. **How to handle P4 ticket expiration?**
   - What we know: P4 tickets expire after 12 hours by default, require re-login
   - What's unclear: Should app prompt for login automatically or show error?
   - Recommendation: Detect "Perforce password (P4PASSWD) invalid or unset" error, trigger login flow with toast notification

3. **Connection status polling frequency?**
   - What we know: Constant polling hammers server (PROJECT.md says avoid)
   - What's unclear: How to detect connection loss without polling?
   - Recommendation: Only update connection status on P4 command results (passive detection), add manual "Test Connection" button in settings

## Sources

### Primary (HIGH confidence)
- [Tauri 2.0 Store Plugin Documentation](https://v2.tauri.app/plugin/store/) - Official API and usage
- [Tauri Store JavaScript Reference](https://v2.tauri.app/reference/javascript/store/) - TypeScript types and methods
- [P4 clients Command Reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_clients.html) - Official syntax and flags
- [Perforce Environment Variables](https://www.perforce.com/manuals/cmdref/Content/CmdRef/envars.html) - Precedence and configuration
- [shadcn/ui Dialog Component](https://ui.shadcn.com/docs/components/dialog) - Official component API
- [React Hook Form Documentation](https://ui.shadcn.com/docs/forms/react-hook-form) - shadcn integration
- [Zustand Persist Middleware](https://zustand.docs.pmnd.rs/middlewares/persist) - Official persist API

### Secondary (MEDIUM confidence)
- [Form Validation with Zod and React Hook Form](https://www.freecodecamp.org/news/react-form-validation-zod-react-hook-form/) - Tutorial with current best practices
- [Tauri Settings Persistence Discussion](https://github.com/tauri-apps/tauri/discussions/5557) - Community patterns
- [Error Message UX Best Practices](https://www.nngroup.com/articles/errors-forms-design-guidelines/) - NN/G guidelines
- [Unsaved Changes Pattern](https://cloudscape.design/patterns/general/unsaved-changes/) - AWS Cloudscape design system
- [Status Indicator Pattern](https://carbondesignsystem.com/patterns/status-indicator-pattern/) - IBM Carbon design system
- [Connection Retry Patterns](https://websockets.readthedocs.io/en/stable/reference/asyncio/client.html) - Exponential backoff examples

### Tertiary (LOW confidence)
- [Tauri Store Community Library](https://tb.dev.br/tauri-store/) - Third-party alternative with migration support
- [Database Migration Best Practices](https://enterprisecraftsmanship.com/posts/database-versioning-best-practices/) - General versioning patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Tauri plugin, established React ecosystem
- Architecture: HIGH - Patterns verified in official docs and community
- Pitfalls: MEDIUM - Derived from P4 behavior and Tauri Store docs, not extensive production testing

**Research date:** 2026-01-28
**Valid until:** 90 days (stable ecosystem, slow-moving technologies)
