# Architecture Research

**Domain:** Desktop GUI for CLI tools (Perforce p4.exe wrapper)
**Researched:** 2026-01-27
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     RENDERER PROCESS(ES)                     │
│                    (Web UI / React App)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  View    │  │  View    │  │  View    │  │  View    │    │
│  │Components│  │Components│  │Components│  │Components│    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│  ┌────┴─────────────┴─────────────┴─────────────┴────┐      │
│  │              State Management                      │      │
│  │        (Zustand / Redux / Context)                 │      │
│  └────────────────────┬───────────────────────────────┘      │
│                       │                                      │
│                  IPC Events                                  │
│                       │                                      │
├───────────────────────┼──────────────────────────────────────┤
│                  PRELOAD SCRIPT                              │
│          (Context Bridge - Security Boundary)                │
├───────────────────────┼──────────────────────────────────────┤
│                   MAIN PROCESS                               │
│              (Node.js / Rust Backend)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │            IPC Handler Layer                        │    │
│  │  (Routes messages, handles cancellation tokens)     │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │                                      │
│  ┌────────────────────┴────────────────────────────────┐    │
│  │          Operation Manager                          │    │
│  │  (Manages active operations, cancellation, state)   │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │                                      │
│  ┌────────────────────┴────────────────────────────────┐    │
│  │             CLI Adapter Layer                       │    │
│  │  (Spawns p4.exe, parses output, handles errors)     │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │                                      │
├───────────────────────┼──────────────────────────────────────┤
│                  CHILD PROCESSES                             │
│                                                              │
│    ┌───────────┐  ┌───────────┐  ┌───────────┐             │
│    │ p4 sync   │  │ p4 submit │  │ p4 changes│             │
│    └───────────┘  └───────────┘  └───────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **View Components** | Display UI, handle user input, show loading/error states | React components with hooks |
| **State Management** | Hold app state, synchronize across views, manage cache | Zustand (recommended) or Redux Toolkit |
| **Preload Script** | Expose safe IPC APIs to renderer via contextBridge | Electron preload.js or Tauri commands |
| **IPC Handler Layer** | Route IPC messages, validate inputs, manage request lifecycle | Event handlers with message schemas |
| **Operation Manager** | Track active operations, handle cancellation, prevent duplicates | Service class with operation registry |
| **CLI Adapter** | Spawn child processes, parse stdout/stderr, emit progress events | Node.js child_process or Rust std::process |
| **Child Processes** | Execute p4.exe commands, stream output | OS-level processes via spawn() |

## Recommended Project Structure

```
p4now/
├── src/
│   ├── main/                  # Main process (Electron) or backend (Tauri)
│   │   ├── index.ts           # Entry point, window creation
│   │   ├── ipc/               # IPC handlers
│   │   │   ├── handlers.ts    # IPC message routing
│   │   │   └── schema.ts      # IPC message type definitions
│   │   ├── p4/                # Perforce CLI integration
│   │   │   ├── adapter.ts     # CLI spawning and output parsing
│   │   │   ├── parser.ts      # p4 output parsing (tagged -G, -s, etc.)
│   │   │   ├── commands.ts    # Typed p4 command builders
│   │   │   └── types.ts       # Perforce domain types
│   │   ├── operations/        # Operation management
│   │   │   ├── manager.ts     # Track and cancel operations
│   │   │   ├── queue.ts       # Optional: operation queuing
│   │   │   └── types.ts       # Operation state types
│   │   └── utils/             # Utilities
│   │       ├── cancellation.ts # AbortController management
│   │       └── errors.ts      # Error handling utilities
│   │
│   ├── renderer/              # Renderer process (web UI)
│   │   ├── index.tsx          # React app entry
│   │   ├── App.tsx            # Root component
│   │   ├── components/        # UI components
│   │   │   ├── common/        # Reusable UI elements
│   │   │   ├── workspace/     # Workspace view
│   │   │   ├── changelist/    # Changelist management
│   │   │   ├── diff/          # Diff viewer integration
│   │   │   └── history/       # File history view
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── useP4Operation.ts # Hook for p4 operations
│   │   │   ├── useCancellableOp.ts # Cancellation support
│   │   │   └── useErrorBoundary.ts # Error handling
│   │   ├── store/             # State management
│   │   │   ├── index.ts       # Store setup
│   │   │   ├── workspaceSlice.ts # Workspace state
│   │   │   ├── changelistSlice.ts # Changelist state
│   │   │   └── operationsSlice.ts # Active operations
│   │   ├── api/               # IPC communication layer
│   │   │   ├── ipc.ts         # IPC wrapper functions
│   │   │   └── types.ts       # Request/response types
│   │   └── utils/             # UI utilities
│   │       ├── formatters.ts  # Data formatting
│   │       └── validators.ts  # Input validation
│   │
│   └── preload/               # Electron preload script
│       └── index.ts           # contextBridge API exposure
│
├── types/                     # Shared TypeScript types
│   ├── ipc.d.ts               # IPC message contracts
│   └── p4.d.ts                # Perforce data types
│
└── tests/                     # Tests
    ├── main/                  # Backend tests
    └── renderer/              # UI tests
```

