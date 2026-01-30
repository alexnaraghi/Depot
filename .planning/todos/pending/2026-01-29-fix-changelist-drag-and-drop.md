---
created: 2026-01-29
title: Fix changelist drag and drop
area: ui
files:
  - src/components/ChangelistPanel/ChangelistPanel.tsx
  - src/components/ChangelistPanel/ChangelistNode.tsx
  - node_modules/react-arborist/dist/module/dnd/drag-hook.js
  - node_modules/react-arborist/dist/module/components/row-container.js
  - node_modules/react-arborist/dist/module/components/provider.js
---

## Problem

Drag and drop of files between changelists does not work — the drag visually does not initiate (no drag ghost appears, no drop targets highlight). The `cursor-grab` or `draggable` attribute appears set but dragging has no visible effect.

## Investigation (2026-01-29)

### What was confirmed working

1. **`isDraggable: true`** — react-arborist's `disableDrag` callback correctly marks file nodes as draggable
2. **`dragHandle` ref fires** — The ref callback from react-arborist IS called with DOM elements
3. **`draggable="true"` gets set** — After react-dnd connects, the HTML attribute is present on all 5 file rows
4. **`mouseDown` fires** — Pointer events reach the file row div
5. **`native onDragStart` fires** — The HTML5 `dragstart` event DOES fire on the element
6. **`handleMove` logic is correct** — The depot path parsing and `invokeP4Reopen` call are properly wired

### Root cause identified

**react-arborist's internal DnD state dispatch causes a re-render that kills the active drag.**

The sequence:
1. User initiates drag → HTML5 `dragstart` fires → react-dnd's HTML5Backend handles it
2. react-arborist's `useDragHook` `item()` callback dispatches `dnd.dragStart()` to its Redux store
3. This state change causes ALL `RowContainer` components to re-render (via `useNodesContext()` which subscribes to `state.nodes` — and `state.nodes.drag` is updated by the drag action)
4. Re-render creates new `useDrag` hook instances → new `dragRef` functions
5. React calls the OLD ref with `null` (cleanup) → react-dnd disconnects the drag source → removes `draggable` attribute and `dragstart` listener
6. React calls the NEW ref with the element → reconnects → but the native HTML5 drag operation is already dead

**Evidence from logs:** Immediately after `onDragStart` fires, ALL file row refs are called with `el: false` (unmount/cleanup), then re-called with `el: true` (remount). The `dragHandleType` briefly becomes `'undefined'` during this cycle.

### What was tried (and reverted)

1. **Shared DndProvider wrapper** — Wrapped MainLayout in a single `DndProvider` + custom `DndContext`, passed `dndManager` to both Trees. **Did not fix it** — the global singleton pattern in react-dnd already handles multiple providers. The issue is react-arborist's internal re-render, not duplicate backends.

2. **Native HTML5 DnD bypass** — Disabled react-arborist's DnD entirely (`disableDrag={true}`, `disableDrop={true}`), added native `draggable`, `onDragStart`, `onDragOver`, `onDrop` handlers directly to the ChangelistNode component. File rows set depot paths via custom MIME type, changelist headers accept drops. **Did not fix it** — drag still did not visually initiate, suggesting the issue may be at the Tauri webview level rather than react-dnd.

### Remaining hypotheses (untested)

1. **Tauri webview blocks HTML5 drag** — The Tauri v2 webview (WRY/WebView2 on Windows) may intercept or suppress native HTML5 drag-and-drop events. Tauri has a `drag_drop_event` system for file drops from the OS; this may conflict with in-page DnD. Test: try a minimal `<div draggable>` in the app to confirm native drag works at all.

2. **CSS `user-select` or `pointer-events` interference** — Some parent element may have styles that prevent drag initiation. Test: inspect computed styles on the file row div in DevTools.

3. **React 19 ref callback incompatibility** — react-dnd v14 was built for React 16-18. React 19 changed callback ref semantics (cleanup return values). While `ConnectDragSource` returns the DOM node (not a function), there may be subtle breakage. Test: downgrade to React 18 temporarily.

4. **Replace react-arborist entirely for the changelist panel** — Since react-arborist's DnD is fundamentally broken by its re-render cycle, consider using a simpler non-virtualized list for changelists (typically <100 items) with native HTML5 DnD, completely outside react-arborist.

## Solution

TBD — start with hypothesis #1 (confirm Tauri webview supports in-page HTML5 DnD) before attempting further fixes.
