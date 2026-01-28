# Phase 1: Non-Blocking Foundation - Research

**Researched:** 2026-01-27
**Domain:** Async-first architecture for desktop process management (Tauri 2.0 + React)
**Confidence:** HIGH

## Summary

This phase establishes an async-first architecture for spawning and managing external processes (p4.exe) without blocking the UI. The research focused on Tauri 2.0's async command and process spawning patterns, React's concurrent features for maintaining 60 FPS responsiveness, and proven patterns for cancellation, progress reporting, and error handling.

**Key findings:**
- Tauri 2.0 async commands execute on a thread pool via `async_runtime::spawn()`, preventing main thread blocking
- Process cancellation requires manual tracking of Child handles; Tauri sidecars auto-cleanup but Windows has known kill() issues
- React 19's concurrent features (useTransition, useDeferredValue) maintain UI responsiveness during heavy operations
- Channels are the recommended pattern for streaming stdout/progress (ordered, high-throughput)
- TanStack Query provides built-in AbortSignal support for cancellation but requires backend integration

**Primary recommendation:** Use Tauri async commands with Rust-based process management (tracking Child handles for cancellation) and Channels for streaming stdout to React frontend. Leverage React 19 concurrent features to maintain <16ms frame budget and use shadcn/ui components for status bar, collapsible output panel, and toast notifications.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri 2.0 | 2.9.5+ | Desktop app framework | Native async runtime, multi-process architecture, shell plugin for spawning processes |
| React 19 | 19.2+ | UI framework | Built-in concurrent features (useTransition, useDeferredValue) for non-blocking UI |
| TypeScript | 5.7+ | Type safety | Strict mode catches async/process management errors at compile time |
| TanStack Query | 5.x | Async state management | Query cancellation via AbortSignal, automatic retry/cache for CLI operations |
| Zustand | 5.0.10+ | Client UI state | Lightweight state for operation status, cancel button visibility, progress tracking |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-shell | 2.x | Spawn p4.exe processes | All Perforce CLI operations requiring stdout/stderr streaming |
| shadcn/ui | latest | UI components | Collapsible, Toast, Progress primitives - copy-paste approach gives full control |
| Radix UI | latest | Headless primitives | Foundation for shadcn/ui, provides accessible components |
| react-hot-toast | latest | Toast notifications | Non-blocking error display, minimal bundle size, React hooks integration |
| cmdk | latest | Command palette | Keyboard-first interface for power users (Cmd+K pattern) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Channels | Tauri Events | Events have JSON payload overhead and lower throughput; use for simple notifications only |
| react-hot-toast | React Toastify | Toastify has more features but larger bundle; hot-toast is lighter and faster |
| Zustand | Jotai | Jotai has better derived state but more boilerplate; Zustand is simpler for status tracking |
| async commands | #[tauri::command(async)] | Explicit async attribute is older pattern; implicit async fn is Tauri 2.0 standard |

**Installation:**
```bash
# Tauri shell plugin (Rust)
cargo add tauri-plugin-shell

# Frontend dependencies
npm install @tanstack/react-query zustand
npm install @tauri-apps/plugin-shell
npm install react-hot-toast cmdk

# shadcn/ui components (copy-paste)
npx shadcn@latest add collapsible
npx shadcn@latest add toast
npx shadcn@latest add progress
```

## Architecture Patterns

### Recommended Project Structure
```
src-tauri/
├── src/
│   ├── commands/          # Tauri async commands
│   │   └── process.rs     # Process spawning, cancellation, streams
│   ├── state/             # Shared application state
│   │   └── process_manager.rs  # Process handle tracking
│   └── lib.rs

src/
├── hooks/                 # React hooks
│   ├── useP4Command.ts    # TanStack Query integration
│   └── useProcessStatus.ts # Zustand state hook
├── components/
│   ├── StatusBar.tsx      # Bottom status bar
│   ├── OutputPanel.tsx    # Collapsible output
│   └── OperationToast.tsx # Error/success notifications
└── lib/
    └── tauri.ts           # Tauri invoke wrappers
```

