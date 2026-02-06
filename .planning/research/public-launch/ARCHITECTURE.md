# Architecture Research: Public Launch Preparation

**Domain:** Open Source Desktop Application (Tauri 2.0)
**Researched:** 2026-02-05
**Confidence:** HIGH

## Overview

Preparing "Depot" (renamed from p4now) for public GitHub launch requires integrating standard open-source project artifacts, release automation, and security tooling with the existing Tauri 2.0 desktop application architecture.

This research focuses on **integration points** rather than theory—where files go, what configurations change, and how build/release processes connect to the existing codebase.

## Current Architecture Baseline

```
Depot (p4now)
├── src/                      # React frontend (TypeScript)
├── src-tauri/                # Rust backend
│   ├── Cargo.toml           # Rust dependencies and package metadata
│   ├── tauri.conf.json      # Tauri app configuration
│   └── build.rs             # Build script
├── package.json              # Node.js dependencies and scripts
├── .planning/                # GSD methodology artifacts (KEEP as showcase)
├── e2e/                      # WebdriverIO tests
└── [build output to dist/]
```

**Critical identifiers to rename:**
- `package.json`: `"name": "p4now"` → `"depot"`
- `src-tauri/Cargo.toml`: `name = "p4now"` → `"depot"`
- `src-tauri/tauri.conf.json`: `"productName": "p4now"`, `"identifier": "com.a.p4now"`, `"title": "p4now"`

## Public Launch Architecture Changes

### Repository Structure Changes

```
Depot (after public launch prep)
├── .github/                      # NEW: GitHub-specific files
│   ├── workflows/
│   │   ├── publish.yml          # Release automation
│   │   ├── security-scan.yml    # Security scanning on push/PR
│   │   └── ci.yml               # Continuous integration (build tests)
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
├── LICENSE                       # NEW: MIT license
├── README.md                     # NEW: Project overview, quick start
├── CONTRIBUTING.md               # NEW: Contributor guide
├── CODE_OF_CONDUCT.md            # NEW: Community guidelines
├── SECURITY.md                   # NEW: Security policy
├── .gitignore                    # UPDATE: Ensure no secrets
├── src/                          # Existing React frontend
├── src-tauri/                    # Existing Rust backend
│   ├── Cargo.toml               # UPDATE: Rename package
│   ├── tauri.conf.json          # UPDATE: Rename product/identifier
│   └── icons/                    # UPDATE: New branding if needed
├── package.json                  # UPDATE: Rename package, add release scripts
├── .planning/                    # KEEP: Showcase agentic development
└── e2e/                          # Existing tests
```

**Top-level files location:** All new documentation files (LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY) go in the **project root** directory.

**GitHub workflows location:** `.github/workflows/` (standard GitHub Actions directory).

## Rename Integration Points

### Files Requiring Updates

| File | Current Value | New Value | Purpose |
|------|---------------|-----------|---------|
| `package.json` | `"name": "p4now"` | `"name": "depot"` | NPM package identifier |
| `package.json` | `"version": "0.1.0"` | Keep (public v0.1) | Signals early testing |
| `src-tauri/Cargo.toml` | `name = "p4now"` | `name = "depot"` | Rust crate name |
| `src-tauri/Cargo.toml` | `name = "p4now_lib"` | `name = "depot_lib"` | Rust library name |
| `src-tauri/tauri.conf.json` | `"productName": "p4now"` | `"productName": "Depot"` | Display name in OS |
| `src-tauri/tauri.conf.json` | `"identifier": "com.a.p4now"` | `"identifier": "com.depot.app"` | Unique app ID (reverse domain) |
| `src-tauri/tauri.conf.json` | `"title": "p4now"` | `"title": "Depot"` | Window title |
| HTML title | (check `index.html`) | `"Depot"` | Browser tab/window |

**Critical note:** The `identifier` field uses reverse domain notation and must be unique. Once shipped, changing it creates a new app installation. Use `com.depot.app` or similar permanent identifier.

**Build artifacts:** After rename, Tauri builds will produce:
- Windows: `depot.exe`, `depot_0.1.0_x64-setup.exe`, `depot_0.1.0_x64.msi`

### Code References

Search and replace string literals:
- Rust source: Any hardcoded "p4now" strings in debug logs or error messages
- TypeScript/React: Any hardcoded "p4now" strings in UI text
- Test fixtures: `e2e/` test setup may reference old app name

