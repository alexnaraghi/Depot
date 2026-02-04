---
phase: quick
plan: 008
type: execute
wave: 1
depends_on: []
files_modified:
  - reports/large-depot-scalability-analysis.md
autonomous: true

must_haves:
  truths:
    - "Every UI component, store, hook, and Rust command has been evaluated for large depot behavior"
    - "Search scalability has a defined, concrete solution"
    - "Report contains prioritized list of feature changes and bugfixes"
  artifacts:
    - path: "reports/large-depot-scalability-analysis.md"
      provides: "Complete large depot scalability analysis"
      min_lines: 200
---

<objective>
Analyze the entire P4Now codebase for potential issues when connected to large Perforce depots (>10,000 files in workspace). Produce a detailed report covering what works, what breaks, and a prioritized remediation plan.

Purpose: Identify all scalability bottlenecks before they become user-facing issues in real-world large depot usage. The search subsystem is the highest concern area.
Output: `reports/large-depot-scalability-analysis.md` - comprehensive scalability analysis with actionable fixes.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

Key files to analyze (read ALL of these):

Frontend - Components:
@src/components/FileTree/FileTree.tsx
@src/components/FileTree/useFileTree.ts
@src/components/FileTree/FileNode.tsx
@src/components/FileTree/FileStatusIcon.tsx
@src/components/DepotBrowser/DepotBrowser.tsx
@src/components/DepotBrowser/useDepotTree.ts
@src/components/DepotBrowser/DepotNode.tsx
@src/components/ChangelistPanel/ChangelistPanel.tsx
@src/components/ChangelistPanel/useChangelists.ts
@src/components/ChangelistPanel/ChangelistNode.tsx
@src/components/ChangelistPanel/ShelvedFilesSection.tsx
@src/components/DetailPane/DetailPane.tsx
@src/components/DetailPane/SearchResultsView.tsx
@src/components/DetailPane/FileContentViewer.tsx
@src/components/DetailPane/FileAnnotationViewer.tsx
@src/components/DetailPane/AnnotationGutter.tsx
@src/components/DetailPane/SyntaxHighlightedContent.tsx
@src/components/DetailPane/ChangelistDetailView.tsx
@src/components/DetailPane/RevisionDetailView.tsx
@src/components/DetailPane/WorkspaceSummaryView.tsx
@src/components/SearchBar.tsx
@src/components/CommandPalette.tsx
@src/components/MainLayout.tsx
@src/components/StatusBar.tsx
@src/components/SyncToolbar.tsx
@src/components/Header/WorkspaceSwitcher.tsx
@src/components/Header/StreamSwitcher.tsx

Frontend - Stores and Hooks:
@src/stores/searchFilterStore.ts
@src/stores/fileTreeStore.ts
@src/stores/changelistStore.ts
@src/stores/detailPaneStore.ts
@src/stores/connectionStore.ts
@src/hooks/useSync.ts
@src/hooks/useFileOperations.ts
@src/hooks/useFileHistory.ts
@src/hooks/useFileContent.ts
@src/hooks/useFileAnnotations.ts
@src/hooks/useReconcile.ts
@src/hooks/useResolve.ts
@src/hooks/useShelvedFiles.ts
@src/hooks/useChangelistFiles.ts
@src/hooks/useFileInfo.ts

Frontend - Data Layer:
@src/lib/tauri.ts
@src/types/p4.ts
@src/utils/treeBuilder.ts

Backend - Rust:
@src-tauri/src/commands/p4.rs
@src-tauri/src/commands/process.rs
@src-tauri/src/commands/mod.rs
@src-tauri/src/state/process_manager.rs

Existing Architecture Report (for reference, do NOT duplicate):
@reports/architecture-review.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Comprehensive codebase analysis for large depot scalability</name>
  <files>
    (All files listed in context above - read-only analysis)
  </files>
  <action>
Read EVERY file listed in the context section above. For each file, evaluate:

1. **Data volume sensitivity**: Does this component/hook/command fetch or process a list of items that scales with depot size? (e.g., file lists, changelist files, search results, tree nodes)

2. **Rendering scalability**: Does it use virtualization (react-arborist, @tanstack/react-virtual) or does it render all items to DOM? What happens at 10,000+ items?

3. **Memory footprint**: Does it hold large data structures in state? Are there unbounded arrays/maps that grow with depot size?

4. **P4 command behavior**: For each Rust command, what is the time complexity with large depots? Which p4 commands produce unbounded output? (Key concern: `p4 files`, `p4 fstat`, `p4 changes`, `p4 have`)

5. **Search-specific analysis** (HIGH PRIORITY):
   - How does the SearchBar filter work? Is it client-side filtering of pre-fetched data or does it issue p4 commands?
   - How does SearchResultsView work for depot search vs submitted CL search?
   - What happens when `p4 files //depot/...` returns 50,000 results?
   - What happens when `p4 changes -s submitted` returns thousands of results?
   - Can a vague search term stall the application?
   - Is there any result limiting, pagination, or streaming for search results?

6. **Sync status scalability**: The sync status feature compares have-rev vs head-rev for each file. What is the cost at 10,000+ files?

7. **Reconcile scalability**: What happens when reconcile finds thousands of changes?

8. **Tree building**: How does `treeBuilder.ts` handle 10,000+ files? Is the tree construction O(n), O(n log n), or worse?

Document findings in working notes organized by: SAFE (handles scale), CONCERN (may degrade), CRITICAL (will fail/freeze).
  </action>
  <verify>All files listed in context have been read and analyzed. Working notes exist for every major component, hook, store, and Rust command.</verify>
  <done>Complete analysis of every UI element, data flow, and backend command for large depot behavior, with each classified as SAFE/CONCERN/CRITICAL.</done>
</task>

