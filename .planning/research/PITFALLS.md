# Pitfalls Research

**Domain:** Desktop GUI Wrapper for CLI Tools (Perforce p4.exe)
**Researched:** 2026-01-27
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Blocking UI Thread During CLI Operations

**What goes wrong:**
The main UI thread blocks while waiting for CLI process responses, causing the entire application to freeze during network operations. This is the exact problem P4V users experience - modal dialogs that can't be dismissed during network issues, making the app completely unresponsive.

**Why it happens:**
Developers use synchronous process spawning (e.g., `execSync()` in Node.js) or fail to properly separate CLI execution from UI rendering. Without explicit async patterns, child process operations block the main thread until completion.

**How to avoid:**
- Always use asynchronous process spawning (`spawn()` or `exec()` with callbacks/promises, never `execSync()`)
- Execute ALL CLI operations on background threads/processes
- Use Node.js child_process with async/await or Rust async for Tauri
- Implement proper IPC between UI and CLI execution layer
- Never wait for CLI responses on the main/renderer thread

**Warning signs:**
- UI becomes unresponsive during any p4 operation
- User can't interact with other parts of the app while one operation runs
- Spinner/loading indicators freeze instead of animating
- App appears "hung" during network delays
- DevTools shows main thread blocking for >16ms

**Phase to address:**
Phase 1 (Core Architecture) - Must establish async-first architecture from the beginning. Retrofitting async patterns later requires complete rewrites.

---

### Pitfall 2: No Cancellation Mechanism for Long-Running Operations

**What goes wrong:**
Users can start operations but have no way to cancel them if they take too long, provide wrong input, or network conditions deteriorate. Operations run to completion or timeout even when the user wants to abort. This is a critical P4V pain point - operations get stuck with no cancel option.

**Why it happens:**
Child processes are spawned but developers don't maintain references to the process handles, or don't implement cancellation signals. UX doesn't expose cancel buttons, or buttons are non-functional because backend doesn't support cancellation.

**How to avoid:**
- Store process handles/PIDs when spawning CLI commands
- Implement kill/abort functionality using `process.kill()` (Node.js) or equivalent
- Add visible "Cancel" button to ALL long-running operation UIs
- Use AbortController pattern for promise-based operations
- Implement timeout thresholds with automatic cancellation options
- Send SIGTERM first, escalate to SIGKILL if process doesn't respond within grace period
- Track operation state so UI knows what can be cancelled

**Warning signs:**
- No "Cancel" buttons on progress dialogs
- Cancel buttons exist but don't work
- Only way to stop operation is killing the entire app
- Process remains running after user attempts cancellation
- User complaints about "stuck" operations

**Phase to address:**
Phase 1 (Core Architecture) - Cancellation must be designed into the process management layer from day one. Also Phase 2 (Basic Operations) to ensure all UI operations expose cancellation.

---

### Pitfall 3: Zombie and Orphaned Child Processes

**What goes wrong:**
Spawned p4.exe processes persist after the parent application closes, or processes enter zombie state consuming system resources. Task Manager shows multiple p4.exe instances that can't be killed. On application crash, child processes continue running indefinitely.

**Why it happens:**
No cleanup handlers for application exit, missing `wait()` calls to reap terminated children, or failure to track and kill child processes on shutdown. Electron/Tauri processes can remain alive after main app closes if not explicitly managed.

**How to avoid:**
- Register process cleanup handlers on application exit (`beforeunload`, `window.on('close')`)
- Track all spawned child process PIDs in a registry/set
- Implement cleanup function that kills all tracked processes
- Use `wait()` or `waitpid()` to properly reap terminated child processes
- For Electron: Use `app.on('before-quit')` and `app.on('window-all-closed')` hooks
- For Tauri: Use `Command::new_sidecar` which auto-cleans on exit (but verify it works)
- Consider process pools instead of ad-hoc spawning
- Use `detached: false` in Node.js spawn options to ensure children die with parent
- Send SIGTERM to all children before exit, wait briefly, then SIGKILL stragglers

**Warning signs:**
- Task Manager shows multiple p4.exe processes after app closes
- System resource usage increases over time
- Processes in zombie state (defunct) appear in process list
- Need to manually kill processes via Task Manager
- Background p4.exe processes after crash

