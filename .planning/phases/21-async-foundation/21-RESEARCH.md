# Phase 21: Async Foundation - Research

**Researched:** 2026-02-04
**Domain:** Async process management (Rust/Tokio) + React debounce patterns
**Confidence:** HIGH

## Summary

Phase 21 establishes the async infrastructure foundation for all streaming work in v5.0. The phase has two independent technical domains: (1) migrating ProcessManager from `std::process::Child` to `tokio::process::Child` for non-blocking async execution, and (2) implementing a React `useDebounce` hook to prevent redundant filter operations.

The current ProcessManager already uses `tokio::sync::Mutex` but wraps synchronous `std::process::Child` handles, causing blocking behavior. The migration to `tokio::process::Child` is straightforward but requires careful attention to zombie process prevention, process tree cleanup on Windows, and avoiding stdout/stderr deadlocks.

The debounce hook is a standard React pattern with established implementations. A 150ms delay is recommended for input filtering to balance responsiveness with computational efficiency.

**Primary recommendation:** Enable tokio `process` and `io-util` features, migrate ProcessManager to async Child handles with explicit `.wait()` calls, implement standard useDebounce hook, and add integration test to verify no zombie p4.exe accumulation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tokio | 1.x (currently in use) | Async runtime for Rust | Tauri v2's built-in async runtime, battle-tested |
| tokio::process | 1.x | Async child process management | Official tokio module, integrated with async runtime |
| tokio::sync | 1.x | Async synchronization primitives | Already in use (Mutex), provides channels for streaming |
| React | 19.1.0 (in use) | Frontend framework | Project's frontend framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nozbe/microfuzz | 1.0.0 (in use) | Fast fuzzy matching | Already used in FileTree filtering |
| TanStack Query | 5.x (in use) | Data synchronization | Query invalidation after mutations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tokio::process | async-process | tokio::process better integrated with Tauri's runtime |
| useDebounce custom | use-debounce library | Custom simpler for 150ms fixed delay, library adds dependency |
| tokio::sync::Mutex | std::sync::Mutex | tokio::sync required for holding across .await points |

**Installation:**
```toml
# Cargo.toml - Add features to existing tokio dependency
tokio = { version = "1", features = ["sync", "process", "io-util"] }
```

## Architecture Patterns

### Recommended Project Structure
```
src-tauri/src/
├── state/
│   └── process_manager.rs    # Async ProcessManager with tokio::process::Child
├── commands/
│   ├── process.rs             # Async command handlers with streaming
│   └── p4/
│       └── p4handlers.rs      # P4 commands using ProcessManager
src/
└── hooks/
    └── useDebounce.ts         # Standard debounce hook
```

### Pattern 1: Async ProcessManager with Zombie Prevention
**What:** Track `tokio::process::Child` handles in `Arc<Mutex<HashMap>>`, always `.wait().await` before removing
**When to use:** Any long-running child process that needs cancellation support
**Example:**
```rust
// Source: https://docs.rs/tokio/latest/tokio/process/index.html
use tokio::process::Command;
use tokio::sync::Mutex;
use std::collections::HashMap;

pub struct ProcessManager {
    processes: Arc<Mutex<HashMap<String, tokio::process::Child>>>,
}

impl ProcessManager {
    pub async fn register(&self, mut child: tokio::process::Child) -> String {
        let id = Uuid::new_v4().to_string();
        let mut processes = self.processes.lock().await;
        processes.insert(id.clone(), child);
        id
    }

    pub async fn kill(&self, id: &str) -> Result<bool, String> {
        let mut processes = self.processes.lock().await;
        if let Some(mut child) = processes.remove(id) {
            // Windows: kill process tree before calling child.kill()
            #[cfg(target_os = "windows")]
            {
                if let Some(pid) = child.id() {
                    let _ = tokio::process::Command::new("taskkill")
                        .args(["/F", "/T", "/PID", &pid.to_string()])
                        .output()
                        .await;
                }
            }

            child.kill().await.map_err(|e| e.to_string())?;
            // CRITICAL: Always wait to reap zombie processes
            let _ = child.wait().await;
            Ok(true)
        } else {
            Ok(false)
        }
    }
}
```