<task type="auto">
  <name>Task 2: Write comprehensive scalability report</name>
  <files>reports/large-depot-scalability-analysis.md</files>
  <action>
Create `reports/large-depot-scalability-analysis.md` with the following structure:

```
# Large Depot Scalability Analysis (>10,000 Files)

**Date:** {today}
**Scope:** All UI components, stores, hooks, and Rust backend commands
**Target Scale:** Workspaces with >10,000 files

## Executive Summary
(2-3 paragraphs: overall assessment, biggest risks, key recommendation)

## Methodology
(Brief: what was analyzed and how scale was evaluated)

## Components That CAN Handle >10,000 Files

For each item:
- Component/feature name
- WHY it handles scale (virtualization? lazy loading? pagination? bounded queries?)
- Any caveats or conditions

Items to evaluate (include all that pass):
- FileTree (react-arborist virtualization)
- DepotBrowser (lazy loading per directory)
- FileContentViewer (single file, bounded)
- FileAnnotationViewer (single file, virtualized)
- Individual file operations (checkout, revert, diff - single file)
- etc.

## Components That CANNOT Handle >10,000 Files

For each item:
- Component/feature name
- FAILURE MODE: What specifically happens (freeze? OOM? UI corruption? data loss?)
- ROOT CAUSE: Why it fails (unbounded query? no virtualization? synchronous processing?)
- SEVERITY: Critical / High / Medium
- AFFECTED USER ACTION: What the user does that triggers the issue

## Search Scalability: Deep Analysis

This section must be thorough and provide a DEFINED SOLUTION.

### Current Search Architecture
- How the SearchBar filter works (client-side filtering)
- How SearchResultsView depot search works (p4 files command)
- How SearchResultsView submitted CL search works (p4 changes command)
- Command palette deep search behavior

### Failure Scenarios
- Scenario 1: User types vague filter term with 10,000+ workspace files
- Scenario 2: User searches depot with broad wildcard (p4 files //depot/...)
- Scenario 3: User searches submitted CLs with common term
- For each: what happens to the app, estimated response time, memory impact

### Defined Solution: Search at Scale
Provide a concrete, implementable solution covering:
- Result limiting strategy (max results per query, with "load more" or streaming)
- Debounce strategy for real-time filtering
- Cancellation strategy (abort previous search when new term typed)
- Progressive loading (show first N results immediately, load more on scroll)
- Backend changes needed (Rust command modifications)
- Frontend changes needed (component and hook modifications)
- P4 command flags to use (-m for max results, streaming via channels)
- Estimated implementation effort per change

### Search Solution Summary Table
| Change | Component | Priority | Effort | Impact |
|--------|-----------|----------|--------|--------|

## Sync Status Scalability
- Current approach (p4 have + p4 files comparison)
- Behavior at 10,000+ files
- Recommended approach if issues found

## Proposed Feature Changes and Bugfixes (Prioritized)

### Priority 1: Critical (App freezes or becomes unusable)
For each:
- Issue description
- Affected component(s) and file(s)
- Proposed fix (specific, implementable)
- Estimated effort (small/medium/large)

### Priority 2: High (Significant performance degradation)
(Same format)

### Priority 3: Medium (Noticeable slowdown, acceptable with workaround)
(Same format)

### Priority 4: Low (Minor issues, nice-to-have improvements)
(Same format)

## Summary: Scalability Scorecard

| Feature Area | Current Scale Limit | Target (10K+) | Status | Fix Priority |
|-------------|---------------------|----------------|--------|-------------|
| File Tree | ... | ... | OK/WARN/FAIL | P1/P2/P3/P4 |
| Depot Browser | ... | ... | ... | ... |
| Search (filter) | ... | ... | ... | ... |
| Search (depot) | ... | ... | ... | ... |
| Search (CLs) | ... | ... | ... | ... |
| Changelists | ... | ... | ... | ... |
| Sync Status | ... | ... | ... | ... |
| Reconcile | ... | ... | ... | ... |
| File Operations | ... | ... | ... | ... |
| Annotations | ... | ... | ... | ... |

## Appendix: Files Analyzed
(List of every file read during analysis)
```

The report must be:
- Actionable: every issue has a specific proposed fix
- Honest: clearly state what works well, not just problems
- Prioritized: critical items (app freeze) before cosmetic issues
- The search solution section must be detailed enough to implement without further research
  </action>
  <verify>
File exists at `reports/large-depot-scalability-analysis.md`.
Report contains all required sections.
Search section contains a defined solution with specific implementation details.
Proposed fixes list is prioritized with at least 3 priority levels.
Scorecard table covers all major feature areas.
Report is at least 200 lines.
  </verify>
  <done>
Comprehensive scalability report exists covering: (1) what CAN handle >10K files with explanation, (2) what CANNOT handle >10K files with failure modes, (3) defined search solution with implementation details, (4) prioritized list of all proposed changes.
  </done>
</task>

</tasks>

<verification>
- `reports/large-depot-scalability-analysis.md` exists and is comprehensive
- Every component in the codebase has been evaluated (no blind spots)
- Search section has a concrete, implementable solution (not vague recommendations)
- All issues have specific file paths and proposed fixes
- Priorities reflect actual severity (freeze = P1, slowdown = P2, etc.)
</verification>

<success_criteria>
1. Report covers all ~85 source files in the codebase
2. Every UI component is classified as CAN or CANNOT handle >10K files
3. Search scalability section provides a defined solution with: result limiting, debounce, cancellation, progressive loading, and specific code changes
4. Proposed changes list has at least 3 priority tiers
5. Report is actionable enough that a developer could start implementing fixes from it
</success_criteria>

<output>
After completion, create `.planning/quick/008-analyze-large-depot-scalability-report/008-SUMMARY.md`
</output>
