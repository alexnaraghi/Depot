# Phase 2: Core Workflows - Research

**Researched:** 2026-01-27
**Domain:** React tree view UI with file system operations, drag-and-drop, and real-time state management
**Confidence:** MEDIUM

## Summary

Phase 2 implements core Perforce workflows: file tree view, changelist management with drag-and-drop, sync operations, and file status tracking. The research investigated React tree view libraries, drag-and-drop solutions, virtualization strategies, and state management patterns for real-time updates from Tauri backend.

**Standard approach:** Use react-arborist (complete tree component with built-in virtualization and drag-and-drop) combined with shadcn/ui components for dialogs and UI primitives. State management should use Zustand (already in project) with Tauri event listeners for real-time file status updates from backend operations.

**Key architectural decision:** react-arborist provides the complete solution for tree view + drag-and-drop + virtualization in a single well-maintained package (3.4.3, Feb 2025), eliminating the need to integrate separate libraries for each concern.

**Primary recommendation:** Use react-arborist for file tree and changelist tree views; leverage existing shadcn/ui AlertDialog for conflict resolution; use Zustand stores with Tauri event subscriptions for reactive state updates.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-arborist | 3.4.3 | Complete tree view component | Built-in drag-and-drop, virtualization, keyboard nav, ARIA, inline editing - purpose-built for VS Code-like file explorers |
| shadcn/ui | (current) | UI primitives (AlertDialog, etc.) | Already in project from Phase 1; Radix UI foundation with accessibility, TypeScript, Tailwind styling |
| Zustand | 5.0.10 | State management | Already in project; lightweight, works well with Tauri event system for real-time updates |
| lucide-react | 0.563.0 | Icons (file types, status badges) | Already in project; 1000+ icons including file/folder types |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-vscode-icons | latest | VS Code file type icons | If lucide-react lacks specific file type icons; provides dedicated VS Code icon set |
| @tanstack/react-query | 5.90.20 | Server state caching | Already in project; use for p4 command results caching to avoid redundant backend calls |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-arborist | dnd-kit + react-window + custom tree | More control but 3x the complexity; need to implement tree logic, drag preview, drop zones, collision detection manually |
| react-arborist | MUI X TreeView + dnd-kit | MUI requires Material Design styling (conflicts with Tailwind); heavier bundle; less flexible |
| Zustand | Redux Toolkit | RTK is heavier; more boilerplate; Zustand simpler for this use case (no middleware needed) |

**Installation:**
```bash
npm install react-arborist
npm install react-vscode-icons  # optional if lucide-react insufficient
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── FileTree/           # File/workspace tree view
│   │   ├── FileTree.tsx         # react-arborist wrapper
│   │   ├── FileNode.tsx         # Custom node renderer
│   │   └── useFileTree.ts       # Tree data logic
│   ├── ChangelistPanel/    # Sidebar changelist management
│   │   ├── ChangelistPanel.tsx
│   │   ├── ChangelistTree.tsx   # react-arborist for CL tree
│   │   └── ChangelistNode.tsx
│   ├── dialogs/            # Conflict/confirmation dialogs
│   │   └── SyncConflictDialog.tsx
│   └── ui/                 # shadcn/ui components (existing)
├── stores/                 # Zustand state stores
│   ├── fileTreeStore.ts         # File tree state
│   ├── changelistStore.ts       # Changelist state
│   └── syncStore.ts             # Sync operation state
├── hooks/
│   ├── useP4Command.ts          # Existing
│   ├── useP4Events.ts           # Tauri event subscriptions
│   └── useFileStatus.ts         # File status updates
└── types/
    ├── p4.ts                    # Perforce types (File, Changelist, etc.)
    └── tree.ts                  # Tree node types
```

