---
created: 2026-02-03
title: CL details panel shows 0 files (regression)
area: ui
files: []
---

## Problem

The changelist details panel shows 0 files in its changelist, even though there are files present. This is a regression — it used to work correctly.

## Solution

Debug the CL details data fetching. Likely a query or data mapping issue introduced during recent refactoring. Check the data flow from p4 describe/fstat through to the detail pane rendering.
