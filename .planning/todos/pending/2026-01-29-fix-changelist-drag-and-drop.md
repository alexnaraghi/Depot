---
created: 2026-01-29
title: Fix changelist drag and drop
area: ui
files:
  - src/components/changelist (likely location)
---

## Problem

Drag and drop of files between changelists does not work — the drag operation doesn't even start. This was wired up in commit 5e1bda4 (feat(04-03): wire context menu to file nodes and fix DnD to use reopen), but something is preventing the drag from initiating.

## Solution

TBD — investigate why drag start isn't firing. Likely issues: missing draggable attribute, event handler not attached, or event being swallowed/prevented.