### Structure Rationale

- **main/p4/:** Isolated CLI integration makes it easy to swap out for mock implementations during testing
- **operations/:** Centralized operation tracking enables cancellation, prevents duplicate operations, and provides operation history
- **renderer/api/:** Abstraction layer over IPC prevents React components from directly coupling to Electron/Tauri APIs
- **renderer/store/:** Centralized state management with slices per domain keeps state updates predictable
- **preload/:** Security boundary between privileged Node.js APIs and untrusted web content

## Architectural Patterns

### Pattern 1: Operation Manager with Cancellation Tokens

**What:** Centralized service that manages all active CLI operations with cancellation support

**When to use:** Any application that spawns long-running child processes that users need to cancel

**Trade-offs:**
- **Pros:** Single source of truth for operation state, easy to implement "cancel all", prevents zombie processes
- **Cons:** Adds complexity compared to directly spawning processes, requires careful cleanup

**Example:**
```typescript
// main/operations/manager.ts
class OperationManager {
  private operations = new Map<string, {
    controller: AbortController,
    subprocess: ChildProcess,
    metadata: OperationMetadata
  }>();

  async startOperation(
    id: string,
    command: string,
    args: string[],
    onProgress: (data: ProgressEvent) => void
  ): Promise<void> {
    const controller = new AbortController();

    const subprocess = spawn(command, args, {
      signal: controller.signal
    });

    this.operations.set(id, { controller, subprocess, metadata });

    subprocess.stdout.on('data', (data) => {
      onProgress({ type: 'stdout', data: data.toString() });
    });

    subprocess.on('close', () => {
      this.operations.delete(id);
    });
  }

  cancelOperation(id: string): boolean {
    const op = this.operations.get(id);
    if (!op) return false;

    op.controller.abort();
    return true;
  }

  cancelAll(): void {
    for (const [id, _] of this.operations) {
      this.cancelOperation(id);
    }
  }
}
```

### Pattern 2: Streaming Parser with Progress Events

**What:** Parse p4 output line-by-line and emit progress events to keep UI responsive

**When to use:** Operations that produce incremental output (sync, submit, filelog)

**Trade-offs:**
- **Pros:** UI updates in real-time, users see progress immediately, supports cancellation mid-operation
- **Cons:** More complex than waiting for full output, needs careful state management

**Example:**
```typescript
// main/p4/adapter.ts
class P4Adapter {
  async sync(
    path: string,
    onProgress: (event: SyncProgressEvent) => void,
    signal?: AbortSignal
  ): Promise<SyncResult> {
    const subprocess = spawn('p4', ['-I', 'sync', '-q', path], { signal });

    let filesUpdated = 0;
    let filesTotal = 0;

    subprocess.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');

      for (const line of lines) {
        if (line.includes('totalFileCount:')) {
          filesTotal = parseInt(line.split(':')[1]);
        }
        if (line.startsWith('//')) {
          filesUpdated++;
          onProgress({
            type: 'file-synced',
            file: line,
            progress: filesUpdated / filesTotal
          });
        }
      }
    });

    return new Promise((resolve, reject) => {
      subprocess.on('close', (code) => {
        if (code === 0) resolve({ filesUpdated });
        else reject(new Error(`p4 sync failed with code ${code}`));
      });
      subprocess.on('error', reject);
    });
  }
}
```