### Pattern 2: Streaming Output with Separate Tasks
**What:** Read stdout/stderr in separate tokio::spawn tasks to prevent deadlocks
**When to use:** When piping stdout/stderr from child process
**Example:**
```rust
// Source: https://docs.rs/tokio/latest/tokio/process/index.html
use tokio::io::{AsyncBufReadExt, BufReader};

let mut child = Command::new("p4")
    .args(&args)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()?;

// Take handles before registering child
let stdout = child.stdout.take().unwrap();
let stderr = child.stderr.take().unwrap();

let process_id = state.register(child).await;

// IMPORTANT: Read stdout in separate task to prevent deadlock
tokio::spawn(async move {
    let mut lines = BufReader::new(stdout).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let _ = on_output.send(OutputLine { line, is_stderr: false });
    }
});

// Read stderr separately
tokio::spawn(async move {
    let mut lines = BufReader::new(stderr).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let _ = on_output.send(OutputLine { line, is_stderr: true });
    }
});
```

### Pattern 3: React useDebounce Hook
**What:** Delay value updates until input stabilizes for specified delay
**When to use:** Search/filter inputs to prevent redundant computation
**Example:**
```typescript
// Source: https://usehooks.com/usedebounce
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 150): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Usage in FileTree filtering
const filterTerm = useSearchFilterStore(s => s.filterTerm);
const debouncedFilter = useDebounce(filterTerm, 150);
// Run expensive filter only when debouncedFilter changes
```

### Anti-Patterns to Avoid
- **Dropping Child without .wait():** Causes zombie processes on Unix systems. Always await `.wait()` before removing from HashMap.
- **Using std::process in async context:** Blocks the tokio runtime. Use `tokio::process::Command` or spawn_blocking.
- **Unbounded channels for streaming:** Can exhaust memory if consumer falls behind. Use bounded channels with backpressure.
- **Reading stdout/stderr synchronously:** Causes deadlocks when child blocks on full pipe buffer. Always read in separate tasks.
- **useDeferredValue without debounce:** Still executes on every keystroke, just defers rendering. Need actual debounce for computation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Process reaping | Custom waitpid loop | tokio::process::Child.wait() | Runtime handles signal registration and edge cases |
| Windows process tree kill | Recursive PID enumeration | taskkill /F /T | Windows API complexity, taskkill is reliable |
| Debounce timer logic | Custom setTimeout tracking | Standard useDebounce hook | Edge cases (rapid updates, unmount cleanup) |
| Async channel backpressure | Custom buffering | tokio::sync::mpsc bounded channel | Runtime-integrated backpressure |
| Line-by-line reading | Manual buffering | tokio::io::BufReader + lines() | Handles partial lines, encoding edge cases |

**Key insight:** Tokio's process module handles OS-specific signal handling, waitpid edge cases, and async integration. Custom solutions miss platform differences (Unix signals vs Windows job objects).

## Common Pitfalls

### Pitfall 1: Zombie Process Accumulation
**What goes wrong:** On Unix systems, child processes that exit but are not reaped remain as zombies, consuming PIDs and memory until parent exits.
**Why it happens:** Current code calls `child.kill()` but never waits for process to fully terminate. Tokio's "best-effort" reaping is not guaranteed.
**How to avoid:** Always call `.wait().await` after `.kill()`. Never drop a Child handle without awaiting it.
**Warning signs:** `ps aux | grep Z` shows zombie processes, PID exhaustion errors on long-running app.

### Pitfall 2: Stdout/Stderr Deadlock
**What goes wrong:** Process hangs indefinitely waiting for stdout to be read, parent hangs waiting for process to exit.
**Why it happens:** Pipe buffers are small (4-64KB). If child writes more than buffer size before parent reads, child blocks. If parent calls `.wait()` without reading pipes first, deadlock.
**How to avoid:** Always spawn separate tasks to read stdout/stderr BEFORE calling `.wait()`. Take stdio handles before registering Child.
**Warning signs:** Commands hang on large output (>64KB), works for small outputs but fails on large.

