# Quick Task 007: Address "Now" Architecture Improvements

**One-liner:** Completed all 4 "address now" items — connection injection, command store, parser tests, hook boilerplate

## Tasks Completed

### Task 1: Inject connection args at invoke layer
- **Commit:** e481331
- Created `getConnectionArgs()` helper in `src/lib/tauri.ts` that reads from connectionStore
- Updated all 29 invoke wrapper functions to auto-inject connection args
- Removed `p4port ?? undefined, p4user ?? undefined, p4client ?? undefined` from ~38 call sites across 22 files
- Kept connection args in React Query keys for cache invalidation
- Net reduction: ~150 lines of boilerplate

### Task 2: Replace window event bus with command store
- **Commit:** 139ac90
- Created `useCommand` hook (`src/hooks/useCommand.ts`) for type-safe event listening
- Replaced all 11 `window.dispatchEvent(new CustomEvent('p4now:...'))` calls with typed `dispatch()`
- Replaced all `addEventListener`/`removeEventListener` patterns with `useCommand()` hook
- Updated 7 component files (dispatchers and listeners)

### Task 3: Test Rust ztag parsers
- **Commit:** fd19651
- Added 34 unit tests for all ztag parsers in `src-tauri/src/commands/p4.rs`
- Covers all 11 parse_ztag_* functions plus builder functions and helpers
- +662 lines of test code

### Task 4: Reduce hook operation boilerplate
- **Commit:** 08ec116
- Extracted `runOperation` helper in `useFileOperations.ts` and `useResolve.ts`
- Refactored 5 operations (checkout, revert, submit, resolveAccept, launchMergeTool)
- ~85 lines of duplicated boilerplate eliminated

## Verification

- `npx tsc --noEmit` — zero errors
- `cargo test` — all 34 Rust tests passing

## Commit Log

```
fd19651 test(quick-007): add Rust tests for ztag parsers
08ec116 refactor(quick-007): reduce hook operation boilerplate
139ac90 refactor(quick-007): replace window event bus with command store
e481331 refactor(quick-007): inject connection args at invoke layer
```

## Addresses TODOs

- `.planning/todos/pending/2026-02-02-inject-connection-args-at-invoke-layer.md` ✅
- `.planning/todos/pending/2026-02-02-replace-window-event-bus-with-command-store.md` ✅
- `.planning/todos/pending/2026-02-02-reduce-hook-operation-boilerplate.md` ✅
- `.planning/todos/pending/2026-02-02-test-rust-ztag-parsers.md` ✅
