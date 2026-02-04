---
created: 2026-02-03T00:00
title: Add standard file menu bar
area: ui
files: []
---

## Problem

The app lacks a standard application menu bar (File, Edit, View, Help). Users expect conventional menu structure for discoverability of existing features and standard OS-level actions.

## Solution

Add a menu bar with four menus, primarily surfacing existing functionality in a standard layout:

**File**
- Settings (existing)
- Open Connection (existing)
- Disconnect (existing)
- Exit

**Edit**
- Undo (new - contextual, grey out when not relevant)
- Redo (new - contextual, grey out when not relevant)
- Copy (new - contextual, grey out when not relevant)
- Paste (new - contextual, grey out when not relevant)

**View**
- Toggle Full Screen
- Depot Shows Deleted Files (checkmark toggle)

**Help**
- About (new modal: app name, version number, link to stub website)

Key considerations:
- Edit menu items need contextual enable/disable logic (new feature)
- Tauri provides native menu APIs that could be used
- "Depot shows deleted files" is an existing setting that should be toggled via checkmark
- About modal needs app name/version from Tauri config + stub website URL
