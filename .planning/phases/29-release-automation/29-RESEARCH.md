# Phase 29: Release Automation - Research

**Researched:** 2026-02-06
**Domain:** GitHub Actions + Tauri Release Automation
**Confidence:** HIGH

## Summary

Release automation for Tauri v2 applications is well-established through the official `tauri-apps/tauri-action` GitHub Action. The action handles building cross-platform installers, generating checksums and signatures, creating GitHub Releases, and uploading artifacts. For Windows, both NSIS (.exe) and MSI installers are built by default when `bundle.targets` is set to "all" in `tauri.conf.json`.

The standard workflow uses `workflow_dispatch` for manual testing, platform matrix builds (windows-latest, macos-latest, ubuntu-22.04), and automatic artifact uploading to GitHub Releases. The action automatically generates updater JSON files with checksums and signatures, making release publishing a single-step process.

For v0.x versions, the `prerelease: true` flag should be set to mark GitHub Releases as pre-releases, signaling to users that the software is in early testing.

**Primary recommendation:** Use `tauri-apps/tauri-action@v0` with `workflow_dispatch` trigger for initial testing, `releaseDraft: true` for safety, and conditional `prerelease` detection based on version number.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tauri-apps/tauri-action | v0 (latest stable) | Builds Tauri apps and creates releases | Official Tauri GitHub Action, maintained by Tauri team |
| actions/checkout | v4 | Repository checkout | GitHub's official checkout action |
| actions/setup-node | v4 | Node.js environment setup | Official Node.js setup with caching |
| dtolnay/rust-toolchain | stable | Rust toolchain installation | Community standard for Rust in CI |
| swatinem/rust-cache | v2 | Rust build artifact caching | De facto standard for caching Rust builds |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| GitHub Releases | Built-in | Artifact hosting and versioning | Default for open-source Tauri apps |
| workflow_dispatch | Built-in | Manual workflow triggers | Testing workflows before tag automation |
| GITHUB_TOKEN | Auto-generated | GitHub API authentication | Required for release creation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GitHub Releases | CrabNebula Cloud | Paid service with additional analytics, overkill for v0.1 |
| tauri-action | Custom build scripts | Loses automatic updater JSON generation, signature handling |
| workflow_dispatch | Tag-based triggers only | Can't test workflow without creating real tags |

**Installation:**
No package installation needed - GitHub Actions workflow uses marketplace actions directly.

## Architecture Patterns

### Recommended Workflow Structure
```
.github/
└── workflows/
    └── publish.yml        # Release automation workflow
```

### Pattern 1: Manual Trigger with Draft Releases
**What:** Use `workflow_dispatch` to manually trigger builds, create draft releases for review before publishing
**When to use:** Initial workflow testing, v0.x releases where you want to verify artifacts before publishing
**Example:**
```yaml
# Source: https://v2.tauri.app/distribute/pipelines/github/
name: Release
on:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  publish-tauri:
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: 'npm'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install frontend dependencies
        run: npm install

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'Depot v__VERSION__'
          releaseBody: 'See the assets to download and install this version.'
          releaseDraft: true
          prerelease: true
```

### Pattern 2: Conditional Pre-Release Detection
**What:** Automatically mark v0.x releases as pre-release
**When to use:** When version determines release stability (v0.x = pre-release, v1.x+ = stable)
**Example:**
```yaml
# Detect if version is pre-release based on v0.x pattern
- name: Check if pre-release
  id: prerelease
  run: |
    VERSION=$(node -p "require('./package.json').version")
    if [[ $VERSION == 0.* ]]; then
      echo "is_prerelease=true" >> $GITHUB_OUTPUT
    else
      echo "is_prerelease=false" >> $GITHUB_OUTPUT
    fi
  shell: bash

- uses: tauri-apps/tauri-action@v0
  with:
    prerelease: ${{ steps.prerelease.outputs.is_prerelease }}
```

### Pattern 3: Multi-Platform Matrix Build
**What:** Build for multiple platforms (Windows, macOS, Linux) in parallel
**When to use:** Production releases that need to support multiple operating systems
**Example:**
```yaml
# Source: https://v2.tauri.app/distribute/pipelines/github/
strategy:
  fail-fast: false
  matrix:
    include:
      - platform: 'windows-latest'
        args: ''
      - platform: 'macos-latest'
        args: '--target aarch64-apple-darwin'
      - platform: 'macos-latest'
        args: '--target x86_64-apple-darwin'
      - platform: 'ubuntu-22.04'
        args: ''

runs-on: ${{ matrix.platform }}
```