**Search commands:**
```bash
# Find all "p4now" references
grep -r "p4now" src/ src-tauri/src/ --exclude-dir=target --exclude-dir=node_modules
grep -r "p4now" e2e/ --exclude-dir=node_modules
```

## GitHub Actions Integration

### Workflow File Locations

Create three workflows in `.github/workflows/`:

1. **`.github/workflows/ci.yml`** - Continuous integration (on push/PR to main)
2. **`.github/workflows/publish.yml`** - Release automation (on version tag or manual trigger)
3. **`.github/workflows/security-scan.yml`** - Security scanning (on push/PR, scheduled)

### Release Workflow Architecture

**File:** `.github/workflows/publish.yml`

```yaml
name: Publish Release

on:
  workflow_dispatch:  # Manual trigger
  push:
    tags:
      - 'v*'          # Trigger on version tags (e.g., v0.1.0)

permissions:
  contents: write       # Required to create releases and upload assets

jobs:
  publish-tauri:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: windows-latest
            args: ''

    runs-on: ${{ matrix.platform }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: x86_64-pc-windows-msvc

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install frontend dependencies
        run: npm ci

      - name: Import Windows code signing certificate
        if: matrix.platform == 'windows-latest'
        run: |
          New-Item -ItemType directory -Path certificate
          Set-Content -Path certificate/tempCert.txt -Value '${{ secrets.WINDOWS_CERTIFICATE }}'
          certutil -decode certificate/tempCert.txt certificate/certificate.pfx
          Remove-Item -path certificate -include tempCert.txt
          Import-PfxCertificate -FilePath certificate/certificate.pfx -CertStoreLocation Cert:\CurrentUser\My -Password (ConvertTo-SecureString -String '${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}' -AsPlainText -Force)

      - name: Build and publish with tauri-action
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'Depot v__VERSION__'
          releaseBody: 'See the assets below to download this release.'
          releaseDraft: true
          prerelease: true  # For v0.x releases
```

**Key points:**
- Uses official `tauri-apps/tauri-action@v0` for cross-platform builds
- `__VERSION__` placeholder automatically replaced from `tauri.conf.json` version
- Draft release allows manual review before publishing
- Prerelease flag for v0.x (early testing phase)

### Windows Code Signing Configuration

**GitHub Secrets Required:**

| Secret Name | Content | How to Generate |
|-------------|---------|-----------------|
| `WINDOWS_CERTIFICATE` | Base64-encoded .pfx certificate | `certutil -encode certificate.pfx cert.txt` (Windows) |
| `WINDOWS_CERTIFICATE_PASSWORD` | Certificate password | Set during certificate creation |

**Tauri Configuration (src-tauri/tauri.conf.json):**

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "<THUMBPRINT_FROM_CERT>",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.comodoca.com"
    }
  }
}
```

**Certificate thumbprint:** Run after importing certificate:
```powershell
Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object {$_.Subject -like "*YourCertName*"}
```

**Alternative signing methods (Tauri 2.0 supports):**
1. Traditional .pfx certificate (above)
2. Azure Key Vault (for enterprise)
3. Azure Trusted Signing (Microsoft's cloud signing service)

**For initial public release:** If no code signing certificate yet, skip signing step. GitHub releases will show "Unknown publisher" warning on Windows, which is acceptable for v0.x early testing.

### Installer Configuration

**Windows installer format:** Tauri 2.0 supports both MSI and NSIS.

**Recommendation for Depot:**
- **NSIS setup executable** (`depot_0.1.0_x64-setup.exe`) - Default, smaller, faster
- **MSI installer** (`depot_0.1.0_x64.msi`) - Optional, for enterprise deployments

**Configuration in `tauri.conf.json`:**

```json
{
  "bundle": {
    "targets": ["nsis", "msi"],
    "windows": {
      "webviewInstallMode": "downloadBootstrapper"
    }
  }
}
```

**WebView2 installation modes:**
- `downloadBootstrapper` (default): Downloads WebView2 if needed (~1.8MB installer size)
- `embedBootstrapper`: Embeds bootstrapper (~+1.8MB)
- `offlineInstaller`: Embeds full WebView2 (~+127MB) - only if users have no internet

**Recommendation:** Use `downloadBootstrapper` for public release. Most Windows 10/11 systems have WebView2 pre-installed.

### CI Workflow (Build Tests)

**File:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  test:
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install dependencies
        run: npm ci

      - name: Build frontend
        run: npm run build

      - name: Build Tauri app
        run: npm run tauri build -- --debug
```

