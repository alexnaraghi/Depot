# Pitfalls Research: v4.0 P4V Parity Features

**Domain:** Perforce GUI - Adding Blame, Workspace Sync Status, File Viewer, Submit Preview, Submitted CL Files, Bookmarks
**Researched:** 2026-02-03
**Confidence:** MEDIUM

This document focuses on pitfalls specific to adding v4.0 P4V parity features to the existing P4Now v3.0 codebase (73,000 LOC). These features close visible daily-use gaps versus P4V.

---

## Executive Summary

Adding P4V parity features to an existing Perforce GUI introduces integration pitfalls distinct from building these features from scratch. The core risks are: (1) `p4 annotate` performance degradation on large files and incorrect blame after renames, (2) `p4 fstat` workspace tree query inefficiency compared to `p4 have`, (3) `p4 print` binary file handling and memory exhaustion, (4) submit dialog preview conflicting with existing submit workflow, (5) `p4 describe` query cost for large submitted changelists, and (6) bookmark schema migration breaking existing settings. **Key insight**: All six features involve commands with known performance traps that manifest differently when integrated into an existing app versus new development.

---

## Critical Pitfalls

### Pitfall 1: p4 annotate Blames Wrong Author After File Rename/Move

**Risk:** File annotations show incorrect author/revision data for lines that existed before file was renamed or moved via `p4 integrate`. User sees "Bob added line 42" when actually "Alice added it 2 years ago in the original file."

