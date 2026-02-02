---
created: 2026-02-02
title: Inject connection args at invoke layer
area: frontend
files:
  - src/lib/tauri.ts
priority: now
source: architecture-report
---

Create a thin wrapper around `invoke` that reads p4port/p4user/p4client from the connection store and injects them automatically. Remove the server/user/client triplet from all 38 invoke wrapper function signatures and their call sites. Big readability win — every hook currently passes `p4port ?? undefined, p4user ?? undefined, p4client ?? undefined`.
