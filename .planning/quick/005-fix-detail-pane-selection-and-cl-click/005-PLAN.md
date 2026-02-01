---
phase: quick-005
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/stores/searchFilterStore.ts
  - src/components/DetailPane/DetailPane.tsx
  - src/components/DetailPane/SearchResultsView.tsx
  - src/components/ChangelistPanel/ChangelistNode.tsx
autonomous: true
must_haves:
  truths:
    - "Clearing search filter resets detail pane to workspace summary (not stale file)"
    - "Clicking a submitted CL in search results navigates to CL detail view (not expand-in-place)"
    - "Clicking a pending CL header in changelist panel still shows CL detail and toggles expand"
  artifacts:
    - path: "src/stores/searchFilterStore.ts"
      provides: "clearFilter calls detailPaneStore.clear()"
    - path: "src/components/DetailPane/SearchResultsView.tsx"
      provides: "CL click navigates to detail view instead of expanding"
  key_links:
    - from: "searchFilterStore.clearFilter"
      to: "detailPaneStore.clear"
      via: "direct store call"
      pattern: "useDetailPaneStore\\.getState\\(\\)\\.clear\\(\\)"
---

<objective>
Fix two UX issues with the detail pane after search:

1. When search filter is cleared (Escape, click result, manual clear), detail pane shows stale file selection instead of resetting to workspace summary. Fix: `clearFilter` should also call `detailPaneStore.clear()`.

2. Clicking a submitted CL in SearchResultsView expands it in-place (chevron toggle). It should instead navigate to ChangelistDetailView in the detail pane, clearing the filter. The expand behavior is redundant since the detail pane already has a rich CL view.

Purpose: Consistent navigation -- search results should behave like the rest of the app where clicking navigates to detail.
Output: Fixed search-to-detail-pane flow.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/stores/searchFilterStore.ts
@src/stores/detailPaneStore.ts
@src/components/DetailPane/DetailPane.tsx
@src/components/DetailPane/SearchResultsView.tsx
@src/components/ChangelistPanel/ChangelistNode.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reset detail pane on filter clear and make CL clicks navigate to detail</name>
  <files>
    src/stores/searchFilterStore.ts
    src/components/DetailPane/SearchResultsView.tsx
  </files>
  <action>
1. In `searchFilterStore.ts` — update `clearFilter` to also reset the detail pane selection:
   - Import `useDetailPaneStore` from `@/stores/detailPaneStore`
   - In `clearFilter`, after resetting filter state, call `useDetailPaneStore.getState().clear()` to reset selection to `{ type: 'none' }`. This ensures clearing the search always shows workspace summary, not a stale file.

2. In `SearchResultsView.tsx` — change `handleCLClick` to navigate to CL detail instead of expand-in-place:
   - Remove the `expandedCL` state and `setExpandedCL` state entirely
   - Change `handleCLClick` to call `handleViewCLDetail` (which already exists and does exactly the right thing: clears filter if toolbar-driven, then navigates to changelist detail)
   - Remove the expanded CL detail section in the JSX (the `{expandedCL === cl.id && ...}` block)
   - Remove the `ChevronDown`/`ChevronRight` icons from CL result rows since there is no expand behavior anymore. Replace with a simple `List` icon (import from lucide-react) to visually match CL items elsewhere in the app.
  </action>
  <verify>
    - `npm run build` passes with no errors
    - Manually verify: type in toolbar search, see results, click a CL -> filter clears and CL detail shows in detail pane
    - Manually verify: clear search with Escape -> detail pane shows workspace summary, not stale file
  </verify>
  <done>
    - Clearing search filter always resets detail pane to workspace summary
    - Clicking submitted CL in search results navigates to ChangelistDetailView
    - No expand-in-place chevrons on search result CL rows
  </done>
</task>

</tasks>

<verification>
- `npm run build` completes without errors
- Search + click CL = navigates to CL detail view
- Search + Escape = workspace summary (not stale selection)
- Pending CL clicks in left panel still work (expand + detail pane update)
</verification>

<success_criteria>
- Filter clear always resets to workspace summary
- CL search results click-through to detail view
- No regressions in pending CL panel behavior
</success_criteria>

<output>
After completion, create `.planning/quick/005-fix-detail-pane-selection-and-cl-click/005-SUMMARY.md`
</output>
