---
created: 2026-01-28T00:00
title: Add click-to-dismiss for toasts
area: ui
files: []
---

## Problem

Toast notifications obscure clickable UI elements behind them until timeout expires. The user is blocked from interacting with UI underneath while waiting for the toast to auto-dismiss. This violates the core value: "The user is never blocked."

## Solution

Add an onClick handler (or close button) to toast components so users can dismiss them immediately. Ensure pointer-events are correct so clicks pass through or dismiss as expected.
