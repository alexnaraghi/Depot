---
created: 2026-02-03
title: Connection dialog shows on startup even with saved connection
area: ui
files: []
---

## Problem

The connection dialog appears on every app startup, even when the user already has a saved connection that is successfully connecting to a server. The dialog should only show if there is no saved connection configuration.

## Solution

Check for saved connection on startup. Only show the connection dialog if no saved connection exists or if the saved connection fails to connect.
