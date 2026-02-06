---
created: 2026-02-05T00:00
title: Offline mode with cached repository
area: ui
files: []
---

## Problem

When the user cannot access the Perforce server but has a cached version of the repository, the app currently shows them as "connected" or shows blocking error dialogs. This freezes functionality and forces modal dismissals, creating a poor UX during network outages or VPN issues.

Users should be able to work with cached data (view files, browse tree, search, etc.) without server access, and the app should gracefully handle the offline state without blocking the UI.

## Solution

Implement offline mode with the following behavior:

1. **Status indication**: Show "offline" status instead of "connected" when server is unreachable but cached data exists
2. **Cached functionality**: Enable read-only operations that don't require server (browse tree, view file info, search cached files)
3. **Disabled functionality**: Gracefully disable/gray out operations requiring server (submit, sync, shelve, etc.)
4. **Auto-reconnection**: Periodically ping server in background to detect when connection is restored
5. **Status transition**: Return to "connected" status when server becomes reachable again, restoring full functionality
6. **Non-blocking UX**: No modal dialogs or frozen UI as result of offline mode - all status changes are graceful

Key constraint: At no point should the user be frozen or forced to dismiss a modal dialog as a result of offline mode.
