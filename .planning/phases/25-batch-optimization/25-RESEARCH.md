# Phase 25: Batch Optimization - Research

**Researched:** 2026-02-04
**Domain:** Perforce CLI batching, React Query parallel queries, async error handling
**Confidence:** HIGH

## Summary

This phase eliminates the N+1 query problem where each changelist triggers a separate `p4 describe -S` command. The current implementation uses React Query's `useQueries` with individual queries for each changelist ID (lines 154-177 in `useChangelists.ts`), generating one backend call per numbered changelist.

**Key finding:** `p4 describe` natively supports multiple changelist numbers in a single command invocation. The syntax `p4 describe -S 12345 12346 12347` processes all changelists in one server round-trip, with each changelist's shelved files returned sequentially in the output.

The batching implementation will replace the React Query `useQueries` pattern with a single backend command that processes all changelist IDs, streaming results back with individual error isolation per changelist.

**Primary recommendation:** Implement backend batch command `p4_describe_shelved_batch` that accepts `Vec<i32>` changelist IDs, executes single `p4 describe -ztag -s -S [IDs...]` command, parses output into per-CL results with error isolation, and returns `Map<changelistId, Result<Vec<P4ShelvedFile>, String>>`.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tokio::process::Command | 1.x | Async process execution | Codebase standard from Phase 21, non-blocking p4 commands |
| serde | 1.x | Serialization | Tauri IPC boundary, all command responses use serde::Serialize |
| react-query (@tanstack/react-query) | 5.x | Frontend data fetching | Existing pattern for all p4 queries, handles caching/invalidation |
| zustand | 4.x | State management | Operation store pattern for progress tracking |
| react-hot-toast | 2.x | User notifications | Existing pattern for success/error/warning toasts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tauri Channel | 2.x | Backend-to-frontend streaming | Progress updates during batch processing |
| tokio::spawn | 1.x | Background async tasks | Parsing/processing without blocking main thread |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single batch command | Individual sequential calls | Sequential = error isolation but slow (N round-trips vs 1) |
| Tauri Channel streaming | Return all results at once | All-at-once = no progress indicator, poor UX for 50+ CLs |
| Result<Vec<...>> | Partial success struct | Result fails entire batch on first error, violates requirement BATCH-02 |

## Architecture Patterns

### Recommended Backend Structure
```rust
// src-tauri/src/commands/p4/p4handlers.rs

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShelvedBatchResult {
    pub changelist_id: i32,
    pub files: Option<Vec<P4ShelvedFile>>,
    pub error: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ShelvedBatchProgress {
    Progress { loaded: u32, total: u32, message: String },
    Result { changelist_id: i32, result: ShelvedBatchResult },
    Complete { success_count: u32, error_count: u32, cancelled: bool },
}

#[tauri::command]
pub async fn p4_describe_shelved_batch(
    changelist_ids: Vec<i32>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
    on_progress: Channel<ShelvedBatchProgress>,
    state: State<'_, ProcessManager>,
) -> Result<String, String> {
    // Build command: p4 -ztag describe -s -S [cl1] [cl2] ...
    // Parse output into per-CL chunks
    // Send Progress + Result for each CL
    // Send Complete at end
}
```

### Frontend Query Pattern
```typescript
// src/hooks/useShelvedFilesBatch.ts

export function useShelvedFilesBatch(changelistIds: number[]) {
  const [results, setResults] = useState<Map<number, P4ShelvedFile[]>>(new Map());
  const [loadedCount, setLoadedCount] = useState(0);
  const { startOperation, updateProgress, completeOperation } = useOperationStore();

  return useQuery({
    queryKey: ['p4', 'shelved-batch', changelistIds.join(',')],
    queryFn: async () => {
      if (changelistIds.length === 0) return new Map();

      await invokeP4DescribeShelvedBatch(changelistIds, (progress) => {
        if (progress.type === 'progress') {
          updateProgress((progress.loaded / progress.total) * 100, progress.message);
        } else if (progress.type === 'result') {
          if (progress.result.files) {
            setResults(prev => new Map(prev).set(progress.changelist_id, progress.result.files));
            setLoadedCount(prev => prev + 1);
          }
        } else if (progress.type === 'complete') {
          if (progress.error_count > 0) {
            toast(`Loaded ${progress.success_count} of ${progress.success_count + progress.error_count} changelists`, {
              icon: '⚠️',
            });
          }
        }
      });

      return results;
    },
    enabled: changelistIds.length > 0,
  });
}
```

### Pattern: Error Isolation in Batch Commands

**What:** Parse batch output into per-item results, never fail entire batch due to single item error.

**When to use:** Any p4 command that processes multiple items (files, changelists, etc.).

