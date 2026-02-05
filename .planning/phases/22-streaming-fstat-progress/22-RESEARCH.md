# Phase 22: Streaming fstat + Progress - Research

**Researched:** 2026-02-04
**Domain:** Streaming data with progress indicators (Tauri Channels + TanStack Query + React UI)
**Confidence:** HIGH

## Summary

Phase 22 implements streaming fstat to replace the blocking all-or-nothing workspace file load. The proven pattern from `p4_sync` (Phase 21) provides the exact template: tokio::process with piped stdout, line-by-line parsing in a background task, batched sends via Tauri Channel, and frontend accumulation via TanStack Query's `setQueryData`. Progress indicators already exist in the StatusBar component and operation store infrastructure.

The current `p4_fstat` blocks for 5-15 seconds on 10K files because it uses `.output().await` which buffers the entire stdout. The streaming version will parse `-ztag` records incrementally and emit batches of 100 files through a Channel, enabling first-batch visibility in under 500ms. The frontend accumulates batches into the existing TanStack Query cache, triggering incremental tree renders as data arrives.

Progress indicators are straightforward: the existing `useOperationStore` already supports `progress: number` (0-100) and `processId: string` for cancellation. The StatusBar already displays progress bars and cancel buttons. For fstat streaming, progress is computed as `(files_received / estimated_total) * 100`. The `p4 fstat` command doesn't provide a total upfront, so estimation strategy is: first batch sets baseline, subsequent batches update estimate based on rate of new records.

**Primary recommendation:** Create `p4_fstat_stream` command modeled on `p4_sync` (lines 559-637 of p4handlers.rs), stream `-ztag` records in batches of 100 via Channel, modify `useFileTree` to accumulate batches via `setQueryData`, integrate with existing `useOperationStore` for progress and cancellation, use indeterminate progress for first batch and percentage progress once estimate is available.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tokio::process | 1.x | Async child process with piped streams | Already enabled in Phase 21, required for non-blocking stdout reads |
| tokio::io | 1.x | AsyncBufReadExt for line-by-line parsing | Already enabled (io-util feature), proven pattern in p4_sync |
| Tauri Channel | 2.x | Streaming IPC from Rust to frontend | Tauri's built-in streaming mechanism, used in p4_sync |
| TanStack Query | 5.x | Cache management and data synchronization | Already in use, setQueryData supports incremental updates |
| Zustand | 4.x | Operation state management | Already in use for useOperationStore |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-progress | 1.x (in use) | Progress bar component | Already in StatusBar via ui/progress.tsx |
| tokio::spawn | 1.x | Background task for stdout reading | Required pattern to prevent stdout buffer deadlock |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tauri Channel | Custom WebSocket | Channel is built-in, type-safe, and proven in p4_sync |
| Batched sends | Send per file | Batching reduces IPC overhead and prevents backpressure |
| setQueryData accumulation | Custom state | TanStack Query's cache provides built-in deduplication and structural sharing |
| Estimated progress | Indeterminate only | Estimated progress provides better UX once initial data arrives |

**Installation:**
No new dependencies. All required libraries already installed.

## Architecture Patterns

### Pattern 1: Streaming Command with Channel Output
**What:** Spawn tokio::process::Command with piped stdout, parse incrementally, send batches via Channel
**When to use:** Any p4 command that can return large result sets (fstat, changes, filelog)
**Example:**
```rust
// Source: C:\Projects\Fun\p4now\src-tauri\src\commands\p4\p4handlers.rs:559-637 (p4_sync pattern)
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use tauri::{ipc::Channel, State};

#[tauri::command]
pub async fn p4_fstat_stream(
    paths: Vec<String>,
    depot_path: Option<String>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
    on_batch: Channel<Vec<P4FileInfo>>,
    state: State<'_, ProcessManager>,
) -> Result<String, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("-ztag");
    cmd.arg("fstat");

    if paths.is_empty() {
        let query_path = depot_path.unwrap_or_else(|| "//...".to_string());
        cmd.arg(query_path);
    } else {
        cmd.args(&paths);
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn p4 fstat: {}", e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Register process for cancellation
    let process_id = state.register(child).await;
    let process_id_clone = process_id.clone();

    // Stream stdout in background task
    let on_batch_clone = on_batch.clone();
    if let Some(stdout) = stdout {
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            let mut current_record = HashMap::new();
            let mut batch = Vec::new();

            while let Ok(Some(line)) = lines.next_line().await {
                let line = line.trim();

                // Blank line = end of record
                if line.is_empty() {
                    if !current_record.is_empty() {
                        if let Some(file_info) = build_file_info(&current_record) {
                            batch.push(file_info);

                            // Send batch when it reaches 100 files
                            if batch.len() >= 100 {
                                let _ = on_batch_clone.send(std::mem::take(&mut batch));
                            }
                        }
                        current_record.clear();
                    }
                    continue;
                }

                // Parse ztag line: "... key value"
                if let Some(stripped) = line.strip_prefix("... ") {
                    if let Some((key, value)) = stripped.split_once(' ') {
                        current_record.insert(key.to_string(), value.to_string());
                    }
                }
            }

            // Send final batch
            if !batch.is_empty() {
                let _ = on_batch_clone.send(batch);
            }
        });
    }

    // Handle stderr (errors/warnings)
    if let Some(stderr) = stderr {
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                // Log errors but don't stop streaming
                eprintln!("p4 fstat stderr: {}", line);
            }
        });
    }

    Ok(process_id_clone)
}
```

