# Domain Pitfalls: P4Now v2.0 Features

**Domain:** Perforce GUI (Tauri 2.0 + React 19, CLI wrapper)
**Researched:** 2026-01-28
**Confidence:** HIGH (based on P4 CLI behavior, Tauri/WebView constraints, and codebase analysis)

---

## Critical Pitfalls

Mistakes that cause data loss, rewrites, or broken UX.

### Pitfall 1: Shelve/Unshelve Silently Overwrites Local Changes

**What goes wrong:** `p4 unshelve` replaces the workspace file with the shelved version. If the user has local edits that differ from the shelved version, those edits are destroyed without warning. The CLI does not prompt -- it just overwrites.

**Why it happens:** Developers assume unshelve is a "merge" operation. It is not -- it is a replace. The `-f` flag forces unshelve even when files are already open, compounding the risk.

**Consequences:** User loses local work silently. No undo available.

**Prevention:**
- Before unshelve, run `p4 diff` on any locally-opened files that overlap with the shelf. Warn the user if local changes exist.
- After unshelve, show a diff summary of what changed.
- Never pass `-f` without explicit user confirmation.

**Warning signs:** Users reporting "my changes disappeared after unshelve."

**Phase:** Shelve/unshelve feature must include pre-unshelve conflict detection from day one.

---

### Pitfall 2: Reconcile on Large Workspaces Freezes the App

**What goes wrong:** `p4 reconcile` scans the entire workspace filesystem, comparing every file against the depot. On workspaces with 50K+ files, this takes minutes. Since the current architecture uses `Command::new("p4")` with `.output()` (waits for full completion), the Rust backend blocks until reconcile finishes. Even the streaming `spawn` approach produces thousands of lines of output that overwhelm the UI.

**Why it happens:** Reconcile is inherently expensive -- it stats every file on disk. The app's "never block the user" principle conflicts with reconcile's blocking nature.

**Consequences:** App appears frozen. Users kill it, leaving partial state. Or the UI floods with thousands of file entries.

**Prevention:**
- Always use the streaming `spawn_p4_command` path with progress reporting.
- Scope reconcile to subdirectories (`p4 reconcile //depot/path/subdir/...`) instead of whole workspace.
- Add a cancel button (already have `kill_process` infrastructure).
- Batch UI updates -- do not render each file as it arrives. Accumulate for 100ms, then render batch.
- Show estimated progress: parse "N files examined" from reconcile output.

**Warning signs:** QA reports "app hangs when I click Reconcile."

**Phase:** Reconcile feature. Must use streaming + scoped paths from initial implementation.

---

### Pitfall 3: Moving Files Between Changelists Is Not Atomic

**What goes wrong:** `p4 reopen -c <target_CL> <file>` moves one file at a time. If you drag 20 files to a new changelist and the operation fails on file 11 (e.g., file is locked by another user), you end up with files split across two changelists. The Zustand store shows one state, the server has another.

**Why it happens:** P4 has no batch-move-to-changelist command. Each `p4 reopen` is independent. The current `p4_edit` command already handles reopening but processes files individually via CLI output parsing.

**Consequences:** UI shows files in wrong changelist. User confusion. Potential accidental submit of partial work.

**Prevention:**
- Run all `p4 reopen` commands, collect successes and failures separately.
- On partial failure, show a clear error: "Moved 10/20 files. 10 files could not be moved: [reasons]."
- Re-fetch changelist state from server after any reopen operation (`p4 opened` to get ground truth).
- Implement undo: track the source changelist so failed files can be described accurately.
- In the Zustand store, use optimistic updates but roll back on failure per-file.

**Warning signs:** Store state diverging from server state after drag-drop operations.

**Phase:** Multiple changelists + drag-drop. Must handle partial failure from v1 of this feature.

---

### Pitfall 4: Default Changelist Edge Cases Break Multi-Changelist UX