### Pattern 3: Error Boundaries with Fallback UI

**What:** Catch UI errors without crashing the entire app, show localized error state

**When to use:** Around error-prone features (new/untested), expensive operations, external integrations

**Trade-offs:**
- **Pros:** Isolated failures, app remains functional, better UX than white screen
- **Cons:** Only catches render errors, not async/event handler errors

**Example:**
```typescript
// renderer/components/common/ErrorBoundary.tsx
class OperationErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Operation error:', error, errorInfo);
    // Log to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false })}
          onDismiss={() => this.props.onDismiss?.()}
        />
      );
    }
    return this.props.children;
  }
}

// Usage: Wrap individual operations
<OperationErrorBoundary>
  <SyncWorkspaceView />
</OperationErrorBoundary>
```

### Pattern 4: Optimistic UI with Rollback

**What:** Update UI immediately, then apply backend changes asynchronously with rollback on failure

**When to use:** Quick operations where users expect immediate feedback (mark file for add/edit/delete)

**Trade-offs:**
- **Pros:** Snappy UI, feels instant, users don't wait
- **Cons:** Needs rollback logic, can confuse users if operation fails

**Example:**
```typescript
// renderer/hooks/useP4Operation.ts
function useOptimisticOperation() {
  const [state, setState] = useStore();

  async function submitChangelist(clId: number) {
    // Optimistic update
    const previousState = state.changelists[clId];
    setState(draft => {
      draft.changelists[clId].status = 'submitting';
    });

    try {
      await window.api.p4.submit(clId);
      setState(draft => {
        draft.changelists[clId].status = 'submitted';
      });
    } catch (error) {
      // Rollback
      setState(draft => {
        draft.changelists[clId] = previousState;
      });
      throw error;
    }
  }

  return { submitChangelist };
}
```

### Pattern 5: IPC Request/Response with Typed Schemas

**What:** Type-safe IPC communication with request/response pairing and validation

**When to use:** Always - prevents runtime errors from IPC message mismatches

**Trade-offs:**
- **Pros:** Type safety across process boundary, easy to refactor, self-documenting
- **Cons:** Requires shared type definitions, adds boilerplate

**Example:**
```typescript
// types/ipc.d.ts
interface IPCSchema {
  'p4:sync': {
    request: { path: string; force?: boolean };
    response: { filesUpdated: number };
    progress: { file: string; progress: number };
  };
  'p4:submit': {
    request: { changelist: number; description: string };
    response: { submittedCl: number };
  };
}

// main/ipc/handlers.ts
ipcMain.handle('p4:sync', async (event, req: IPCSchema['p4:sync']['request']) => {
  const operationId = uuid();

  await operationManager.startOperation(
    operationId,
    'p4', ['sync', req.path],
    (progress) => {
      event.sender.send('p4:sync:progress', { operationId, ...progress });
    }
  );

  return { filesUpdated: 42 }; // Type-checked response
});

// renderer/api/ipc.ts
async function syncWorkspace(path: string): Promise<IPCSchema['p4:sync']['response']> {
  return window.api.invoke('p4:sync', { path });
}
```

## Data Flow

### Request Flow (User Action → Backend → Response)