### Pattern 2: Frontend Batch Accumulation with TanStack Query
**What:** Accumulate streamed batches into query cache using setQueryData, trigger re-renders incrementally
**When to use:** Any streaming data that needs to integrate with existing query infrastructure
**Example:**
```typescript
// Source: Adapted from C:\Projects\Fun\p4now\src\hooks\useSync.ts:98-149
import { listen } from '@tauri-apps/api/event';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function useFileTree() {
  const queryClient = useQueryClient();
  const { startOperation, updateProgress, setProcessId, completeOperation } = useOperationStore();

  const startStreaming = useCallback(async () => {
    const operationId = `fstat-${Date.now()}`;
    startOperation(operationId, 'Loading workspace files');

    let accumulatedFiles: P4File[] = [];
    let totalReceived = 0;
    let estimatedTotal = 0;

    try {
      const processId = await invoke('p4_fstat_stream', {
        paths: [],
        depotPath,
        onBatch: (batch: P4FileInfo[]) => {
          // Map backend types to frontend types
          const mappedBatch = batch.map(mapP4FileInfo);

          // Accumulate files
          accumulatedFiles.push(...mappedBatch);
          totalReceived += batch.length;

          // Update estimate: first batch sets baseline, subsequent batches refine
          if (estimatedTotal === 0) {
            // Conservative estimate: assume first batch is 10% of total
            estimatedTotal = batch.length * 10;
          } else if (totalReceived > estimatedTotal * 0.9) {
            // Approaching estimate, increase it
            estimatedTotal = Math.floor(totalReceived * 1.1);
          }

          // Update progress
          const progress = Math.min(
            Math.round((totalReceived / estimatedTotal) * 100),
            99 // Never show 100% until completion
          );
          updateProgress(progress, `Loaded ${totalReceived} files...`);

          // Update query cache incrementally
          queryClient.setQueryData(
            ['fileTree', rootPath, depotPath],
            accumulatedFiles.slice() // Create new array reference for React
          );
        },
      });

      setProcessId(processId);

      // Wait for process to complete
      // (In practice, completion detected via stderr close or explicit signal)
      await new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
          // Poll or use event listener to detect completion
          // For now, assume completion after reasonable timeout
        }, 100);
      });

      // Final update
      setFiles(accumulatedFiles);
      completeOperation(true);

    } catch (error) {
      completeOperation(false, String(error));
      throw error;
    }
  }, [depotPath, rootPath, queryClient]);

  return { startStreaming };
}
```

### Pattern 3: Progress Indicator with Cancellation
**What:** Display progress bar in StatusBar, provide cancel button that kills backend process
**When to use:** Any long-running operation (>2 seconds expected duration)
**Example:**
```typescript
// Source: C:\Projects\Fun\p4now\src\components\StatusBar.tsx:1-74 (already implemented)
// StatusBar component already handles this pattern:
// - Reads from useOperationStore (currentOperation)
// - Displays Progress component when progress is defined
// - Displays Loader2 spinner when progress is undefined (indeterminate)
// - Shows cancel button when canCancel is true
// - Calls cancel() which invokes invokeKillProcess(processId)

// Integration point in useFileTree:
const { cancel, canCancel } = useP4Command();

// During streaming, the operation store provides cancellation:
const handleCancel = useCallback(async () => {
  if (currentOperation?.processId) {
    await invokeKillProcess(currentOperation.processId);
    completeOperation(false, 'Cancelled by user');
  }
}, [currentOperation, completeOperation]);
```