**What goes wrong:** P4's default changelist (id=0) behaves differently from numbered changelists:
- You cannot shelve the default changelist directly (must specify files or use `-c default`).
- `p4 reopen -c default` uses the literal string "default", not 0.
- Files opened without `-c` go to default, not the last-used changelist.
- The default changelist cannot be deleted.
- `p4 submit` with no `-c` flag submits ALL files in the default changelist.

The current code already hardcodes `changelist == 0` for default (see `p4_submit`). But every new feature (shelve, reopen, drag-drop) must handle this special case.

**Consequences:** Commands fail silently or act on wrong files. Submitting default CL accidentally submits everything.

**Prevention:**
- Create a P4 command builder abstraction that translates `0` to `"default"` for commands that need the string form.
- For submit from default CL, always show a confirmation dialog listing ALL files that will be submitted.
- Consider auto-creating numbered changelists and discouraging use of default (like P4V does).
- Unit test every command path with both `changelist=0` and `changelist=N`.

**Phase:** Affects multiple changelists, shelve, and drag-drop. Address in the changelist management phase before shelving.

---

## Moderate Pitfalls

Mistakes that cause poor UX, rework, or technical debt.

### Pitfall 5: File History Performance Cliff

**What goes wrong:** `p4 filelog` returns the entire history of a file. For files with 500+ revisions (common in long-lived repos), parsing and rendering all revisions is slow. Worse, `p4 filelog -l` (long descriptions) multiplies the data volume. Integration history (branches/merges) adds `... ... ` lines that explode the output size.

**Prevention:**
- Use `p4 filelog -m 50` to limit initial fetch. Add "Load more" pagination.
- Use `-s` (short, no integration history) for initial display. Offer "Show integrations" toggle.
- Parse incrementally with the streaming approach, not `.output()`.
- Cache results -- file history is immutable for past revisions.

**Phase:** File history viewer.

---

### Pitfall 6: External Diff Tool Launch Blocks the Event Loop

**What goes wrong:** Launching `p4 diff` or a custom diff tool (Beyond Compare, WinMerge, etc.) with `Command::new()` and calling `.output()` or `.wait()` blocks the Rust async runtime. The diff tool window stays open indefinitely (user is reading diffs), and the app hangs.

**Why it happens:** The current codebase uses both `.output()` (blocking) and `spawn` (non-blocking) patterns. It is easy to accidentally use the blocking path for diff.

**Consequences:** App freezes until user closes the diff tool.

**Prevention:**
- Always use `.spawn()` for external tools. Never `.output()` or `.wait()`.
- Track spawned diff processes in `ProcessManager` for cleanup on app exit.
- Use `p4 set P4DIFF` to detect configured diff tool. Fall back to system default.
- For temp files (needed when diffing depot revisions): create in a temp directory, clean up when the diff process exits (monitor with a background thread).
- Handle "tool not found" gracefully: try the command, catch the spawn error, show a settings dialog to configure the diff tool path.

**Phase:** External diff tool integration.

---

### Pitfall 7: Keyboard Shortcuts Conflict with WebView/OS

**What goes wrong:** Tauri uses a WebView (WebView2 on Windows). The WebView captures many keyboard shortcuts:
- `Ctrl+A` -- selects all text in the WebView, not "select all files"
- `Ctrl+F` -- opens WebView's built-in find bar, not app search
- `Ctrl+P` -- triggers print dialog
- `F5` -- refreshes the WebView (reloads the entire app!)
- `Ctrl+R` -- also refreshes
- `Ctrl+L` -- focuses the URL bar (if visible)
- `Backspace` -- navigates back in WebView history

**Consequences:** Shortcuts either do the wrong thing or are silently swallowed by the WebView.

**Prevention:**
- In Tauri 2.0, disable default WebView shortcuts via the window configuration or by intercepting key events at the Rust level.
- Use `document.addEventListener('keydown')` with `preventDefault()` for app shortcuts at the React level.
- Avoid `Ctrl+R`, `F5`, `Ctrl+P`, `Ctrl+L` as app shortcuts entirely -- too confusing when they sometimes leak through.
- Test every shortcut with focus in different UI areas (tree, panel, dialog).
- Provide a keyboard shortcut settings page so users can remap conflicts.