```
[User clicks "Sync"]
    ↓
[React Component] → dispatch action
    ↓
[State Management] → update state to "loading"
    ↓
[IPC API wrapper] → window.api.p4.sync({ path: '//depot/...' })
    ↓
[Preload Script] → ipcRenderer.invoke('p4:sync', payload)
    ↓
─────────────── Process Boundary ───────────────
    ↓
[IPC Handler] → validate request, generate operation ID
    ↓
[Operation Manager] → register operation, create AbortController
    ↓
[CLI Adapter] → spawn('p4', ['sync', path], { signal })
    ↓
[Child Process: p4.exe] → executes command, streams output
    ↓
[CLI Adapter] ← parses stdout line-by-line
    ↓
[Operation Manager] ← emits progress events
    ↓
[IPC Handler] ← sends progress via event.sender.send()
    ↓
─────────────── Process Boundary ───────────────
    ↓
[IPC API wrapper] ← receives progress events
    ↓
[State Management] ← updates progress in store
    ↓
[React Component] ← re-renders with new progress
    ↓
[User sees progress bar update]
```

### Cancellation Flow (User Action → Backend → Cleanup)

```
[User clicks "Cancel"]
    ↓
[React Component] → dispatch cancelOperation(operationId)
    ↓
[IPC API wrapper] → window.api.operations.cancel(operationId)
    ↓
─────────────── Process Boundary ───────────────
    ↓
[IPC Handler] → operationManager.cancelOperation(operationId)
    ↓
[Operation Manager] → abortController.abort()
    ↓
[Child Process] ← receives SIGTERM signal
    ↓
[Child Process] → exits gracefully
    ↓
[CLI Adapter] ← 'close' event with signal = 'SIGTERM'
    ↓
[Operation Manager] ← removes operation from registry
    ↓
[IPC Handler] ← sends cancellation event
    ↓
─────────────── Process Boundary ───────────────
    ↓
[State Management] ← updates operation status to 'cancelled'
    ↓
[React Component] ← shows "Operation cancelled" message
```

### State Synchronization (Multi-Window)

```
[Window A] → changes workspace setting
    ↓
[Store (Window A)] → persist to main process via IPC
    ↓
─────────────── Process Boundary ───────────────
    ↓
[Main Process] → updates global settings, broadcasts to all windows
    ↓
─────────────── Process Boundary ───────────────
    ↓
[Store (Window B)] ← receives setting update event
    ↓
[React Components (Window B)] ← re-render with new setting
```

### Key Data Flows

1. **Command execution:** Renderer → IPC → Main → spawn p4.exe → parse output → stream to Renderer
2. **Progress updates:** p4.exe stdout → parse → emit event → send via IPC → update store → re-render
3. **Cancellation:** User action → IPC → abort signal → kill process → cleanup → update UI
4. **Error handling:** p4.exe stderr or exit code → parse error → send to Renderer → show error boundary or toast
5. **State persistence:** Store change → debounced IPC call → main process saves to disk → on restart, load and hydrate store

## Achieving "Never Block" UX

### Core Principles

1. **All CLI operations are asynchronous** - Never wait synchronously for p4.exe
2. **Cancellation is first-class** - Every operation can be cancelled via AbortController
3. **Progressive feedback** - Show progress immediately, update incrementally
4. **Localized errors** - Errors don't crash the app, only affected component shows error state
5. **Optimistic updates** - UI responds immediately, backend confirms later

### Implementation Strategies

#### 1. Async/Await with AbortSignal

```typescript
// All operations accept an optional AbortSignal
async function sync(path: string, signal?: AbortSignal): Promise<SyncResult> {
  const subprocess = spawn('p4', ['sync', path], { signal });

  return new Promise((resolve, reject) => {
    subprocess.on('close', (code) => {
      if (signal?.aborted) {
        reject(new Error('Operation cancelled'));
      } else if (code === 0) {
        resolve(result);
      } else {
        reject(new Error(`Sync failed: ${code}`));
      }
    });
  });
}
```

#### 2. Progress Streaming

```typescript
// Emit progress events instead of blocking
class P4Adapter {
  sync(path: string, callbacks: {
    onProgress?: (file: string, progress: number) => void;
    onComplete?: (result: SyncResult) => void;
    onError?: (error: Error) => void;
  }, signal?: AbortSignal) {
    const subprocess = spawn('p4', ['-I', 'sync', path], { signal });

    subprocess.stdout.on('data', (chunk) => {
      // Parse and emit progress
      callbacks.onProgress?.(file, progress);
    });

    subprocess.on('close', (code) => {
      if (code === 0) callbacks.onComplete?.(result);
      else callbacks.onError?.(new Error(`Exit code ${code}`));
    });
  }
}
```

