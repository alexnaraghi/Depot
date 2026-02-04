---
phase: quick
plan: "008"
type: analysis
completed: 2026-02-03
duration: ~30 minutes
---

# Quick Task 008: Large Depot Scalability Analysis

**One-liner:** Full codebase audit identifying 12 scalability issues for >10K file depots with complete three-tier search architecture design.

## What Was Done

Analyzed every UI component, store, hook, and Rust backend command in P4Now for scalability issues when connected to depots with >10,000 files. Produced a comprehensive report at `reports/large-depot-scalability-analysis.md`.

## Key Findings

### P0 Issues (App-Breaking)
1. **Full workspace `p4 fstat` on every load** - Fetches entire file tree in one blocking call. At 10K files: 5-15 second hang.
2. **File tree filter rebuild per keystroke** - Creates a new fuzzy search index on every keystroke. At 10K files: noticeable input lag.
3. **Search architecture not scalable** - Three separate search mechanisms, all client-side with hard caps (500 CLs, 100 files). No depot-wide fuzzy search.

### P1 Issues (Major Degradation)
4. Tree builder full rebuild on every 30s refresh
5. N+1 shelved file queries (one per pending CL)
6. All backend commands block async runtime (`cmd.output()` instead of streaming)
7. FileTreeStore creates new Map on every single file update during sync

### P2 Issues (Minor Degradation)
8. Unbounded depot browser directory listings
9. Non-virtualized code viewer (full DOM render)
10. Non-virtualized annotation gutter
11. Reconcile preview scans entire workspace

### P3 Issues (Extreme Scale)
12. Submitted CL history hard-capped at 500

## Search at Scale Solution

Designed a three-tier search architecture:
- **Tier 1 (Client):** Fix existing microfuzz to build index once, not per keystroke
- **Tier 2 (Rust Backend):** In-memory file path index for instant workspace search
- **Tier 3 (P4 Server):** Streaming `p4 files` and `p4 changes` with pagination

Includes unified search UI design replacing the current three-path approach.

## Commits

| Commit | Description |
|---|---|
| `584ef65` | docs(008): large depot scalability analysis report |

## Output

- **Report:** `reports/large-depot-scalability-analysis.md` (663 lines)
- Covers: 23 components, 5 stores, 12 hooks, 15+ Rust commands
- Includes: priority matrix, implementation phases (A-D), effort estimates (~17-22 days total)

## Deviations from Plan

None - plan executed exactly as written.
