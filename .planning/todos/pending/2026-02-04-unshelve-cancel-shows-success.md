---
created: 2026-02-04T22:34
title: Unshelve shows success message even when user cancels
area: ui
files:
  - src/hooks/useShelvedFiles.ts
---

## Problem

When unshelving files that have conflicts, a dialog appears asking the user to resolve. If the user cancels this dialog (choosing not to proceed), the UI still displays "unshelved successfully" toast message. This is misleading - the operation was aborted, not completed successfully.

## Solution

Track whether the user actually completed the unshelve+resolve flow or cancelled out. Only show success toast if the operation actually completed. If cancelled, either show no message or show "Unshelve cancelled" to avoid confusion.