**Phase:** Keyboard shortcuts. Research Tauri 2.0's exact WebView key interception API before implementation.

---

### Pitfall 8: Connection Status Polling Creates Server Load and Zombie Processes

**What goes wrong:** Naively polling `p4 info` every N seconds to check connection status:
- Spawns a new `p4.exe` process each time (process creation overhead on Windows is ~10ms).
- Each call authenticates with the server.
- At 5-second intervals, this is 12 p4.exe processes per minute doing nothing useful.
- If the server is slow/down, pending `p4 info` calls queue up, spawning zombie processes.

**Prevention:**
- Use exponential backoff: 5s when connected, 30s after first failure, 60s after sustained failure.
- Piggyback on real commands: if the user runs `p4 sync`, that confirms connection. Reset the timer.
- Use a single `p4 info` call, not `p4 ping` (info gives useful data, ping is deprecated in some server versions).
- Set a timeout on the connection check process (kill after 5 seconds = assume disconnected).
- Track in-flight connection checks to prevent stacking.

**Phase:** Connection status indicator.

---

### Pitfall 9: Settings Persistence Corruption and Migration

**What goes wrong:** If settings are stored in a JSON file, concurrent reads/writes from the Rust backend and the React frontend can corrupt the file. Schema changes between app versions break deserialization.

