---
created: 2026-01-31
title: Separate connection dialog from settings menu
area: ui
files:
  - src/components/Settings (likely location)
---

## Problem

The P4 connection configuration is currently embedded in the settings menu. This creates two UX issues:

1. **First-run experience:** When a user opens P4Now for the first time (or is not connected to a Perforce server), there's no clear prompt to connect. The user must know to navigate to settings to configure the connection.
2. **Separation of concerns:** Connection setup is a distinct workflow from general app settings (theme, refresh interval, etc.) and deserves its own dedicated dialog.

## Solution

- Extract connection fields (P4PORT, P4USER, P4CLIENT, P4PASSWD) into a standalone connection dialog component
- Show the connection dialog automatically on startup when no active P4 connection is detected
- Keep connection accessible from settings or a toolbar button for reconnecting/switching
- Update E2E test flow to handle the connection modal (dismiss or fill it during automated tests)
- Settings menu retains non-connection preferences only