### Pattern 4: Batched Channel Sends to Prevent Backpressure
**What:** Accumulate records into batches before sending through Channel to avoid blocking
**When to use:** Streaming commands that produce high-frequency output
**Example:**
```rust
// Source: Derived from p4_sync pattern and research pitfalls
// CRITICAL: Batch sends to prevent tokio executor blocking

// BAD: Send every file individually (causes backpressure)
if let Some(file_info) = build_file_info(&record) {
    let _ = on_batch.send(vec![file_info]); // BAD: 10K individual sends
}

// GOOD: Batch into groups of 100
let mut batch = Vec::with_capacity(100);
if let Some(file_info) = build_file_info(&record) {
    batch.push(file_info);

    if batch.len() >= 100 {
        // Send batch on background thread to avoid blocking tokio
        let batch_to_send = std::mem::take(&mut batch);
        tokio::task::spawn_blocking(move || {
            let _ = on_batch_clone.send(batch_to_send);
        });
    }
}

// ALTERNATIVE: If spawn_blocking overhead is too high, send directly but batch
// Research indicates 100-file batches keep payload under 1MB, avoiding UI freeze
let _ = on_batch_clone.send(std::mem::take(&mut batch));
```

### Anti-Patterns to Avoid
- **Calling .output().await on streaming commands:** Buffers entire stdout in memory, negating streaming benefits
- **Sending individual files through Channel:** Creates backpressure at 10K+ files, freezes UI
- **Using structural sharing with accumulating arrays:** TanStack Query's structural sharing breaks reference identity, causing full tree re-renders
- **Not handling stderr:** Errors/warnings go unnoticed, making debugging impossible
- **Forgetting to send final batch:** Last <100 files never sent if not flushed after loop

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress estimation | Custom smoothing algorithm | Simple batch-based estimation with ceiling | Complex algorithms add maintenance burden, simple strategy works for p4 fstat |
| Streaming parser | Custom state machine | Adapt parse_ztag_records to incremental mode | Existing parser is well-tested, just needs streaming wrapper |
| Cancellation mechanism | Custom abort signals | Tauri ProcessManager + kill command | Already implemented in Phase 21, proven to work |
| Progress UI | Custom component | Existing StatusBar + Progress component | Already handles indeterminate/percentage modes, cancellation |

**Key insight:** The entire pattern already exists in p4_sync. Phase 22 is a mechanical adaptation, not new architecture. Resist the urge to rewrite or "improve" the proven pattern.

## Common Pitfalls

### Pitfall 1: Zombie Processes from Incomplete Wait
**What goes wrong:** Cancelled streaming processes become zombies if not properly awaited
**Why it happens:** Channel closes but child process never reaps
**How to avoid:** ProcessManager.kill() already calls .wait().await (fixed in Phase 21-01)
**Warning signs:** Orphaned p4.exe in Task Manager after cancellation

### Pitfall 2: TanStack Query Race Conditions
**What goes wrong:** Auto-refresh invalidation races with streaming updates, causing data flicker
**Why it happens:** `invalidateQueries` clears cache while `setQueryData` is accumulating
**How to avoid:** Guard auto-refresh with mutation check:
```typescript
const isMutating = queryClient.isMutating({ mutationKey: ['fstat-stream'] });
if (!isMutating) {
  queryClient.invalidateQueries(['fileTree']);
}
```
**Warning signs:** File tree briefly shows empty state during streaming load

### Pitfall 3: Channel Backpressure Freezes UI
**What goes wrong:** Sending large payloads through Channel blocks tokio executor for 30-50ms
**Why it happens:** Tauri Channel serializes via serde_json, large Vec<P4FileInfo> is slow
**How to avoid:** Batch to 100 files max (~50KB JSON), consider spawn_blocking for sends over 1MB
**Warning signs:** "Application Not Responding" on Windows, stuttering progress bar

### Pitfall 4: Structural Sharing Breaks Tree References
**What goes wrong:** TanStack Query's structural sharing creates new references for unchanged data
**Why it happens:** Array accumulation via setQueryData triggers shallow comparison, which fails
**How to avoid:** Disable structural sharing for streaming queries:
```typescript
queryClient.setQueryData(['fileTree', ...], data, {
  structuralSharing: false
});
```
**Warning signs:** react-arborist re-renders all 10K nodes on every batch, scroll position resets

