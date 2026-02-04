---
created: 2026-02-03
title: Unify async loading indicators across the app
area: ui
files: []
---

## Problem

Inconsistency in how async operations indicate loading state across the app:
- Opening a depot directory is extremely slow and does not update unless an item is clicked at least twice
- The refresh button shows its own icon spinning but other places don't indicate loading at all
- No unified way to know when any async operation is in progress

## Solution

Unify async behavior with a consistent loading indication system:
1. Add a global loading spinner on the bottom-right status bar that activates whenever ANY async action is in progress
2. Consider individual component-level loading states for specific panels/areas
3. Fix depot directory loading to show progress and update properly without requiring extra clicks
