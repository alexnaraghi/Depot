---
phase: 14-depot-browser
plan: 02
subsystem: ui
status: complete
completed: 2026-02-01

requires:
  - phases/14-depot-browser/14-01

provides:
  - DepotBrowser component with virtualized lazy-loading tree
  - Accordion left column layout with Workspace Files and Depot sections
  - localStorage persistence for accordion state

affects:
  - phases/14-depot-browser/14-03 (will add context menus and detail pane integration)

tech-stack:
  added: []
  patterns:
    - react-arborist virtualized tree for depot browsing
    - Radix Collapsible for accordion sections
    - ResizeObserver for dynamic container height measurement
    - localStorage for UI state persistence

key-files:
  created:
    - src/components/DepotBrowser/useDepotTree.ts
    - src/components/DepotBrowser/DepotNode.tsx
    - src/components/DepotBrowser/DepotBrowser.tsx
    - .planning/phases/14-depot-browser/14-02-SUMMARY.md
  modified:
    - src/components/MainLayout.tsx

decisions:
  - id: accordion-persistence
    what: "Store accordion section open/closed state in localStorage"
    why: "Users expect UI state to persist across sessions"
    alternatives: ["Session storage", "No persistence"]
    impact: "Accordion state survives app restarts, better UX"

  - id: lazy-loading-on-toggle
    what: "Load depot subdirectories only when user expands folder"
    why: "Prevents memory exhaustion with large depot hierarchies"
    alternatives: ["Load entire tree upfront", "Load first N levels"]
    impact: "Fast initial load, scales to massive depots"

  - id: local-tree-state
    what: "Use local useState for tree data instead of TanStack Query cache"
    why: "Tree structure requires incremental updates as folders expand, query cache is better for flat data"
    alternatives: ["Nested query keys per folder", "Single query with full tree"]
    impact: "Simpler state updates, query cache used only for directory listings"

  - id: both-sections-open-default
    what: "Both Workspace Files and Depot sections default to open"
    why: "Users likely want to see both simultaneously, matching VS Code/GitKraken patterns"
    alternatives: ["Only workspace open", "Only depot open"]
    impact: "Left column taller when both open, users control via collapse"

metrics:
  duration: 4 min
  commits: 2
  files_modified: 4
  lines_added: 362

tags: [ui, depot-browser, accordion, lazy-loading, react-arborist, collapsible]
---

# Phase 14 Plan 02: Depot Browser UI with Accordion Layout

**One-liner:** Virtualized depot tree with lazy-loading subdirectories in collapsible accordion left column

## Objective

Build the depot browser UI component with lazy-loaded subdirectories and restructure the left column into accordion sections for Workspace Files and Depot.

## What Was Built

### useDepotTree Hook (useDepotTree.ts)

Custom hook for managing depot tree data with lazy loading:

**Features:**
- Fetches depot roots on mount via `invokeP4Depots()`
- Transforms depot roots into `DepotNodeData[]` with `children: null`
- Provides `loadChildren(depotPath)` async function for lazy-loading subdirectories
- Uses TanStack Query with `queryKey: ['depot', 'roots']` and 5-minute `staleTime`
- Tracks loading state per node in `Set<string>` (loadingPaths)
- Local state management for tree data to support incremental updates
- Enabled only when connection status is 'connected'

**Data model:**
```typescript
export interface DepotNodeData {
  id: string;           // Depot path (e.g., "//depot/projects")
  name: string;         // Display name (last path segment)
  isFolder: boolean;    // Always true for dirs
  children: DepotNodeData[] | null;  // null = not loaded, [] = empty
}
```

**Returns:** `{ treeData, isLoading, error, loadChildren, loadingPaths }`

### DepotNode Component (DepotNode.tsx)

Tree node renderer for react-arborist:

**Features:**
- Accepts `NodeRendererProps<DepotNodeData>` and `loadingPaths: Set<string>`
- Displays folder icon (Folder/FolderOpen from lucide-react)
- Shows spinner (Loader2 with animate-spin) when loading
- Click handler toggles expand/collapse via `node.toggle()`
- Selected state: subtle highlight background (bg-blue-900/50)
- Matches FileNode.tsx styling (padding, font size, hover states)
- Proper indentation via `style.paddingLeft`

### DepotBrowser Component (DepotBrowser.tsx)

Main depot browser component with react-arborist tree:

**Features:**
- Uses `useDepotTree()` hook for data
- Virtualized rendering with react-arborist `<Tree>`
- Container height measured via ResizeObserver
- `rowHeight={28}` matching FileTree
- `onToggle` handler triggers `loadChildren()` when expanding folders with `children === null`
- Loading state: skeleton placeholders (5 animated items)
- Error state: red error message with icon, no retry button
- Empty state: "No depots found" message
- Does NOT apply search filter (per 14-CONTEXT.md)

**Configuration:**
- `indent={16}`, `overscanCount={10}`
- `disableDrag`, `disableDrop`, `disableEdit` (same as FileTree)
- Uses shared `dndManager` from context