### Pattern 1: Tree View with File Status Icons
**What:** react-arborist Tree component with custom Node renderer showing file status badges
**When to use:** File tree and changelist tree views
**Example:**
```typescript
// Source: https://github.com/brimdata/react-arborist (official docs)
import { Tree } from 'react-arborist';

interface FileData {
  id: string;
  name: string;
  status: 'synced' | 'checkedOut' | 'added' | 'deleted' | 'modified';
  revision: number;
  children?: FileData[];
}

function FileTree({ data }: { data: FileData[] }) {
  return (
    <Tree
      data={data}
      width="100%"
      height={600}
      indent={24}
      rowHeight={32}
      // Drag-and-drop built-in
      onMove={(nodes, parent) => {
        // Handle moving files between changelists
      }}
    >
      {({ node, style, dragHandle }) => (
        <div style={style} ref={dragHandle} className="flex items-center gap-2">
          {/* File type icon */}
          <FileIcon fileName={node.data.name} />
          {/* Status badge */}
          <StatusBadge status={node.data.status} />
          {/* File name */}
          <span>{node.data.name}</span>
          {/* Revision */}
          <span className="text-xs text-slate-500">#{node.data.revision}</span>
        </div>
      )}
    </Tree>
  );
}
```

### Pattern 2: Zustand Store with Tauri Event Listeners
**What:** Zustand store subscribing to Tauri backend events for real-time file status updates
**When to use:** Any state that changes based on backend operations (file status, sync progress, etc.)
**Example:**
```typescript
// Source: https://github.com/robosushie/tauri-global-state-management
import { create } from 'zustand';
import { listen } from '@tauri-apps/api/event';

interface FileTreeState {
  files: Map<string, FileData>;
  updateFileStatus: (path: string, status: string) => void;
  initialize: () => void;
}

export const useFileTreeStore = create<FileTreeState>((set) => ({
  files: new Map(),
  updateFileStatus: (path, status) =>
    set((state) => {
      const newFiles = new Map(state.files);
      const file = newFiles.get(path);
      if (file) {
        newFiles.set(path, { ...file, status });
      }
      return { files: newFiles };
    }),
  initialize: () => {
    // Subscribe to backend file status events
    listen('file-status-changed', (event) => {
      const { path, status } = event.payload as { path: string; status: string };
      useFileTreeStore.getState().updateFileStatus(path, status);
    });
  },
}));
```

### Pattern 3: Context Menu with React Hook
**What:** Custom useContextMenu hook for right-click menus on tree nodes
**When to use:** File operations menu (checkout, revert, sync folder, etc.)
**Example:**
```typescript
// Source: https://www.perpetualny.com/blog/create-a-custom-context-menu-hook-in-react
function useContextMenu() {
  const [clicked, setClicked] = useState(false);
  const [points, setPoints] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleClick = () => setClicked(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return {
    clicked,
    setClicked,
    points,
    setPoints,
  };
}

// Usage in FileNode component
function FileNode({ node }) {
  const { clicked, setClicked, points, setPoints } = useContextMenu();

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setClicked(true);
    setPoints({ x: e.pageX, y: e.pageY });
  };

  return (
    <>
      <div onContextMenu={handleContextMenu}>
        {node.data.name}
      </div>
      {clicked && (
        <ContextMenu x={points.x} y={points.y}>
          <MenuItem onClick={() => checkoutFile(node.data.path)}>
            Checkout for Edit
          </MenuItem>
          <MenuItem onClick={() => revertFile(node.data.path)}>
            Revert
          </MenuItem>
        </ContextMenu>
      )}
    </>
  );
}
```