**Phase to address:**
Phase 1 (Core Architecture) - Process lifecycle management must be implemented from the start, with proper cleanup hooks.

---

### Pitfall 4: Poor Error Handling - Missing stdout/stderr Separation

**What goes wrong:**
Application treats all stderr output as fatal errors, or worse, ignores stderr entirely. Users see generic "Command failed" messages without actual error details. Perforce writes diagnostics to stderr but command succeeds, causing false error states. Conversely, silent failures occur when real errors on stderr are ignored.

**Why it happens:**
Developers assume stderr = error and stdout = success, but CLI tools (including p4) write warnings, progress updates, and diagnostics to stderr even for successful operations. Starting in .NET 10, many CLI tools moved non-core output to stderr for cleaner parsing, breaking assumptions.

**How to avoid:**
- Capture both stdout AND stderr separately
- Check process exit code as the primary success indicator (exit code 0 = success)
- Parse stderr for actual error patterns specific to p4 (e.g., "error:", "Perforce client error:")
- Display stderr warnings non-intrusively (bottom status bar, expandable details)
- Only treat stderr as error when exit code != 0
- Log full stdout/stderr to debug log for troubleshooting
- Create p4-specific error parser that understands Perforce error formats

**Warning signs:**
- App shows errors when commands succeed
- No error details shown when commands actually fail
- User confusion about what went wrong
- "Command failed" without explanation
- Success for operations that actually failed silently

**Phase to address:**
Phase 2 (Basic Operations) - Implement during initial p4 command execution, as this affects every operation.

---

### Pitfall 5: Memory Leaks from Event Listener Accumulation

**What goes wrong:**
Application memory usage grows continuously over time, eventually consuming gigabytes and slowing down or crashing. Each operation adds event listeners for process events but never removes them, even after processes complete.

**Why it happens:**
In Electron/Tauri apps, developers attach event listeners to child processes, IPC channels, or UI components but forget to clean them up. BrowserWindow instances aren't destroyed when closed. Each p4 operation registers 'stdout', 'stderr', 'exit', 'error' listeners that persist after completion.

**How to avoid:**
- Always remove event listeners when done using `removeListener()` or `removeAllListeners()`
- Destroy BrowserWindow instances explicitly with `window.destroy()`
- Implement component unmount/cleanup lifecycle hooks
- Use `once()` instead of `on()` for one-time events
- Clear intervals/timeouts with `clearInterval()`, `clearTimeout()`
- Close file handles, network connections, database connections
- For child processes: Remove all listeners after 'exit' event
- Monitor memory usage in development using Chrome DevTools heap snapshots
- Track RSS (Resident Set Size) not just JavaScript heap (native memory matters in Electron)

**Warning signs:**
- Application memory usage grows steadily over hours
- Memory doesn't decrease after closing windows/operations
- Chrome DevTools shows accumulating event listeners
- Heap snapshots show retained objects
- Application becomes sluggish after extended use
- Memory usage >500MB for simple GUI app

**Phase to address:**
Phase 1 (Core Architecture) - Establish memory management patterns early. Phase 3 (Continuous Operations) - Critical when implementing long-running apps with repeated operations.

---

### Pitfall 6: Inadequate Progress Feedback and Timeouts

**What goes wrong:**
Long-running operations (large syncs, submits) show no progress indication, making users think the app is frozen. Operations time out prematurely on slow networks, or worse, run indefinitely with no timeout. Users can't distinguish between "operation in progress" and "application hung."

**Why it happens:**
Developers don't implement progress streaming from CLI output, don't set appropriate timeouts, or use global timeout values that don't account for operation variability. Progress information exists in p4 output but isn't parsed and displayed.

