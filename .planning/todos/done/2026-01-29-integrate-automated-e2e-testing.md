---
created: 2026-01-29
title: Integrate automated E2E testing with WebdriverIO
area: testing
files: []
---

## Problem

The app has no automated UI/E2E tests. All feature verification has been manual. As the feature set grows (changelists, drag-and-drop, shelving, reconcile, file history, diff, keyboard shortcuts, etc.), manual testing becomes unsustainable and regressions are likely.

Need a test suite that exercises the app as an end user would — clicking buttons, dragging files between changelists, opening dialogs, submitting changelists, etc.

## Solution

**Framework:** WebdriverIO with `tauri-driver` (official Tauri recommendation for native app testing).

**Key considerations:**
- **Perforce mocking:** Evaluate options for test isolation — mock P4 server (e.g., p4d in-memory with temp depot), stub Tauri commands at the IPC layer, or record/replay P4 command output. A local throwaway p4d instance is likely the most realistic option.
- **Test scope:** Cover all implemented features that interact with Perforce — connection settings, changelist CRUD, file checkout/revert, drag-and-drop between changelists, shelve/unshelve, reconcile, file history, diff launch, submit, keyboard shortcuts.
- **CI integration:** Wire tests into the automated verification workflow so regressions are caught before merge.
- **Test architecture:** Consider page object pattern for maintainability, fixtures for P4 depot state setup/teardown.