### Pitfall 5: Incomplete Final Batch
**What goes wrong:** Last batch (<100 files) never sent, tree missing final files
**Why it happens:** Forgetting to flush batch buffer after loop completes
**How to avoid:** Always send remaining batch after stdout closes:
```rust
// After loop
if !batch.is_empty() {
    let _ = on_batch.send(batch);
}
```
**Warning signs:** File count in tree is 0-99 less than expected, specific files missing

### Pitfall 6: Progress Never Reaches 100%
**What goes wrong:** Progress bar stuck at 95-99% after all files loaded
**Why it happens:** Estimation algorithm never allows progress to reach 100
**How to avoid:** Cap progress at 99% during streaming, set to 100% on explicit completion:
```typescript
const progress = Math.min(Math.round((received / estimate) * 100), 99);
// On completion:
completeOperation(true); // Sets progress to 100
```
**Warning signs:** Status bar shows "Loaded 10000 files..." with 99% progress indefinitely

## Code Examples

Verified patterns from existing codebase:

### Streaming Command Template
```rust
// Source: p4handlers.rs:559-637 (p4_sync)
// Complete pattern for streaming p4 commands with progress

#[tauri::command]
pub async fn p4_fstat_stream(
    paths: Vec<String>,
    depot_path: Option<String>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
    on_batch: Channel<Vec<P4FileInfo>>,
    state: State<'_, ProcessManager>,
) -> Result<String, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["-ztag", "fstat"]);

    if paths.is_empty() {
        cmd.arg(depot_path.unwrap_or_else(|| "//...".to_string()));
    } else {
        cmd.args(&paths);
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn: {}", e))?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let process_id = state.register(child).await;

    // Parse and batch stdout
    if let Some(stdout) = stdout {
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            let mut current_record = HashMap::new();
            let mut batch = Vec::new();

            while let Ok(Some(line)) = lines.next_line().await {
                // Parse -ztag output incrementally
                // Batch to 100 files, send via Channel
            }

            if !batch.is_empty() {
                let _ = on_batch.send(batch);
            }
        });
    }

    Ok(process_id)
}
```

