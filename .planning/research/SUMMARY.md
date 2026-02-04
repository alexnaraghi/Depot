# Project Research Summary

**Project:** P4Now v5.0 -- Large Depot Scalability
**Domain:** Desktop GUI (Tauri 2.0 + React 19) -- Perforce version control client
**Researched:** 2026-02-04
**Confidence:** HIGH

## Executive Summary

P4Now v5.0 addresses 7 scalability bottlenecks (3 P0, 4 P1) that make the application unusable with depots exceeding 10K files. The core problem is architectural: all Perforce commands block the async runtime, data flows are all-or-nothing with no streaming, and both search and tree rendering rebuild from scratch on every change. The good news is that P4Now's existing stack already contains every foundation needed -- Tauri Channels (proven in p4_sync), TanStack Query caching, tokio 1.x runtime, react-arborist virtualization, and Zustand stores. The fix requires **extending existing patterns**, not replacing them.

The recommended approach adds only two new dependencies (nucleo for Rust fuzzy matching, @tanstack/react-pacer for debounced search input) and enables two existing tokio feature flags (process, io-util). The most impactful change is generalizing the proven p4_sync streaming pattern to p4_fstat, which transforms the worst bottleneck (5-15 second blocking fstat on 10K files) into progressive rendering with first data in under 500ms. All other fixes compose on top of this streaming foundation: the FileIndex populates during streaming, the tree builder incrementally updates from streamed batches, and debounce prevents wasted computation during user input.

The primary risks are operational, not architectural. Zombie process accumulation from improperly awaited tokio child processes will crash the app after hours of use. Tauri Channel backpressure from large payloads will freeze the UI if sends are not batched. TanStack Query race conditions between streaming updates and auto-refresh invalidations will cause data flickering. All three have well-documented prevention patterns (explicit wait, batched sends via spawn_blocking, mutation guards against concurrent invalidation). The 13-14 day estimate from architecture research is realistic given that the codebase already has the right primitives and no fundamental rewrites are needed.

## Key Findings

### Recommended Stack

The existing stack (Tauri 2.0, React 19, TanStack Query 5, Zustand, react-arborist) requires minimal additions. No replacements needed. See [STACK.md](./STACK.md) for full rationale and code patterns.

**Additions:**
- **tokio features `process` + `io-util`**: Enable async process spawning and line-by-line stdout parsing. Near-identical API to std::process::Command. Prevents executor starvation during long p4 commands. ~50KB binary increase.
- **nucleo 0.5**: Rust fuzzy matcher used by helix-editor. 6x faster than alternatives, handles 100K file paths in <5ms. Required for Tier 2 workspace search (in-memory index on backend).
- **@tanstack/react-pacer 1.x**: Official TanStack debounce/throttle hooks. Prevents redundant search operations during rapid typing. ~10KB bundle increase. Newer library (Jan 2026) but simple API with easy fallback to lodash.debounce.

**What NOT to add:** Monaco editor (5MB overkill for read-only viewing), custom streaming libraries (Tauri Channels suffice), lodash (react-pacer covers debounce needs), additional fuzzy matchers (nucleo backend + microfuzz frontend is correct split).

### Expected Features

The v5.0 feature landscape covers 8 table stakes, 4 differentiators, and 5 anti-features specific to large depot support. See [large-depot-scalability/FEATURES.md](./large-depot-scalability/FEATURES.md) for complete categorization with complexity estimates and dependency chains.

**Must fix (P0 -- app unusable without):**
- **TS-1: Streaming fstat** to replace blocking 5-15s full-workspace query (Medium, 3-4 days)
- **TS-3: Debounced search with persistent index** to replace per-keystroke filter rebuilds (Low, 1-2 days)
- **TS-8: Background async execution** via tokio::process to unblock runtime (Low, 1-2 days)

**Must fix (P1 -- poor experience without):**
- **TS-2: Delta refresh** -- query only opened/shelved files on 30s refresh instead of full fstat (Medium, 2-3 days)
- **TS-6: Batch shelved queries** to eliminate N+1 p4 describe calls (Low, 1 day)
- **TS-7: Progress indicators** with cancellation for operations > 2 seconds (Low, 1 day)
- **TS-4: Workspace-restricted depot view** -- P4V's single most impactful performance feature (Medium, 1-2 days)
- **TS-5: Server-side result limiting** with `-m` flag and "Load More" pagination (Low, 1 day)

**Differentiators (where P4Now exceeds P4V):**
- **DIFF-1: Unified search** with streaming results across workspace, depot, and changelists (High, 5-7 days -- defer to post-core)
- **DIFF-2: Incremental tree updates** via structural sharing (Medium, 2-3 days -- include in core milestone)
- **DIFF-3: Scoped reconcile** for directory-level operations (Low, 1 day -- defer)
- **DIFF-4: Virtualized code viewer** for large files (Medium, 1-2 days -- defer)

