---
created: 2026-02-03
title: File click does not update contextual toolbar icons
area: ui
files: []
---

## Problem

Clicking a file in workspace, depot, or pending changes does not update the contextual top toolbar icons (checkout, revert, diff). The toolbar should reflect available actions for the currently selected file.

## Solution

Ensure file selection in any panel updates the shared selection state that the toolbar reads from. The toolbar icons should reactively update based on the selected file's status and location.