### Anti-Patterns to Avoid
- **Auto-publishing on push to main:** Creates unintended releases; use workflow_dispatch or explicit tag pushes
- **Skipping draft releases for v0.x:** Publishing directly means no chance to verify artifacts before users download
- **Not setting permissions:** Default GITHUB_TOKEN is read-only; workflow will fail without `contents: write`
- **Building all platforms when only Windows is needed:** Wastes CI minutes; start with single platform, expand later

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Checksum generation | Custom SHA256 scripts | tauri-action (automatic) | Action generates checksums for all bundles automatically |
| Signature files (.sig) | Manual signing scripts | Tauri CLI (automatic) | `tauri build` creates signatures automatically for updater |
| Release notes formatting | Custom changelog parser | `releaseBody` with static text or `generateReleaseNotes: true` | GitHub can auto-generate notes from commits |
| Multi-platform builds | Custom Docker containers | GitHub Actions matrix strategy | Native runners are faster and simpler |
| Updater JSON generation | Custom JSON builder | tauri-action `uploadUpdaterJson: true` | Action creates correct latest.json format automatically |
| Asset name patterns | String manipulation in workflow | tauri-action defaults | Tauri uses standard naming: `{appname}_{version}_{arch}-setup.exe` |

**Key insight:** The tauri-action is designed to handle the entire release pipeline. Custom solutions introduce bugs (incorrect signature formats, missing checksums, wrong JSON structure) that break the Tauri updater system.

## Common Pitfalls

### Pitfall 1: Missing Write Permissions
**What goes wrong:** Workflow fails with "Resource not accessible by integration" error when trying to create release
**Why it happens:** GITHUB_TOKEN has read-only permissions by default; tauri-action needs write access to create releases
**How to avoid:** Add `permissions: contents: write` to workflow file OR go to repo Settings → Actions → Workflow permissions → check "Read and write permissions"
**Warning signs:** Error message contains "Resource not accessible" or "403 Forbidden"

### Pitfall 2: Building Both NSIS and MSI Without Updater Configuration
**What goes wrong:** Both installers are built, but only one is referenced in updater JSON, causing confusion about which users should download
**Why it happens:** Tauri builds all bundle types in `tauri.conf.json` targets, but `updaterJsonPreferNsis` defaults to `false` (uses MSI for updater)
**How to avoid:** For v0.x, explicitly set `bundle.targets: ["nsis", "msi"]` in tauri.conf.json and document which installer to use in README, OR choose one installer type for simplicity
**Warning signs:** GitHub Release contains both .exe and .msi files, but latest.json only references one

### Pitfall 3: Not Testing Workflow Before Tagging
**What goes wrong:** Tag-triggered workflow fails on first run, creating a release with failed/missing artifacts
**Why it happens:** Workflow has never been tested; errors only discovered when tag is pushed
**How to avoid:** Use `workflow_dispatch` for initial testing, verify artifacts are created correctly, THEN add tag-based triggers
**Warning signs:** First release has "no artifacts" or failed build status

### Pitfall 4: Forgetting Platform-Specific Dependencies on Linux
**What goes wrong:** Linux builds fail with missing library errors (webkit2gtk, libappindicator)
**Why it happens:** Ubuntu runners don't include Tauri's GTK dependencies by default
**How to avoid:** Add dependency installation step for Ubuntu: `sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
**Warning signs:** Build fails on ubuntu-22.04 runner with "cannot find -lwebkit2gtk" errors

### Pitfall 5: Using workflow_dispatch Without Manual Testing UI
**What goes wrong:** Workflow exists but team doesn't know how to trigger it
**Why it happens:** workflow_dispatch requires manual trigger via GitHub UI (Actions tab → Select workflow → Run workflow button)
**How to avoid:** Document how to manually trigger in CONTRIBUTING.md; test triggering process yourself first
**Warning signs:** Workflow never runs because "no one knows how to start it"

### Pitfall 6: Pre-release Flag Mismatch
**What goes wrong:** v0.x release is marked as "Latest Release" on GitHub, misleading users about stability
**Why it happens:** `prerelease: false` is the default in tauri-action
**How to avoid:** Explicitly set `prerelease: true` for all v0.x releases
**Warning signs:** GitHub repository shows v0.1.0 as "Latest" instead of "Pre-release"

## Code Examples

Verified patterns from official sources:

### Complete Windows-Only Release Workflow
```yaml
# Source: https://v2.tauri.app/distribute/pipelines/github/
# Simplified for single-platform (Windows) release
name: Release

on:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  publish-tauri:
    runs-on: windows-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: 'npm'

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install frontend dependencies
        run: npm install

      - name: Build and release
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'Depot v__VERSION__'
          releaseBody: 'See the assets to download and install this version.'
          releaseDraft: true
          prerelease: true
```

### Conditional Pre-release Detection
```yaml
# Automatically detect v0.x versions and mark as pre-release
- name: Detect pre-release version
  id: version-check
  shell: bash
  run: |
    VERSION=$(node -p "require('./package.json').version")
    if [[ "$VERSION" =~ ^0\. ]]; then
      echo "prerelease=true" >> $GITHUB_OUTPUT
    else
      echo "prerelease=false" >> $GITHUB_OUTPUT
    fi

