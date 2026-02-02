---
created: 2026-02-02
title: Replace window event bus with Zustand command store
area: frontend
files:
  - src/components/MainLayout.tsx
  - src/components/CommandPalette.tsx
  - src/components/FileTree.tsx
  - src/components/ChangelistPanel.tsx
  - src/components/SyncToolbar.tsx
  - src/components/ConnectionStatus.tsx
  - src/components/SearchBar.tsx
priority: now
source: architecture-report
---

Replace 11 custom `window.dispatchEvent(new CustomEvent('p4now:...'))` events with a typed Zustand command store. Current events are untyped strings with no discoverability — renaming one silently breaks listeners. A `useCommandStore` with a `pendingCommand` field gives type safety, debuggability, and no string matching.