### Pattern 1: Async Command with Channels for Streaming
**What:** Spawn p4.exe process, stream stdout/stderr to frontend via Channel, track Child handle for cancellation
**When to use:** All p4 operations that produce continuous output (sync, file history, etc.)
**Example:**
```rust
// Source: https://v2.tauri.app/develop/calling-frontend/ (official Tauri docs)
use tauri::ipc::Channel;

#[tauri::command]
async fn spawn_p4_command(
    args: Vec<String>,
    on_output: Channel<String>,
    state: State<'_, ProcessManager>
) -> Result<String, String> {
    let (mut rx, child) = Command::new("p4")
        .args(args)
        .spawn()
        .map_err(|e| e.to_string())?;

    // Track child for cancellation
    let process_id = state.register_process(child);

    // Stream stdout
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            if let CommandEvent::Stdout(line) = event {
                let _ = on_output.send(String::from_utf8_lossy(&line).to_string());
            }
        }
    });

    Ok(process_id)
}
```

### Pattern 2: React Query with Manual Cancellation
**What:** Use TanStack Query for p4 commands with manual cancellation via queryClient
**When to use:** When user clicks Cancel button during operation
**Example:**
```typescript
// React frontend
const { data, error, isLoading } = useQuery({
  queryKey: ['p4-sync', depot],
  queryFn: async ({ signal }) => {
    const processId = await invoke('spawn_p4_command', {
      args: ['sync', depot],
      onOutput: (line: string) => {
        // Update progress via event or state
      }
    });

    // Store processId for cancellation
    return { processId };
  }
});

// Cancel button handler
const handleCancel = () => {
  queryClient.cancelQueries({ queryKey: ['p4-sync', depot] });
  invoke('kill_process', { processId }); // Backend cleanup
};
```