### Pattern 4: Sync Conflict Dialog with shadcn/ui AlertDialog
**What:** AlertDialog prompting user decision when sync detects local changes
**When to use:** When p4 sync encounters files open for edit or modified locally
**Example:**
```typescript
// Source: https://ui.shadcn.com/docs/components/alert-dialog
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function SyncConflictDialog({ open, file, onResolve }) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sync Conflict Detected</AlertDialogTitle>
          <AlertDialogDescription>
            File "{file}" has local changes. Syncing will overwrite your edits.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onResolve('skip')}>
            Skip This File
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => onResolve('overwrite')}>
            Overwrite Local Changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### Anti-Patterns to Avoid
- **Optimistic UI updates for file status:** User context says "Wait for server confirmation before updating UI" - do NOT update file status until p4 command completes. This prevents showing incorrect state if command fails.
- **Rendering entire file tree without virtualization:** With 1000+ files, non-virtualized trees freeze the UI. react-arborist handles this automatically but you must use it.
- **Separate tree + drag-and-drop libraries:** Don't use react-window + dnd-kit separately when react-arborist provides integrated solution. Integration bugs (drag preview position, drop zone detection) are common.
- **Manual tree node recursion:** Let react-arborist handle tree traversal and rendering. Custom recursion leads to performance issues and stack overflow with deep trees.
- **Redux for simple local state:** User already chose Zustand (in package.json). Don't introduce Redux; it's heavier and unnecessary for this use case.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree view with expand/collapse | Custom recursive component | react-arborist | Handles keyboard navigation, focus management, ARIA attributes, virtualization, selection state - easy to get wrong |
| Drag-and-drop between trees | Custom drag event handlers | react-arborist's built-in onMove | Collision detection, drop preview, drag ghost, touch support, accessibility - complex browser API quirks |
| Virtualizing large lists | Custom windowing logic | react-arborist (built-in) or react-window | Dynamic height calculation, scroll position sync, buffer zones - performance pitfalls everywhere |
| File type icons | Custom icon mapping | lucide-react + react-vscode-icons | 1000+ file types with proper extensions; maintaining icon set is ongoing work |
| Context menu positioning | Manual position calculation | useContextMenu hook pattern | Viewport boundary detection, menu overflow, cleanup listeners - subtle edge cases |
| File status polling | setInterval to check status | Tauri event listeners | Polling wastes CPU; events are real-time; backend controls timing; avoid race conditions |

**Key insight:** Tree views and drag-and-drop are deceptively complex. What looks like "just recursion and mouse events" involves accessibility, keyboard navigation, screen readers, touch devices, scroll synchronization, focus management, and performance optimization. react-arborist is purpose-built for this exact use case (file explorer UIs) and maintained by active team.

## Common Pitfalls

### Pitfall 1: Performance Degradation with Large File Trees
**What goes wrong:** Rendering 5000+ files causes browser freeze, stack overflow, or "page unresponsive" errors. Expanding/collapsing nodes has 1-2 second delay.
**Why it happens:** Without virtualization, React renders all DOM nodes even if not visible. Tree depth causes excessive recursion in custom components.
**How to avoid:** Use react-arborist which has built-in virtualization. Do NOT implement custom tree recursion. Enable lazy loading for extremely deep trees (load children when parent expands).
**Warning signs:** UI lag when scrolling tree; DevTools shows 10,000+ DOM nodes; high memory usage in browser task manager.

### Pitfall 2: Stale File Status After Backend Operations
**What goes wrong:** User checks out file but tree still shows "synced" icon. Or sync completes but files don't update until manual refresh.
**Why it happens:** Frontend doesn't know backend operation completed. No event subscription to file status changes.
**How to avoid:** Emit Tauri events from backend after p4 operations complete. Subscribe to events in Zustand store initialization. Update tree data when event received.
**Warning signs:** Users reporting "I have to refresh to see changes"; file status icons don't match p4 fstat output.

### Pitfall 3: Drag-and-Drop State Corruption
**What goes wrong:** Dragging file to changelist shows it in both changelists. Or drag succeeds visually but backend rejects the move.
**Why it happens:** Optimistic update moves file in UI before backend confirms. Backend operation fails but UI not rolled back.
**How to avoid:** Per user context: "Wait for server confirmation before updating UI." Only update tree after p4 reopen command succeeds. Show loading state during operation.
**Warning signs:** Files appearing in multiple changelists; changelists showing wrong file counts; backend logs show "file already in changelist" errors.

### Pitfall 4: Context Menu Memory Leaks
**What goes wrong:** After opening/closing context menu 50+ times, app becomes sluggish. Memory usage steadily increases.
**Why it happens:** Event listeners added to document in useEffect without cleanup. Each mount adds new listener without removing old one.
**How to avoid:** Always return cleanup function from useEffect. Remove event listeners on unmount. Use ref to track mounted state.
**Warning signs:** Performance degrades over time in long sessions; DevTools shows increasing listener counts; memory doesn't release.

### Pitfall 5: Tree Re-renders on Unrelated State Changes
**What goes wrong:** Typing in sync progress text causes entire 5000-node tree to re-render. UI freezes during fast updates.
**Why it happens:** Tree data and operation state in same Zustand store. Every state change triggers tree re-render even if tree data unchanged.
**How to avoid:** Separate stores for tree data vs operation state (sync progress, running commands, etc.). Use Zustand's shallow comparison for selectors. Memoize tree node components with React.memo.
**Warning signs:** DevTools Profiler shows tree re-rendering on every keystroke; high CPU during sync with frequent updates.

## Code Examples

Verified patterns from official sources:

### Example 1: Basic File Tree with react-arborist
```typescript
// Source: https://github.com/brimdata/react-arborist
import { Tree } from 'react-arborist';
import { File, Folder } from 'lucide-react';

interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
}

function FileTree({ data }: { data: FileTreeNode[] }) {
  return (
    <Tree
      data={data}
      width="100%"
      height={600}
      indent={24}
      rowHeight={28}
    >
      {({ node, style, dragHandle }) => (
        <div
          style={style}
          ref={dragHandle}
          className="flex items-center gap-2 px-2 hover:bg-slate-800"
        >
          {node.data.type === 'folder' ? (
            <Folder className="w-4 h-4 text-blue-400" />
          ) : (
            <File className="w-4 h-4 text-slate-400" />
          )}
          <span className="text-sm">{node.data.name}</span>
        </div>
      )}
    </Tree>
  );
}
```

### Example 2: Changelist Drag-and-Drop
```typescript
// Source: https://github.com/brimdata/react-arborist (onMove callback)
import { Tree } from 'react-arborist';
import { useP4Command } from '@/hooks/useP4Command';

function ChangelistTree({ changelists }: { changelists: Changelist[] }) {
  const { execute } = useP4Command();

  const handleMove = async (draggedNodes, parentNode) => {
    // Extract file paths from dragged nodes
    const filePaths = draggedNodes.map(n => n.data.path);

    // Target changelist ID
    const targetChangelistId = parentNode?.data.changelistId || 'default';

    try {
      // Move files to changelist via p4 reopen
      await execute('reopen', ['-c', targetChangelistId, ...filePaths]);

      // Backend will emit event to update state
      // Don't update UI optimistically per user context
    } catch (error) {
      console.error('Failed to move files:', error);
      // Tree will stay in original state (no optimistic update)
    }
  };

  return (
    <Tree
      data={changelists}
      onMove={handleMove}
      // ... other props
    >
      {/* Node renderer */}
    </Tree>
  );
}
```

### Example 3: Zustand Store with Event Subscription
```typescript
// Source: https://github.com/robosushie/tauri-global-state-management
import { create } from 'zustand';
import { listen } from '@tauri-apps/api/event';

interface FileStatusEvent {
  path: string;
  status: 'synced' | 'checkedOut' | 'added' | 'deleted' | 'modified';
  revision: number;
}

interface FileTreeState {
  files: Map<string, FileStatusEvent>;
  updateFile: (file: FileStatusEvent) => void;
}

export const useFileTreeStore = create<FileTreeState>((set) => ({
  files: new Map(),

  updateFile: (file) =>
    set((state) => {
      const newFiles = new Map(state.files);
      newFiles.set(file.path, file);
      return { files: newFiles };
    }),
}));

// Initialize event listeners on app mount
export function initializeFileTreeEvents() {
  listen<FileStatusEvent>('file-status-changed', (event) => {
    useFileTreeStore.getState().updateFile(event.payload);
  });
}
```

### Example 4: Context Menu with Cleanup
```typescript
// Source: https://www.perpetualny.com/blog/create-a-custom-context-menu-hook-in-react
import { useState, useEffect } from 'react';

