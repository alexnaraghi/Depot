# Phase 27: Application Rename - Research

**Researched:** 2026-02-05
**Domain:** Tauri application rebranding / configuration management
**Confidence:** HIGH

## Summary

Renaming the application from "p4now" to "Depot" requires coordinated updates across 8 key configuration files and 2 source code files. The rename touches package.json (npm), Cargo.toml (Rust crate and lib names), tauri.conf.json (productName, identifier, window title), index.html (browser title), main.rs (lib reference), and e2e test helpers (settings path, binary path).

The critical constraint is the bundle identifier change from `com.a.p4now` to `com.depot.app` - this is a one-time decision that affects installation directories and settings storage on all platforms. Pre-v1.0, this is acceptable since there are no existing installations to migrate.

Version display requires adding a footer to the Settings dialog that reads the version from Tauri's API. Dynamic window titles ("Depot - [workspace]") require using the Tauri window API and adding the `core:window:allow-set-title` permission.

**Primary recommendation:** Execute rename in dependency order (Rust files first, then Tauri config, then frontend, then E2E tests), followed by comprehensive grep verification and build test.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Product name always capitalized as "Depot" (title case) throughout UI
- No tagline - just "Depot" standalone
- Window titles show "Depot - [workspace]" when connected to server
- Keep "p4now" references in git history/commit messages for historical context
- Remove all "p4now" references from source code, configs, and documentation
- No migration concerns - pre-v1.0 breaking changes are acceptable
- No README migration notice needed - limited private testing audience
- Assume no existing p4now installations to handle
- Version number displayed in settings panel footer
- Display format: "v0.1.0 (Alpha)" to set stability expectations
- Version sourced from tauri.conf.json (single source of truth)
- No update checking mechanism - defer to future phase
- Successful build criteria: (1) builds without errors, (2) application launches
- Smoke test only: launch app, verify Depot branding appears, basic UI loads
- Comprehensive grep verification: search entire codebase for "p4now" references (excluding git history)
- Build failures or verification issues: stop immediately and fix before proceeding

### Claude's Discretion
- Exact order of file updates during rename
- Commit message structure and granularity
- Specific grep patterns and exclusions for verification

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope
</user_constraints>

## Standard Stack

This phase requires no new libraries. All necessary APIs are already available in the project.

### Core APIs Used
| API | Source | Purpose | Why Standard |
|-----|--------|---------|--------------|
| `getVersion()` | `@tauri-apps/api/app` | Read version from tauri.conf.json | Official Tauri API for version access |
| `getCurrentWindow().setTitle()` | `@tauri-apps/api/window` | Dynamic window title | Official Tauri API for window management |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| ripgrep (`rg`) | Verification | Final grep to confirm zero p4now references |
| `cargo build` | Rust compilation | Verify Rust changes compile |
| `npm run tauri build` | Full build | Verify complete application builds |

### No New Dependencies
This phase modifies existing configuration files and adds minimal code for version display. No new npm packages or Cargo dependencies needed.

## Architecture Patterns

### Recommended Update Order

```
1. Rust Configuration (Cargo.toml)
   ├── package name: p4now → depot
   ├── lib name: p4now_lib → depot_lib
   └── description: update if needed

2. Rust Source (main.rs)
   └── p4now_lib::run() → depot_lib::run()

3. Tauri Configuration (tauri.conf.json)
   ├── productName: p4now → Depot
   ├── identifier: com.a.p4now → com.depot.app
   └── windows[0].title: p4now → Depot

4. Frontend Configuration
   ├── package.json: name p4now → depot
   └── index.html: title → Depot

5. E2E Test Configuration
   ├── wdio.conf.ts: p4now.exe → depot.exe
   └── seed-settings.ts: com.a.p4now → com.depot.app

6. Version Display (new code)
   └── SettingsDialog.tsx: add version footer

7. Dynamic Window Title (new code)
   └── MainLayout.tsx: update title on connection
```

### Pattern 1: Version Display in Settings Footer
**What:** Display "v0.1.0 (Alpha)" in settings panel footer
**When to use:** Settings dialog component
**Example:**
```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespaceapp/
import { getVersion } from '@tauri-apps/api/app';
import { useEffect, useState } from 'react';

function SettingsFooter() {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  return (
    <div className="text-xs text-muted-foreground text-center mt-4">
      v{version} (Alpha)
    </div>
  );
}
```