### Pitfall 3: Windows Child Process Survival
**What goes wrong:** Calling `child.kill()` on Windows only kills parent process, child processes (p4.exe → p4.exe subprocess) survive.
**Why it happens:** Windows doesn't have Unix's process groups. `child.kill()` sends SIGTERM equivalent only to direct child.
**How to avoid:** Use `taskkill /F /T /PID` on Windows before `child.kill()` to kill entire process tree. Already implemented in current code, preserve this.
**Warning signs:** Multiple p4.exe processes accumulate after cancellation, ProcessManager count doesn't match actual process count.

### Pitfall 4: Blocking the Async Runtime
**What goes wrong:** App becomes unresponsive, other async tasks starve, UI freezes.
**Why it happens:** Using `std::process::Command::output()` (blocking) in async command handler blocks the tokio worker thread.
**How to avoid:** Use `tokio::process::Command` throughout. If blocking work required, use `tokio::task::spawn_blocking`.
**Warning signs:** App freezes during p4 commands, other operations delayed, tokio worker thread shows high blocking time.

### Pitfall 5: TanStack Query Race Conditions After Async Invalidation
**What goes wrong:** File tree doesn't update after operations, or shows stale data briefly.
**Why it happens:** Query invalidation triggers refetch, but if not awaited, operation completes before refetch starts. Streaming commands return immediately (process ID) but data arrives later.
**How to avoid:** For non-streaming commands, await invalidation. For streaming, invalidate on operation complete event, not on command return.
**Warning signs:** UI state out of sync after operations, manual refresh fixes it, race-dependent bugs.

## Code Examples

Verified patterns from official sources:

### Spawning Async Process with Piped Output
```rust
// Source: https://docs.rs/tokio/latest/tokio/process/struct.Command.html
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};

let mut child = Command::new("p4")
    .arg("fstat")
    .arg("//...")
    .stdout(Stdio::piped())
    .spawn()
    .expect("failed to spawn p4");

let stdout = child.stdout.take()
    .expect("child missing stdout");

// Read lines asynchronously
tokio::spawn(async move {
    let mut lines = BufReader::new(stdout).lines();
    while let Some(line) = lines.next_line().await.unwrap() {
        println!("Line: {}", line);
    }
});

// Wait for process to complete (prevents zombies)
let status = child.wait().await?;
```

### Tauri Command with ProcessManager
```rust
// Source: https://v2.tauri.app/develop/calling-rust/
#[tauri::command]
pub async fn p4_fstat_streaming(
    on_progress: Channel<P4FileInfo>,
    state: State<'_, ProcessManager>,
) -> Result<String, String> {
    let mut cmd = tokio::process::Command::new("p4");
    cmd.args(["-ztag", "fstat", "//..."]);
    cmd.stdout(Stdio::piped());

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let process_id = state.register(child).await;

    // Stream parsing in background
    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if let Some(file) = parse_ztag_line(&line) {
                let _ = on_progress.send(file);
            }
        }
    });

    Ok(process_id)
}
```

### Basic useDebounce Implementation
```typescript
// Source: https://usehooks.com/usedebounce
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 150): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up timeout to update debounced value
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clear timeout if value changes before delay expires
    // or component unmounts
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### Graceful Shutdown with Process Cleanup
```rust
// Source: https://tokio.rs/tokio/topics/shutdown
use tokio::signal;

async fn shutdown_signal() {
    signal::ctrl_c()
        .await
        .expect("failed to listen for ctrl-c");
}