**Purpose:** Validates that the app builds successfully on every push/PR. Catches build-breaking changes before merge.

**E2E tests:** Current WebdriverIO tests require real P4 server (marked `human_needed`). Skip in CI until P4 server setup automated or mocked.

## Security Scanning Integration

### Secret Scanning

**GitHub native secret scanning:** Automatically enabled for public repositories. Scans Git history for known secret patterns (API keys, tokens, passwords).

**Pre-commit hook option:** Add local scanning before commits reach GitHub.

**Tool recommendation:** `gitleaks` (open-source, fast)

```bash
# Install pre-commit hook (manual setup, not automated in workflow)
# In .git/hooks/pre-commit:
#!/bin/sh
gitleaks protect --staged --verbose
```

### Dependency Vulnerability Scanning

**File:** `.github/workflows/security-scan.yml`

```yaml
name: Security Scan

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday

jobs:
  security:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Run npm audit
        run: npm audit --audit-level=moderate
        continue-on-error: true

      - name: Run Cargo audit
        uses: actions-rs/audit-check@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

**Multi-language scanning:**
- **npm audit:** Scans JavaScript/TypeScript dependencies (package.json)
- **cargo audit:** Scans Rust dependencies (Cargo.toml)

**Alternatives considered:**

| Tool | Languages | GitHub Integration | Free for Open Source |
|------|-----------|-------------------|---------------------|
| GitHub CodeQL | C/C++, C#, Go, Java, JS/TS, Python, Ruby | Native | Yes |
| Snyk | Multi-language | GitHub App | Yes (public repos) |
| Bearer | Go, Java, JS/TS, PHP, Python, Ruby | GitHub Actions | Yes |
| ShiftLeft Scan | Java, Node.js, Rust, Go, C# | GitHub Actions | Yes |

**Recommendation for Depot:**
- **Start with:** Native npm/cargo audit (zero setup, fast)
- **Add later:** GitHub CodeQL for deeper static analysis (enable in Security tab)
- **Skip for v0.1:** Third-party SaaS tools (Snyk, etc.) - add complexity without immediate value

### .gitignore Security Audit

**Current `.gitignore` gaps to address:**

```gitignore
# Add to existing .gitignore:

# Tauri build artifacts
src-tauri/target/
src-tauri/WixTools/

# Credentials and secrets
*.pfx
*.p12
certificate/
.env
.env.local
*.pem
*.key

# Sensitive Perforce files (user's local P4 settings)
.p4config
.p4enviro

# IDE and OS files
.vscode/
.idea/
*.swp
*.swo
.DS_Store
Thumbs.db

# Test artifacts with potential secrets
test-client/
test-server/
reports/
```

**Audit process:**
1. Review existing `.gitignore` for gaps
2. Search Git history for accidentally committed secrets: `git log -S "password" --all --patch`
3. If secrets found: Use `git filter-repo` or BFG Repo-Cleaner to remove from history (before public release)

**Tauri-specific secrets risk:** Low. App doesn't store API keys or cloud credentials. Main risk: User's Perforce credentials stored in local settings (already in `.gitignore` via `.vscode/`, `test-client/`, `test-server/`).

## Release Build and Signing Workflow

### Release Process Flow

```
Developer Action: Tag version (git tag v0.1.0 && git push --tags)
        ↓
GitHub Actions: Workflow triggered (.github/workflows/publish.yml)
        ↓
Build Steps:
    1. Checkout repository
    2. Setup Node.js (with cache)
    3. Setup Rust toolchain
    4. Cache Rust build artifacts
    5. Install frontend dependencies (npm ci)
    6. [OPTIONAL] Import Windows code signing certificate
    7. Build frontend (npm run build)
    8. Build Tauri app (cargo build --release)
    9. Bundle installers (NSIS, MSI)
   10. [OPTIONAL] Sign binaries with certificate
   11. Generate checksums
        ↓
Publish: Create GitHub Release (draft)
    - Tag: v0.1.0
    - Name: "Depot v0.1.0"
    - Assets:
        • depot.exe (portable, unsigned)
        • depot_0.1.0_x64-setup.exe (NSIS installer)
        • depot_0.1.0_x64.msi (MSI installer)
        • SHA256SUMS.txt (checksums)
        ↓
Manual Review: Developer reviews draft release, edits release notes
        ↓
Publish Release: Mark draft as published
        ↓
