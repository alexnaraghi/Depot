# Design: Unified Three-Column Layout

**Status:** Proposal
**Replaces:** Phase 12 (Actionable Search) — subsumes its goals into a broader layout rework
**Affects:** MainLayout, FileTree, ChangelistPanel, SearchBar, FileHistoryDialog, SearchResultsPanel

## Motivation

The current layout uses a two-panel split (file tree + changelist sidebar) with dialogs and slide-out panels for secondary views like file history and search results. This mirrors P4V's tab-heavy approach where switching context means losing your place. Modern dev tools (GitKraken, Linear, Figma) solve this with selection-driven detail panes that keep spatial layout stable while changing content contextually.

## Layout Structure

```
┌──────────────────────────────────────────────────────────────┐
│ Toolbar: [Stream/Workspace] [Refresh Sync Reconcile ...] [🔍] [⚙] │
├─────────────┬────────────────────────┬───────────────────────┤
│ FILE TREE   │ DETAIL PANE            │ CHANGELISTS           │
│ ~280px      │ flex: 1                │ ~320px                │
│ resizable   │                        │ resizable             │
│             │                        │                       │
│ ▸ src/      │ (content driven by     │ ● Default (3 files)   │
│   ▸ engine/ │  selection in either   │   engine.cpp          │
│     file.cpp│  side column)          │   render.h            │
│     render.h│                        │   config.json         │
│   ▸ ui/     │                        │                       │
│     app.tsx │                        │ ● CL 4521 "Fix crash" │
│             │                        │   debug.cpp           │
├─────────────┴────────────────────────┴───────────────────────┤
│ Output log (collapsible)                                     │
└──────────────────────────────────────────────────────────────┘
```

Three persistent columns. The left and right columns are sources of selection. The center column reacts to whatever was last clicked.

## Detail Pane States

The detail pane has a small set of views driven entirely by user selection. A breadcrumb bar at the top of the pane shows the current navigation path and supports back navigation.

### 1. Nothing Selected — Workspace Summary

Shown on launch and when selection is cleared (Escape).

```
WORKSPACE SUMMARY

3 files checked out
2 pending changelists
Last sync: 5 min ago (#4520)

RECENT ACTIVITY
alice submitted CL 4520
bob shelved CL 4518
```

### 2. File Selected (from tree or CL file list)

Click a file in either the tree or a changelist's file list.

```
← engine.cpp
#42 · edit · 2.3KB
───────────────────────
ACTIONS: [Diff] [Checkout] [Revert] [Open] [Open in Explorer]
───────────────────────
HISTORY
#42  alice  Jan 30  "Fix null deref in render loop"
#41  bob    Jan 28  "Add shadow pass"
#40  alice  Jan 25  "Refactor pipeline"
───────────────────────
PROPERTIES
Type: text    Depot: //depot/src/engine/engine.cpp
Workspace: C:\src\engine\engine.cpp
```

Key points:
- File history is **inline** — no dialog. The history table loads lazily when a file is selected.
- Clicking a history row drills into that revision (see state 4 below).
- Action buttons match the file's current state (e.g., "Checkout" if not checked out, "Revert" if checked out).
- If the file was selected from a CL file list, the breadcrumb shows `CL 4521 > engine.cpp` and the back arrow returns to the CL detail view.

### 3. Changelist Selected

Click a changelist header in the right column.

```
← CL 4521 · Pending
"Fix crash on disconnect"
───────────────────────
ACTIONS: [Submit] [Shelve] [Delete] [Edit Description]
───────────────────────
FILES (3)
✎ engine.cpp     #42 edit
✎ render.h       #18 edit
+ config.json         add
───────────────────────
SHELVED FILES (1)
  debug.cpp      #5  edit
───────────────────────
CL HISTORY (recent submits in this workspace)
#4520  alice  Jan 29  "Add shadow pass"
#4519  bob    Jan 28  "Update config schema"
```

Key points:
- Clicking a file in the CL detail view drills into that file's detail (state 2), with breadcrumb `CL 4521 > engine.cpp`.
- The CL history section shows recent submitted CLs for workspace context — not a tab, just always visible below the fold.
- Shelved files section only appears if the CL has shelved files.

### 4. History Revision Selected

Click a row in a file's history table.

```
← engine.cpp > #42
alice · Jan 30, 2026
"Fix null deref in render loop"
───────────────────────
ACTIONS: [Diff vs Previous] [Diff vs Workspace] [Open This Revision]
───────────────────────
FILES IN THIS SUBMIT
✎ engine.cpp     #42 edit
✎ render.h       #18 edit
+ config.json         add
```