function useContextMenu() {
  const [clicked, setClicked] = useState(false);
  const [points, setPoints] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleClick = () => setClicked(false);
    const handleScroll = () => setClicked(false);

    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', handleScroll);

    // CRITICAL: Cleanup to prevent memory leaks
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return { clicked, setClicked, points, setPoints };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | Pragmatic DnD or dnd-kit | 2024 | react-beautiful-dnd archived; Atlassian moved to Pragmatic DnD (framework-agnostic); dnd-kit remains best React-specific option |
| react-virtualized | react-window or react-virtuoso | 2020 | react-window is lighter rewrite by same author; react-virtuoso better for dynamic heights |
| Custom tree recursion | react-arborist or dedicated tree libs | 2023-2025 | Integrated solutions handle accessibility, performance, drag-drop; custom approaches miss edge cases |
| Redux for all state | Zustand/Jotai for client state + React Query for server state | 2023-2025 | Lighter alternatives; Redux overkill for simple client state; React Query better for server cache |

**Deprecated/outdated:**
- **react-beautiful-dnd:** Project archived November 2024; use Pragmatic DnD or dnd-kit instead
- **react-virtualized:** Superseded by react-window (same author, smaller bundle); use react-window or react-virtuoso
- **Redux Toolkit for simple local UI state:** Still valid for complex apps but Zustand simpler for this use case (no middleware, less boilerplate)

## Open Questions

Things that couldn't be fully resolved:

1. **Perforce file status icon mappings**
   - What we know: P4V uses red badges for user actions (checkout, add, delete), blue for other users. Official docs at https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/using.icons.html have complete reference.
   - What's unclear: Exact color palette and icon shapes for each status. Need to fetch official P4V docs or define custom palette.
   - Recommendation: Use official P4V icon semantics (red=local actions, blue=others, green=synced) but implement with lucide-react icons. Define status-to-color mapping in constants file. Verify with manual p4 fstat testing.

2. **Tree virtualization threshold**
   - What we know: react-arborist has built-in virtualization; performance issues start around 1000-5000 nodes depending on browser.
   - What's unclear: Whether to lazy-load folder children (only fetch when expanded) or load entire workspace upfront.
   - Recommendation: Start with loading entire workspace (simpler). If workspace has 10,000+ files, add lazy loading in later optimization. User context specifies "Show all workspace files (full tree)" so full load is acceptable.

3. **Drag-and-drop visual feedback customization**
   - What we know: react-arborist provides drag preview and cursor components for customization.
   - What's unclear: Default behavior may be sufficient or may need custom styling to match app theme.
   - Recommendation: Test default drag preview first. If visual style doesn't match dark Tailwind theme, customize using Tree component's dragPreviewRender prop.

4. **Multi-file selection and operations**
   - What we know: react-arborist supports multi-selection. User context doesn't explicitly require it but file operations (checkout, revert) are typically batched.
   - What's unclear: Whether to implement multi-select in initial tasks or defer to enhancement.
   - Recommendation: Include basic multi-select (Ctrl+click, Shift+click) in tree setup since react-arborist provides it free. Context menu operations should handle array of selected files, not just single file.

## Sources

### Primary (HIGH confidence)
- react-arborist GitHub: https://github.com/brimdata/react-arborist - Official repo, version 3.4.3, features, examples
- dnd-kit docs: https://docs.dndkit.com - Installation, API, accessibility features
- shadcn/ui AlertDialog docs: https://ui.shadcn.com/docs/components/alert-dialog - Official component docs, usage examples
- Perforce P4V icons: https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/using.icons.html - Official file status icon reference
- Perforce changelists: https://legacy-docs.perforce.com/doc.051/manuals/p4guide/07_changelists.html - Official changelist workflow docs

### Secondary (MEDIUM confidence)
- Tauri state management with Zustand: https://github.com/robosushie/tauri-global-state-management - Community example of global state pattern
- DEV Community react-arborist tutorial (Jan 2026): https://dev.to/blockpathdev/building-tree-views-with-react-arborist-in-react-53cn - Recent walkthrough
- LogRocket react-arborist guide: https://blog.logrocket.com/using-react-arborist-create-tree-components/ - Comprehensive tutorial with examples
- Context menu hook pattern: https://www.perpetualny.com/blog/create-a-custom-context-menu-hook-in-react - Verified React pattern

### Tertiary (LOW confidence)
- ReactScript "Best Tree View Components" roundup: https://reactscript.com/best-tree-view/ - Community rankings, not authoritative
- Medium article on React tree performance: https://medium.com/@fiffty/things-i-learned-while-trying-to-make-a-fast-treeview-in-react-e3b23cd4ab74 - Anecdotal experience, useful insights but not official
- WebSearch results on drag-and-drop library comparisons - Multiple sources agree on dnd-kit and Pragmatic DnD as current leaders

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-arborist official docs confirm all features; version verified; package.json shows existing dependencies
- Architecture: MEDIUM - Patterns are well-established (Zustand + events, context menu hooks) but not verified in Tauri context specifically
- Pitfalls: MEDIUM - Performance issues and memory leaks are documented in multiple sources but severity depends on workspace size

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days) - Tree view libraries are mature and stable; drag-and-drop ecosystem stabilized after react-beautiful-dnd deprecation