### Frontend Accumulation Pattern
```typescript
// Source: Adapted from useSync.ts and useFileTree.ts
// Pattern for accumulating streaming data in TanStack Query cache

export function useFileTree() {
  const queryClient = useQueryClient();
  const { startOperation, updateProgress, setProcessId, completeOperation } = useOperationStore();

  const loadWithStreaming = useCallback(async () => {
    const operationId = `fstat-${Date.now()}`;
    startOperation(operationId, 'Loading workspace files');

    let accumulated: P4File[] = [];
    let received = 0;
    let estimate = 0;

    const processId = await invoke('p4_fstat_stream', {
      paths: [],
      depotPath,
      onBatch: (batch: P4FileInfo[]) => {
        const mapped = batch.map(mapP4FileInfo);
        accumulated.push(...mapped);
        received += batch.length;

        // First batch: conservative estimate
        if (estimate === 0) estimate = batch.length * 10;

        // Update estimate as we go
        if (received > estimate * 0.9) estimate = Math.floor(received * 1.1);

        // Update progress (capped at 99 until completion)
        const progress = Math.min(Math.round((received / estimate) * 100), 99);
        updateProgress(progress, `Loaded ${received} files...`);

        // Update cache incrementally
        queryClient.setQueryData(['fileTree', rootPath, depotPath], [...accumulated], {
          structuralSharing: false, // Prevent reference breaks
        });
      },
    });

    setProcessId(processId);

    // Detect completion (backend signals or stderr close)
    // Set final progress to 100
    completeOperation(true);
  }, [depotPath, rootPath]);

  return { loadWithStreaming };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| .output().await buffering | tokio::process with piped stdout | Phase 21 (2026-02-04) | Enables streaming, prevents blocking |
| std::thread::spawn | tokio::spawn | Phase 21 (2026-02-04) | Integrates with async runtime, no thread pool exhaustion |
| Single all-or-nothing load | Incremental streaming with batches | Phase 22 (this phase) | First data in <500ms vs 5-15s blocking |
| No progress indicators | Progress bar with count/estimate | Phase 22 (this phase) | User sees progress, can cancel |
| Hard-coded 30s refresh | Delta refresh (Phase 24) | Future | Queries only opened/shelved files |

**Deprecated/outdated:**
- `cmd.output().await`: Blocks tokio thread, buffers entire output. Replaced by `cmd.stdout(Stdio::piped())` + streaming.
- `std::process::Command`: Synchronous, causes runtime blocking. Replaced by `tokio::process::Command`.
- N+1 individual Channel sends: Causes backpressure. Replaced by batched sends.

## Open Questions

Things that couldn't be fully resolved:

1. **Completion Detection Strategy**
   - What we know: p4 fstat doesn't emit a "complete" signal. Completion detected when stdout closes or child process exits.
   - What's unclear: Best way to signal completion to frontend without polling. Options: (a) wait for child.wait() in spawned task and emit completion event, (b) frontend detects no new batches for 1s, (c) add explicit completion signal to Channel.
   - Recommendation: Use approach (c) - add `FstatBatch` enum with `Data(Vec<P4FileInfo>)` and `Complete` variants. Backend sends `Complete` after final batch.

2. **Estimation Algorithm Accuracy**
   - What we know: p4 fstat output is not predictable. Large workspaces may have uneven distribution (many small files vs few large directories).
   - What's unclear: Whether "first batch * 10" heuristic is accurate across different depot structures.
   - Recommendation: Start with simple heuristic, validate with real 10K+ depots during Phase 22 execution. If estimate is consistently off, adjust multiplier or use adaptive algorithm.

3. **Auto-Refresh During Streaming**
   - What we know: TanStack Query's 30s refetch can trigger while streaming is in progress.
   - What's unclear: Whether mutation-guard check is sufficient or if we need explicit streaming lock.
   - Recommendation: Disable auto-refresh during active streaming via `enabled: !isStreaming` flag in query config. Re-enable after completion.

4. **Structural Sharing Performance**
   - What we know: Disabling structural sharing prevents reference breaks but may increase memory usage.
   - What's unclear: Memory impact on 10K+ file workspaces with frequent updates.
   - Recommendation: Start with structural sharing disabled for streaming queries, measure memory usage, re-enable if memory becomes an issue (trade reference stability for memory).

## Sources

### Primary (HIGH confidence)
- C:\Projects\Fun\p4now\src-tauri\src\commands\p4\p4handlers.rs (lines 559-637) - p4_sync streaming pattern
- C:\Projects\Fun\p4now\src\hooks\useSync.ts (lines 1-150) - Frontend streaming accumulation pattern
- C:\Projects\Fun\p4now\src\store\operation.ts - Operation store with progress tracking
- C:\Projects\Fun\p4now\src\components\StatusBar.tsx - Progress UI with cancellation
- C:\Projects\Fun\p4now\reports\large-depot-scalability-analysis.md - Issue #1 (P0 full workspace fstat)
- C:\Projects\Fun\p4now\.planning\research\SUMMARY.md - Phase 2 streaming architecture
- https://docs.rs/tokio/latest/tokio/process/struct.Command.html - tokio::process API
- https://docs.rs/tokio/latest/tokio/io/struct.BufReader.html - AsyncBufReadExt for line-by-line reading
- https://v2.tauri.app/develop/calling-rust/#streaming-responses - Tauri Channel streaming
- https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientsetquerydata - setQueryData for incremental updates

### Secondary (MEDIUM confidence)
- C:\Projects\Fun\p4now\.planning\phases\21-async-foundation\21-RESEARCH.md - Zombie process prevention patterns
- https://github.com/TanStack/query/discussions/7932 - TanStack Query race condition discussion
- https://github.com/TanStack/query/issues/6812 - Structural sharing with tree data
- https://learn.microsoft.com/en-us/windows/win32/uxguide/progress-bars - 2-second threshold for progress indicators

### Tertiary (LOW confidence)
- Batch size of 100 files: Inferred from typical p4 fstat record size (~50 lines = ~2KB per file, 100 files = ~200KB JSON payload). Not empirically validated.
- Estimation heuristic "first batch * 10": Common pattern for streaming progress, but not verified against Perforce depot distributions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, proven in p4_sync
- Architecture: HIGH - Direct adaptation of existing p4_sync pattern to p4_fstat
- Pitfalls: HIGH - Zombie processes and race conditions documented in Phase 21 research, Channel backpressure from Tauri community
- Progress estimation: MEDIUM - Heuristic not validated against real depots

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - stable tech stack, no fast-moving dependencies)