#### 3. Operation Queue with Concurrency Control

```typescript
// Prevent too many concurrent operations from overwhelming system
class OperationQueue {
  private queue: Operation[] = [];
  private active = 0;
  private maxConcurrent = 3; // Tunable based on testing

  async enqueue(operation: Operation): Promise<void> {
    if (this.active >= this.maxConcurrent) {
      await this.waitForSlot();
    }

    this.active++;
    try {
      await operation.execute();
    } finally {
      this.active--;
      this.processNext();
    }
  }
}
```

#### 4. Error Boundaries at Component Level

```typescript
// Wrap error-prone components to prevent cascading failures
<ErrorBoundary fallback={<OperationFailed />}>
  <WorkspaceView />
</ErrorBoundary>

<ErrorBoundary fallback={<ChangelistLoadFailed />}>
  <ChangelistPanel />
</ErrorBoundary>

// If WorkspaceView crashes, ChangelistPanel still works
```

#### 5. Reactive State Updates

```typescript
// Use state management that supports fine-grained updates
const useWorkspaceStore = create((set) => ({
  files: [],
  operations: {},

  updateFileStatus: (path, status) => set(state => {
    // Only re-render components watching this specific file
    const index = state.files.findIndex(f => f.path === path);
    if (index >= 0) {
      state.files[index].status = status;
    }
  })
}));
```

### Responsiveness Checklist

- [ ] **No synchronous waits** - All spawn() calls are async with event handlers
- [ ] **Cancellation supported** - Every long-running operation accepts AbortSignal
- [ ] **Progress indicators** - Users see what's happening (loading spinner, progress bar, file count)
- [ ] **Error recovery** - Errors show retry/dismiss options, don't block other operations
- [ ] **Concurrent operations** - Users can start new operations while others run
- [ ] **Debounced updates** - High-frequency updates (like progress) are throttled to prevent UI thrashing
- [ ] **Optimistic updates** - Quick operations (mark file) update UI immediately
- [ ] **Operation history** - Users can see what operations are running/completed/failed

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **POC (1 user, small workspace)** | Single renderer, in-memory state, basic error handling |
| **Beta (5-10 users, medium workspace)** | Add operation queue, persist state to disk, add retry logic |
| **Production (50+ users, large workspaces)** | Add operation prioritization, implement caching layer for expensive queries (p4 files, p4 changes), add telemetry |

### Scaling Priorities

1. **First bottleneck:** Large workspaces with thousands of files - p4 files and p4 changes become slow
   - **Solution:** Cache results, implement incremental updates, add pagination

2. **Second bottleneck:** Many concurrent operations causing UI lag
   - **Solution:** Implement operation queue with priority levels, increase maxConcurrent based on system resources

## Anti-Patterns

### Anti-Pattern 1: Synchronous CLI Calls

**What people do:** Use `execSync()` or `spawnSync()` to wait for p4 commands

**Why it's wrong:** Blocks the entire main process, freezes UI, can't be cancelled

**Do this instead:**
```typescript
// ❌ BAD - blocks main process
const result = execSync('p4 sync //depot/...');

// ✅ GOOD - async with progress
const subprocess = spawn('p4', ['sync', '//depot/...']);
subprocess.stdout.on('data', handleProgress);
```

### Anti-Pattern 2: Shared State in Main Process Without Locking

**What people do:** Modify shared state from multiple IPC handlers without synchronization

**Why it's wrong:** Race conditions, corrupted state, unpredictable behavior

**Do this instead:**
```typescript
// ❌ BAD - race condition
ipcMain.handle('operation', async () => {
  const id = ++globalOperationId; // Not atomic!
  operations.set(id, ...);
});

// ✅ GOOD - atomic ID generation
class OperationManager {
  private nextId = 0;

  createOperation() {
    const id = this.nextId++;
    this.operations.set(id, ...);
  }
}
```