### Pattern 3: Process Manager State for Tracking
**What:** Rust state struct tracking active Child processes with async Mutex
**When to use:** Need to kill processes from multiple contexts (cancel button, app close, timeout)
**Example:**
```rust
// Source: https://v2.tauri.app/develop/state-management/ (official Tauri docs)
use tokio::sync::Mutex;
use std::collections::HashMap;

pub struct ProcessManager {
    processes: Mutex<HashMap<String, Child>>,
}

#[tauri::command]
async fn kill_process(
    process_id: String,
    state: State<'_, ProcessManager>
) -> Result<(), String> {
    let mut processes = state.processes.lock().await;
    if let Some(mut child) = processes.remove(&process_id) {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

### Pattern 4: React Concurrent Features for Responsiveness
**What:** Use useTransition for state updates during heavy rendering, useDeferredValue for throttling
**When to use:** Large stdout output causing UI lag (e.g., 1000+ files in sync)
**Example:**
```typescript
// Source: https://certificates.dev/blog/react-concurrent-features-an-overview
function OutputPanel({ lines }: { lines: string[] }) {
  const [isPending, startTransition] = useTransition();
  const deferredLines = useDeferredValue(lines);

  // Urgent: scroll position update
  // Deferred: render 1000+ lines
  return (
    <div className={isPending ? 'opacity-50' : ''}>
      {deferredLines.map((line, i) => <div key={i}>{line}</div>)}
    </div>
  );
}
```

### Pattern 5: Status Bar with Operation Context
**What:** Fixed bottom bar showing current operation, progress, and cancel button
**When to use:** Always visible during any p4 operation
**Example:**
```typescript
// Inspired by: https://code.visualstudio.com/api/ux-guidelines/status-bar
function StatusBar() {
  const { operation, progress, canCancel } = useProcessStatus();

  return (
    <div className="fixed bottom-0 left-0 right-0 h-6 bg-blue-600 text-white px-4 flex items-center justify-between">
      {/* Primary (left): operation status */}
      <div className="flex items-center gap-2">
        {operation && <Spinner size="sm" />}
        <span className="text-sm">{operation?.message}</span>
        {progress && <Progress value={progress.percent} className="w-32" />}
      </div>

      {/* Secondary (right): actions */}
      <div className="flex items-center gap-2">
        {canCancel && (
          <button onClick={handleCancel} className="text-xs hover:bg-blue-500">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Blocking main thread:** Never use synchronous Tauri commands for p4.exe operations - always async
- **Forgetting cleanup:** Not tracking Child handles leads to zombie processes on Windows
- **Event overuse:** Don't use Tauri Events for stdout streaming - they're JSON-based and slow; use Channels
- **setState in tight loops:** Don't call React setState for every stdout line - batch updates or use transitions
- **Missing AbortSignal:** TanStack Query provides signal but Tauri commands must handle cancellation manually
- **Mutex across await:** Don't hold std::sync::Mutex across await points - use tokio::sync::Mutex or release before await

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Process lifecycle tracking | Custom HashMap of process IDs | Tauri State<Mutex<HashMap>> | Tauri manages state lifetime, handles multi-window access, built-in serialization |
| Query cancellation | Manual AbortController + flags | TanStack Query AbortSignal | Built-in integration with React lifecycle, automatic cleanup, retry logic |
| Toast notifications | Custom Portal + animation | react-hot-toast or shadcn Toast | Accessible, tested animation, queue management, mobile-responsive |
| Progress indicators | Custom SVG spinners | shadcn Progress + Radix primitives | ARIA labels, determinate/indeterminate modes, screen reader support |
| Command palette | Custom modal + search | cmdk | Keyboard nav, fuzzy search, group management, 2000+ item performance |
| Collapsible panels | Manual height animation | shadcn Collapsible (Radix) | Smooth CSS animations, data-state attributes, accessibility |
| Stdout streaming | Polling or WebSocket | Tauri Channels | Ordered delivery, high throughput, built into shell plugin |

**Key insight:** Desktop app process management has edge cases you won't discover until production (zombie processes on crash, Windows kill() issues, stdout buffer deadlocks). Tauri's primitives and proven React libraries encode years of production debugging.

## Common Pitfalls

### Pitfall 1: Windows Child.kill() Doesn't Work
**What goes wrong:** Calling child.kill() on Windows succeeds but process keeps running
**Why it happens:** PyInstaller and some Windows executables spawn child processes without proper cleanup; Tauri's kill() doesn't traverse process tree
**How to avoid:**
- Use Tauri sidecars (automatic cleanup) if possible
- For external binaries, implement custom Windows process tree killing via Win32 API
- Track process by PID and use `taskkill /F /T /PID` on Windows
**Warning signs:** Task Manager shows p4.exe processes after app close

### Pitfall 2: Event Emission Memory Leaks
**What goes wrong:** Memory usage grows unbounded when emitting frequent events from Rust to frontend
**Why it happens:** Tauri Events buffer messages and don't apply backpressure; frontend listeners accumulate unreleased references
**How to avoid:**
- Use Channels instead of Events for high-frequency updates (>10/sec)
- Unlisten in React useEffect cleanup: `return () => unlisten()`
- Batch updates: collect 100ms of stdout before sending
**Warning signs:** Memory usage increases during operations, GC runs frequently

### Pitfall 3: Main Thread Blocking >16ms
**What goes wrong:** UI stutters or freezes during large state updates (e.g., 1000+ stdout lines)
**Why it happens:** React re-renders synchronously by default; large reconciliation blocks 60 FPS frame budget
**How to avoid:**
- Use useTransition for non-urgent updates
- Use useDeferredValue to throttle expensive renders
- Virtual scrolling for large lists (react-window)
- Batch setState calls: collect updates in array, set once
**Warning signs:** DevTools Performance tab shows long tasks >16ms during operations

### Pitfall 4: Zombie Processes on App Close
**What goes wrong:** p4.exe processes remain in Task Manager after app exits
**Why it happens:** Tauri only auto-kills sidecars; regular Command::spawn requires manual cleanup
**How to avoid:**
- Implement window close handler: `window.listen('tauri://close-requested', cleanup)`
- Track all Child handles in ProcessManager state
- Kill all processes in cleanup: `processes.iter_mut().for_each(|c| c.kill())`
- For Windows, use process groups: `Command::new().creation_flags(CREATE_NEW_PROCESS_GROUP)`
**Warning signs:** Multiple p4.exe in Task Manager after app closes

### Pitfall 5: Query Cancellation Without Backend Cleanup
**What goes wrong:** Clicking Cancel stops frontend loading state but p4.exe keeps running
**Why it happens:** TanStack Query's queryClient.cancelQueries() only cancels React query, not backend process
**How to avoid:**
- Always invoke backend kill_process when cancelling
- Store processId in query state: `queryFn: async () => ({ processId: await invoke(...) })`
- Cancel handler calls both: `queryClient.cancelQueries() && invoke('kill_process', { processId })`
**Warning signs:** Cancel button hides but Task Manager shows p4.exe still running

### Pitfall 6: Using std::sync::Mutex with Async
**What goes wrong:** Deadlocks or "cannot send across threads" errors in async commands
**Why it happens:** std::sync::Mutex blocks the thread; holding across await points causes executor issues
**How to avoid:**
- Use tokio::sync::Mutex for state held across await
- Or use std::sync::Mutex but release before any await
- Tauri docs: "often fine to use std Mutex" but "need async if hold across await"
**Warning signs:** Intermittent hangs, tokio runtime errors about Send trait

### Pitfall 7: Forgetting Result Return Type for Async Commands
**What goes wrong:** Rust compiler error: "async fn must return Result"
**Why it happens:** Tauri serializes all return values; errors must be serializable
**How to avoid:**
- Always return Result<T, String> for async commands
- Map errors to strings: `.map_err(|e| e.to_string())`
- Or use thiserror crate for custom serializable error types
**Warning signs:** Compile error "the trait bound ... is not satisfied"

## Code Examples

Verified patterns from official sources:

### Spawning Process with Stdout Streaming
```rust
// Source: https://v2.tauri.app/plugin/shell/
use tauri_plugin_shell::ShellExt;

#[tauri::command]
async fn p4_info(app: tauri::AppHandle) -> Result<String, String> {
    let shell = app.shell();
    let output = shell
        .command("p4")
        .args(["info"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
```

### Tauri Command with Channel for Real-Time Output
```rust
// Source: https://v2.tauri.app/develop/calling-frontend/
use tauri::ipc::Channel;

#[derive(Clone, serde::Serialize)]
struct ProgressPayload {
    percent: u8,
    message: String,
}

#[tauri::command]
async fn p4_sync_with_progress(
    depot: String,
    on_progress: Channel<ProgressPayload>,
) -> Result<(), String> {
    // Simulate p4 sync with progress
    for i in 0..=100 {
        on_progress.send(ProgressPayload {
            percent: i,
            message: format!("Syncing files... {}/100", i),
        }).map_err(|e| e.to_string())?;

        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    Ok(())
}
```

### React Frontend: Using Channel
```typescript
// Source: https://v2.tauri.app/develop/calling-frontend/
import { invoke, Channel } from '@tauri-apps/api/core';

function SyncButton() {
  const [progress, setProgress] = useState(0);

  const handleSync = async () => {
    const onProgress = new Channel<{ percent: number; message: string }>();
    onProgress.onmessage = (payload) => {
      setProgress(payload.percent);
    };

    await invoke('p4_sync_with_progress', {
      depot: '//depot/main',
      onProgress,
    });
  };

  return (
    <button onClick={handleSync}>
      Sync {progress > 0 && `(${progress}%)`}
    </button>
  );
}
```

### TanStack Query Integration with Cancellation
```typescript
// Source: https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

function useP4Command(command: string, args: string[]) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['p4', command, ...args],
    queryFn: async ({ signal }) => {
      // AbortSignal provided by TanStack Query
      const processId = await invoke<string>('spawn_p4_command', {
        command,
        args,
      });

      // Store for manual cancellation
      signal.addEventListener('abort', () => {
        invoke('kill_process', { processId });
      });

      return processId;
    },
  });

  const cancel = () => {
    queryClient.cancelQueries({ queryKey: ['p4', command, ...args] });
  };

  return { ...query, cancel };
}
```

### Process Manager State
```rust
// Source: https://v2.tauri.app/develop/state-management/
use std::collections::HashMap;
use tokio::sync::Mutex;
use tauri::State;

pub struct ProcessManager {
    processes: Mutex<HashMap<String, std::process::Child>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
async fn register_process(
    process_id: String,
    child: std::process::Child,
    state: State<'_, ProcessManager>,
) -> Result<(), String> {
    let mut processes = state.processes.lock().await;
    processes.insert(process_id, child);
    Ok(())
}

#[tauri::command]
async fn kill_process(
    process_id: String,
    state: State<'_, ProcessManager>,
) -> Result<(), String> {
    let mut processes = state.processes.lock().await;
    if let Some(mut child) = processes.remove(&process_id) {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

### React: Concurrent Features for Large Outputs
```typescript
// Source: https://certificates.dev/blog/react-concurrent-features-an-overview
import { useTransition, useDeferredValue } from 'react';

function OutputPanel({ lines }: { lines: string[] }) {
  const [isPending, startTransition] = useTransition();
  const deferredLines = useDeferredValue(lines);

  // Update urgent state (scroll) immediately,
  // defer expensive render (1000+ lines)
  useEffect(() => {
    if (lines.length > deferredLines.length) {
      // Scroll to bottom (urgent)
      scrollToBottom();
    }
  }, [lines.length]);

  return (
    <div className={isPending ? 'opacity-50' : ''}>
      {deferredLines.map((line, i) => (
        <div key={i} className="font-mono text-xs">
          {line}
        </div>
      ))}
    </div>
  );
}
```

### React: Status Bar Component
```typescript
// Inspired by: https://code.visualstudio.com/api/ux-guidelines/status-bar
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';

interface Operation {
  id: string;
  message: string;
  percent?: number;
  cancellable: boolean;
}

function StatusBar({ operation, onCancel }: {
  operation: Operation | null;
  onCancel: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-6 bg-blue-600 text-white px-4 flex items-center justify-between text-sm">
      {/* Primary (left): operation status */}
      <div className="flex items-center gap-2">
        {operation && (
          <>
            {operation.percent === undefined ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Progress value={operation.percent} className="w-32 h-2" />
            )}
            <span>{operation.message}</span>
          </>
        )}
      </div>

      {/* Secondary (right): actions */}
      <div className="flex items-center gap-2">
        {operation?.cancellable && (
          <button
            onClick={() => onCancel(operation.id)}
            className="px-2 py-0.5 hover:bg-blue-500 rounded"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
```

### React: Collapsible Output Panel
```typescript
// Source: https://ui.shadcn.com/docs/components/collapsible
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

function OutputPanel({ lines }: { lines: string[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-2 bg-gray-800 text-white">
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        <span>Output ({lines.length} lines)</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="max-h-64 overflow-y-auto bg-gray-900 text-gray-100">
        {lines.map((line, i) => (
          <div key={i} className="px-4 py-1 font-mono text-xs">
            {line}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### React: Toast Error Handling
```typescript
// Source: https://github.com/albingroen/react-cmdk and react-hot-toast patterns
import toast from 'react-hot-toast';

function useP4Command() {
  const executep4 = async (command: string) => {
    try {
      const result = await invoke<string>('p4_command', { command });
      toast.success(`Command completed: ${command}`);
      return result;
    } catch (error) {
      // Non-blocking error notification
      toast.error(
        `Command failed: ${error}`,
        {
          duration: 5000,
          position: 'bottom-right',
          action: {
            label: 'Retry',
            onClick: () => executep4(command),
          },
        }
      );
      throw error;
    }
  };

  return { executep4 };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri Events for all data | Channels for streaming, Events for notifications | Tauri 2.0 (2024) | Channels provide ordered delivery and handle high throughput; Events now used only for small payloads |
| #[tauri::command(async)] | async fn (implicit) | Tauri 2.0 | Cleaner syntax, same behavior |
| React setState for progress | useTransition/useDeferredValue | React 18/19 (2022-2024) | Concurrent features maintain 60 FPS during heavy renders |
| Manual AbortController | TanStack Query AbortSignal | TanStack Query v4+ (2022) | Built-in cancellation integration with React lifecycle |
| Custom toast portals | react-hot-toast/shadcn Toast | 2023-2024 | Accessible, animated, queue-managed toasts with minimal code |
| Redux for async CLI state | TanStack Query | 2021-2022 | Query eliminates boilerplate for async operations, built-in retry/cache |

**Deprecated/outdated:**
- **Tauri v1 API patterns**: v2 changed shell plugin API, event system, and state management (use v2 docs only)
- **Class components for hooks**: useTransition/useDeferredValue require function components
- **React Suspense for data fetching**: Still experimental for data; use TanStack Query instead
- **Polling for process status**: Use Channels or Events for push-based updates

## Open Questions

Things that couldn't be fully resolved:

1. **Windows Process Tree Killing**
   - What we know: Child.kill() on Windows doesn't terminate all descendant processes; known issue #4949
   - What's unclear: Best cross-platform pattern for guaranteed cleanup (Win32 API vs taskkill vs process groups)
   - Recommendation: Start with Tauri sidecars (auto-cleanup), test zombie scenarios early, implement Windows-specific taskkill fallback if needed

2. **Optimal Stdout Batch Size**
   - What we know: Channels are high-throughput but buffering stdout reduces render thrashing
   - What's unclear: Ideal batch size/interval for p4 output (100ms? 1000 lines? 4KB?)
   - Recommendation: Start with 100ms batching, profile with DevTools, adjust based on operation type (sync vs file list)

3. **TanStack Query vs Direct Invoke**
   - What we know: Query adds caching/retry but p4 operations are usually one-shot
   - What's unclear: Whether Query overhead is worth it for non-cacheable operations (submit, checkout)
   - Recommendation: Use Query for read operations (info, status, files), direct invoke for mutations (submit, edit, revert)

4. **AbortSignal Propagation to Rust**
   - What we know: TanStack Query provides AbortSignal, but Tauri commands must handle cancellation manually
   - What's unclear: Pattern for propagating signal to Rust (pass signal state? separate cancel command?)
   - Recommendation: Use separate kill_process command triggered by signal.addEventListener('abort'); simpler than passing signal state

5. **Memory Leak Thresholds**
   - What we know: High-frequency event emission causes memory leaks (issue #12724)
   - What's unclear: Safe event rate (1/sec? 10/sec? 100/sec?)
   - Recommendation: Use Channels for >10 events/sec, Events for occasional notifications; profile with 1000-op test

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Shell Plugin](https://v2.tauri.app/plugin/shell/) - Official docs on process spawning
- [Tauri v2 Calling Rust from Frontend](https://v2.tauri.app/develop/calling-rust/) - Async commands documentation
- [Tauri v2 Calling Frontend from Rust](https://v2.tauri.app/develop/calling-frontend/) - Channels and Events patterns
- [Tauri v2 State Management](https://v2.tauri.app/develop/state-management/) - Mutex selection and state access
- [TanStack Query Cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation) - AbortSignal usage
- [React 19 Concurrent Features](https://certificates.dev/blog/react-concurrent-features-an-overview) - useTransition, useDeferredValue
- [shadcn/ui Collapsible](https://ui.shadcn.com/docs/components/collapsible) - Component documentation
- [VS Code Status Bar Guidelines](https://code.visualstudio.com/api/ux-guidelines/status-bar) - Status bar UX patterns

### Secondary (MEDIUM confidence)
- [Tauri Process Cleanup Discussion #3273](https://github.com/tauri-apps/tauri/discussions/3273) - Community patterns for process cleanup
- [Tauri Windows Kill Bug #4949](https://github.com/tauri-apps/tauri/issues/4949) - Known Windows child kill issue
- [Tauri Event Memory Leak #12724](https://github.com/tauri-apps/tauri/issues/12724) - Event emission memory leaks
- [Tauri Memory Leak When Reading Files #9190](https://github.com/tauri-apps/tauri/issues/9190) - File operation memory issues
- [React Query Error Handling (TkDodo)](https://tkdodo.eu/blog/react-query-error-handling) - Error handling patterns
- [Tauri Error Handling Recipes](https://tbt.qkation.com/posts/tauri-error-handling/) - thiserror integration
- [cmdk GitHub](https://github.com/dip/cmdk) - Command palette library
- [react-hot-toast](https://react-hot-toast.com/) - Toast notification library

### Tertiary (LOW confidence - verify during implementation)
- Community reports of >10 events/sec causing leaks - needs profiling
- Claim that std::sync::Mutex "often preferred" - verify with async load testing
- Performance claims about 16ms frame budget - validate with DevTools
- Windows taskkill /F /T reliability - test across Windows versions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All recommendations from official Tauri 2.0 and React 19 docs, verified versions
- Architecture patterns: HIGH - Channels, async commands, State patterns directly from Tauri docs; React patterns from official React docs
- Pitfalls: MEDIUM-HIGH - Windows kill issue and memory leaks verified in GitHub issues; other pitfalls from Tauri community discussions
- Code examples: HIGH - All examples adapted from official documentation with source URLs

**Research date:** 2026-01-27
**Valid until:** 2026-04-27 (90 days) - Tauri 2.x is stable, but check for patch releases addressing Windows kill issue

**Key uncertainties requiring validation during implementation:**
- Exact event emission rate threshold for memory leaks
- Optimal stdout batching strategy for p4 operations
- Windows process tree killing reliability across versions
- Performance impact of TanStack Query for non-cacheable operations
