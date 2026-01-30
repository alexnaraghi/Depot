---
created: 2026-01-30
title: Implement refresh button
area: ui
files: []
---

## Problem

The refresh button in the UI does nothing when clicked. It should trigger a re-fetch of pending changelists and workspace file state from the Perforce server.

## Solution

TBD — Wire the refresh button's onClick handler to invalidate relevant React Query caches (changelists, opened files, etc.) so data is re-fetched from the P4 backend.