### Anti-Pattern 3: Passing Raw Error Objects via IPC

**What people do:** Send Error objects directly through IPC

**Why it's wrong:** Errors don't serialize properly, stack traces are lost

**Do this instead:**
```typescript
// ❌ BAD - error doesn't serialize
ipcMain.handle('operation', async () => {
  try {
    await doSomething();
  } catch (error) {
    return { error }; // Becomes empty object {}
  }
});

// ✅ GOOD - serialize error details
ipcMain.handle('operation', async () => {
  try {
    await doSomething();
  } catch (error) {
    return {
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      }
    };
  }
});
```

### Anti-Pattern 4: Coupling UI Components Directly to IPC

**What people do:** Call `window.electron.invoke()` directly from React components

**Why it's wrong:** Tight coupling, hard to test, hard to swap Electron for Tauri

**Do this instead:**
```typescript
// ❌ BAD - tight coupling
function WorkspaceView() {
  const sync = () => window.electron.invoke('p4:sync', { path });
}

// ✅ GOOD - abstraction layer
// api/p4.ts
export const p4Api = {
  sync: (path: string) => window.api.invoke('p4:sync', { path })
};

// Component uses abstraction
function WorkspaceView() {
  const sync = () => p4Api.sync(path);
}
```

### Anti-Pattern 5: No Cleanup on Window Close

**What people do:** Forget to cancel operations when window closes

**Why it's wrong:** Zombie processes, resource leaks, operations complete after user left

**Do this instead:**
```typescript
// ❌ BAD - operations continue after window closes
ipcMain.handle('p4:sync', async () => {
  spawn('p4', ['sync']);
});

// ✅ GOOD - cleanup on window close
const windowOperations = new Map<number, Set<string>>();

ipcMain.handle('p4:sync', async (event) => {
  const windowId = event.sender.id;
  const operationId = uuid();

  windowOperations.get(windowId)?.add(operationId);

  await operationManager.start(operationId, ...);

  windowOperations.get(windowId)?.delete(operationId);
});

app.on('browser-window-closed', (event, window) => {
  const operations = windowOperations.get(window.id);
  for (const opId of operations) {
    operationManager.cancel(opId);
  }
  windowOperations.delete(window.id);
});
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **p4.exe CLI** | spawn() with streaming output | Parse tagged output (-G), use -I for progress, handle -s for errors |
| **External diff tool (P4Merge, Beyond Compare)** | spawn() detached with file paths | Use `detached: true` and `unref()` so app doesn't wait for diff tool to close |
| **File system watcher** | Node.js fs.watch() or chokidar | Watch workspace for external changes (other tools modifying files) |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Renderer ↔ Main** | IPC (invoke/handle pattern) | Typed schemas, request/response pairing, progress events |
| **Main ↔ CLI Adapter** | Direct function calls | Same process, synchronous API with async implementation |
| **Operation Manager ↔ CLI Adapter** | Callbacks and promises | Operation Manager owns lifecycle, CLI Adapter handles execution |
| **Store ↔ Components** | React hooks (useStore) | Components subscribe to slices, re-render on changes |

## Build Order and Dependencies

### Phase 1: Foundation (No dependencies)
1. **Project structure** - Set up Electron/Tauri, build tooling, TypeScript config
2. **Shared types** - Define IPC schemas, p4 domain types
3. **Basic IPC** - Implement preload script, basic invoke/handle

### Phase 2: Backend Core (Depends on Phase 1)
4. **CLI Adapter** - Implement basic p4 spawning, output parsing
5. **Operation Manager** - Track operations, cancellation support
6. **IPC Handlers** - Wire up handlers for p4 commands

### Phase 3: Frontend Core (Depends on Phase 1)
7. **State management** - Set up Zustand/Redux, define slices
8. **IPC API wrapper** - Abstract IPC calls behind typed API
9. **Basic UI components** - Layout, navigation, common components

### Phase 4: Features (Depends on Phases 2 & 3)
10. **Workspace view** - Show files, status, allow sync
11. **Changelist management** - Create, edit, delete changelists
12. **Diff integration** - Launch external diff tools
13. **History view** - Show file history

### Phase 5: Polish (Depends on Phase 4)
14. **Error handling** - Error boundaries, retry logic, user-friendly messages
15. **Progress indicators** - Spinners, progress bars, operation status
16. **Performance** - Debouncing, virtualization for large lists, caching

### Dependency Graph

```
Phase 1 (Foundation)
    ├─→ Phase 2 (Backend Core)
    │       └─→ Phase 4 (Features)
    │               └─→ Phase 5 (Polish)
    └─→ Phase 3 (Frontend Core)
            └─→ Phase 4 (Features)
                    └─→ Phase 5 (Polish)
