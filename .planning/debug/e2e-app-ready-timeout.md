---
status: resolved
trigger: "e2e-app-ready-timeout"
created: 2026-01-31T00:00:00Z
updated: 2026-01-31T00:00:00Z
---

## Current Focus

hypothesis: Tauri app is not loading the built frontend HTML at all. The page source is completely empty (no <div id="root">, no scripts). The app may not be configured to load from the correct path or there's a build/bundle issue.
test: Check Tauri configuration and verify frontend files are actually bundled into the app
expecting: Find misconfiguration or missing frontend files in the built app
next_action: Check if frontend files are embedded in the Tauri app bundle

## Symptoms

expected: App should display data-testid="app-ready" element within 30s so E2E tests can proceed
actual: All 3 test specs (changelist, file-operations, sync) timeout waiting for app-ready element
errors: element ("[data-testid="app-ready"]") still not displayed after 30000ms
reproduction: Run E2E tests with `npx wdio run` or similar
started: First time running with a real perforce server set up

## Eliminated

- hypothesis: Tauri app binary is out of date with stale frontend
  evidence: Rebuilt Tauri app with npm run tauri build, tests still fail with same timeout
  timestamp: 2026-01-31T00:07:00Z

## Evidence

- timestamp: 2026-01-31T00:01:00Z
  checked: MainLayout.tsx line 172
  found: data-testid="app-ready" is on the root div of MainLayout component
  implication: The element is always rendered - no conditional logic around it

- timestamp: 2026-01-31T00:02:00Z
  checked: App.tsx lines 20-46
  found: MainLayout is rendered unconditionally at line 31 inside AppContent
  implication: If MainLayout doesn't render, AppContent itself must not be rendering

- timestamp: 2026-01-31T00:03:00Z
  checked: App.tsx line 22 and useSettings.ts
  found: useSettings() hook loads settings and tests P4 connection but doesn't block rendering (async useEffect)
  implication: Settings loading shouldn't prevent initial render

- timestamp: 2026-01-31T00:04:00Z
  checked: wdio.conf.ts line 53 and seed-settings.ts
  found: seedSettings() is called in onPrepare hook before app launches, writes to com.a.p4now/settings.json
  implication: P4 settings should be available when app starts

- timestamp: 2026-01-31T00:05:00Z
  checked: E2E test output logs
  found: All 3 tests timeout with "element still not displayed after 30000ms", webview2 is launching
  implication: App launches but React doesn't render the element

- timestamp: 2026-01-31T00:06:00Z
  checked: File timestamps - src-tauri/target/release/p4now.exe vs dist/
  found: p4now.exe built Jan 30 00:34, dist/ folder rebuilt Jan 31 18:09
  implication: Tauri app binary might have old frontend embedded, doesn't match current dist

- timestamp: 2026-01-31T00:08:00Z
  checked: Debug test capturing page source and browser logs
  found: Page source is completely empty: "<html><head></head><body></body></html>" - no root div, no scripts
  implication: The Tauri app is not loading the frontend HTML file at all - this is a bundle/build issue, not a React rendering issue

- timestamp: 2026-01-31T00:09:00Z
  checked: Browser console logs from debug test
  found: "IPC custom protocol failed" and "Couldn't find callback id" errors from Tauri
  implication: Tauri IPC is failing, and there are JS errors, but main issue is that HTML isn't loaded

- timestamp: 2026-01-31T00:10:00Z
  checked: WebDriver browser URL via debug test
  found: URL is "about:blank" and stays "about:blank" even after 10 seconds
  implication: Tauri webview never navigates to the bundled frontend - it stays on blank page

## Resolution

root_cause: Tauri v2 window configuration is missing the URL specification. The window opens to "about:blank" and never loads the bundled frontend. In Tauri v2, windows need an explicit URL or the default behavior may not load the frontend automatically.
fix:
verification:
files_changed: []