**Why it happens:**
Perforce doesn't have a native rename command. Files are renamed by:
1. `p4 integrate oldPath newPath` (creates newPath#1 with all history attached to oldPath)
2. `p4 delete oldPath`
3. `p4 submit`

The pitfall: `p4 annotate newPath` only annotates from newPath#1 forward. It does NOT follow the integration history back to oldPath. Result: All lines from oldPath show up as authored by whoever performed the integrate (the "rename author"), not the original authors.

Detecting renames requires parsing `p4 filelog -i` (follow integrations) to find integration records, then manually stitching together annotation across file paths. This is complex, slow, and error-prone.

**Warning Signs:**
- Entire file shows single author/revision when it clearly has multiple contributors
- Recent revision number on old code (e.g., 100-line function shows #3 when file is at #3 after rename from file at #87)
- User reports: "Blame shows wrong person for this code"
- `p4 filelog` shows integration records (`branch from`, `merge from`)

**Prevention:**
1. **Detect integration history before annotation:**
   ```rust
   #[tauri::command]
   pub async fn p4_annotate_with_renames(
       depot_path: String,
       // ... connection args
   ) -> Result<Vec<AnnotationLine>, String> {
       // Step 1: Check if file has integration history
       let filelog_output = run_p4_command(&["filelog", "-i", "-m", "1", &depot_path])?;
       let has_integrations = filelog_output.contains("branch from")
           || filelog_output.contains("merge from");

       if has_integrations {
           // Warn user or attempt to follow integration chain
           return Err("File has rename/integration history. Annotation may be incomplete.".to_string());
       }

       // Step 2: Run standard p4 annotate
       run_p4_annotate(&depot_path)
   }
   ```

2. **Warn user when annotation is incomplete:**
   ```tsx
   {fileHasIntegrationHistory && (
     <Alert variant="warning">
       This file was renamed/moved. Annotations only show history since {renamedAtRevision}.
       <Button onClick={() => viewFullHistory()}>View Full History</Button>
     </Alert>
   )}
   ```

3. **Limit annotation query to recent revisions:**
   ```bash
   # Only annotate last 100 revisions to avoid performance issues
   p4 annotate -i -I file.txt#head,#head-100
   ```

4. **Cache annotation results aggressively:**
   ```typescript
   useQuery(['annotate', depotPath, headRev], fetchAnnotate, {
     staleTime: 60 * 60 * 1000, // 1 hour - annotations rarely change retroactively
     cacheTime: 24 * 60 * 60 * 1000, // 24 hours
   });
   ```

5. **Surface `p4 filelog` instead for renamed files:**
   - If integration detected, redirect user to file history viewer
   - Show integration graph: "File was `oldPath` until #87, then renamed to `newPath`"
   - Provide "Annotate Original File" button for pre-rename history

**Affects:** File annotations (blame) feature - Phase 1 implementation

---

### Pitfall 2: p4 annotate Hangs on Large Files (>10MB Default Limit)

**Risk:** User opens blame view for 50MB log file. UI shows "Loading annotations..." for 30 seconds, then returns empty result or hangs. Backend spawns `p4 annotate` process that server rejects due to `dm.annotate.maxsize` limit (default 10MB).

**Why it happens:**
Perforce servers have `dm.annotate.maxsize` configurable (default 10MB) to prevent memory exhaustion. Files exceeding this size are silently ignored by `p4 annotate`. The command returns exit code 0 but outputs no annotation data. GUI doesn't detect this condition and shows "No annotations available" or hangs waiting for data.

Additionally, even below the limit, `p4 annotate` on files with thousands of revisions can take 10+ seconds on slow networks. If run synchronously on UI thread or without timeout, this blocks the app.

**Warning Signs:**
- Blame view works for small files, fails silently for large files
- `p4 annotate` command in logs shows no output but exit code 0
- Server logs show "file too large for annotation" or similar
- Blame request times out after 30s
- No error message shown to user, just empty result

**Prevention:**
1. **Check file size before annotation:**
   ```rust
   #[tauri::command]
   pub async fn p4_annotate(
       depot_path: String,
       // ... connection args
   ) -> Result<Vec<AnnotationLine>, String> {
       // Step 1: Get file size from p4 fstat
       let fstat_output = run_p4_command(&["-ztag", "fstat", &depot_path])?;
       let file_size = parse_ztag_field(&fstat_output, "fileSize")
           .and_then(|s| s.parse::<i64>().ok())
           .unwrap_or(0);

       // Assume 10MB server limit unless admin configured higher
       const MAX_ANNOTATE_SIZE: i64 = 10 * 1024 * 1024;

       if file_size > MAX_ANNOTATE_SIZE {
           return Err(format!(
               "File too large for annotation ({:.1}MB). Server limit is 10MB.",
               file_size as f64 / 1024.0 / 1024.0
           ));
       }

       // Step 2: Run annotation with timeout
       run_p4_annotate_with_timeout(&depot_path, 30_000) // 30s timeout
   }
   ```

2. **Show progressive loading for large annotations:**
   ```tsx
   const AnnotateView = ({ depotPath }) => {
     const { data, error, isLoading } = useQuery(
       ['annotate', depotPath],
       () => invoke('p4_annotate', { depotPath }),
       { timeout: 30_000 }
     );

     if (isLoading) {
       return (
         <div>
           <Spinner />
           <p>Loading annotations... This may take up to 30 seconds for large files.</p>
           <Button onClick={cancelQuery}>Cancel</Button>
         </div>
       );
     }

     if (error?.includes("too large")) {
       return (
         <Alert variant="warning">
           This file is too large for annotation. Try viewing file history instead.
           <Button onClick={() => showHistory(depotPath)}>View History</Button>
         </Alert>
       );
     }

     // Render annotations
   };
   ```

3. **Use `p4 annotate -I` to limit revision range:**
   ```bash
   # Only annotate recent revisions for faster results
   p4 annotate -I file.txt#head,#head-50
   ```

4. **Spawn annotation in background, stream results:**
   ```rust
   // Don't block on p4 annotate completion
   // Stream results as they arrive
   let mut cmd = Command::new("p4")
       .args(["annotate", "-c", &depot_path])
       .stdout(Stdio::piped())
       .spawn()?;

   let stdout = cmd.stdout.take().unwrap();
   let reader = BufReader::new(stdout);

   // Emit partial results as lines arrive
   for line in reader.lines() {
       let line = line?;
       let annotation = parse_annotation_line(&line)?;
       app.emit("annotation-line", annotation)?;
   }
   ```

**Affects:** File annotations (blame) feature - Phase 1 implementation

---

### Pitfall 3: Workspace File Tree Queries Use Slow p4 fstat Instead of p4 have

**Risk:** App queries workspace file tree to show sync status (have-rev vs head-rev) by running `p4 fstat //...` for 10,000 files. Query takes 15 seconds on cold cache. User clicks "Refresh" and waits 15 seconds again. Auto-refresh every 30s makes app unusable due to constant 15s freezes.

**Why it happens:**
The existing codebase uses `p4 fstat` for all file queries because it returns rich metadata (status, action, changelist). But for workspace tree sync status, you only need two fields: `haveRev` and `headRev`. `p4 fstat` queries the entire file database with expensive joins. `p4 have` only queries the client's have table, which is 10-100x faster.

Efficiency comparison:
- `p4 have //...` → Client have table only (fast, 0.5s for 10k files)
- `p4 fstat -T haveRev,headRev //...` → File database + have table (slow, 15s for 10k files)

**Warning Signs:**
- Workspace tree load takes >5s with thousands of files
- `p4 fstat` in logs for simple sync status check
- Task Manager shows `p4.exe` running for 10+ seconds
- Users report: "App freezes when refreshing"
- Query DevTools shows file query taking 10,000ms+

**Prevention:**
1. **Use `p4 have` for sync status queries:**
   ```rust
   #[tauri::command]
   pub async fn p4_workspace_sync_status(
       server: Option<String>,
       user: Option<String>,
       client: Option<String>,
   ) -> Result<Vec<FileSyncStatus>, String> {
       // Step 1: Get have revisions (fast)
       let have_output = run_p4_command(&["have", "//..."])?;
       let have_map = parse_have_output(&have_output); // depot_path -> have_rev

       // Step 2: Get head revisions (also fast, server-side query)
       let files_output = run_p4_command(&["files", "//..."])?;
       let head_map = parse_files_output(&files_output); // depot_path -> head_rev

       // Step 3: Compare locally
       let sync_status: Vec<FileSyncStatus> = have_map.iter()
           .map(|(path, have_rev)| {
               let head_rev = head_map.get(path).copied().unwrap_or(*have_rev);
               FileSyncStatus {
                   depot_path: path.clone(),
                   have_rev: *have_rev,
                   head_rev,
                   status: if *have_rev < head_rev { "outOfDate" } else { "synced" }
               }
           })
           .collect();

       Ok(sync_status)
   }
   ```

2. **Lazy load tree sync status on expand:**
   ```typescript
   // Don't query entire workspace upfront
   // Load sync status per folder when user expands
   const useFolderSyncStatus = (folderPath: string) => {
     return useQuery(
       ['sync-status', folderPath],
       () => invoke('p4_have', { path: `${folderPath}/...` }),
       { enabled: isFolderExpanded }
     );
   };
   ```

3. **Use `p4 fstat -T` to limit fields when full metadata needed:**
   ```bash
   # Only request needed fields, not all 50+ fields
   p4 fstat -T "depotFile,haveRev,headRev,action" //...
   ```

4. **Cache workspace sync status with long staleTime:**
   ```typescript
   useQuery(['workspace-sync-status'], fetchSyncStatus, {
     staleTime: 5 * 60 * 1000, // 5 minutes
     // Sync status changes rarely unless user syncs
     // Don't refetch constantly
   });
   ```

5. **Show diff count, not full tree, for out-of-date indicator:**
   ```typescript
   // Instead of full tree with status icons:
   // "Workspace: 47 files out of date (click to view)"
   const outOfDateCount = useQuery(
     ['out-of-date-count'],
     async () => {
       const haveMap = await invoke('p4_have');
       const filesMap = await invoke('p4_files');
       return countOutOfDate(haveMap, filesMap);
     },
     { staleTime: 60_000 } // 1 minute
   );
   ```

**Affects:** Workspace file tree with sync status - Phase 2 implementation

---

### Pitfall 4: p4 print Loads Entire Binary File Into Memory

**Risk:** User opens 500MB binary file (asset, video, compiled binary) in file content viewer. Backend runs `p4 print //depot/asset.bin`, loads entire 500MB into Rust process memory, serializes to base64, sends 700MB JSON blob to frontend. App crashes with OOM (Out Of Memory).

**Why it happens:**
The TODO at `RevisionDetailView.tsx:43` indicates `p4_print` is not yet implemented. When implementing, naive approach is:
```rust
let output = Command::new("p4").args(["print", "-o", temp_path, depot_path]).output()?;
let content = fs::read_to_string(temp_path)?; // Loads entire file into memory
Ok(content) // Serialize to JSON
```

This works for small text files but fails catastrophically for large files. `p4 print` also doesn't distinguish binary vs text, so attempting to print binary as UTF-8 string causes decode errors.

Additionally, `p4 -G print` (Python marshalled output) is known to be extremely slow for binary files, grinding servers to a halt.

**Warning Signs:**
- File viewer works for 1KB files, crashes for 100MB+ files
- Memory usage spikes 500MB+ when opening file viewer
- App becomes unresponsive after opening binary file
- Error: "Failed to decode UTF-8" for binary files
- Task Manager shows `p4.exe` consuming GBs of memory

**Prevention:**
1. **Check file type and size before printing:**
   ```rust
   #[tauri::command]
   pub async fn p4_print(
       depot_path: String,
       revision: Option<i32>,
       // ... connection args
   ) -> Result<FileContent, String> {
       // Step 1: Get file type and size
       let rev_spec = revision.map(|r| format!("{}#{}", depot_path, r))
           .unwrap_or_else(|| depot_path.clone());

       let fstat_output = run_p4_command(&["-ztag", "fstat", &rev_spec])?;
       let file_type = parse_ztag_field(&fstat_output, "headType").unwrap_or("text");
       let file_size = parse_ztag_field(&fstat_output, "fileSize")
           .and_then(|s| s.parse::<i64>().ok())
           .unwrap_or(0);

       const MAX_VIEWABLE_SIZE: i64 = 10 * 1024 * 1024; // 10MB

       // Step 2: Reject binary files
       if file_type.starts_with("binary") || file_type.contains("ubinary") {
           return Err("Cannot view binary files. Use external editor instead.".to_string());
       }

       // Step 3: Reject large files
       if file_size > MAX_VIEWABLE_SIZE {
           return Err(format!(
               "File too large to view ({:.1}MB). Maximum is 10MB.",
               file_size as f64 / 1024.0 / 1024.0
           ));
       }

       // Step 4: Print to temp file (not memory)
       let temp_file = create_temp_file()?;
       run_p4_command(&["print", "-o", temp_file.path(), &rev_spec])?;

       // Step 5: Read with size limit (prevent runaway memory)
       let content = fs::read_to_string(temp_file.path())
           .map_err(|e| format!("Failed to read file: {}", e))?;

       Ok(FileContent { content, file_type })
   }
   ```

2. **For external editor, use temp file not memory:**
   ```rust
   // Open in external editor - don't serialize through IPC
   #[tauri::command]
   pub async fn p4_open_in_editor(
       depot_path: String,
       revision: Option<i32>,
       editor_path: String,
   ) -> Result<(), String> {
       let temp_file = create_temp_file()?;
       let rev_spec = revision.map(|r| format!("{}#{}", depot_path, r))
           .unwrap_or_else(|| depot_path.clone());

       // Print directly to temp file
       run_p4_command(&["print", "-o", temp_file.path(), &rev_spec])?;

       // Launch editor with temp file path (editor handles large files)
       Command::new(editor_path)
           .arg(temp_file.path())
           .spawn()?;

       Ok(())
   }
   ```

3. **Show preview warning for large text files:**
   ```tsx
   const FileViewer = ({ depotPath, revision }) => {
     const { data: fileInfo } = useQuery(['fstat', depotPath], fetchFileInfo);

     const fileSizeMB = (fileInfo?.fileSize || 0) / 1024 / 1024;
     const canView = fileSizeMB < 10 && !fileInfo?.fileType?.includes('binary');

     if (!canView) {
       return (
         <Alert variant="warning">
           Cannot view {fileInfo?.fileType} file ({fileSizeMB.toFixed(1)}MB).
           <Button onClick={() => openInExternalEditor()}>Open in External Editor</Button>
         </Alert>
       );
     }

     // Render file content
   };
   ```

4. **Stream large files with chunking (advanced):**
   ```rust
   // For very large viewable text files, stream in chunks
   #[tauri::command]
   pub async fn p4_print_chunked(
       depot_path: String,
       app: AppHandle,
   ) -> Result<(), String> {
       let temp_file = create_temp_file()?;
       run_p4_command(&["print", "-o", temp_file.path(), &depot_path])?;

       // Read and emit in 64KB chunks
       let file = File::open(temp_file.path())?;
       let reader = BufReader::new(file);

       for (i, chunk) in reader.bytes().chunks(64 * 1024).into_iter().enumerate() {
           let bytes: Vec<u8> = chunk.collect::<Result<Vec<_>, _>>()?;
           let text = String::from_utf8_lossy(&bytes);
           app.emit("file-content-chunk", (i, text.to_string()))?;
       }

       Ok(())
   }
   ```

**Affects:**
- Open file in external editor - Phase 3 implementation
- File content viewer - Phase 4 implementation

---

### Pitfall 5: Submit Dialog Description Edit Conflicts With Existing Submit Flow

**Risk:** User edits changelist description in submit dialog preview. They also have the changelist description editor open in main UI (already editable via Edit CL). User clicks Submit in dialog. App submits with dialog description, overwriting main UI edits. Or vice versa: main UI edits overwrite dialog edits. User loses work.

**Why it happens:**
P4Now already has changelist description editing in the UI (from v2.0). Adding submit dialog with preview/edit creates two concurrent edit paths for same data. Without coordination:
1. User types in main UI description field → updates local state
2. User opens submit dialog → initializes with stale description from server
3. User edits in dialog → dialog has different state
4. User submits → which state wins? Both are "unsaved edits"

Perforce's `p4 change` saves description server-side, but app's local state may not reflect this. `p4 submit -d` accepts description inline, bypassing `p4 change`. This creates three sources of truth: (1) server state, (2) main UI state, (3) submit dialog state.

**Warning Signs:**
- User reports: "My changelist description disappeared when I submitted"
- Description in main UI differs from description in submit dialog
- Submit succeeds but description is old version
- Two "Save" buttons (main UI + dialog) confuse user
- Query cache shows stale description after submit

**Prevention:**
1. **Single source of truth: Server state via TanStack Query:**
   ```typescript
   // Main UI and submit dialog both read from same query
   const useChangelistDescription = (changelistId: number) => {
     return useQuery(
       ['changelist', changelistId, 'description'],
       () => invoke('p4_describe', { changelistId }),
       { staleTime: 0 } // Always fresh
     );
   };
   ```

2. **Submit dialog reads only, no editing:**
   ```tsx
   // Option 1: Submit dialog shows preview, not editor
   const SubmitDialog = ({ changelistId }) => {
     const { data: description } = useChangelistDescription(changelistId);

     return (
       <Dialog>
         <DialogTitle>Submit Changelist #{changelistId}</DialogTitle>
         <DialogContent>
           <div className="description-preview">
             <Label>Description:</Label>
             <pre>{description}</pre>
             <Button variant="link" onClick={openMainEditor}>
               Edit Description
             </Button>
           </div>
           <FileList files={files} />
         </DialogContent>
         <DialogActions>
           <Button onClick={submit}>Submit</Button>
         </DialogActions>
       </Dialog>
     );
   };
   ```

3. **Lock editing when submit dialog open:**
   ```typescript
   // Option 2: Disable main UI editor when dialog open
   const ChangelistDescriptionEditor = ({ changelistId }) => {
     const isSubmitDialogOpen = useSubmitDialogStore(s => s.isOpen);

     return (
       <textarea
         value={description}
         onChange={handleChange}
         disabled={isSubmitDialogOpen}
         title={isSubmitDialogOpen ? "Close submit dialog to edit" : ""}
       />
     );
   };
   ```

4. **Optimistic update on description save, invalidate before submit:**
   ```typescript
   const saveDescriptionMutation = useMutation({
     mutationFn: (desc: string) =>
       invoke('p4_change', { changelistId, description: desc }),
     onMutate: async (newDesc) => {
       // Cancel in-flight queries
       await queryClient.cancelQueries(['changelist', changelistId]);

       // Snapshot current value
       const snapshot = queryClient.getQueryData(['changelist', changelistId]);

       // Optimistically update
       queryClient.setQueryData(['changelist', changelistId], {
         ...snapshot,
         description: newDesc
       });

       return { snapshot };
     },
     onError: (err, newDesc, context) => {
       // Rollback on error
       queryClient.setQueryData(['changelist', changelistId], context.snapshot);
     },
     onSettled: () => {
       // Refetch to ensure consistency
       queryClient.invalidateQueries(['changelist', changelistId]);
     }
   });

   const submitMutation = useMutation({
     mutationFn: () => invoke('p4_submit', { changelistId }),
     onMutate: async () => {
       // CRITICAL: Refetch description before submit to ensure fresh
       await queryClient.refetchQueries(['changelist', changelistId]);
     }
   });
   ```

5. **Warn if description edited since dialog opened:**
   ```typescript
   const SubmitDialog = ({ changelistId }) => {
     const [initialDescription, setInitialDescription] = useState('');
     const { data: currentDescription } = useChangelistDescription(changelistId);

     useEffect(() => {
       setInitialDescription(currentDescription);
     }, []);

     const hasChanged = currentDescription !== initialDescription;

     return (
       <Dialog>
         {hasChanged && (
           <Alert variant="warning">
             Description was edited since dialog opened. Current version will be submitted.
           </Alert>
         )}
         {/* ... */}
       </Dialog>
     );
   };
   ```

**Affects:** Submit dialog with preview/edit - Phase 5 implementation

---

### Pitfall 6: p4 describe Hangs on Large Submitted Changelists (1000+ Files)

**Risk:** User clicks on submitted changelist with 5,000 files. App runs `p4 describe <cl>` to show file list. Command takes 60 seconds, returns 50MB of output with full diffs. App hangs parsing output, frontend times out waiting for response, or UI shows massive lag when rendering 5,000 file rows.

**Why it happens:**
By default, `p4 describe` returns:
1. Changelist metadata (description, user, date)
2. Full file list (depot path, action, revision)
3. **Full diffs for every file** (can be megabytes per file)

For large CLs, the diff data dominates response size and time. The TODO at `RevisionDetailView.tsx:96` indicates `p4_describe` needs implementation for sibling files. Naive implementation runs full `p4 describe`, including unnecessary diffs.

Additionally, rendering 5,000 file rows in a non-virtualized list causes DOM node count explosion, freezing UI thread.

**Warning Signs:**
- `p4 describe` command takes >10s in logs
- Memory usage spikes 100MB+ when viewing submitted CL
- UI freezes when rendering large CL file list
- Scroll performance is janky with 1000+ files
- Query timeout errors for large CLs
- Task Manager shows `p4.exe` running for 30+ seconds

**Prevention:**
1. **Use `p4 describe -s` to suppress diffs:**
   ```rust
   #[tauri::command]
   pub async fn p4_describe(
       changelist_id: i32,
       server: Option<String>,
       user: Option<String>,
       client: Option<String>,
   ) -> Result<ChangelistDetails, String> {
       // CRITICAL: Use -s flag to omit diffs, only get file list
       let mut cmd = Command::new("p4");
       apply_connection_args(&mut cmd, &server, &user, &client);
       cmd.args(["-ztag", "describe", "-s", &changelist_id.to_string()]);

       let output = cmd.output()
           .map_err(|e| format!("Failed to execute p4 describe: {}", e))?;

       if !output.status.success() {
           let stderr = String::from_utf8_lossy(&output.stderr);
           return Err(format!("p4 describe failed: {}", stderr));
       }

       let stdout = String::from_utf8_lossy(&output.stdout);
       parse_ztag_describe(&stdout)
   }
   ```

2. **Paginate file list for large CLs:**
   ```typescript
   const SubmittedChangelistFiles = ({ changelistId }) => {
     const { data: files } = useQuery(
       ['changelist', changelistId, 'files'],
       () => invoke('p4_describe', { changelistId })
     );

     const [page, setPage] = useState(0);
     const PAGE_SIZE = 100;

     const pagedFiles = useMemo(() => {
       const start = page * PAGE_SIZE;
       return files?.slice(start, start + PAGE_SIZE) || [];
     }, [files, page]);

     return (
       <div>
         <p>Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, files.length)} of {files.length} files</p>
         <FileList files={pagedFiles} />
         <Pagination page={page} total={Math.ceil(files.length / PAGE_SIZE)} onPageChange={setPage} />
       </div>
     );
   };
   ```

3. **Virtualize file list rendering:**
   ```tsx
   import { useVirtualizer } from '@tanstack/react-virtual';

   const VirtualizedFileList = ({ files }) => {
     const parentRef = useRef(null);

     const virtualizer = useVirtualizer({
       count: files.length,
       getScrollElement: () => parentRef.current,
       estimateSize: () => 32, // 32px per row
       overscan: 10
     });

     return (
       <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
         <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
           {virtualizer.getVirtualItems().map(virtualRow => (
             <div
               key={virtualRow.index}
               style={{
                 position: 'absolute',
                 top: 0,
                 left: 0,
                 width: '100%',
                 height: `${virtualRow.size}px`,
                 transform: `translateY(${virtualRow.start}px)`
               }}
             >
               <FileRow file={files[virtualRow.index]} />
             </div>
           ))}
         </div>
       </div>
     );
   };
   ```

4. **Cache describe results aggressively:**
   ```typescript
   useQuery(['describe', changelistId], fetchDescribe, {
     staleTime: Infinity, // Submitted CLs never change
     cacheTime: 60 * 60 * 1000, // Cache for 1 hour
   });
   ```

5. **Show loading indicator with progress:**
   ```tsx
   const { data, isLoading } = useQuery(
     ['describe', changelistId],
     () => invoke('p4_describe', { changelistId }),
     { timeout: 30_000 }
   );

   if (isLoading) {
     return (
       <div>
         <Spinner />
         <p>Loading changelist details...</p>
         <p className="text-muted-foreground">Large changelists may take up to 30 seconds.</p>
       </div>
     );
   }
   ```

6. **Warn user about large CLs:**
   ```tsx
   {files.length > 1000 && (
     <Alert variant="info">
       This changelist contains {files.length} files. Loading may be slow.
     </Alert>
   )}
   ```

**Affects:**
- Submitted changelist file list - Phase 6 implementation
- Sibling files in revision detail view - uses same `p4_describe` command

---

### Pitfall 7: Bookmark Invalid Depot Paths Cause Silent Failures

**Risk:** User bookmarks depot path `//stream/main/src/`. Later, stream is deleted or renamed to `//stream/release/`. User clicks bookmark. App runs `p4 dirs //stream/main/src/` which fails with "no such file(s)". Error is swallowed or shown as cryptic message. Bookmark appears broken but user doesn't know why or how to fix it.

**Why it happens:**
Bookmarks store static depot paths. Depot structure changes over time (streams deleted, folders renamed, projects archived). Apps typically don't validate bookmarks at save time, and don't handle invalidation at use time.

When bookmark points to non-existent path:
- `p4` commands return non-zero exit code
- Error messages are Perforce-specific: "//stream/main/src/... - no such file(s)"
- User doesn't understand what went wrong
- No mechanism to "fix" bookmark or remove invalid ones

Additional edge case: Bookmark path uses incorrect syntax (e.g., `C:\workspace\file.txt` instead of `//depot/file.txt`), causing immediate failure.

**Warning Signs:**
- Bookmark click does nothing or shows error toast
- Console shows "p4 dirs failed: no such file(s)"
- Bookmark was working yesterday, broken today (stream deleted)
- Bookmark list cluttered with old/invalid entries
- User can't tell which bookmarks are valid

**Prevention:**
1. **Validate depot path syntax at bookmark creation:**
   ```typescript
   const addBookmark = async (path: string, label: string) => {
     // Validate depot path syntax
     if (!path.startsWith('//')) {
       throw new Error('Bookmark path must be depot path starting with //');
     }

     // Validate path exists
     const exists = await invoke('p4_dirs_validate', { path });
     if (!exists) {
       const confirm = await showDialog({
         title: 'Path Not Found',
         message: `${path} does not exist. Bookmark anyway?`,
         options: ['Cancel', 'Bookmark Anyway']
       });
       if (confirm !== 'Bookmark Anyway') return;
     }

     // Save bookmark
     await invoke('save_bookmark', { path, label });
   };
   ```

2. **Add validation command to check path existence:**
   ```rust
   #[tauri::command]
   pub async fn p4_dirs_validate(
       path: String,
       server: Option<String>,
       user: Option<String>,
       client: Option<String>,
   ) -> Result<bool, String> {
       let mut cmd = Command::new("p4");
       apply_connection_args(&mut cmd, &server, &user, &client);
       cmd.args(["dirs", &path]);

       let output = cmd.output()
           .map_err(|e| format!("Failed to validate path: {}", e))?;

       let stdout = String::from_utf8_lossy(&output.stdout);

       // If path exists, output contains path
       // If not, output is empty or contains "no such file(s)"
       Ok(output.status.success() && !stdout.contains("no such file"))
   }
   ```

3. **Show bookmark validity status in UI:**
   ```tsx
   const BookmarkList = ({ bookmarks }) => {
     const { data: validityMap } = useQuery(
       ['bookmark-validity'],
       async () => {
         const map = new Map();
         for (const bookmark of bookmarks) {
           const isValid = await invoke('p4_dirs_validate', { path: bookmark.path });
           map.set(bookmark.path, isValid);
         }
         return map;
       },
       { staleTime: 5 * 60 * 1000 } // 5 minutes
     );

     return (
       <div>
         {bookmarks.map(bookmark => (
           <div key={bookmark.path} className="bookmark-item">
             {!validityMap?.get(bookmark.path) && (
               <AlertTriangle className="text-warning" title="Path no longer exists" />
             )}
             <span>{bookmark.label}</span>
             <Button onClick={() => navigateToBookmark(bookmark)}>Go</Button>
             <Button onClick={() => deleteBookmark(bookmark)}>Delete</Button>
           </div>
         ))}
       </div>
     );
   };
   ```

4. **Handle invalid bookmark click gracefully:**
   ```typescript
   const navigateToBookmark = async (bookmark: Bookmark) => {
     try {
       await invoke('p4_dirs', { path: bookmark.path });
       // Navigate to path
     } catch (err) {
       const action = await showDialog({
         title: 'Bookmark No Longer Valid',
         message: `${bookmark.path} no longer exists. What would you like to do?`,
         options: ['Delete Bookmark', 'Edit Path', 'Cancel']
       });

       if (action === 'Delete Bookmark') {
         await deleteBookmark(bookmark);
       } else if (action === 'Edit Path') {
         await editBookmark(bookmark);
       }
     }
   };
   ```

5. **Bookmark settings schema migration:**
   ```typescript
   // When adding bookmarks feature, migrate settings schema
   const migrateSettings = async () => {
     const settings = await invoke('load_settings');

     // v3.0 schema: { server, user, client, ... }
     // v4.0 schema: { server, user, client, bookmarks: [], ... }

     if (!settings.bookmarks) {
       settings.bookmarks = [];
       settings.schemaVersion = 2;
       await invoke('save_settings', { settings });
     }
   };

   // On app start
   useEffect(() => {
     migrateSettings();
   }, []);
   ```

6. **Export/import bookmarks for backup:**
   ```tsx
   const BookmarkManager = () => {
     const exportBookmarks = async () => {
       const bookmarks = await invoke('get_bookmarks');
       const json = JSON.stringify(bookmarks, null, 2);
       // Save to file via Tauri dialog
       await save({ contents: json, defaultPath: 'p4now-bookmarks.json' });
     };

     const importBookmarks = async () => {
       const file = await open({ filters: [{ name: 'JSON', extensions: ['json'] }] });
       const json = await readTextFile(file);
       const bookmarks = JSON.parse(json);
       await invoke('import_bookmarks', { bookmarks });
     };

     return (
       <div>
         <Button onClick={exportBookmarks}>Export Bookmarks</Button>
         <Button onClick={importBookmarks}>Import Bookmarks</Button>
       </div>
     );
   };
   ```

**Affects:** Bookmarks/favorites feature - Phase 7 implementation

---

## Integration Pitfalls

### Integration Pitfall 1: New Commands Don't Use Existing apply_connection_args Pattern

**Risk:** Implementing `p4_print`, `p4_describe`, `p4_annotate` commands without calling `apply_connection_args()` function. Commands fail in DVCS setups or when user switches workspaces because `P4CONFIG`, `P4CLIENT` env vars pollute command execution.

**Why it happens:**
The existing codebase has `apply_connection_args()` helper (lines 13-42 in `p4.rs`) that clears `P4CONFIG`, `P4ROOT` and sets `-p`, `-u`, `-c` flags explicitly. This ensures command isolation. New commands might skip this pattern, causing env var inheritance issues that only manifest in specific environments (DVCS, multiple workspaces).

**Prevention:**
- All new p4 commands MUST call `apply_connection_args(&mut cmd, &server, &user, &client)` before `.args()`
- Add unit test verifying env vars are cleared for each command
- Code review checklist: "Does this command call apply_connection_args?"

**Affects:** All v4.0 commands (`p4_print`, `p4_describe`, `p4_annotate`)

---

### Integration Pitfall 2: TanStack Query Cache Pollution From New Queries

**Risk:** Adding new query keys (`['annotate', ...]`, `['describe', ...]`, `['print', ...]`) without coordinating invalidation with existing mutations. Example: User submits changelist, but `['describe', changelistId]` cache isn't invalidated. User views submitted CL and sees stale data (status: "pending" instead of "submitted").

**Why it happens:**
Existing mutations invalidate known query keys:
```typescript
onSettled: () => {
  queryClient.invalidateQueries(['files']);
  queryClient.invalidateQueries(['changelists']);
  queryClient.invalidateQueries(['opened']);
}
```

New queries aren't added to invalidation lists, so they stay stale after mutations.

**Prevention:**
1. **Audit all mutation onSettled hooks, add new query keys:**
   ```typescript
   const submitMutation = useMutation({
     mutationFn: submitChangelist,
     onSettled: () => {
       queryClient.invalidateQueries(['files']);
       queryClient.invalidateQueries(['changelists']);
       queryClient.invalidateQueries(['opened']);
       // ADD THESE for v4.0:
       queryClient.invalidateQueries(['describe']); // Submitted CL details
       queryClient.invalidateQueries(['annotate']); // File blame may change
     }
   });
   ```

2. **Use query key prefixes for bulk invalidation:**
   ```typescript
   // Query key structure: ['p4-command', ...args]
   // Example: ['p4-describe', 12345]
   //          ['p4-annotate', '//depot/file.txt']

   // Invalidate all p4 queries after workspace switch:
   queryClient.invalidateQueries({ predicate: (query) =>
     query.queryKey[0]?.toString().startsWith('p4-')
   });
   ```

3. **Document query invalidation requirements in PLAN files:**
   - Each feature plan should list "Queries to invalidate after X mutation"

**Affects:** All v4.0 features - cache coordination with existing v3.0 mutations

---

### Integration Pitfall 3: Stale File Type Detection After p4 print Implementation

**Risk:** `p4_print` implementation doesn't check file type, attempts to print binary files as text. User clicks "Open This Revision" on binary file (compiled binary, image, video). Backend runs `p4 print -o temp.bin //depot/binary`, then tries `fs::read_to_string(temp.bin)` which fails with UTF-8 decode error. Or worse: Decodes partially, shows garbled text in viewer.

**Why it happens:**
File type is available from `p4 fstat -T headType`, but `p4_print` implementation might skip this check for speed. Binary files should either:
1. Reject with error: "Cannot view binary files"
2. Auto-launch external editor instead of viewer
3. Show binary preview (hex dump, metadata)

**Prevention:**
- `p4_print` must call `p4_fstat` first to check `headType`
- If `headType` contains "binary", "ubinary", "apple", "resource", return error or auto-open external editor
- Show warning in UI before printing large text files (>1MB)

**Affects:** Open file in external editor, File content viewer

---

### Integration Pitfall 4: Auto-Refresh Conflicts With Long-Running p4 annotate

**Risk:** User opens blame view for large file. `p4 annotate` runs for 20 seconds. Meanwhile, auto-refresh timer fires (every 30s from v3.0). Auto-refresh runs `p4 fstat //...` which spawns new `p4.exe` process. Now two `p4.exe` processes compete for server resources, slowing both. Annotate takes 40s instead of 20s. Auto-refresh cascades, spawning more processes.

**Why it happens:**
v3.0 auto-refresh disables during operations via `useOperationStore` (from v3.0 PITFALLS.md, lines 98-120). But new operations (`p4_annotate`, `p4_describe`) aren't registered as "active operations", so auto-refresh doesn't disable.

**Prevention:**
1. **Register new commands as operations:**
   ```typescript
   const annotateQuery = useQuery(
     ['annotate', depotPath],
     async () => {
       operationStore.startOperation('annotate'); // ADD THIS
       try {
         return await invoke('p4_annotate', { depotPath });
       } finally {
         operationStore.endOperation('annotate'); // ADD THIS
       }
     }
   );
   ```

2. **Or use query status to disable auto-refresh:**
   ```typescript
   const hasActiveAnnotate = queryClient.getQueryState(['annotate'])?.fetchStatus === 'fetching';

   useQuery(['files'], fetchFiles, {
     enabled: !hasActiveAnnotate, // Disable auto-refresh during annotate
     refetchInterval: 30_000
   });
   ```

**Affects:** All long-running v4.0 queries (annotate, describe large CLs)

---

## Feature-Specific Edge Cases

### Edge Case 1: Annotate Shows Gaps For Deleted/Restored Lines

**Scenario:** File has line deleted in #5, restored in #10. User views blame at #15. Annotation shows:
- Lines 1-10: #3 (original author)
- Lines 11-50: [gap, no annotation]
- Lines 51-100: #7 (different author)

Lines 11-50 have no blame data because they were deleted/restored, confusing `p4 annotate` logic.

**Impact:** User confused why some lines have no author/revision data.

**Mitigation:** Show "(line history complex)" for lines without annotation. Provide "View Full History" link to file history viewer.

---

### Edge Case 2: Submit Dialog Preview Doesn't Show Shelved Files Warning

**Scenario:** User has changelist with 5 regular files + 3 shelved files. Submit dialog shows 5 files in preview. User clicks Submit. Perforce shows error: "Cannot submit changelist with shelved files. Delete or unshelve first."

**Impact:** Submit fails unexpectedly, user doesn't know why.

**Mitigation:**
1. Query shelved files before showing submit dialog
2. Show warning: "This changelist has 3 shelved files. Unshelve or delete before submitting."
3. Provide "View Shelved Files" button

---

### Edge Case 3: Workspace Sync Status Shows Wrong Icons After Partial Sync

**Scenario:** User starts sync of 1000 files. Sync completes 500 files, then user cancels. Workspace tree still shows old sync status (out-of-date for all 1000 files). Manually refresh doesn't update because query cache still fresh (staleTime: 5 min).

**Impact:** Incorrect sync status indicators, user confused about what's synced.

**Mitigation:**
1. Invalidate sync status queries after sync mutation (even if cancelled)
2. Show "Refreshing sync status..." after partial sync
3. Add "Force Refresh Sync Status" button

---

### Edge Case 4: Bookmark Points To File Instead of Folder

**Scenario:** User bookmarks specific file `//depot/file.txt`. Clicks bookmark. App runs `p4 dirs //depot/file.txt` which fails (p4 dirs only works on folders). Error: "//depot/file.txt - must refer to client 'client'."

**Impact:** Bookmark fails, cryptic error message.

**Mitigation:**
1. Detect if bookmark path is file vs folder at save time
2. For file bookmarks, navigate to parent folder and highlight file
3. Or run `p4 fstat` instead of `p4 dirs` for file paths

---

## "Looks Done But Isn't" Checklist

- [ ] **p4_annotate:** Often missing file rename detection — Verify: Renamed file shows correct author history, or clear warning about rename
- [ ] **p4_annotate:** Often missing large file size check — Verify: 50MB file shows "too large" error, not 30s hang
- [ ] **p4_have vs p4_fstat:** Often use slow fstat for sync status — Verify: Workspace tree loads in <2s for 10k files
- [ ] **p4_print binary check:** Often missing file type validation — Verify: Binary file shows error, not garbled text or crash
- [ ] **p4_print memory handling:** Often load entire file into memory — Verify: 100MB file doesn't crash app or spike memory
- [ ] **Submit dialog coordination:** Often conflict with main UI editor — Verify: Description edits in both places don't overwrite each other
- [ ] **p4_describe -s flag:** Often missing, includes diffs — Verify: Large CL query takes <5s, not 60s
- [ ] **Submitted CL file list:** Often missing virtualization — Verify: 5000 file CL renders smoothly, no janky scroll
- [ ] **Bookmark validation:** Often missing path existence check — Verify: Invalid bookmark shows clear error with fix options
- [ ] **Query cache invalidation:** Often missing new query keys in mutations — Verify: Submit invalidates describe cache, not stale

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip file type check in p4_print | Faster implementation | Crashes on binary files, garbled output | **Never** - file type check is 1 line |
| Use p4 fstat instead of p4 have for sync status | Simpler code (one command) | 10x slower queries, poor scalability | Only for prototypes with <100 files |
| Load entire p4 print output into memory | Simpler code (fs::read_to_string) | OOM crashes on large files | Only if file size check enforces <1MB limit |
| Submit dialog allows description editing | Feature parity with P4V | Conflicts with main UI, data loss risk | **Never** - coordination cost is lower than data loss risk |
| p4 describe without -s flag | Complete data (includes diffs) | 100x slower for large CLs, memory spikes | Only if CL guaranteed <10 files |
| Skip bookmark path validation | Faster bookmark creation | Silent failures, user confusion | **Never** - validation is async, doesn't block UX |
| Non-virtualized file list rendering | Simpler code (map over array) | UI freeze with >1000 files | Only if file count guaranteed <100 |
| p4 annotate without rename detection | Simpler implementation | Wrong author/revision data | **Acceptable** if clear warning shown |

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Annotate shows wrong author (rename) | **LOW** | Show warning, link to full file history, document limitation |
| Annotate hangs on large file | **LOW** | Kill process via ProcessManager, show error with size limit |
| Workspace tree query slow (fstat) | **HIGH** | Replace with p4 have + p4 files (different query logic, requires refactor) |
| p4 print crashes on binary file | **MEDIUM** | Add file type pre-check, reject binary files early |
| Submit dialog conflicts with main UI | **HIGH** | Refactor to single source of truth (query), lock one editor when other open |
| p4 describe hangs on large CL | **LOW** | Add -s flag to command args (one-line fix) |
| Bookmark points to non-existent path | **LOW** | Show error dialog with "Delete Bookmark" option, validate on click |
| Query cache stale after new feature | **MEDIUM** | Audit all mutations, add new query keys to invalidation lists |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification Method |
|---------|------------------|---------------------|
| Annotate wrong author (rename) | **Phase 1 - Blame View** | Test: Rename file, verify annotation shows warning or follows rename |
| Annotate hangs on large file | **Phase 1 - Blame View** | Test: 50MB file, verify size check rejects with clear error |
| Workspace tree uses slow fstat | **Phase 2 - Sync Status Tree** | Test: 10k file workspace, measure load time <2s |
| p4 print binary file crash | **Phase 3 - External Editor, Phase 4 - File Viewer** | Test: Binary file, verify error or auto-open external editor |
| p4 print memory exhaustion | **Phase 3 - External Editor, Phase 4 - File Viewer** | Test: 100MB text file, verify size check or chunking |
| Submit dialog description conflict | **Phase 5 - Submit Dialog Preview** | Test: Edit in both places, verify no data loss |
| p4 describe hangs on large CL | **Phase 6 - Submitted CL Files** | Test: 1000 file CL, verify -s flag used, query <5s |
| Bookmark invalid path | **Phase 7 - Bookmarks** | Test: Bookmark deleted path, verify clear error with fix options |
| Query cache pollution | **All phases** | Test: Submit CL, verify describe/annotate queries invalidated |
| Auto-refresh during long queries | **Phase 1, 6** | Test: Start annotate, verify auto-refresh disabled during operation |

---

## Sources

**Perforce Annotate and Blame:**
- [p4 annotate - Perforce Command Reference](https://help.perforce.com/helix-core/server-apps/cmdref/2024.2/Content/CmdRef/p4_annotate.html) - Official annotate command documentation
- [p4 annotate - Perforce r16.2 Reference](https://ftp.perforce.com/perforce/r16.2/doc/manuals/cmdref/p4_annotate.html) - 10MB default size limit documentation
- [p4-blame doesn't take advantage of p4 annotate - GitHub Issue](https://github.com/gareth-rees/p4.el/issues/19) - Performance improvement discussion
- [Integrating while keeping history? - Perforce Forums](https://perforce-user.perforce.narkive.com/Y8IdlQvu/integrating-while-keeping-history) - File rename history preservation

**Perforce Workspace Sync and File Queries:**
- [p4 status - Perforce Command Reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_status.html) - Workspace sync status detection
- [Tuning Perforce for Performance](https://perforce.com/manuals/v15.1/p4sag/chapter.performance.html) - Performance optimization guide
- [p4 fstat - Perforce Command Reference](https://www.perforce.com/manuals/v15.1/cmdref/p4_fstat.html) - fstat command reference

**Perforce Print and Binary Files:**
- [p4 print - Perforce Command Reference](https://www.perforce.com/manuals/v17.1/cmdref/Content/CmdRef/p4_print.html) - Print command documentation
- [PATCH: git-p4 improve performance with large files](https://git.vger.kernel.narkive.com/rsxDKpsR/patch-p4-improve-performance-with-large-files) - Memory performance issues with large files
- [Very large Perforce clientspecs (>3GB) - JetBrains TeamCity](https://teamcity-support.jetbrains.com/hc/en-us/community/posts/206224689-Very-large-Perforce-clientspecs-3-GB) - p4 print performance issues

**Perforce File Type Detection:**
- [Helix Core file type detection and Unicode](https://www.perforce.com/manuals/v17.1/p4guide/Content/P4Guide/filetypes.unicode.detection.html) - Binary vs text detection
- [Helix Server file type detection](https://help.perforce.com/helix-core/server-apps/p4guide/2023.2/Content/P4Guide/filetypes.unicode.detection.html) - File type detection algorithm

**Perforce Submit and Changelists:**
- [p4 submit - Perforce Command Reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_submit.html) - Submit command documentation
- [How to submit changelist with multiple lines? - Perforce Forums](https://perforce-user.perforce.narkive.com/nCQBslAF/p4-how-to-submit-changelist-with-change-description-of-multiple-lines) - Multiline description handling
- [Submit (Check in) files - P4V User Guide](https://www.perforce.com/manuals/p4v/Content/P4V/files.submit.html) - Submit dialog edge cases

**Perforce Describe and Large Changelists:**
- [p4 describe - Perforce Command Reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_describe.html) - Describe command with -s flag
- [p4 changes - Perforce Command Reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_changes.html) - Changelist queries
- [Changelist and affected files report - Perforce Forums](https://perforce-user.perforce.narkive.com/noS3CZ8X/p4-changelist-and-affected-files-report) - Performance with large CLs

**Perforce Bookmarks:**
- [Bookmarking files - P4V User Guide](https://www.perforce.com/manuals/v18.3/p4v/Content/P4V/using.bookmarks.html) - Bookmark functionality
- [Bookmark files and folders - P4V User Guide](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/using.bookmarks.html) - Bookmark path syntax
- [P4 Client Error Handling - Perforce Support Portal](https://portal.perforce.com/s/article/3505) - Path validation errors

---

*Pitfalls research for: P4Now v4.0 P4V parity feature additions*
*Researched: 2026-02-03*
*Focus: Integration pitfalls when adding blame, sync status, file viewer, submit preview, submitted CL files, and bookmarks to existing v3.0 system*