Users: Download from GitHub Releases page
```

**Time estimate:** ~10-15 minutes per release (mostly build time).

**Release cadence:** For v0.x, release as needed (bug fixes, features). No fixed schedule.

### Artifact Outputs

**Generated files (Windows x64 build):**

| File | Size (approx) | Purpose |
|------|---------------|---------|
| `depot.exe` | 15-20 MB | Portable executable (no installer) |
| `depot_0.1.0_x64-setup.exe` | 16-22 MB | NSIS installer (recommended) |
| `depot_0.1.0_x64.msi` | 16-22 MB | MSI installer (enterprise) |
| `SHA256SUMS.txt` | <1 KB | Checksums for verification |

**Size factors:**
- Rust binary: ~5-10 MB (optimized release build)
- React frontend: ~5-10 MB (bundled assets, dependencies)
- Tauri runtime: Minimal (links to system WebView2)
- Embedded resources: Icons, manifests

**Download recommendations in README:**
- **Most users:** Download `depot_0.1.0_x64-setup.exe` (NSIS installer)
- **Portable use:** Download `depot.exe` (no installation needed)
- **Enterprise/IT:** Download `depot_0.1.0_x64.msi` (MSI for managed deployments)

## Documentation File Locations and Content

### LICENSE (Project Root)

**File:** `LICENSE`
**Content:** MIT License text with copyright holder name and year.

**Template:**
```text
MIT License

Copyright (c) 2026 [Your Name/Organization]

Permission is hereby granted, free of charge, to any person obtaining a copy...
[Standard MIT license text]
```

**Placement rationale:** Root directory. GitHub automatically detects and displays license badge.

### README.md (Project Root)

**File:** `README.md`
**Purpose:** Project introduction, quick start, feature overview.

**Structure:**
```markdown
# Depot

> A modern Windows Perforce GUI that replaces P4V for daily development work.

⚠️ **Early Testing Phase:** Depot is in active development (v0.x). Expect bugs and breaking changes.

## Why Depot?

[2-3 paragraphs comparing to P4V, emphasizing non-blocking UX]

## Features

- Three-column layout (file tree, detail pane, changelists)
- Depot browser with lazy-loaded hierarchy
- Workspace/stream switching with auto-shelve
- Conflict resolution with external merge tools
- Progressive loading for large depots (10,000+ files)
- [... see PROJECT.md for full list]

## Quick Start

### Prerequisites
- Windows 10/11
- Perforce command-line tools (`p4.exe` in PATH)
- P4 server access with username and workspace

