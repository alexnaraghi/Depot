---
created: 2026-02-03
title: Shelve and unshelve do not update UI
area: ui
files: []
---

## Problem

Shelve and unshelve operations do not update the UI at all. Even after restarting the app, the shelved files list doesn't show up. The UI appears completely disconnected from shelve/unshelve state changes.

## Solution

Ensure shelve/unshelve operations trigger proper query invalidation so the UI reflects the current shelved state. Verify the shelved files query is working correctly on app load as well.
