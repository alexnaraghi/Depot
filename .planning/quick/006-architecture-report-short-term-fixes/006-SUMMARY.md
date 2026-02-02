---
phase: quick
plan: 006
subsystem: core
tags: [refactor, architecture, rust, react, query-invalidation]
dependency-graph:
  requires: []
  provides: [parse_ztag_records, batched-invalidation, ref-based-progress]
  affects: []
tech-stack:
  added: []
  patterns: [shared-parser-function, ref-based-callbacks, batched-promises]
key-files:
  created: []
  modified:
    - src-tauri/src/commands/p4.rs
    - src/components/MainLayout.tsx
    - src/components/CommandPalette.tsx
    - src/hooks/useSync.ts
    - src/hooks/useShelvedFiles.ts
    - src/hooks/useResolve.ts
    - src/hooks/useReconcile.ts
    - src/hooks/useFileOperations.ts
    - src/components/DepotBrowser/DepotContextMenu.tsx
    - src/components/ChangelistPanel/ChangelistPanel.tsx
    - src/components/ChangelistPanel/ChangelistContextMenu.tsx
    - src/components/ChangelistPanel/EditDescriptionDialog.tsx
decisions: []
metrics:
  duration: 8 min
  completed: 2026-02-02
---

# Quick Task 006: Architecture Report Short-Term Fixes Summary

**One-liner:** Fixed 5 architecture issues: apply_connection_args in p4_submit, removed __queryClient global, extracted parse_ztag_records shared parser, ref-based sync progress, batched query invalidation.

## What Was Done

### Task 1: Fix p4_submit to use apply_connection_args
Replaced two blocks of manual `-p`/`-u`/`-c` arg setting with `apply_connection_args()` calls, making p4_submit consistent with all other command functions. This also adds P4CONFIG/P4ROOT env var isolation that was missing.

### Task 2: Kill window.__queryClient global
Removed the `(window as any).__queryClient` assignment from MainLayout.tsx and replaced the consumer in CommandPalette.tsx with `useQueryClient()` hook. CommandPalette is rendered inside the QueryClientProvider tree so the hook works correctly.

### Task 3: Extract parse_ztag_records() in Rust
Created a single `parse_ztag_records()` function that handles the common "... key value" parsing with blank-line record separation. Refactored all 11 parse_ztag_* functions plus launch_merge_tool's inline parsing to delegate to it. Net reduction: 181 lines removed.

### Task 4: Fix stale closure in useSync progress
Added `useRef` counterparts for `totalFiles` and `syncedFiles`. The progress callback now reads/writes ref values (stable across renders) and calls setState from the ref values to trigger UI updates. Removed stale `syncedFiles`/`totalFiles` from useCallback dependency array.

### Task 5: Batch query invalidation
Wrapped sequential `await queryClient.invalidateQueries()` calls in `Promise.all()` across 8 files (13 call sites). Queries now fire concurrently instead of sequentially.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `cargo build` compiles successfully
- `npm run build` succeeds
- No `__queryClient` references in codebase
- No manual `-p`/`-u`/`-c` in p4_submit
- All parse_ztag_* functions delegate to parse_ztag_records
- All multi-invalidation sites use Promise.all

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 482707d | fix(quick-006): use apply_connection_args in p4_submit |
| 2 | 05b2cfc | fix(quick-006): remove window.__queryClient global |
| 3 | 27893f9 | refactor(quick-006): extract parse_ztag_records shared function |
| 4 | 8f4d5b1 | fix(quick-006): fix stale closure in useSync progress callback |
| 5 | 9b2e63b | perf(quick-006): batch query invalidation with Promise.all |