**Explicitly avoid (anti-features):**
- Full-text content search / grep across workspace (prohibitively expensive)
- Real-time file system watching (no Perforce protocol for it)
- Offline mode / local caching (Perforce is server-authoritative)
- Automatic background syncing (dangerous, user should always initiate)
- Client-side changelist history beyond 500 CLs (diminishing returns)

### Architecture Approach

The 7 core fixes integrate into the existing architecture through three migration patterns: (A) wrap short commands in `spawn_blocking`, (B) convert streaming commands to `tokio::process` with Tauri Channel output, and (C) add new managed state (`FileIndex`) alongside existing `ProcessManager`. The architecture preserves backward compatibility by adding new streaming variants (e.g., `p4_fstat_stream`) alongside existing commands rather than replacing them. See [ARCHITECTURE.md](./ARCHITECTURE.md) for integration map, data flow diagrams, and file-level change inventory (~1,400 lines across 17 files).

**Major components and changes:**
1. **p4_fstat_stream (new Rust command)** -- Streams fstat results in batches of 100 via Tauri Channel, modeled on existing p4_sync pattern
2. **FileIndex (new managed state)** -- In-memory nucleo-powered fuzzy index of all workspace depot paths, rebuilt after fstat completes, searched in <5ms
3. **ProcessManager (extended)** -- Support both std::process::Child and tokio::process::Child for kill/cleanup operations
4. **useFileTree (modified hook)** -- Accumulates streaming batches, triggers single tree build on completion, uses incremental builder for subsequent updates
5. **treeBuilder (new incremental mode)** -- Detects changes between old/new file sets, applies incremental updates for <10% changes, falls back to full rebuild otherwise
6. **p4_describe_shelved_batch (new Rust command)** -- Single backend call for all shelved file queries, sequential execution with per-CL error isolation
7. **useDebounce hook / react-pacer integration** -- 150ms debounce on filter inputs, keeps stores pure and debounce at hook level

### Critical Pitfalls

Top 5 pitfalls that must be addressed during implementation. See [PITFALLS.md](./PITFALLS.md) for all 11 pitfalls with code examples and detection strategies.

1. **Zombie process accumulation** -- Forgetting to `.await` tokio child processes creates zombies that exhaust PIDs after hours. Prevention: explicit `child.wait().await` or background reaping via `tokio::spawn`. Detection: orphaned p4.exe in Task Manager.
2. **Tauri Channel backpressure freezes UI** -- Sending >1MB payloads through Channels blocks the tokio executor for 30-50ms per send. Prevention: batch into 100-file chunks, use `spawn_blocking` for channel sends. Detection: "Application Not Responding" on Windows.
3. **TanStack Query race conditions** -- Streaming `setQueryData` updates racing with auto-refresh `invalidateQueries` causes data flickering. Prevention: check `isMutating` before invalidation, use mutation keys to guard streaming state.
4. **Structural sharing breaks tree node references** -- TanStack Query structural sharing creates new object references for unchanged subtrees, causing react-arborist to re-render all 10K nodes and lose scroll/focus state. Prevention: disable structural sharing for tree queries or use custom deep-merge that preserves references.
5. **Batch query error isolation** -- Single failure in batched shelved file query hides which changelist caused the error. Prevention: execute describe commands sequentially with per-CL try/catch, skip failures without failing the batch.

## Implications for Roadmap

Based on dependency analysis from ARCHITECTURE.md and feature prioritization from FEATURES.md, the work groups into 5 phases. Phase 1 items have zero dependencies (parallelizable), Phases 2-3 form the critical path, and Phases 4-5 are independent optimizations. Total P0 effort: 5-8 days. Total P0+P1 effort: 12-17 days.

### Phase 1: Async Foundation
**Rationale:** ProcessManager and debounce hook have zero dependencies and unblock all subsequent phases. Must happen first because streaming fstat (Phase 2) requires tokio::process support in ProcessManager.
**Delivers:** Updated ProcessManager supporting tokio Child processes, CommandExt trait for generic connection args, useDebounce utility hook, tokio feature flags enabled in Cargo.toml.
**Addresses:** TS-8 (async execution), TS-3 partial (debounce infrastructure)
**Avoids:** Pitfall 1 (mutex across await -- already fixed, verify), Pitfall 2 (zombie processes -- add reaping)
**Estimated effort:** 1-1.5 days

