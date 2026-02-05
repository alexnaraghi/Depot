---
status: resolved
trigger: "ui-freeze-large-depot-operations"
created: 2026-02-04T00:00:00Z
updated: 2026-02-04T00:07:00Z
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

hypothesis: CONFIRMED - invalidateQueries(['fileTree']) triggers full re-fetch of all 1000+ files after every single-file operation
test: verified that invokeP4Fstat supports querying specific paths instead of full workspace
expecting: can update only affected files using queryClient.setQueryData instead of invalidation
next_action: implement targeted update using invokeP4Fstat with specific paths

## Symptoms

expected: Operation completes with brief loading indicator, UI stays responsive
actual: Entire UI goes grey and becomes completely unresponsive, never recovers
errors: React error boundary triggered in FileTree component:
```
An error occurred in the <FileTree> component.
Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://react.dev/link/error-boundaries to learn more about error boundaries.
defaultOnUncaughtError	@	react-dom-client.development.js:9362
logUncaughtError	@	react-dom-client.development.js:9431
runWithFiberInDEV	@	react-dom-client.development.js:871
```
reproduction:
1. Open a depot with 1000+ files
2. Right-click a workspace file and select "checkout for edit"
3. OR revert a file from a pending changelist
4. UI immediately freezes and goes grey
started: Never worked with large depots - this has always been an issue with 1000+ file depots

## Eliminated

## Evidence

- timestamp: 2026-02-04T00:01:00Z
  checked: useFileOperations.ts lines 106-110, 134-138
  found: Both checkout and revert invalidate ['fileTree'] query after completion
  implication: This triggers full re-fetch of all workspace files via invokeP4FstatStream

- timestamp: 2026-02-04T00:02:00Z
  checked: useFileTree.ts lines 161-266 (loadFilesStreaming function)
  found: Full fstat stream that processes all files in depot, updates progress incrementally
  implication: Every single-file operation (checkout/revert) triggers this expensive full-depot scan

- timestamp: 2026-02-04T00:03:00Z
  checked: useFileTree.ts lines 279-294 (delta refresh mechanism)
  found: System already has delta refresh using invokeP4FstatOpened for incremental updates
  implication: The delta refresh approach could be used for single-file operations instead of full invalidation

- timestamp: 2026-02-04T00:04:00Z
  checked: tauri.ts lines 138-139 (invokeP4Fstat API)
  found: invokeP4Fstat accepts paths array for querying specific files
  implication: Can query only the affected files after checkout/revert instead of entire workspace

## Resolution

root_cause: After checkout/revert operations complete, useFileOperations invalidates the entire ['fileTree'] query cache. This triggers loadFilesStreaming() to re-fetch ALL 1000+ workspace files via invokeP4FstatStream, causing the UI to freeze while processing the massive dataset. The code has the capability to query specific files via invokeP4Fstat(paths), but instead uses nuclear invalidation approach.

fix: Modified useFileOperations.ts to use targeted updates instead of full cache invalidation:
1. Added mapP4FileInfo helper function (duplicated from useFileTree to avoid circular dependency)
2. Added updateAffectedFiles function that queries only the affected file paths via invokeP4Fstat
3. Updates both the fileTreeStore (via batchUpdateFiles) and query cache (via setQueriesData)
4. Modified checkout() and revert() to call updateAffectedFiles instead of invalidating ['fileTree']
5. Removed ['fileTree'] from invalidateKeys array in both operations
6. Falls back to full invalidation if targeted update fails

verification: Code review completed:
✓ TypeScript compilation passes with no errors
✓ updateAffectedFiles correctly queries only specified paths via invokeP4Fstat
✓ Both Zustand store and React Query cache are updated consistently
✓ Fallback to full invalidation if targeted update fails (error handling)
✓ checkout() and revert() both use targeted updates
✓ ['fileTree'] removed from invalidateKeys in both operations
✓ Other queries (['p4', 'opened'], ['p4', 'changes']) still invalidated as needed
✓ Submit operation still uses full invalidation (affects many files)

Expected behavior after fix:
- Single-file checkout/revert will query only 1 file instead of 1000+
- UI remains responsive (no streaming of entire workspace)
- File tree updates correctly with new status
- Performance improvement: O(1) instead of O(n) for single-file operations

files_changed:
  - src/hooks/useFileOperations.ts