- uses: tauri-apps/tauri-action@v0
  with:
    prerelease: ${{ steps.version-check.outputs.prerelease }}
```

### Bundle Target Configuration
```json
// Source: https://v2.tauri.app/distribute/windows-installer/
// tauri.conf.json
{
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],  // Build both Windows installers
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper"  // ~0MB, requires internet
      }
    }
  }
}
```

### Asset Naming Output
```
# Source: https://github.com/tauri-apps/tauri-action
# Tauri-action creates these files automatically:
depot_0.1.0_x64-setup.exe           # NSIS installer
depot_0.1.0_x64-setup.exe.sig       # NSIS signature for updater
depot_0.1.0_x64_en-US.msi           # MSI installer
depot_0.1.0_x64_en-US.msi.sig       # MSI signature for updater
latest.json                          # Updater manifest with checksums
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom CI scripts | tauri-apps/tauri-action | Tauri v1.0 (2022) | Eliminated 100+ lines of build script boilerplate |
| Manual asset uploads | Automatic via GITHUB_TOKEN | tauri-action v0.1 (2020) | Releases created in single workflow run |
| Tag-only triggers | workflow_dispatch support | GitHub Actions 2020 | Workflow testing without creating tags |
| Single latest.json | Per-installer-type keys | Tauri v2.10 updater (2024) | Supports distributing NSIS + MSI simultaneously |
| WiX Toolset v3 | WiX Toolset v3 (still current) | N/A | v4 exists but Tauri hasn't migrated yet |

**Deprecated/outdated:**
- **Custom checksum generation scripts:** tauri build creates .sig files automatically since Tauri v1.0
- **Separate updater JSON workflows:** tauri-action's `uploadUpdaterJson: true` (default) handles this since v0.2
- **Manual tag creation:** tauri-action creates tags automatically from app version using `tagName: v__VERSION__`

## Open Questions

Things that couldn't be fully resolved:

1. **Windows 7 Support**
   - What we know: MSI with default `downloadBootstrapper` mode doesn't work on Windows 7; requires `embedBootstrapper` or `offlineInstaller`
   - What's unclear: Whether supporting Windows 7 is a requirement for this project (not specified in PROJECT.md)
   - Recommendation: Use default `downloadBootstrapper` for v0.1; Windows 7 is EOL (2020) and unlikely user base

2. **Code Signing for Windows**
   - What we know: Unsigned binaries trigger Windows SmartScreen warnings (addressed in README with bypass instructions)
   - What's unclear: Cost/benefit of code signing for v0.1 pre-release
   - Recommendation: Defer to post-v0.1 based on user feedback per STATE.md decision

3. **Multi-Platform Build Matrix**
   - What we know: Standard pattern includes macOS and Linux builds
   - What's unclear: Whether cross-platform builds are needed for Phase 29, or Windows-only is sufficient for initial automation
   - Recommendation: Start Windows-only for simplicity; expand to multi-platform matrix if macOS/Linux users request it

## Sources

### Primary (HIGH confidence)
- [Tauri v2 GitHub Actions Distribution Guide](https://v2.tauri.app/distribute/pipelines/github/) - Complete workflow examples and configuration
- [tauri-apps/tauri-action Repository](https://github.com/tauri-apps/tauri-action) - Official action documentation with all options
- [Tauri v2 Windows Installer Guide](https://v2.tauri.app/distribute/windows-installer/) - NSIS vs MSI configuration details
- [GitHub Actions workflow_dispatch Documentation](https://docs.github.com/actions/learn-github-actions/events-that-trigger-workflows) - Manual trigger configuration

### Secondary (MEDIUM confidence)
- [Tauri v2 Updater Plugin Guide](https://v2.tauri.app/plugin/updater/) - Updater JSON format and signature handling (verified with official docs)
- [GitHub Actions Manual Workflow Guide](https://docs.github.com/actions/managing-workflow-runs/manually-running-a-workflow) - workflow_dispatch UI usage (official GitHub docs)
- Multiple community tutorials on tauri-action setup (verified against official documentation)

### Tertiary (LOW confidence - flagged for validation)
- Community discussions about AppImage build failures (anecdotal, not affecting Windows builds)
- Blog posts about Tauri v2 updater from 2024-2025 (concepts verified with official docs, but specific examples may be outdated)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Tauri action with comprehensive documentation
- Architecture: HIGH - Clear workflow patterns from official Tauri v2 docs
- Pitfalls: MEDIUM - Mixture of official warnings (permissions) and community experience (workflow testing)

**Research date:** 2026-02-06
**Valid until:** ~90 days (Tauri ecosystem is stable; tauri-action v0 is current major version)