**Example:**
```rust
// Parse -ztag output, tracking current CL context
let mut current_cl_id: Option<i32> = None;
let mut current_files: Vec<P4ShelvedFile> = Vec::new();
let mut results: HashMap<i32, Result<Vec<P4ShelvedFile>, String>> = HashMap::new();

for record in parse_ztag_records(output) {
    if let Some(change_str) = record.get("change") {
        // New CL starts - save previous
        if let Some(cl_id) = current_cl_id {
            results.insert(cl_id, Ok(std::mem::take(&mut current_files)));
        }
        current_cl_id = change_str.parse().ok();
    }

    if let Some(depot_file) = record.get("depotFile0") {
        // Parse shelved file for current CL
        current_files.push(/* ... */);
    }
}

// Send each result individually via Channel
for (cl_id, result) in results {
    on_progress.send(ShelvedBatchProgress::Result { changelist_id: cl_id, result });
}
```

### Pattern: Cancellable Batch Operations

**What:** Use ProcessManager to register long-running batch commands for user cancellation.

**When to use:** Operations expected to take >2 seconds or process >10 items.

**Example:**
```rust
let mut child = cmd.spawn()?;
let process_id = state.register(child).await;

// Spawn background task for parsing
tokio::spawn(async move {
    // Check process_id validity periodically
    // Parse output, send progress
    // Clean up on cancel or completion
});

Ok(process_id)  // Return immediately, processing continues in background
```

### Anti-Patterns to Avoid

- **All-or-nothing batch results:** Don't return `Result<Vec<T>>` for batches - one error hides all success. Use `Vec<Result<T>>` or progress channel with per-item results.

- **Blocking parse loops:** Don't parse large -ztag output synchronously. Spawn background task for parsing, send results incrementally.

- **Untracked cancellation:** Don't spawn processes without registering in ProcessManager. Users need cancel buttons for long operations.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-changelist query | Sequential `p4 describe` calls | Single `p4 describe [cl1] [cl2] ...` | Native batch support, 1 server round-trip vs N |
| Progress tracking during parse | Custom event emitter | Tauri Channel with enum variants | Type-safe, built-in backpressure, existing pattern in codebase |
| Cancellable async operations | Manual AbortController logic | ProcessManager.register() + tokio::spawn | Handles .kill() + .wait() correctly, prevents zombies |
| Partial success communication | Custom error codes | Toast for warnings + OutputWindow for details | Established UX pattern (see Phase 18 decisions) |
| -ztag parsing for describe | Regex or manual parsing | `parse_ztag_records()` utility | Already handles multi-record merging, field extraction |

**Key insight:** Perforce CLI was designed for batch operations. Most commands accept multiple arguments (files, CLs, paths). The UI should expose this native batching rather than wrapping individual calls.

## Common Pitfalls

### Pitfall 1: -ztag Field Index Resets Per Changelist

**What goes wrong:** When parsing `p4 describe -ztag -S [multiple CLs]`, field indices like `depotFile0`, `depotFile1`, etc. reset to 0 for each changelist. Naively accumulating all `depotFile{N}` fields without tracking CL boundaries merges files from different changelists.

**Why it happens:** The -ztag format uses `... change NNNN` to delimit records, but field indices restart within each CL's record block.

**How to avoid:**
- Track current changelist context using `... change` field
- When `change` field appears, save accumulated files for previous CL and start fresh vector
- See `parse_ztag_describe_shelved` (parsing.rs:385) for single-CL example - extend to handle multiple CL contexts

**Warning signs:**
- Shelved file lists showing incorrect files for changelists
- File counts not matching `p4 describe` CLI output
- Files from CL 12345 appearing under CL 12346

### Pitfall 2: Empty Results Treated as Errors

**What goes wrong:** CLs without shelved files return non-zero exit code with stderr like "no shelved files in changelist". Treating this as error fails the entire batch and hides results from other CLs.

**Why it happens:** p4 returns exit code 1 for empty result sets, not just actual errors.

**How to avoid:**
- Check stderr for known "empty result" messages: `no shelved files`, `not shelved`, `no shelf`
- Treat empty-result CLs as success with empty file array: `Ok(vec![])`
- Only fail for actual errors: network timeout, auth failure, invalid CL number
- Reference: `p4_describe_shelved` lines 1247-1256 handles this for single CL

**Warning signs:**
- Batch query fails when one CL has no shelf
- Error message contains "no shelved files" but operation marked as failed
- Some CLs load correctly but batch still shows error toast

### Pitfall 3: Progress Updates Block Parsing Thread

**What goes wrong:** Sending `on_progress.send()` calls within tight parsing loop blocks the spawned task if frontend consumer is slow, causing backend to hang.