Key points:
- Shows the submitted CL that contained this revision.
- "Diff vs Previous" launches external diff tool comparing #41 and #42.
- "Diff vs Workspace" compares this revision against the current workspace file.
- Clicking a sibling file in the submit drills into that file's detail.

### 5. Search Active

When the user types in the toolbar search input, the detail pane does **not** change to a search results view. Instead:

- The **file tree** (left column) filters in-place to show only files matching the query.
- The **changelist column** (right column) filters in-place to show only CLs containing matching files, or CLs whose descriptions match the query.
- Both columns show a subtle filter indicator — a small pill/badge on the column header showing match count (e.g., "12 files", "2 CLs") and a tinted background to signal filtered state.
- The detail pane continues to work normally: clicking a filtered result shows its file detail or CL detail.
- Pressing Escape or clearing the search input restores both columns to their unfiltered state.

#### Search Scope

The search input accepts plain text and filters across:
- **File paths** in the workspace tree (client-side, instant)
- **File paths** within pending changelists (client-side, instant)
- **Changelist descriptions** (client-side against cached data)

For deeper searches (submitted CL history, depot-wide), the command palette (Ctrl+K) provides explicit "Search submitted changelists" and "Search depot" commands that load results into the detail pane as a scrollable list. Clicking a result from these drills into the appropriate detail view.

## Navigation Model

### Breadcrumb Back Stack

The detail pane maintains a shallow navigation stack (max ~3 levels):

```
Workspace Summary
  → CL 4521
    → engine.cpp
      → #42 (revision detail)
```

- The `←` back arrow and Escape pop one level.
- Clicking in either side column resets the stack to depth 1 (the selected item).
- Breadcrumb segments are clickable for direct jumps.

### Selection Priority

When both columns could drive the detail pane, the rule is simple: **last click wins**. If you click a file in the tree, the detail pane shows that file. If you then click a CL on the right, it shows the CL. The previously selected item in the other column stays visually highlighted (dimmed) so you can return to it.

## Filtered State Visual Treatment

When search is active, both side columns need to clearly communicate they're showing a subset:

- **Column header badge**: Small pill showing `12 files` or `2 CLs` next to the column title.
- **Background tint**: A very subtle color shift (e.g., slightly lighter background) on the filtered column content area.
- Both indicators disappear when the search is cleared.

The goal is to prevent confusion ("where did all my files go?") without being visually noisy.

## What This Replaces

### Removed Components
- **FileHistoryDialog** — history is now inline in the file detail view
- **SearchResultsPanel** (slide-out) — search now filters columns in place

### Modified Components
- **MainLayout** — three-column layout with center detail pane
- **FileTree** — gains search filtering capability, stays in left column
- **ChangelistPanel** — moves to right column, gains search filtering, CL header click emits selection event
- **SearchBar** — stays in toolbar, drives column filtering instead of opening a panel

### New Components
- **DetailPane** — center column, renders the appropriate view based on selection state
- **FileDetailView** — file info, actions, inline history
- **ChangelistDetailView** — CL info, actions, file list, shelved files
- **RevisionDetailView** — revision info, diff actions, sibling files
- **WorkspaceSummaryView** — dashboard shown when nothing selected
- **DetailBreadcrumb** — navigation breadcrumb at top of detail pane

## Implementation Considerations

- The detail pane views should lazy-load data. File history is only fetched when a file is selected, not preloaded for every file.
- The file tree filtering should remain client-side for instant response — the prefetched cache from the current search implementation can be reused.
- CL column filtering should also be client-side against the already-loaded changelist data.
- The breadcrumb stack is UI-only state (useState or a small zustand slice) — no need for router-style URL tracking.
- Drag-and-drop between CLs in the right column continues to work as it does today.
- Column resize handles use the same pattern as the current sidebar resizer.

## Interaction Flows

**"I want to submit my changes"**
1. Click a CL header in the right column
2. Detail pane shows CL files, description, actions
3. Review files, click [Submit]

**"I want to see who changed a file and why"**
1. Click file in tree
2. History is right there in the detail pane
3. Click a revision row to see the full submit details

**"I want to find a file"**
1. Type in the toolbar search
2. Tree filters instantly, CL column filters too
3. Click the file in the tree, detail pane shows it
4. Clear search, tree restores

**"I want to move files between changelists"**
1. Drag from tree or from one CL to another (existing behavior)
2. Or: click file, use context menu "Move to Changelist"

**"I want to diff a specific revision"**
1. Click file in tree → see history
2. Click revision row → see revision detail with diff actions
3. Click [Diff vs Previous] → external diff tool launches
