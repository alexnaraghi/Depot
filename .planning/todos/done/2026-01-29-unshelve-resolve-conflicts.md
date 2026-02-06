---
created: 2026-01-29
title: Add resolve dialog after unshelving conflicting files
area: ui
files:
  - src/hooks/useShelvedFiles.ts
  - src-tauri/src/commands/p4.rs
---

## Problem

When unshelving a file that is already opened/modified in a changelist, `p4 unshelve` reports success but the file requires resolution (`p4 resolve`). Currently the UI shows a success toast but does not prompt the user to resolve the conflict. The file is left in an unresolved state, which blocks further operations (submit, shelve) until resolved.

## Solution

After a successful unshelve, check if any files need resolution (e.g., run `p4 resolve -n` to preview). If unresolved files exist, show a resolve dialog offering accept-theirs / accept-yours / merge options, or at minimum inform the user that files need resolving and provide a way to trigger `p4 resolve -a` (auto-resolve) or launch the configured merge tool.