**Prevention:**
- Use `tauri-plugin-store` which handles file locking.
- Define a settings schema with version number. On load, migrate old schemas to current.
- Validate all settings on load -- replace invalid values with defaults rather than crashing.
- For P4 connection settings specifically: validate by running `p4 -p <port> -u <user> -c <client> info` before saving.
- Store settings in `%APPDATA%/p4now/` (Tauri's standard app data path).

**Phase:** Connection settings UI. Establish the settings infrastructure before other features depend on it.

---

### Pitfall 10: Drag-and-Drop Accidental File Moves with No Undo

**What goes wrong:** User accidentally drops files on the wrong changelist. Since `p4 reopen` executes immediately, the move is committed to the server. There is no client-side undo.

**Prevention:**
- Show a confirmation dialog for multi-file drops: "Move N files to changelist X?"
- Implement client-side undo: store the previous changelist for each moved file. "Undo" runs `p4 reopen -c <original_CL>` to move files back.
- Add visual feedback during drag: highlight valid drop targets, show file count badge on cursor.
- Reject drops on invalid targets (e.g., submitted changelists).
- Debounce rapid successive drops to prevent double-processing.

**Phase:** Drag-drop in multiple changelists feature.

---

### Pitfall 11: Search Submitted Changelists Hammers the Server

**What goes wrong:** `p4 changes -s submitted` returns ALL submitted changelists. On an active server, this can be millions of records. Even with `-m 100` limit, searching by description requires `p4 changes -l` which fetches full descriptions server-side before filtering.

**Prevention:**
- Always use `-m <limit>` (start with 100, allow "load more").
- Filter by date range: `p4 changes -s submitted @2026/01/01,@now`.
- Filter by path when possible: `p4 changes -s submitted //depot/path/...`.
- For description search, use `p4 changes -l -m 500` and filter client-side. Do NOT fetch unlimited results.
- Cache results: submitted changelists are immutable. Cache by CL number.
- Debounce search input (300ms) to avoid firing queries on every keystroke.

**Phase:** Search submitted changelists feature.

---

## Minor Pitfalls

Annoyances that are fixable but worth avoiding.

### Pitfall 12: Shelve of Binary Files Creates Huge Shelf Storage

**What goes wrong:** Users shelve large binary files (textures, builds) without realizing each shelve creates a full copy on the server. Repeated shelve/unshelve cycles consume significant server storage.

**Prevention:** Show file sizes in the shelve dialog. Warn when shelving files over a configurable threshold (e.g., 50MB). Show total shelf size.

---

### Pitfall 13: Stream/Repository Display Assumes Single Stream

**What goes wrong:** The current `P4ClientInfo.client_stream` is `Option<String>` -- handles classic and stream depots. But some workflows involve switching streams (`p4 switch`), and the cached stream name becomes stale.

**Prevention:** Re-fetch `p4 info` when the user returns to the app (window focus event) or after any stream-related operation. Display the stream name prominently so staleness is visible.

---

### Pitfall 14: Context Menu Items Enabled for Invalid States

**What goes wrong:** Right-click context menu shows "Shelve" for files that cannot be shelved (e.g., files opened for add in default changelist with certain server configurations), or "Diff" for deleted files, or "Revert" for files not opened.

**Prevention:** Query file state before building context menu items. Disable (gray out with tooltip) rather than hide invalid actions -- users need to discover features exist even when not applicable.

---

### Pitfall 15: Reconcile False Positives from Line Ending Differences

**What goes wrong:** Files modified only by line-ending changes (CRLF vs LF) show up as "needs edit" in reconcile. On Windows workspaces this is common when Git tools or editors change line endings.

**Prevention:** Use `p4 reconcile -n` (preview mode) first. Filter results: if the only difference is line endings, flag separately. Consider using `p4 diff -dl` (ignore line endings) to verify.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Connection settings UI | Saving invalid P4PORT crashes subsequent commands | Validate with `p4 -p <port> info` before persisting |
| File history | Rendering 1000+ revisions kills React performance | Virtualized list + paginated fetch (`-m 50`) |
| External diff | Temp files left behind after app crash | Use OS temp dir + cleanup on app start |
| Keyboard shortcuts | F5 reloads WebView, losing all state | Intercept at document level before WebView handles it |
| Connection status | Polling spawns zombie p4.exe on network timeout | Set process kill timeout, track in ProcessManager |
| Reconcile | User runs reconcile on 100K-file workspace | Scope to subdirectory, stream results, allow cancel |
| Multiple changelists | Default CL (id=0) uses "default" string in some commands | Abstract CL ID translation in command builder |
| Shelve/unshelve | Unshelve overwrites local edits silently | Pre-check with `p4 diff`, warn on conflicts |
| Drag-drop | No undo after accidental move | Track source CL, offer undo via `p4 reopen` |
| Search | Unbounded `p4 changes` query | Always use `-m` limit + date range filter |
| Stream display | Cached stream stale after `p4 switch` | Re-fetch on window focus |
| Context menus | Menu items enabled for invalid file states | Check file state before building menu |

---

## Integration Pitfalls with Existing Architecture

### Current: All Commands Use `std::process::Command`

Every new feature adds more `p4.exe` process spawns. On Windows, process creation is expensive (~10ms each). With connection polling + reconcile + history + normal operations, the app could easily spawn 10+ processes per second.

**Mitigation:** Consider a persistent `p4 -x - -ztag` session (reads commands from stdin) for rapid-fire operations. Or batch related queries. At minimum, queue commands and limit concurrency to 3-4 simultaneous p4.exe processes.

### Current: Zustand Stores Are File-Centric

The `changelistStore` and `fileTreeStore` track files and changelists. Adding shelves, history, and search results needs new stores or significant store expansion. If shelved files, opened files, and history all reference the same depot path with different data shapes, normalization becomes important.

**Mitigation:** Design a normalized data layer: files keyed by depot path, with relationships to changelists, shelves, and history. Avoid duplicating file data across stores.

### Current: Events Are Fire-and-Forget

The `app.emit("file-status-changed", ...)` pattern works for simple updates but does not guarantee the frontend received or processed the event. With more features emitting events (shelve-complete, reconcile-progress, connection-changed), event ordering and deduplication matter.

**Mitigation:** Add sequence numbers or timestamps to events. In stores, ignore events older than current state. Consider a single event bus with typed events rather than ad-hoc emit calls.
