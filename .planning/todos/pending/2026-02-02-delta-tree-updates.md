---
created: 2026-02-02
title: Delta tree updates instead of full reconstruction
area: frontend
files:
  - src/utils/treeBuilder.ts
  - src/stores/fileTreeStore.ts
priority: backlog
source: architecture-report
---

buildFileTree() reconstructs entire tree from scratch on any change. updateFile() clones entire Map via `new Map(currentFiles)`. At 10K+ files with rapid updates (e.g. syncing 500 files), this creates significant GC pressure. Update single nodes in-place instead of rebuilding. Biggest potential performance win available.