### Pattern 2: Dynamic Window Title
**What:** Update window title to "Depot - [workspace]" when connected
**When to use:** After successful P4 connection
**Example:**
```typescript
// Source: https://v2.tauri.app/learn/window-customization/
import { getCurrentWindow } from '@tauri-apps/api/window';

// Called when connection status changes
async function updateWindowTitle(workspace: string | null) {
  const window = getCurrentWindow();
  if (workspace) {
    await window.setTitle(`Depot - ${workspace}`);
  } else {
    await window.setTitle('Depot');
  }
}
```

**Capability required:** Add `"core:window:allow-set-title"` to `src-tauri/capabilities/default.json`

### Anti-Patterns to Avoid
- **Partial rename:** Don't rename some files and leave others - causes build failures
- **Case inconsistency:** Use "Depot" (title case) consistently, not "depot" or "DEPOT" in UI
- **Hardcoded version strings:** Don't duplicate version in code - always read from tauri.conf.json

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version access | Read package.json or cargo.toml directly | `getVersion()` from `@tauri-apps/api/app` | Tauri handles version resolution from tauri.conf.json |
| Window title updates | Direct DOM manipulation or document.title | `getCurrentWindow().setTitle()` | Tauri API properly updates native window title |

**Key insight:** Tauri provides official APIs for both version access and window title management. These APIs read from the single source of truth (tauri.conf.json) and handle cross-platform differences.

## Common Pitfalls

### Pitfall 1: Cargo.lock Out of Sync
**What goes wrong:** After renaming package in Cargo.toml, Cargo.lock still references old name causing "crate not found" errors
**Why it happens:** Cargo.lock caches crate names; manual rename doesn't update it
**How to avoid:** Run `cargo update` or let `cargo build` regenerate the lock file
**Warning signs:** Build error mentioning p4now crate not found

### Pitfall 2: Missing main.rs Update
**What goes wrong:** main.rs still calls `p4now_lib::run()` after lib name change
**Why it happens:** Lib name change in Cargo.toml doesn't auto-update source references
**How to avoid:** Update main.rs immediately after Cargo.toml lib name change
**Warning signs:** Rust compilation error "unresolved import p4now_lib"

### Pitfall 3: E2E Test Binary Path
**What goes wrong:** E2E tests try to launch `p4now.exe` which no longer exists
**Why it happens:** Tauri renames output binary based on Cargo.toml package name
**How to avoid:** Update `wdio.conf.ts` application path from `p4now.exe` to `depot.exe`
**Warning signs:** E2E tests fail with "application not found"

### Pitfall 4: E2E Settings Path
**What goes wrong:** E2E test seeds settings to wrong directory
**Why it happens:** Tauri plugin-store uses bundle identifier for settings directory
**How to avoid:** Update `seed-settings.ts` to use `com.depot.app` instead of `com.a.p4now`
**Warning signs:** E2E tests start with no connection settings, connection dialog appears

### Pitfall 5: Window Title Permission
**What goes wrong:** `setTitle()` call fails silently or throws permission error
**Why it happens:** Tauri 2.0 requires explicit capability for window title changes
**How to avoid:** Add `"core:window:allow-set-title"` to capabilities/default.json
**Warning signs:** Window title doesn't update when connecting to workspace

### Pitfall 6: Incomplete Grep Verification
**What goes wrong:** Stray "p4now" references remain in code or docs
**Why it happens:** Grep excludes miss some file types or directories
**How to avoid:** Use comprehensive pattern: `rg -i "p4now" --type-not lockfile --glob "!.git"`
**Warning signs:** Users see "p4now" in UI, logs, or error messages

## Code Examples

### Complete File Updates

#### src-tauri/Cargo.toml
```toml
[package]
name = "depot"              # Was: p4now
version = "0.1.0"
description = "A Tauri App"
authors = ["you"]
edition = "2021"

[lib]
name = "depot_lib"          # Was: p4now_lib
crate-type = ["staticlib", "cdylib", "rlib"]
```

#### src-tauri/src/main.rs
```rust
fn main() {
    depot_lib::run()        // Was: p4now_lib::run()
}
```

