---
created: 2026-02-02
title: Unify UI update mechanism (query invalidation vs Tauri events)
area: frontend
files:
  - src/hooks/useP4Events.ts
  - src/hooks/useFileOperations.ts
  - src-tauri/src/commands/p4.rs
priority: backlog
source: architecture-report
---

Two mechanisms exist for "data changed, update UI": query invalidation and Tauri event listeners (file-status-changed, changelist-updated, etc.). Pick query invalidation as single source of truth. Remove Tauri event listeners for state updates. Needs careful audit — some events may serve purposes beyond just UI refresh.