### Phase 2: Streaming fstat + Progress
**Rationale:** The single highest-impact change. Transforms the worst bottleneck (TS-1: 5-15s blocking fstat) into progressive rendering. Depends on Phase 1 ProcessManager update. Progress indicators (TS-7) are a natural byproduct of streaming -- the batch count provides progress data for free.
**Delivers:** `p4_fstat_stream` Rust command, frontend streaming accumulator in useFileTree, progress bar during load with cancellation.
**Addresses:** TS-1 (incremental loading), TS-7 (progress indicators)
**Avoids:** Pitfall 3 (channel backpressure -- batch sends of 100 files), Pitfall 4 (race conditions -- guard invalidation during streaming)
**Uses:** tokio::process, Tauri Channel (existing pattern from p4_sync)
**Estimated effort:** 3-4 days

### Phase 3: FileIndex and Search
**Rationale:** The FileIndex can be populated during streaming fstat from Phase 2, providing the data foundation for fast workspace search. Depends on Phase 2 for the data pipeline.
**Delivers:** FileIndex managed state with nucleo, `search_workspace_files` and `rebuild_file_index` Tauri commands, useWorkspaceSearch hook, persistent fuzzy index for filter.
**Addresses:** TS-3 (debounced search with persistent index), partial DIFF-1 (workspace search tier)
**Avoids:** Pitfall 8 (memory leak from string slices -- use owned Strings in index)
**Uses:** nucleo, Tauri managed state pattern
**Estimated effort:** 2-3 days

### Phase 4: Tree Performance + Delta Refresh
**Rationale:** With streaming data flowing (Phase 2) and search working (Phase 3), optimize the tree rendering pipeline. Incremental builder (DIFF-2) prevents full tree rebuild on every update. Delta refresh (TS-2) makes the 30-second auto-refresh cheap by querying only opened/shelved files.
**Delivers:** Incremental tree builder with structural sharing, debounced filter in FileTree and ChangelistPanel, batch FileTreeStore updates, delta refresh via `p4 fstat -Ro` for opened files only.
**Addresses:** DIFF-2 (incremental tree updates), TS-2 (delta refresh), P1-7 (Map copy per file update)
**Avoids:** Pitfall 6 (structural sharing breaks tree refs -- custom merge preserving references), Pitfall 10 (non-virtualized operations on large trees)
**Estimated effort:** 3-5 days

### Phase 5: Batch Optimization
**Rationale:** Independent of Phases 2-4. Fixes the N+1 shelved file query pattern. Can be developed in parallel with earlier phases.
**Delivers:** `p4_describe_shelved_batch` Rust command, single TanStack Query replacing useQueries array.
**Addresses:** TS-6 (batch shelved queries)
**Avoids:** Pitfall 7 (batch error isolation -- per-CL try/catch), Pitfall 9 (server rate limiting -- sequential execution, not parallel)
**Estimated effort:** 1 day

### Phase Ordering Rationale

- **Phase 1 before all others:** ProcessManager update is a hard dependency for streaming. Debounce hook is trivial and unblocks Phase 4 filter work.
- **Phase 2 before Phase 3:** FileIndex rebuild hook fires after fstat streaming completes. Without streaming data, there is nothing to index.
- **Phase 3 before Phase 4:** The tree filter can use the FileIndex for matching, but this is a soft dependency. Phase 4 can start before Phase 3 finishes.
- **Phase 5 is independent:** Batched shelved queries have no dependency on streaming or search. Can be done in parallel with any phase after Phase 1.
- **TS-4 (workspace restriction) and TS-5 (server-side limiting) are deferred** to a follow-up iteration. They are P1/P2 features that improve depot browser performance but are not on the critical path for the 7 core bottlenecks. They can be added after the core scalability work ships.
- **Grouping rationale:** Phases are grouped by data flow direction: Phase 1-2 fix backend-to-frontend pipeline, Phase 3 adds backend state, Phase 4 optimizes frontend rendering, Phase 5 optimizes a separate backend query.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Streaming fstat):** Integration of Tauri Channel streaming with TanStack Query cache requires careful race condition handling. The existing p4_sync pattern is a good model but streaming into query cache (vs. one-shot mutation) is a different pattern. Needs validation with real 10K depot.
- **Phase 4 (Tree Performance):** Incremental tree builder with structural sharing is the most complex change (~200 new lines). Edge cases around empty folders, file renames, and deep nesting need comprehensive unit tests. react-arborist behavior with 10K nodes and partial tree updates needs empirical testing.