**Why it happens:** Tauri Channels have bounded buffers (default ~32). If frontend doesn't drain fast enough, sends block.

**How to avoid:**
- Batch progress updates: send every N items (e.g., every 5 CLs), not every file
- Use `try_send()` instead of `send()` for non-critical progress updates
- Send critical results (`Result { ... }`) with `send()` to ensure delivery
- Send `Progress { ... }` with `try_send()` - if buffer full, skip that update

**Warning signs:**
- Backend task never completes despite p4 command finishing
- Progress indicator stuck mid-operation
- Frontend freezes when cancelling operation

### Pitfall 4: React Query Cache Invalidation Triggers Re-Batch

**What goes wrong:** After shelving/unshelving, invalidating `['p4', 'shelved']` query key triggers individual re-fetches of all CL queries instead of re-batching, temporarily reverting to N+1 pattern.

**Why it happens:** React Query's `invalidateQueries` marks matching queries as stale and refetches them. If batch query key doesn't match the invalidation pattern, individual queries refetch.

**How to avoid:**
- Ensure batch query key includes predictable prefix: `['p4', 'shelved-batch', ...]`
- Update invalidation calls to target batch key: `invalidateQueries({ queryKey: ['p4', 'shelved-batch'] })`
- OR: use exact key match for batch, invalidate by exact key after mutations
- Consider: batch query could be single source of truth, remove individual queries entirely

**Warning signs:**
- After shelving, status bar shows N individual "p4 describe" calls
- Output window logs individual describe commands after mutation
- Performance regression after first load (fast batch, slow invalidation)

## Code Examples

Verified patterns from official sources:

### Batch Describe Command
```bash
# Source: https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_describe.html
# Official documentation confirms multi-CL syntax

p4 -ztag describe -s -S 12345 12346 12347

# Output structure:
# ... change 12345
# ... user alice
# ... depotFile0 //depot/main/foo.cpp
# ... action0 edit
# ... type0 text
# ... rev0 5
# (blank line - next changelist starts)
# ... change 12346
# ... user bob
# ... depotFile0 //depot/main/bar.cpp
# ...
```

### Parsing Multi-CL -ztag Output
```rust
// Adapted from parse_ztag_describe_shelved (parsing.rs:385)
// Extended to handle multiple changelists

pub fn parse_describe_shelved_batch(output: &str) -> HashMap<i32, Vec<P4ShelvedFile>> {
    let records = parse_ztag_records(output);
    let mut results: HashMap<i32, Vec<P4ShelvedFile>> = HashMap::new();
    let mut current_cl_id: Option<i32> = None;
    let mut current_fields: HashMap<String, String> = HashMap::new();

    for record in records {
        // Check if this record starts a new changelist
        if let Some(change_str) = record.get("change") {
            // Flush previous CL's files
            if let Some(cl_id) = current_cl_id {
                let files = extract_shelved_files(&current_fields);
                results.insert(cl_id, files);
            }

            // Start new CL context
            current_cl_id = change_str.parse().ok();
            current_fields.clear();
        }

        // Accumulate fields for current CL
        current_fields.extend(record);
    }

    // Don't forget last CL
    if let Some(cl_id) = current_cl_id {
        let files = extract_shelved_files(&current_fields);
        results.insert(cl_id, files);
    }

    results
}

fn extract_shelved_files(fields: &HashMap<String, String>) -> Vec<P4ShelvedFile> {
    let mut files = Vec::new();
    let mut index = 0;

    loop {
        let depot_file_key = format!("depotFile{}", index);
        if let Some(depot_path) = fields.get(&depot_file_key) {
            let action = fields.get(&format!("action{}", index)).cloned().unwrap_or_default();
            let file_type = fields.get(&format!("type{}", index)).cloned().unwrap_or_else(|| "text".to_string());
            let revision = fields.get(&format!("rev{}", index))
                .and_then(|s| s.parse::<i32>().ok())
                .unwrap_or(0);

            files.push(P4ShelvedFile {
                depot_path: depot_path.clone(),
                action,
                file_type,
                revision,
            });

            index += 1;
        } else {
            break;
        }
    }

    files
}
```

