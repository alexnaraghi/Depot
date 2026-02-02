---
created: 2026-02-01
title: Fix depot accordion header visibility when collapsed
area: ui
files:
  - src/components/MainLayout.tsx:390-412
---

## Problem

When the Workspace Files accordion is expanded and the Depot accordion is collapsed, the Depot header/trigger disappears — it gets pushed out of view by the workspace section filling the available space in the `overflow-hidden` flex column.

Expected: The Depot accordion header should always be visible at the bottom of the workspace file list, even when collapsed, so the user can click it to expand.

Current layout uses `flex: 1 1 0%` on the expanded workspace Collapsible and `flex: 0 0 auto` on the collapsed depot Collapsible inside a `flex flex-col overflow-hidden` parent. The workspace grows to consume all space, and the depot header gets clipped.

Attempted fixes with `shrink-0` and explicit flex values did not resolve the issue — likely need a different layout approach (e.g., making the workspace section calc-based with reserved space for the depot header, or restructuring so the depot trigger sits outside the Collapsible).

## Solution

TBD — needs a layout approach where the depot trigger is guaranteed visible space regardless of workspace expansion state. Possible approaches:
- Pull the depot `CollapsibleTrigger` outside the flex-growing area so it's a fixed sibling
- Use `calc(100% - header-height)` for the workspace max-height
- Restructure so both headers are always-visible fixed elements and only content areas flex
