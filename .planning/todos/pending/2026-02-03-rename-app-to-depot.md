---
created: 2026-02-03T21:23
title: Rename app from p4now to Depot
area: general
files: []
---

## Problem

The app is currently named "p4now" throughout the codebase and user-facing surfaces. The app should be renamed to "Depot" for end users. This includes:

- Window title / app name
- Tauri app configuration (tauri.conf.json)
- Package.json name/description
- Any user-visible strings, about dialogs, or branding
- Installer/executable naming
- README and user-facing documentation references

Internal code references (variable names, module paths, etc.) do not necessarily need to change — focus is on what the end user sees.

## Solution

TBD — Audit all user-facing references to "p4now" and update to "Depot". Key files likely include:
- `src-tauri/tauri.conf.json` (app title, bundle identifier)
- `package.json` (name, description)
- Window title bar text
- Any about/splash screens
- Installer output names