### MainLayout Accordion Restructure (MainLayout.tsx)

Left column converted to accordion sections:

**Added imports:**
- `DepotBrowser` from `@/components/DepotBrowser/DepotBrowser`
- `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `@/components/ui/collapsible`
- `ChevronDown` from lucide-react
- `cn` from `@/lib/utils`

**Accordion state management:**
```typescript
const [workspaceOpen, setWorkspaceOpen] = useState(() => {
  const saved = localStorage.getItem('accordion-workspace');
  return saved !== null ? saved === 'true' : true;
});

const [depotOpen, setDepotOpen] = useState(() => {
  const saved = localStorage.getItem('accordion-depot');
  return saved !== null ? saved === 'true' : true;
});

useEffect(() => {
  localStorage.setItem('accordion-workspace', String(workspaceOpen));
}, [workspaceOpen]);

useEffect(() => {
  localStorage.setItem('accordion-depot', String(depotOpen));
}, [depotOpen]);
```

**Layout structure:**
```tsx
<div className="flex flex-col overflow-hidden">
  {/* Workspace Files Section */}
  <Collapsible open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
    <CollapsibleTrigger>
      Workspace Files
      <ChevronDown className={cn("transition-transform", workspaceOpen && "rotate-180")} />
    </CollapsibleTrigger>
    <CollapsibleContent className="flex-1 min-h-0 overflow-hidden">
      <FileTree />
    </CollapsibleContent>
  </Collapsible>

  {/* Depot Section */}
  <Collapsible open={depotOpen} onOpenChange={setDepotOpen}>
    <CollapsibleTrigger className="border-t border-border">
      Depot
      <ChevronDown className={cn("transition-transform", depotOpen && "rotate-180")} />
    </CollapsibleTrigger>
    <CollapsibleContent className="flex-1 min-h-0 overflow-hidden">
      <DepotBrowser />
    </CollapsibleContent>
  </Collapsible>
</div>
```

**Styling:**
- Trigger: uppercase text, muted-foreground color, hover:bg-accent/50
- ChevronDown rotates 180deg when section is open
- Depot trigger has border-top separator
- Both sections use flex-1 to share available height

## Implementation Details

### Lazy Loading Flow

1. **Initial load:** `useDepotTree()` fetches depot roots, sets `children: null`
2. **User expands folder:** DepotBrowser's `onToggle` handler called with nodeId
3. **Check if loaded:** Find node in tree, check if `children === null`
4. **Load if needed:** Call `loadChildren(nodeId)` which:
   - Adds nodeId to loadingPaths Set
   - Calls `invokeP4Dirs(nodeId + "/*")`
   - Maps results to DepotNodeData with `children: null`
   - Updates tree data by finding parent node and setting its children
   - Removes nodeId from loadingPaths Set
5. **Display:** DepotNode shows spinner while loading, then shows children

### Error Handling

- Empty results from `invokeP4Dirs()` → empty children array (no error)
- Network errors → logged to console, empty children array set, user can retry by collapsing/expanding
- Depot roots query error → error state UI with message display

### Height Management

Both FileTree and DepotBrowser measure their container height via ResizeObserver:
- Initial measurement on mount
- Updates on window resize
- Observers disconnected on unmount
- Height passed to react-arborist Tree component for virtualization

## Verification Results

1. **TypeScript compilation:** `npx tsc --noEmit` passed without errors
2. **Left column structure:** Both "Workspace Files" and "Depot" headers render
3. **Collapsible state:** Both sections independently collapse/expand
4. **Persistence:** Accordion state survives page reload via localStorage

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

### Phase 14-03: Context Menus and Detail Pane Integration

**Ready:** Depot tree renders and supports lazy-loading.

**Provides:**
- DepotBrowser component ready for context menu integration
- DepotNode component ready for click handling
- Tree data structure supports file metadata addition

**Note:** Next plan will add right-click context menus and clicking depot items to show file info in detail pane.

### Technical Debt

None introduced.

### Blockers Resolved

None - this plan followed 14-01 smoothly.

## Session Notes

**Execution pattern:** Fully autonomous (no checkpoints)

**Task breakdown:**
1. Task 1: Create useDepotTree hook and DepotNode renderer (2 min)
2. Task 2: Create DepotBrowser and restructure left column with accordion (2 min)

**Smooth areas:**
- Followed FileTree patterns exactly for consistency
- Accordion integration straightforward with Radix Collapsible
- Lazy loading pattern worked first try
- No refactoring needed

**Learning:**
- ResizeObserver better than window resize listener for nested containers
- Local state for tree data simpler than nested query keys
- CollapsibleContent needs flex-1 min-h-0 to prevent layout overflow

## Commits

1. `932dd93` - feat(14-02): add useDepotTree hook and DepotNode renderer
2. `5ddf3d4` - feat(14-02): add DepotBrowser with accordion left column layout
