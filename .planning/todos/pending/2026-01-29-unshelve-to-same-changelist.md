---
created: 2026-01-29
title: Unshelve file to same changelist, not default
area: ui
files:
  - src/hooks/useShelvedFiles.ts
  - src/components/ChangelistPanel/ChangelistNode.tsx
---

## Problem

When unshelving an individual shelved file, it gets unshelved to the default changelist instead of the changelist the shelf belongs to. The `p4 unshelve` command defaults to the default CL unless `-c {changelist}` is specified. The per-file unshelve UI added in the debug fix needs to pass the parent changelist number so files return to their original changelist.

## Solution

Ensure the unshelve invocation passes `-c {changelistId}` where changelistId is the shelved changelist the file belongs to. The useUnshelve hook already accepts changelistId — verify it's being passed through to the backend command correctly for per-file unshelves.
