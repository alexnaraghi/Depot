---
created: 2026-02-02
title: Reduce hook operation boilerplate
area: frontend
files:
  - src/hooks/useFileOperations.ts
priority: now
source: architecture-report
---

checkout/revert/submit each duplicate ~40 lines of identical ceremony: startOperation, invoke, log, completeOperation, invalidateQueries, toast, error handling. Extract a shared higher-order function that takes the invoke call and toast message as params. Prepares codebase for adding lock, unlock, integrate, resolve, move, copy without more copies.