**How to avoid:**
- Display progress indicators for all operations >1 second
- Show percent-done indicators for operations >10 seconds (Jakob Nielsen's guideline)
- Parse p4 output for progress information (file counts, transfer rates)
- Implement operation-specific timeouts (sync: 30min, status: 30sec, submit: 10min)
- Use `net.maxwait` parameter per p4 command: `p4 -vnet.maxwait=60 sync`
- Combine with `-rN` retry option for automatic reconnection
- Show animated spinners so users know app is responsive
- Display current action ("Syncing file 342 of 1250...")
- Provide time estimates when possible
- After timeout, offer "Retry" and "Cancel" options, not just failure

**Warning signs:**
- Users report "app seems frozen"
- No visual feedback during operations
- All operations use same timeout regardless of expected duration
- Operations fail on slow networks but succeed on fast networks
- No way to tell if operation is progressing or stuck

**Phase to address:**
Phase 2 (Basic Operations) - Implement basic progress for all operations. Phase 3 (Continuous Operations) - Refine with accurate progress parsing and time estimates.

---

### Pitfall 7: Ignoring Platform-Specific Process Behavior

**What goes wrong:**
Application works perfectly on developer's Windows machine but fails on other configurations. Process spawning behaves differently on Windows vs Linux/Mac. Path separators, environment variables, or shell interpretation causes subtle bugs.

**Why it happens:**
Developers test only on one platform. Windows uses backslashes (`\`) and different shell syntax than Unix. Environment variable syntax differs (`%VAR%` vs `$VAR`). Process spawning on Windows doesn't use shell by default in Node.js.

**How to avoid:**
- Use `path.join()` and `path.resolve()` for all filesystem paths (handles separators)
- For p4.exe specifically: Always provide full absolute path to executable
- Set `shell: true` in Node.js spawn options if using shell features, or avoid shell features entirely
- Normalize path separators when passing paths to p4 commands
- Test on Windows, Mac, and Linux (or at minimum target platform + one other)
- Use environment variable libraries that abstract platform differences
- Be explicit about working directory for spawned processes
- Handle case sensitivity differences in file paths

**Warning signs:**
- Works on dev machine but not CI or other users' machines
- Path-related errors on different OS
- "Command not found" despite executable existing
- Different behavior with same commands on different platforms

**Phase to address:**
Phase 1 (Core Architecture) - Platform abstraction must be designed in from the start, before accumulating platform-specific code.

---

### Pitfall 8: State Synchronization Without Optimistic Updates or Rollback

**What goes wrong:**
User makes changes in the GUI, but UI doesn't update until server confirms, creating laggy feel. Or worse, UI updates optimistically but has no rollback mechanism when operation fails, leaving UI state inconsistent with actual server state.

**Why it happens:**
Developers either wait for CLI operation completion before updating UI (pessimistic), or update UI immediately without handling failures (naive optimistic). No mechanism to reconcile UI state when background operation fails.

**How to avoid:**
- Implement optimistic updates: Update UI immediately on user action
- Show operation as "pending" with visual indicator (opacity, icon)
- If operation succeeds: Commit UI state
- If operation fails: Roll back UI to previous state AND show error
- Take snapshot of state before optimistic update for rollback
- Use state management libraries with built-in optimistic mutation support (TanStack Query, Zustand)
- Consider two-phase display: Instant local update + eventual server confirmation
- For critical operations (submit), consider pessimistic updates with good progress feedback
- Queue operations and handle retry/rollback for each

**Warning signs:**
- UI feels sluggish/laggy compared to modern web apps
- UI shows changes that never actually happened
- Inconsistent state after network failures
- No visual distinction between "pending" and "confirmed" changes
- User confusion about whether action succeeded

**Phase to address:**
Phase 2 (Basic Operations) - Implement state management pattern from first interactive features. Phase 4 (Advanced Features) - Refine with queue management and conflict resolution.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `execSync()` for "quick" operations | Simple synchronous code, easier to reason about | Blocks UI thread, creates perception of sluggishness, prevents scaling to async | Never - even 50ms blocks create janky UX |
| Global timeout for all p4 commands | Easy to configure, one setting | Small operations timeout on slow networks, large operations timeout prematurely | Never - operations have vastly different durations |
| Ignoring process cleanup on crash | Reduces code complexity | Zombie processes accumulate, system resources leak | Never - proper cleanup is essential |
| Parsing stderr as plain text instead of structured errors | Quick to implement | Can't distinguish error types, poor error messages, breaks with CLI updates | Only for MVP prototype, must refactor before beta |
| Spawning new process per command | Simplest architecture | Process creation overhead, potential resource exhaustion | Acceptable for infrequent operations (<1/minute), use process pooling for frequent ops |
| Bundling p4.exe with app | Ensures version consistency | Large bundle size, can't use system p4, version update requires app update | Acceptable as fallback option if system p4 not found |
| Not implementing operation queueing | Simpler concurrent execution | Race conditions, overwhelming server, conflicting operations | Only for single-user, single-workspace scenarios |
| Using Electron instead of Tauri | Faster development, more examples | 200MB bundle size vs 10MB, higher memory usage | Acceptable if team knows JS better than Rust, or needs Node.js ecosystem |

## Integration Gotchas

Common mistakes when connecting to Perforce CLI.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| p4 client configuration | Assuming P4CLIENT environment variable is set | Check for P4CLIENT, fall back to -c flag, allow user to select client |
| File sync operations | Not using -f flag when files should be overwritten | Detect when sync fails due to writable files, offer -f option |
| Multi-factor authentication | Assuming `p4 login` works | Detect MFA, use `p4 login2` or redirect to P4V for auth |
| Large file operations | Treating all operations equally | Implement streaming for large files, chunked progress updates |
| Changelist operations | Not handling pending changelists | Query and display pending changelists, don't assume clean state |
| Connection failures | Showing generic "connection failed" | Parse p4 connection errors, suggest fixes (firewall, VPN, server down) |
| Workspace path mapping | Hardcoding path separators | Use p4 where command to map depot paths to local paths |
| Edit detection | Assuming files are read-only until checked out | Check file attributes, handle manual edits outside p4 |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Spawning new p4 process per file status check | Works fine for 10 files | Use batch operations: `p4 fstat file1 file2 file3...` | >50 files, or >5 ops/second |
| Loading entire file list into memory | Fast for small repos | Use streaming/pagination, virtual scrolling in UI | >10,000 files in workspace |
| No request debouncing/throttling | Responsive to every user action | Debounce rapid user actions, throttle API calls | User rapidly clicks through files |
| Synchronous file tree scanning | Simple recursive directory read | Use async iterators, background workers | >1,000 directories |
| Not caching p4 info/client info | Always fresh data | Cache with TTL (5 minutes), invalidate on known changes | Called >10 times/minute |
| Rendering all operations in one list | Simple UI component | Virtual scrolling, pagination, or infinite scroll | >500 history items |
| Full workspace refresh after every operation | Ensures consistency | Incremental updates, only refresh affected paths | Workspace with >5,000 files |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing p4 credentials in logs | Credentials leaked in debug logs or crash reports | Sanitize all logs, never log P4PASSWD or login tokens |
| Storing p4 password in plain text | Password theft from config files | Use OS credential storage (keytar for Electron), or rely on p4 tickets |
| Not validating p4 command injection | Malicious workspace names or file paths inject commands | Sanitize all user input before passing to p4, use parameterized commands |
| Running p4 with elevated privileges | Unnecessarily broad permissions | Run p4 commands with minimum necessary permissions |
| Not verifying SSL certificates | Man-in-the-middle attacks on p4 SSL connections | Enable SSL verification, don't allow self-signed certs in production |
| Leaking workspace paths | Privacy issue, reveals system username/structure | Sanitize paths in error messages, allow user to hide full paths |
| Executing arbitrary commands via shell | Remote code execution if input not sanitized | Use spawn with array arguments, never string concatenation |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Modal dialogs that can't be dismissed | User stuck waiting, can't cancel or do other work | Non-modal panels, background operations with notification on completion |
| No indication of what's blocking | User doesn't know why app is unresponsive | Always show current operation: "Syncing 342/1250 files..." |
| Requiring user to check output log for errors | Cognitive load, error messages buried | Parse errors, show user-friendly summary with "Details" expando |
| No way to recover from errors | User must restart app or manually fix | Offer "Retry", "Skip", "Cancel" options on all errors |
| Hiding network status | User doesn't know if slow network or hung operation | Show network activity indicator, ping time, or connection status |
| File operations without preview | User doesn't know what will be affected | Show list of affected files before destructive operations |
| No undo for destructive operations | Accidental deletes/reverts can't be recovered | Implement operation history with undo/redo, or confirmation dialogs |
| Overusing confirmation dialogs | Dialog fatigue, users click "OK" without reading | Only confirm destructive operations, remember "Don't ask again" preferences |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Process spawning:** Often missing cleanup on abnormal exit — verify exit handlers actually kill child processes
- [ ] **Error handling:** Often missing stderr parsing — verify errors show actionable messages, not just "Command failed"
- [ ] **Cancellation:** Often missing SIGKILL fallback — verify SIGTERM + grace period + SIGKILL escalation
- [ ] **Progress indicators:** Often missing actual progress parsing — verify percentage is based on real data, not just spinner
- [ ] **Memory management:** Often missing event listener cleanup — verify all listeners removed after operation completion
- [ ] **Timeout handling:** Often missing retry mechanism — verify timeout leads to user choice (retry/cancel), not just failure
- [ ] **State synchronization:** Often missing rollback on failure — verify failed optimistic updates revert UI to previous state
- [ ] **Multi-platform support:** Often missing Windows path handling — verify works with both forward slashes and backslashes
- [ ] **Authentication:** Often missing MFA support — verify `p4 login2` is used when MFA detected
- [ ] **Large operations:** Often missing streaming/chunking — verify memory doesn't grow linearly with operation size

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Blocking UI thread | HIGH | Requires architectural refactor to async execution model; expect 2-4 weeks for complete retrofit |
| No cancellation mechanism | MEDIUM | Add process tracking registry and kill functionality; refactor UI to expose cancel buttons; 1-2 weeks |
| Zombie processes | LOW | Add exit handlers and cleanup functions; test thoroughly; 2-3 days |
| Poor error handling | LOW-MEDIUM | Implement error parser and improve error display; can be done incrementally; 3-5 days |
| Memory leaks | MEDIUM | Profile with DevTools, identify leaks, add cleanup; iterative process; 1-2 weeks |
| No progress feedback | LOW | Parse CLI output for progress, add UI indicators; 3-5 days per operation type |
| Platform-specific bugs | MEDIUM | Abstract platform differences, add cross-platform testing; 1-2 weeks |
| State synchronization issues | MEDIUM-HIGH | Implement state management library with optimistic updates; 1-3 weeks depending on scope |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Blocking UI thread | Phase 1 (Core Architecture) | Spawn p4 command, verify UI remains responsive during execution |
| No cancellation mechanism | Phase 1 (Core Architecture) + Phase 2 (Basic Operations) | Start long operation, click cancel, verify process terminates immediately |
| Zombie processes | Phase 1 (Core Architecture) | Close app during operation, check Task Manager for orphaned p4.exe |
| Poor error handling | Phase 2 (Basic Operations) | Force various p4 errors, verify all show clear messages |
| Memory leaks | Phase 1 (Core Architecture) + Phase 3 (Continuous Operations) | Run 1000 operations, verify memory returns to baseline |
| No progress feedback | Phase 2 (Basic Operations) + Phase 3 (Continuous Operations) | Start large sync, verify continuous progress updates |
| Platform-specific bugs | Phase 1 (Core Architecture) | Run test suite on Windows, Mac, Linux (minimum Windows + one other) |
| State synchronization issues | Phase 2 (Basic Operations) + Phase 4 (Advanced Features) | Disconnect network mid-operation, verify UI handles gracefully |

## Sources

**GUI Wrapper Patterns:**
- [Command Line Interface Guidelines](https://clig.dev/)
- [Why not GUI wrapper for command line tools?](https://hashnode.com/post/why-not-gui-wrapper-for-command-line-tools-cjng0k9hg00abrts2bcd2j79b)
- [Desktop GUIs for Web Developers](https://www.fullstackstanley.com/articles/desktop-guis-for-webdevelopers/)

**Electron Best Practices:**
- [Simple Electron GUI Wrapper for a Command-Line Utility](https://manu.ninja/simple-electron-gui-wrapper-for-a-command-line-utility/)
- [Electron Desktop App Development Guide for Business in 2026](https://www.forasoft.com/blog/article/electron-desktop-app-development-guide-for-business)
- [Electron Performance Documentation](https://www.electronjs.org/docs/latest/tutorial/performance)

**Child Process Management:**
- [Everything You Wanted To Know About Electron Child Processes](https://www.matthewslipper.com/2019/09/22/everything-you-wanted-electron-child-process.html)
- [Electron utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process)
- [Node.js child_process Documentation](https://nodejs.org/api/child_process.html)
- [Zombie processes with Electron Issue](https://github.com/nklayman/vue-cli-plugin-electron-builder/issues/108)

**Async Patterns & UI Responsiveness:**
- [Keep the UI thread responsive - Microsoft](https://learn.microsoft.com/en-us/windows/uwp/debug-test-perf/keep-the-ui-thread-responsive)
- [Deep Dive: scheduler.yield() and Non-Blocking UI Updates (Jan 2026)](https://medium.com/@tharunbalaji110/deep-dive-scheduler-yield-and-the-art-of-non-blocking-ui-updates-18b01241106a)
- [Managing Non-blocking Calls on the UI Thread](https://www.codeguru.com/dotnet/managing-non-blocking-calls-on-the-ui-thread-with-async-await/)

**UX Patterns for Long Operations:**
- [Designing for Long Waits and Interruptions - Nielsen Norman Group](https://www.nngroup.com/articles/designing-for-waits-and-interruptions/)
- [Response Time Limits - Jakob Nielsen](https://www.nngroup.com/articles/response-times-3-important-limits/)
- [How Optimistic Updates Make Apps Feel Faster](https://blog.openreplay.com/optimistic-updates-make-apps-faster/)
- [Asynchronous (Mobile) UX Patterns](https://medium.com/snapp-mobile/asynchronous-mobile-ux-patterns-785ea69c4391)

**Memory Management:**
- [Diagnosing and Fixing Memory Leaks in Electron Applications](https://www.mindfulchase.com/explore/troubleshooting-tips/frameworks-and-libraries/diagnosing-and-fixing-memory-leaks-in-electron-applications.html)
- [Top Strategies to Prevent Memory Leaks in Electron Apps](https://infinitejs.com/posts/top-strategies-prevent-memory-leaks-electron-apps/)
- [Debugging Electron Memory Usage](https://seenaburns.com/debugging-electron-memory-usage/)

**Error Handling:**
- [Breaking change - dotnet CLI stderr output](https://learn.microsoft.com/en-us/dotnet/core/compatibility/sdk/10.0/dotnet-cli-stderr-output)
- [console output sent to stderr when it should be stdout - GitHub Issue](https://github.com/cli/cli/issues/2984)

**Perforce-Specific:**
- [Troubleshoot Common Perforce Issues](https://articles.assembla.com/en/articles/748140-troubleshoot-common-perforce-issues)
- [Work over unreliable networks - Perforce](https://www.perforce.com/manuals/p4sag/Content/P4SAG/performance.diagnosing.network.html)
- [Perforce Network Troubleshooting Guide](https://www.devopsschool.com/blog/perforce-network-troubleshooting-hints/)
- [p4 sync and other commands stalls thread](https://perforce-user.perforce.narkive.com/zGmCGveZ/p4-sync-and-other-commands-stalls-and-never-completes)

**Tauri vs Electron:**
- [Tauri vs. Electron: The Ultimate Desktop Framework Comparison](https://peerlist.io/jagss/articles/tauri-vs-electron-a-deep-technical-comparison)
- [Tauri vs. Electron: performance, bundle size, and trade-offs](https://www.gethopp.app/blog/tauri-vs-electron)
- [Electron vs. Tauri - DoltHub Blog](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/)

**Process Cleanup:**
- [Kill process on exit - Tauri Discussion](https://github.com/tauri-apps/tauri/discussions/3273)
- [Zombie Processes and their Prevention - GeeksforGeeks](https://www.geeksforgeeks.org/operating-systems/zombie-processes-prevention/)
- [Understanding Zombie Process - Jan 2026 Update](https://digitalgadgetwave.com/understanding-zombie-process-and-its-implications/)

---
*Pitfalls research for: P4Now - Desktop GUI wrapper for Perforce CLI*
*Researched: 2026-01-27*