### Cancellable Batch Operation with Progress
```rust
// Pattern from p4_fstat_stream (p4handlers.rs:82-218)
// Adapted for batch describe

#[tauri::command]
pub async fn p4_describe_shelved_batch(
    changelist_ids: Vec<i32>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
    on_progress: Channel<ShelvedBatchProgress>,
    state: State<'_, ProcessManager>,
) -> Result<String, String> {
    if changelist_ids.is_empty() {
        return Ok("".to_string());
    }

    let total = changelist_ids.len() as u32;
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("-ztag");
    cmd.arg("describe");
    cmd.arg("-s");  // suppress diffs
    cmd.arg("-S");  // show shelved files

    for cl_id in &changelist_ids {
        cmd.arg(cl_id.to_string());
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn p4 describe: {}", e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Register for cancellation
    let process_id = state.register(child).await;
    let process_id_clone = process_id.clone();

    // Parse stdout in background
    if let Some(stdout) = stdout {
        let on_progress_clone = on_progress.clone();
        tokio::spawn(async move {
            let output = tokio::io::read_to_string(stdout).await.unwrap_or_default();
            let results = parse_describe_shelved_batch(&output);

            let mut success_count = 0;
            let mut error_count = 0;

            for (index, cl_id) in changelist_ids.iter().enumerate() {
                let files = results.get(cl_id).cloned().unwrap_or_default();
                let has_error = files.is_empty() && /* check if expected files */;

                if has_error {
                    error_count += 1;
                } else {
                    success_count += 1;
                }

                // Send result
                let _ = on_progress_clone.send(ShelvedBatchProgress::Result {
                    changelist_id: *cl_id,
                    result: ShelvedBatchResult {
                        changelist_id: *cl_id,
                        files: Some(files),
                        error: None,
                    },
                });

                // Send progress update every 5 CLs
                if (index + 1) % 5 == 0 {
                    let _ = on_progress_clone.try_send(ShelvedBatchProgress::Progress {
                        loaded: (index + 1) as u32,
                        total,
                        message: format!("Loading shelved files... ({}/{})", index + 1, total),
                    });
                }
            }

            // Send completion
            let _ = on_progress_clone.send(ShelvedBatchProgress::Complete {
                success_count,
                error_count,
                cancelled: false,
            });
        });
    }

    Ok(process_id_clone)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| useQueries with N queries | Single batch query with streaming | This phase (25) | 10-50x latency reduction for 10-50 CLs |
| Individual error handling per query | Batch error isolation with partial success | This phase (25) | Better UX - show what loaded, toast for failures |
| No progress indicator for shelved files | Count-based progress in status bar | This phase (25) | User sees progress for large CL lists |

**Deprecated/outdated:**
- Individual `p4 describe -S [single-CL]` calls - now batched
- React Query useQueries for shelved files - replaced with single batch query
- Treating empty shelved file results as hard errors - now handled as empty success

## Open Questions

Things that couldn't be fully resolved:

1. **p4 describe batch size limits**
   - What we know: CLI supports multiple CL arguments, no documented hard limit
   - What's unclear: Server-side limits on command length or result size (10 CLs? 100? 1000?)
   - Recommendation: Start with no artificial limit, add chunking if users report errors with large batches (50+ CLs). Monitor output window for "command too long" errors.

2. **Optimal progress update frequency**
   - What we know: Status bar can show count-based progress, backend can send updates per CL
   - What's unclear: Does sending progress per-CL (50 updates for 50 CLs) flood the IPC channel?
   - Recommendation: Batch progress updates (every 5 CLs), send individual results always. If performance issues arise, increase batch interval to 10.

3. **Retry logic for individual failed CLs**
   - What we know: User decisions say "no manual retry, auto-retry on next refresh"
   - What's unclear: Should backend track which specific CLs failed and retry only those on next batch?
   - Recommendation: Keep it simple - on next refresh/invalidation, re-batch all CLs. Failed CLs will be retried naturally. Don't add stateful retry tracking.

## Sources

### Primary (HIGH confidence)
- Perforce Official Documentation - p4 describe command reference
  - URL: https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_describe.html
  - Verified: Multiple CL syntax, -ztag support, -S flag for shelved files
- Existing codebase patterns (p4handlers.rs, parsing.rs, useChangelists.ts)
  - Analyzed: Current N+1 implementation, streaming patterns, error handling
  - Direct file inspection confirms: -ztag parsing utilities, ProcessManager pattern, React Query integration

### Secondary (MEDIUM confidence)
- React Query documentation for useQueries to single query migration
  - Pattern: Replace array of queries with single query managing batch state
- Tauri Channel documentation for streaming results
  - Pattern: Enum variants for different message types (Progress, Result, Complete)

### Tertiary (LOW confidence)
- None - all findings verified with primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, verified in package.json and Cargo.toml
- Architecture: HIGH - Patterns directly observed in existing streaming commands (p4_fstat_stream, p4_sync)
- Pitfalls: HIGH - Identified from actual codebase code (parse_ztag_describe_shelved, error handling in p4_describe_shelved)
- p4 batch syntax: HIGH - Verified with official Perforce documentation + WebSearch confirmation

**Research date:** 2026-02-04
**Valid until:** ~60 days (stable domain - Perforce CLI syntax unchanged for years, codebase patterns established in Phase 21)