### Installation
1. Download the latest release: [depot_0.1.0_x64-setup.exe](https://github.com/user/depot/releases)
2. Run the installer
3. Launch Depot from Start Menu

### First Use
1. Open Settings (Ctrl+,)
2. Configure P4 connection:
   - Server: `perforce:1666`
   - Username: `your-username`
   - Workspace: `your-workspace`
3. Click "Test Connection"
4. Start using Depot!

## Documentation

- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

## Development Process

Depot is developed using an **agentic development methodology** with Claude Code. The `.planning/` directory contains the complete development history: milestones, roadmaps, phases, research, and todos. This is kept public as a showcase of AI-assisted software development.

## License

MIT License - see [LICENSE](LICENSE) for details.
```

**Key sections:**
- Warning badge for v0.x status
- Quick comparison to P4V (target users already know P4V)
- Installation instructions (assume zero technical knowledge)
- Link to agentic development showcase (`.planning/`)

### CONTRIBUTING.md (Project Root)

**File:** `CONTRIBUTING.md`
**Purpose:** Guide potential contributors on how to participate.

**Structure:**
```markdown
# Contributing to Depot

Thank you for considering contributing to Depot!

## How to Contribute

### Reporting Bugs
Use the [Bug Report](https://github.com/user/depot/issues/new?template=bug_report.md) template.

### Suggesting Features
Use the [Feature Request](https://github.com/user/depot/issues/new?template=feature_request.md) template.

### Submitting Code

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/your-feature-name`
3. **Make your changes:**
   - Follow existing code style (TypeScript: Prettier, Rust: rustfmt)
   - Add tests if applicable
   - Update documentation
4. **Test your changes:** `npm run build && npm run tauri build`
5. **Commit your changes:** Use clear commit messages
6. **Push to your fork:** `git push origin feature/your-feature-name`
7. **Open a Pull Request**

## Development Setup

### Prerequisites
- Node.js 20+
- Rust 1.70+ (via rustup)
- Perforce command-line tools (`p4.exe`)

### Local Development
```bash
git clone https://github.com/user/depot.git
cd depot
npm install
npm run tauri dev  # Launches dev build with hot-reload
```

### Running Tests
```bash
npm test           # Frontend unit tests
npm run test:e2e   # End-to-end tests (requires P4 server)
```

## Code Review Process

All submissions require review. Maintainers will:
- Check code quality and style
- Verify functionality
- Ensure tests pass
- Provide feedback

## Community

- Be respectful and constructive
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md)
- Ask questions in [Discussions](https://github.com/user/depot/discussions)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
```

**Key points:**
- Clear step-by-step contribution process
- Local development setup instructions
- Links to issue templates (create in `.github/ISSUE_TEMPLATE/`)

### CODE_OF_CONDUCT.md (Project Root)

**File:** `CODE_OF_CONDUCT.md`
**Purpose:** Define expected behavior and enforcement policies.

**Recommendation:** Use **Contributor Covenant** (industry standard, GitHub recognizes it).

**Template:** https://www.contributor-covenant.org/version/2/1/code_of_conduct/

**Customization:** Update enforcement email to project maintainer email.

### SECURITY.md (Project Root)

**File:** `SECURITY.md`
**Purpose:** Security policy for reporting vulnerabilities.

**Structure:**
```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

**Do not open public GitHub issues for security vulnerabilities.**

Instead, please report security issues via email to: [your-email@example.com]

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

**Response time:** We aim to respond within 72 hours.

## Disclosure Policy

- Reporter receives acknowledgment within 72 hours
- Issue confirmed within 1 week
- Fix developed and tested
- Security advisory published (coordinated with reporter)
- Public disclosure after fix released

## Comments on This Policy

If you have suggestions on how this process could be improved, please submit a pull request.
```

**Key points:**
- Clear reporting channel (email, not public issues)
- Expected response times
- Coordinated disclosure process

### GitHub Issue Templates

**Location:** `.github/ISSUE_TEMPLATE/`

**Files to create:**
1. **`bug_report.md`** - Bug report template
2. **`feature_request.md`** - Feature suggestion template

**Bug report template:**
```markdown
---
name: Bug Report
about: Report a bug in Depot
title: '[BUG] '
labels: bug
assignees: ''
---

## Describe the Bug
A clear and concise description of what the bug is.

## To Reproduce
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What you expected to happen.

## Screenshots
If applicable, add screenshots.

## Environment
- Depot Version: [e.g. 0.1.0]
- Windows Version: [e.g. Windows 11 23H2]
- Perforce Server Version: [e.g. P4D/2023.1]

## Additional Context
Add any other context about the problem here.
```

**Feature request template:**
```markdown
---
name: Feature Request
about: Suggest a feature for Depot
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

## Feature Description
A clear and concise description of the feature.

## Use Case
Describe the problem this feature would solve.

## Proposed Solution
How you think this should work.

## Alternatives Considered
Other approaches you've thought about.

## Additional Context
Any other context or screenshots.
```

## Implementation Order (Phase Sequencing)

### Suggested Build Order

**Phase 1: Rename (MUST BE FIRST)**
- Update `package.json`, `Cargo.toml`, `tauri.conf.json` identifiers
- Search/replace code references
- Test builds to verify rename didn't break anything
- **Rationale:** All subsequent work references the new name. Doing this last creates merge conflicts.

**Phase 2: Security Audit**
- Review `.gitignore` for gaps (add Tauri artifacts, certificates, secrets)
- Scan Git history for accidentally committed secrets
- Run `gitleaks` or similar tool
- Clean up any found issues
- **Rationale:** Must be done before public release. Can't "unpublish" leaked secrets.

**Phase 3: Documentation Files**
- Create LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY
- Create `.github/ISSUE_TEMPLATE/` files
- **Rationale:** GitHub displays these immediately. Having incomplete docs looks unprofessional.

**Phase 4: GitHub Actions Workflows (Can parallelize)**
- Create `.github/workflows/ci.yml` (build validation)
- Create `.github/workflows/security-scan.yml` (npm/cargo audit)
- Test workflows on a feature branch
- **Rationale:** Non-blocking—can be added incrementally. Doesn't affect existing app functionality.

**Phase 5: Release Automation**
- Create `.github/workflows/publish.yml`
- Configure Windows code signing (if certificate available)
- Configure WebView2 installation mode
- Test release workflow (create draft release)
- **Rationale:** Depends on rename being complete (uses new product name). Code signing is optional for v0.1.

**Phase 6: Final Smoke Test**
- Build release binary locally
- Test all validated features (see PROJECT.md requirements list)
- Verify installer works
- Check that Settings persist with new app identifier
- **Rationale:** Last validation before public release. Catches any breaking changes from rename.

**Phase 7: Publish**
- Push version tag (e.g., `v0.1.0`)
- Trigger release workflow
- Review draft release
- Publish release
- Announce on social media / relevant forums

### Dependencies Between Phases

```
Phase 1 (Rename)
    ↓
Phase 2 (Security Audit)  →  Phase 3 (Documentation)
    ↓                              ↓
Phase 4 (CI Workflows)  ←  ←  ←  ←
    ↓
Phase 5 (Release Automation)
    ↓
Phase 6 (Smoke Test)
    ↓
Phase 7 (Publish)
```

**Parallelizable:**
- Phase 2 and Phase 3 can be done in parallel (no dependencies)
- Phase 4 can start once Phase 3 completes (needs documentation to reference in CI failure messages)

**Blocking dependencies:**
- Phase 5 MUST wait for Phase 1 (uses new product name in release tags/names)
- Phase 6 MUST wait for Phase 5 (tests release build process)

## Architectural Patterns

### Pattern 1: Draft Releases First

**What:** Always create draft releases in automation, never auto-publish.

**Why:** Allows manual review of:
- Release notes (auto-generated changelog may need editing)
- Binary integrity (download and smoke test before users see it)
- Version number correctness

**Implementation:** In `publish.yml`:
```yaml
with:
  releaseDraft: true  # Creates draft, doesn't publish
```

**Trade-off:** Extra manual step (review + publish), but prevents shipping broken releases.

### Pattern 2: Prerelease Flag for v0.x

**What:** Mark all v0.x releases as "pre-release" in GitHub.

**Why:** Signals to users that this is early testing software. GitHub displays "Pre-release" badge.

**Implementation:** In `publish.yml`:
```yaml
with:
  prerelease: true  # For versions < 1.0
```

**When to stop:** Remove `prerelease: true` when shipping v1.0 (production-ready).

### Pattern 3: Semantic Versioning with Internal/Public Split

**What:** Use dual versioning strategy:
- **Internal milestone:** v6.0 (preserves development history)
- **Public version:** v0.1.0 (signals early testing)

**Why:** GitHub releases use public version (user-facing), but internal docs track milestone progression (developer-facing).

**Implementation:**
- `tauri.conf.json`: `"version": "0.1.0"` (public)
- `PROJECT.md`: Track as "v6.0 Public Launch Preparation" (internal)

**Trade-off:** Slightly confusing to have two version numbers, but aligns user expectations (v0.1 = early) with developer context (v6.0 = sixth milestone).

### Pattern 4: Multi-Format Installers

**What:** Ship both NSIS and MSI installers.

**Why:**
- **NSIS:** Faster, smaller, user-friendly (recommended for most users)
- **MSI:** Enterprise IT prefers MSI for managed deployments

**Implementation:** In `tauri.conf.json`:
```json
{
  "bundle": {
    "targets": ["nsis", "msi"]
  }
}
```

**Trade-off:** Doubles build time (~2x longer), but serves both consumer and enterprise use cases.

### Pattern 5: Minimal Security Scanning for v0.1

**What:** Start with native npm/cargo audit, skip third-party SaaS tools.

**Why:** Third-party tools (Snyk, CodeQL, etc.) add complexity and setup overhead. For v0.1, focus on shipping.

**When to expand:** Add CodeQL or Snyk when:
- Project has active contributors (not just solo developer)
- Handling sensitive data (Depot doesn't—P4 credentials stay local)
- Compliance requirements (none for open-source project)

**Implementation:** Single workflow file (`security-scan.yml`) with 2 steps: `npm audit` and `cargo audit`.

## Anti-Patterns

### Anti-Pattern 1: Changing App Identifier After Public Release

**What people do:** Ship with identifier `com.a.p4now`, then change to `com.depot.app` later.

**Why it's wrong:** App identifier determines:
- Installation directory: `%LOCALAPPDATA%\com.a.p4now\`
- Settings storage location
- Windows registry entries

Changing identifier **creates a new app**—existing users see both old and new versions installed.

**Do this instead:** Choose permanent identifier **before first public release**. For Depot: `com.depot.app` (no personal domain, generic).

### Anti-Pattern 2: Auto-Publishing Releases

**What people do:** Set `releaseDraft: false` in workflow to automatically publish releases.

**Why it's wrong:** Broken builds get published immediately. Users download broken binaries before maintainer notices.

**Do this instead:** Always use `releaseDraft: true`. Manual publish step takes 30 seconds and prevents embarrassment.

### Anti-Pattern 3: Embedding Offline WebView2 Installer

**What people do:** Set `webviewInstallMode: "offlineInstaller"` to avoid download step.

**Why it's wrong:** Increases installer size by **127 MB** for minimal benefit. Most Windows 10/11 systems have WebView2 pre-installed.

**Do this instead:** Use `downloadBootstrapper` (default). Only embed if target users have **no internet access** (extremely rare).

### Anti-Pattern 4: Skipping .gitignore Audit

**What people do:** Assume existing `.gitignore` is sufficient, publish repo without review.

**Why it's wrong:** Tauri projects generate new artifacts (`.pfx` certificates, `target/` directories) that may contain secrets.

**Do this instead:** Before first public push:
1. Add Tauri-specific patterns to `.gitignore`
2. Run `git status --ignored` to check for sensitive files
3. Run `gitleaks` to scan Git history

### Anti-Pattern 5: Forgetting to Update Window Title

**What people do:** Rename `productName` in `tauri.conf.json` but forget `title` field.

**Why it's wrong:** Users see "p4now" in window title bar even after rename to "Depot". Looks unpolished.

**Do this instead:** Grep for all occurrences:
```bash
grep -r "p4now" src-tauri/tauri.conf.json package.json index.html
```

Update all references in a single commit.

## Integration Points

### Tauri Configuration Updates

**File:** `src-tauri/tauri.conf.json`

**Changes required:**
```json
{
  "productName": "Depot",          // Display name (was "p4now")
  "version": "0.1.0",               // Public version (unchanged)
  "identifier": "com.depot.app",   // Unique ID (was "com.a.p4now")
  "app": {
    "windows": [
      {
        "title": "Depot"            // Window title (was "p4now")
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],     // Multiple installer formats
    "windows": {
      "certificateThumbprint": "",  // Add when code signing
      "digestAlgorithm": "sha256",  // Add when code signing
      "timestampUrl": "http://timestamp.comodoca.com",
      "webviewInstallMode": "downloadBootstrapper"
    }
  }
}
```

### Package.json Updates

**File:** `package.json`

**Changes required:**
```json
{
  "name": "depot",                  // Package name (was "p4now")
  "version": "0.1.0",               // Public version (unchanged)
  "private": true,                  // Keep private (not publishing to NPM)
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "tauri": "tauri",
    "test:e2e": "wdio run e2e/wdio.conf.ts"
    // Add later: "release": "npm run build && npm run tauri build"
  }
}
```

### Cargo.toml Updates

**File:** `src-tauri/Cargo.toml`

**Changes required:**
```toml
[package]
name = "depot"                      # Crate name (was "p4now")
version = "0.1.0"                   # Public version (unchanged)
description = "A modern Windows Perforce GUI"
authors = ["Your Name"]             # Update author
edition = "2021"

[lib]
name = "depot_lib"                  # Library name (was "p4now_lib")
crate-type = ["staticlib", "cdylib", "rlib"]
```

### Settings Migration Consideration

**Issue:** Existing developers using p4now locally have settings stored in:
```
%LOCALAPPDATA%\com.a.p4now\settings.json
```

After rename, settings stored in:
```
%LOCALAPPDATA%\com.depot.app\settings.json
```

**Impact:** Developers lose connection settings after rename.

**Solutions:**
1. **Manual:** Document in README: "If you used pre-release builds, you'll need to re-enter connection settings"
2. **Automated:** Add migration code in Rust backend to copy old settings to new location (check if old path exists, copy to new path)

**Recommendation for v0.1:** Manual (document in README). Automated migration adds complexity for minimal benefit (only affects developers who used pre-release builds).

## Data Flow Changes

### Current Release Process (Manual)

```
Developer: npm run tauri build
    ↓
Cargo: Build Rust backend (src-tauri/)
    ↓
Vite: Build React frontend (src/)
    ↓
Tauri CLI: Bundle into installer
    ↓
Output: src-tauri/target/release/bundle/nsis/depot_0.1.0_x64-setup.exe
    ↓
Developer: Manually upload to GitHub Releases
```

**Time:** ~5 minutes (build) + ~5 minutes (manual upload and documentation)

### Automated Release Process (Post-Implementation)

```
Developer: git tag v0.1.0 && git push --tags
    ↓
GitHub Actions: Trigger publish.yml workflow
    ↓
Runner (windows-latest): Checkout code
    ↓
Runner: Setup Node.js + Rust toolchains
    ↓
Runner: Install dependencies (npm ci)
    ↓
Runner: [OPTIONAL] Import code signing certificate
    ↓
Runner: Build frontend (npm run build)
    ↓
Runner: Build backend (cargo build --release)
    ↓
Runner: Bundle installers (tauri build)
    ↓
Runner: [OPTIONAL] Sign binaries
    ↓
tauri-action: Upload artifacts to GitHub Release (draft)
    ↓
Developer: Review draft, edit release notes, publish
```

**Time:** ~10-15 minutes (automated) + ~2 minutes (manual review and publish)

**Benefits:**
- Consistent build environment (GitHub-hosted runner, not developer machine)
- Reproducible builds (same dependencies, same toolchain)
- Automatic checksums generation
- Easier to add multiple platforms later (just add matrix entries)

## Scaling Considerations

### Multi-Platform Expansion

**Current:** Windows only (x64)

**Future expansion:**
- Windows ARM64 (for Surface Pro X, ARM laptops)
- Linux (x64, ARM64)
- macOS (x64, ARM64)

**How to add:** Expand matrix in `publish.yml`:
```yaml
matrix:
  include:
    - platform: windows-latest
      args: ''
    - platform: ubuntu-22.04
      args: ''
    - platform: macos-latest
      args: '--target universal-apple-darwin'
```

**Blockers for Depot:**
- P4 CLI availability on target platform (P4 provides binaries for all major platforms)
- Platform-specific UI testing (current E2E tests only run on Windows)

**Timeline:** Defer to post-v1.0. Focus on Windows excellence first.

### Auto-Update System

**Not in scope for v0.1:** Tauri 2.0 supports auto-update plugin, but requires:
- Signed binaries (code signing certificate)
- Update server (can use GitHub Releases)
- Version checking logic

**When to add:** After v1.0, when update frequency increases and user base grows.

**Implementation preview:**
```rust
// In src-tauri/src/main.rs (future)
use tauri_plugin_updater::UpdaterExt;

tauri::Builder::default()
  .plugin(tauri_plugin_updater::init())
  .setup(|app| {
    app.handle().updater().check_for_updates();
    Ok(())
  })
```

**Requires:** `tauri.conf.json` update:
```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/user/depot/releases/latest/download/latest.json"
      ]
    }
  }
}
```

## Sources

### Tauri 2.0 Official Documentation
- [GitHub Actions Release Workflow](https://v2.tauri.app/distribute/pipelines/github/)
- [Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/)
- [Windows Installer Configuration](https://v2.tauri.app/distribute/windows-installer/)
- [Tauri Configuration Reference](https://v2.tauri.app/reference/config/)

### GitHub Resources
- [tauri-apps/tauri-action](https://github.com/tauri-apps/tauri-action) - Official GitHub Action for building Tauri apps

### Open Source Best Practices
- [Best Practices to Manage an Open Source Project](https://blog.codacy.com/best-practices-to-manage-an-open-source-project)
- [GitHub: Licensing a Repository](https://docs.github.com/articles/licensing-a-repository)
- [README Best Practices](https://github.com/jehna/readme-best-practices)
- [GitHub Special Files](https://gist.github.com/jakebrinkmann/c63eaedbe384516e4a7bc133c1e1066b) - LICENSE, CONTRIBUTING, CODE_OF_CONDUCT

### Security Tools and Practices
- [GitHub Secret Scanning](https://docs.github.com/code-security/secret-scanning/about-secret-scanning)
- [Top Open-Source Security Tools (2026)](https://www.wiz.io/academy/application-security/open-source-code-security-tools)
- [Code Scanning Integrations](https://github.blog/news-insights/product-news/new-code-scanning-integrations-open-source-security-tools/)
- [Yelp detect-secrets](https://github.com/Yelp/detect-secrets) - Enterprise secret detection tool

---
*Architecture research for: Depot Public Launch Preparation*
*Researched: 2026-02-05*
*Confidence: HIGH (all integration points verified with Tauri 2.0 official documentation)*