// In Tauri setup (current implementation already does this)
window.on_window_event(move |event| {
    if let tauri::WindowEvent::CloseRequested { .. } = event {
        let pm_clone = pm.clone();
        tauri::async_runtime::block_on(async move {
            pm_clone.kill_all().await;
        });
    }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| std::process blocking calls | tokio::process async | Tokio 1.0 (2020) | Non-blocking process management |
| Manual thread spawning | tokio::spawn | Tokio 0.3 (2020) | Runtime-managed concurrency |
| Unbounded channels by default | Bounded with backpressure | Best practice since 2021 | Memory safety |
| useDeferredValue only | useDeferredValue + useDebounce | React 19 (2024) | Defer rendering vs. defer computation |

**Deprecated/outdated:**
- `tokio-process` crate: Merged into tokio 1.0 as `tokio::process` module
- `Command::status()` without features: Now requires explicit `process` feature flag
- Unbounded channel recommendation: Now explicitly discouraged in Tokio docs

## Open Questions

1. **ProcessManager mutex contention at scale**
   - What we know: Current implementation uses single `Arc<Mutex<HashMap>>` for all processes. Phase 25 will have 20+ concurrent p4 describe commands.
   - What's unclear: Will mutex contention become a bottleneck? Should we shard the HashMap?
   - Recommendation: Measure first. If contention is >1% of operation time in Phase 25, consider sharding or using DashMap. Premature optimization likely not needed.

2. **Optimal debounce delay for 10K+ file tree**
   - What we know: 150ms is recommended standard. Current code uses `useDeferredValue` which has no delay.
   - What's unclear: Will 150ms feel laggy? Should it be configurable?
   - Recommendation: Start with 150ms fixed. If user testing shows issues, make it a setting (100-300ms range). Likely fine as-is.

3. **Should streaming commands return completion status?**
   - What we know: Current `p4_sync` returns process_id immediately, frontend waits indefinitely. No completion signal.
   - What's unclear: Should we send completion event via Tauri event system? Or let frontend detect via Channel close?
   - Recommendation: Phase 21 keeps current pattern (return process_id). Phase 22 will add completion signaling as part of streaming generalization.

## Sources

### Primary (HIGH confidence)
- [tokio::process documentation](https://docs.rs/tokio/latest/tokio/process/index.html) - Process management API, zombie prevention
- [Tokio Graceful Shutdown guide](https://tokio.rs/tokio/topics/shutdown) - Cleanup patterns
- [Tokio Channels tutorial](https://tokio.rs/tokio/tutorial/channels) - Backpressure, bounded channels
- [Tauri v2 async runtime](https://docs.rs/tauri/latest/tauri/async_runtime/index.html) - Runtime integration
- [Tauri v2 IPC Channels](https://v2.tauri.app/develop/calling-rust/) - Streaming data to frontend

### Secondary (MEDIUM confidence)
- [useDebounce hook pattern](https://usehooks.com/usedebounce) - Standard React implementation
- [Tokio process deadlock prevention](https://users.rust-lang.org/t/using-tokios-child-process-across-tasks/59017) - Community best practices
- [Tokio zombie process issue #2685](https://github.com/tokio-rs/tokio/issues/2685) - Known edge cases

### Tertiary (LOW confidence)
- [kill_tree crate](https://lib.rs/crates/kill_tree) - Alternative to taskkill, but taskkill is sufficient and built-in

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - tokio::process is well-documented, actively maintained (TokioConf 2026), Tauri integration proven
- Architecture: HIGH - Patterns extracted from official docs and production code examples
- Pitfalls: HIGH - Zombie processes and deadlocks documented in Tokio issues, Windows behavior verified in current code

**Research date:** 2026-02-04
**Valid until:** ~90 days (stable domain, Tokio LTS until Sept 2026)

## Implementation Checklist

Phase 21 planner should ensure:
- [ ] Enable tokio features: `process`, `io-util` in Cargo.toml
- [ ] Migrate ProcessManager.register to accept `tokio::process::Child`
- [ ] Add `.wait().await` to ProcessManager.kill after child.kill()
- [ ] Update p4_sync to use tokio::process::Command
- [ ] Migrate all Command::new("p4") to tokio::process::Command
- [ ] Verify stdout/stderr reading happens in separate tokio::spawn tasks
- [ ] Create src/hooks/useDebounce.ts with 150ms default
- [ ] Update FileTree to use useDebounce(filterTerm, 150)
- [ ] Add integration test: spawn 10 processes, kill all, verify no zombies (ps/tasklist)
- [ ] Verify ProcessManager.kill_all on app close still works
- [ ] Test cancellation: start long operation, cancel, verify p4.exe terminates