#### src-tauri/tauri.conf.json
```json
{
  "productName": "Depot",                    // Was: p4now
  "version": "0.1.0",
  "identifier": "com.depot.app",             // Was: com.a.p4now
  "app": {
    "windows": [{
      "title": "Depot",                      // Was: p4now
      ...
    }]
  }
}
```

#### package.json
```json
{
  "name": "depot",           // Was: p4now
  "version": "0.1.0"
}
```

#### index.html
```html
<title>Depot</title>         <!-- Was: Tauri + React + Typescript -->
```

#### e2e/wdio.conf.ts
```typescript
capabilities: [{
  'tauri:options': {
    application: join(process.cwd(), 'src-tauri', 'target', 'release', 'depot.exe'),
    // Was: p4now.exe
  },
}]
```

#### e2e/test/helpers/seed-settings.ts
```typescript
// Path comments and code
// - Windows: %APPDATA%\com.depot.app\settings.json
// - Linux: ~/.config/com.depot.app/settings.json
// - macOS: ~/Library/Application Support/com.depot.app/settings.json

const storeDir = join(appDataDir, 'com.depot.app')  // Was: com.a.p4now
```

### Capability Addition for Window Title

#### src-tauri/capabilities/default.json
```json
{
  "permissions": [
    "core:default",
    "core:window:allow-set-title",  // ADD THIS
    "opener:default",
    ...
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global Tauri object | Module imports | Tauri 2.0 | Use `@tauri-apps/api/*` imports |
| Implicit permissions | Explicit capabilities | Tauri 2.0 | Must declare window permissions |
| document.title | window.setTitle() | Tauri 1.0+ | Native window title properly updated |

**Deprecated/outdated:**
- `window.__TAURI__` global: Use module imports in Tauri 2.0
- Implicit window permissions: Must explicitly add capabilities in Tauri 2.0

## Open Questions

None - all aspects of this phase are well-understood:
1. File locations to update: Fully mapped
2. API for version display: Confirmed via official Tauri docs
3. API for window title: Confirmed via official Tauri docs
4. Capability requirements: Confirmed

## Sources

### Primary (HIGH confidence)
- [Tauri 2.0 App API Reference](https://v2.tauri.app/reference/javascript/api/namespaceapp/) - getVersion(), getName() APIs
- [Tauri 2.0 Window Customization](https://v2.tauri.app/learn/window-customization/) - setTitle() pattern
- Existing codebase analysis - All file locations verified via grep

### Secondary (MEDIUM confidence)
- [Tauri Configuration Reference](https://v2.tauri.app/reference/config/) - tauri.conf.json fields

### Project-Specific (HIGH confidence)
- `C:\Projects\Fun\p4now\src-tauri\tauri.conf.json` - Current Tauri configuration
- `C:\Projects\Fun\p4now\src-tauri\Cargo.toml` - Current Rust configuration
- `C:\Projects\Fun\p4now\package.json` - Current npm configuration
- `C:\Projects\Fun\p4now\src\stores\connectionStore.ts` - Workspace name source for dynamic title
- `C:\Projects\Fun\p4now\src\components\SettingsDialog.tsx` - Target for version display
- `C:\Projects\Fun\p4now\src-tauri\capabilities\default.json` - Existing capabilities file
- `C:\Projects\Fun\p4now\.planning\research\public-launch\ARCHITECTURE.md` - Prior rename research

## Metadata

**Confidence breakdown:**
- File updates: HIGH - All locations verified via codebase grep
- Tauri APIs: HIGH - Verified via official Tauri 2.0 documentation
- Capability requirements: HIGH - Confirmed Tauri 2.0 requires explicit permissions
- Build process: HIGH - Standard Tauri build pipeline

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stable domain, Tauri 2.0 APIs mature)

## Verification Commands

After completing rename, run these verification commands:

```bash
# 1. Comprehensive grep for remaining p4now references
rg -i "p4now" --glob "!.git" --glob "!node_modules" --glob "!target" --glob "!*.lock"

# 2. Verify Rust compilation
cd src-tauri && cargo check

# 3. Verify full build
npm run tauri build

# 4. Verify binary name
dir src-tauri\target\release\depot.exe

# 5. Launch and smoke test
# - Verify window title shows "Depot"
# - Connect to workspace, verify title shows "Depot - [workspace]"
# - Open Settings, verify version footer shows "v0.1.0 (Alpha)"
```