```

**Critical path:** Foundation → Backend OR Frontend → Features → Polish

**Parallelizable:** Backend Core and Frontend Core can be built simultaneously after Foundation

## Technology Decision: Electron vs Tauri

### Recommended: Start with Electron, consider Tauri later

**Rationale:**
- **Electron:** Mature ecosystem, extensive documentation, larger community, easier to find examples of CLI-wrapping apps
- **Tauri:** Smaller bundle size, lower memory, better performance, but smaller ecosystem and steeper learning curve (Rust)

**For P4Now POC:** Use Electron
- Faster development (JavaScript/TypeScript only)
- More examples of Git GUIs (GitKraken, GitHub Desktop) built with Electron
- Easy to integrate Node.js ecosystem (parsers, child_process utilities)

**Post-POC evaluation criteria for Tauri:**
- If bundle size matters (Electron ~100MB, Tauri ~10MB)
- If memory footprint matters (Electron uses more RAM)
- If team comfortable with Rust (Tauri backend is Rust)

### State Management: Use Zustand

**Rationale:**
- Simpler than Redux Toolkit, less boilerplate
- Good performance with fine-grained updates
- Growing adoption (30%+ YoY growth)
- Electron-specific: Zutron library simplifies multi-window state sync

**Alternative:** Redux Toolkit if team already knows Redux or expects to scale to very large codebase

## Sources

### Official Documentation (HIGH confidence)
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) - Process architecture
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc) - Inter-process communication
- [Tauri Architecture](https://v2.tauri.app/concept/architecture/) - Tauri system design
- [Node.js Child Process](https://nodejs.org/api/child_process.html) - CLI spawning and error handling
- [Perforce ClientProgress API](https://help.perforce.com/helix-core/apis/p4api/current/Content/P4API/chapter.clientprogramming.clientprogress.html) - Progress tracking

### Architecture Patterns (MEDIUM confidence)
- [Advanced Electron.js Architecture](https://blog.logrocket.com/advanced-electron-js-architecture/) - Best practices
- [CLI Wrapper Example](https://manu.ninja/simple-electron-gui-wrapper-for-a-command-line-utility/) - Practical implementation
- [GUI Architectures (Martin Fowler)](https://martinfowler.com/eaaDev/uiArchs.html) - Separation of concerns
- [React Error Boundaries](https://legacy.reactjs.org/docs/error-boundaries.html) - Error handling

### State Management (MEDIUM confidence)
- [State Management in 2026](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns) - Current trends
- [Zustand vs Redux Toolkit](https://medium.com/@sangramkumarp530/zustand-vs-redux-toolkit-which-should-you-use-in-2026-903304495e84) - Comparison
- [Zutron](https://github.com/goosewobbler/zutron) - Zustand for Electron

### UX Patterns (MEDIUM confidence)
- [CLI UX Progress Displays](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays) - Progress patterns
- [GitKraken vs Sourcetree](https://www.gitkraken.com/compare/gitkraken-vs-sourcetree) - Git GUI comparison

---
*Architecture research for: Desktop Perforce GUI (P4Now)*
*Researched: 2026-01-27*