Phases with standard patterns (skip phase research):
- **Phase 1 (Async Foundation):** Well-documented tokio patterns. ProcessManager already uses tokio::sync::Mutex. Straightforward feature flag enable + spawn_blocking wrapping.
- **Phase 3 (FileIndex):** Managed state in Tauri is a documented pattern. nucleo API is simple. This is a new module with clean boundaries.
- **Phase 5 (Batch Optimization):** Replace useQueries with single useQuery. Backend batching is trivial loop. Error isolation is standard try/catch pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only 2 new deps (nucleo battle-tested in helix, react-pacer is only medium confidence item). Existing stack verified solid. |
| Features | HIGH | v5.0 scope is well-defined: 8 table stakes, 4 differentiators, 5 anti-features mapped from P4V research and scalability analysis. |
| Architecture | HIGH | Integration map verified against actual codebase file paths. Existing p4_sync streaming pattern provides proven template. ~1,400 lines estimated. |
| Pitfalls | MEDIUM | Tauri + tokio pitfalls verified with official docs. TanStack Query race conditions based on community patterns. Perforce server limits may vary by deployment. |

**Overall confidence:** HIGH

The research converges strongly. All four documents agree on approach (extend existing patterns), stack (minimal additions), and risk profile (operational pitfalls, not architectural gaps). The 13-14 day single-developer estimate from architecture research is credible given the codebase already has the right foundations.

### Gaps to Address

- **Real depot testing:** All performance targets (10K files in <3s, search in <5ms) are extrapolated from library benchmarks, not measured on target hardware with a real Perforce server. Need a 10K+ file test depot for validation during Phase 2.
- **Perforce server limits:** Server-side `maxcommands` and connection limits vary by deployment. Phase 5 batch query assumes sequential execution is safe, but target server config should be verified with admin.
- **react-pacer maturity:** @tanstack/react-pacer released January 2026. Small API surface reduces risk, but monitor for breaking changes. Fallback to lodash.debounce or custom useDebounce hook if issues arise.
- **Long-running memory stability:** Pitfall 8 (memory leak from string slices) needs 8+ hour soak testing with periodic fstat refreshes to validate FileIndex memory behavior.
- **Streaming + auto-refresh interaction:** The exact behavior of TanStack Query when `setQueryData` and `invalidateQueries` overlap needs empirical testing. Pitfall 4 documents the risk, but the mutation-guard prevention pattern needs validation in P4Now's specific refresh cycle.
- **Delta refresh accuracy:** TS-2 assumes `p4 fstat -Ro` (opened files only) is sufficient for 30-second refresh. Need to validate that deleted/added files not yet opened are handled correctly -- may require periodic full refresh (every 5 minutes) alongside frequent delta refreshes.

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Streaming Responses](https://v2.tauri.app/develop/calling-rust/#streaming-responses) -- Channel streaming API
- [tokio::process::Command](https://docs.rs/tokio/latest/tokio/process/struct.Command.html) -- Async process spawning
- [tokio::io::BufReader](https://docs.rs/tokio/latest/tokio/io/struct.BufReader.html) -- Async line-by-line reading
- [TanStack Query v5 QueryClient](https://tanstack.com/query/v5/docs/reference/QueryClient) -- setQueryData, invalidation
- [nucleo GitHub (helix-editor)](https://github.com/helix-editor/nucleo) -- Fuzzy matching performance
- [p4 fstat reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_fstat.html) -- Filter flags for incremental queries
- [P4V performance tips](https://articles.assembla.com/en/articles/1804524-speed-up-your-perforce-repo-with-p4v) -- Workspace restriction as top performance feature
- P4Now codebase: `src-tauri/src/commands/p4/p4handlers.rs` (p4_sync streaming pattern, lines 545-623)

### Secondary (MEDIUM confidence)
- [TanStack Pacer documentation](https://tanstack.com/pacer/latest/docs/installation) -- Debounce hooks
- [TanStack Query race condition discussion](https://github.com/TanStack/query/discussions/7932) -- Concurrent invalidation patterns
- [TanStack Query structural sharing issue](https://github.com/TanStack/query/issues/6812) -- Tree data reference identity
- [React debounce stale closures](https://www.developerway.com/posts/debouncing-in-react) -- Prevention patterns
- [Perforce connection limits](https://www.perforce.com/manuals/p4sag/Content/P4SAG/performance.prevention.connection_limits.html) -- Server-side rate limiting
- [Progress Bars - Win32 UX Guide](https://learn.microsoft.com/en-us/windows/win32/uxguide/progress-bars) -- 2 second threshold for progress indicators

### Tertiary (LOW confidence)
- [Tauri Channel blocking discussion](https://github.com/tauri-apps/tauri/discussions/11589) -- Backpressure behavior (community report, not official docs)
- react-arborist performance with 10K+ nodes -- Inferred from virtualization design, needs empirical validation

---
*Research completed: 2026-02-04*
*Ready for roadmap: yes*
