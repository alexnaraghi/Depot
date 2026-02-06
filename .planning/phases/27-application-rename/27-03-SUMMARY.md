---
phase: 27-application-rename
plan: 03
subsystem: ui
tags: [tauri, version-display, window-title, typescript, react]
type: execute
status: complete
duration: 2min
completed: 2026-02-05

# Dependency Graph
requires:
  - "27-01: Configuration rename (productName, app name)"
provides:
  - "Version display in Settings dialog footer"
  - "Dynamic window title updates"
  - "Tauri window title permission"
affects:
  - "27-REVIEW: May inform final UX validation"

# Tech Stack
tech-stack:
  added: []
  patterns:
    - "Tauri window API for dynamic title updates"
    - "Tauri app API for version retrieval"
    - "Zustand store subscription for reactive title updates"

# Files
key-files:
  created: []
  modified:
    - "src-tauri/capabilities/default.json: Added window title permission"
    - "src/components/SettingsDialog.tsx: Version display in footer"
    - "src/components/MainLayout.tsx: Dynamic window title based on workspace"

# Decisions
decisions:
  - id: version-format
    choice: "Display format 'v{version} (Alpha)' in settings footer"
    rationale: "Sets stability expectations for early adopters per user decision"
    alternatives: ["Just version number", "Beta label", "No version display"]

  - id: title-format
    choice: "Window title format: 'Depot - {workspace}' when connected, 'Depot' when disconnected"
    rationale: "Clear context for multi-workspace workflows, clean when disconnected"
    alternatives: ["Always show last workspace", "Include server info", "Just 'Depot'"]
---

# Phase 27 Plan 03: UI Branding Updates Summary

**One-liner:** Dynamic window title showing workspace context and Settings dialog displaying app version with Alpha stability indicator

## What Changed

Added version display to Settings dialog footer and implemented dynamic window title that updates based on connection state.

### Components Modified

**1. Tauri Capabilities (src-tauri/capabilities/default.json)**
- Added `core:window:allow-set-title` permission
- Required for window title updates via Tauri JavaScript API
- Placed after `core:default` in permissions array

**2. Settings Dialog (src/components/SettingsDialog.tsx)**
- Added `getVersion` import from `@tauri-apps/api/app`
- Added `useState` for version tracking
- Fetches version when dialog opens
- Displays "v{version} (Alpha)" in footer inside Form after DialogFooter
- Format chosen to set stability expectations for early testers

**3. Main Layout (src/components/MainLayout.tsx)**
- Added `getCurrentWindow` import from `@tauri-apps/api/window`
- Subscribes to workspace from connection store
- useEffect updates window title when workspace changes
- Format: "Depot - {workspace}" when connected, "Depot" when disconnected
- Provides workspace context for users with multiple workspaces

## Technical Details

**Version Display Implementation:**
```typescript
// Fetch version when dialog opens
useEffect(() => {
  if (open) {
    // ... existing settings load
    getVersion().then(setVersion);
  }
}, [open, form]);

// Display in footer
{version && (
  <div className="text-xs text-muted-foreground text-center pt-2">
    v{version} (Alpha)
  </div>
)}
```

**Window Title Implementation:**
```typescript
// Subscribe to workspace from connection store
const workspace = useConnectionStore(s => s.workspace);

// Update title reactively
useEffect(() => {
  const updateTitle = async () => {
    const window = getCurrentWindow();
    if (workspace) {
      await window.setTitle(`Depot - ${workspace}`);
    } else {
      await window.setTitle('Depot');
    }
  };
  updateTitle();
}, [workspace]);
```

**Why These Changes:**
- **Version display:** Users need visibility into what version they're running, especially during early testing phase (v0.1 Alpha)
- **Dynamic title:** Multi-workspace users benefit from seeing which workspace is active in taskbar/window manager
- **Alpha label:** Sets clear expectation that this is early-stage software, managing user expectations for stability

## Testing Notes

**Manual Verification Needed:**
1. Open Settings dialog → should show "v0.1.0 (Alpha)" in footer
2. Connect to workspace → window title should update to "Depot - {workspace name}"
3. Disconnect → window title should revert to "Depot"
4. Switch workspaces → title should update to reflect new workspace

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Blockers:** None

**Recommendations:**
- Visual verification during Phase 27 review to confirm version display and title updates
- Consider E2E test for window title updates in post-v6.0 test expansion

**Concerns:** None

## Commits

| Hash | Message |
|------|---------|
| a955ba7 | feat(27-03): add window title permission |
| 6234b24 | feat(27-03): add version display to settings dialog |
| 5bec844 | feat(27-03): implement dynamic window title |

**Total Changes:**
- 3 files modified
- ~25 lines added
- 0 lines removed
- TypeScript compilation: ✓ Passed
