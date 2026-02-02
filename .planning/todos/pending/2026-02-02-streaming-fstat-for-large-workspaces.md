---
created: 2026-02-02
title: Streaming fstat for large workspaces
area: backend
files:
  - src-tauri/src/commands/p4.rs
priority: backlog
source: architecture-report
---

p4_fstat buffers entire stdout via cmd.output() before parsing. At 100K+ files this holds data 3x in memory. Apply the same Channel-based streaming pattern used by p4_sync — parse and send records incrementally. Only matters at scale; no user reports yet.
