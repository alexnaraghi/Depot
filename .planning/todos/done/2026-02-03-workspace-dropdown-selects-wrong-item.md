---
created: 2026-02-03T00:00
title: Fix workspace dropdown selecting wrong workspace
area: ui
files: []
---

## Problem

The workspace switcher dropdown does not open the selected workspace — it opens a different one. Likely an off-by-one or indexing mismatch between the displayed list and the value passed on selection.

## Solution

TBD — investigate the workspace dropdown component. Check:
- Whether the index vs. value mapping is correct (e.g., 0-based vs 1-based mismatch)
- Whether the onChange handler receives the display index rather than the workspace identifier
- Whether filtering or sorting of the workspace list causes the visual order to diverge from the underlying data order
