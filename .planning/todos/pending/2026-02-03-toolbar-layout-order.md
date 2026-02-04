---
created: 2026-02-03
title: Fix top toolbar layout order (stream, workspace, client spec)
area: ui
files: []
---

## Problem

The top toolbar's workspace, stream, and client spec layout order is wrong. Currently shows workspace first, but the correct order should be: stream first, then workspace, then client spec.

## Solution

Reorder the toolbar items to: Stream → Workspace → Client Spec.
