# Stack Research

**Domain:** GitHub Release Automation & Repository Preparation
**Researched:** 2026-02-05
**Confidence:** HIGH

## Recommended Stack

### GitHub Actions & CI/CD

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| tauri-apps/tauri-action | v0 | Build & release automation for Tauri apps | Official Tauri action with native support for multi-platform builds, automatic GitHub release creation, and updater.json generation. Handles Windows, macOS, and Linux builds with built-in code signing support. |
| actions/checkout | v4 | Repository checkout | Standard GitHub Actions checkout with current best practices for authentication and submodule handling. |
| actions/setup-node | v4 | Node.js environment setup | Latest LTS support with caching for npm dependencies. |
| dtolnay/rust-toolchain | stable | Rust toolchain installation | Minimal, fast Rust toolchain setup from trusted maintainer. Preferred over actions-rs (unmaintained). |
| github/codeql-action/upload-sarif | v3 | Security scan result upload | Official GitHub action for uploading SARIF-formatted security scan results to GitHub Security tab. |

### Security Scanning - Credential Detection

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Gitleaks | latest | Secret and credential scanning | Lightweight, fast secret detection built in Go. Preferred for CI/CD due to speed (faster than TruffleHog on large repos). Uses high-entropy detection and 350+ built-in secret patterns. Best for catching hardcoded credentials before they reach GitHub. |
| trufflesecurity/trufflehog-actions-scan | v3 | Deep secret scanning with verification | Optional secondary scanner with 600+ detectors and automatic API validation. More thorough than Gitleaks but slower. Use for comprehensive pre-release audits, not in CI pipeline. |

**Recommendation:** Use Gitleaks in CI pipeline for every commit. Run TruffleHog manually before major releases for comprehensive audit.

### Security Scanning - Dependencies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| cargo-audit | latest | Rust dependency vulnerability scanning | Official RustSec tooling for checking Cargo.lock against RustSec Advisory Database. Fast, focused, and Rust-native. |
| cargo-deny | 0.14+ | Comprehensive Rust dependency policy enforcement | Goes beyond advisories - enforces license policy, detects duplicate dependencies, bans specific crates, and validates sources. Essential for open-source projects where license compliance matters. |
| npm audit | built-in | JavaScript dependency scanning | Built into npm, uses GitHub Advisory Database (superset of npm database). Zero-config scanning via `npm audit --audit-level=moderate`. |
| aquasecurity/trivy-action | latest | Multi-language dependency & container scanning with SARIF output | Comprehensive scanner supporting JavaScript, Rust, and container images. Outputs SARIF format for GitHub Security integration. Use as unified scanner for both Rust and JavaScript dependencies. |

**Recommendation:** Use cargo-deny for comprehensive Rust checks (advisories + licenses + bans). Use Trivy with SARIF upload for unified security reporting in GitHub Security tab. npm audit runs automatically during install.

### Windows Code Signing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Azure Trusted Signing | current | Modern Windows code signing service | Microsoft's new code signing service (released 2024). Relatively cheap, cloud-based, integrates with GitHub Actions. Provides immediate SmartScreen reputation (no warnings). Recommended over traditional EV certificates on USB HSMs. |
| trusted-signing-cli | latest | Azure Trusted Signing CLI tool | Official Microsoft CLI for Azure Trusted Signing. Works cross-platform (can sign from macOS/Linux runners). Requires .NET 6+ and Azure CLI. |

**Configuration:** Set `bundle.windows.signCommand` in tauri.conf.json to use trusted-signing-cli. Store Azure credentials (CLIENT_ID, CLIENT_SECRET, TENANT_ID) in GitHub Secrets.

**Alternative:** If using traditional certificate, configure via `bundle.windows.certificateThumbprint` and `bundle.windows.digestAlgorithm` (typically SHA256). EV certificates provide immediate reputation; OV certificates require building reputation over time.

### Changelog & Release Automation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| git-cliff | latest | Changelog generation from conventional commits | Highly customizable Rust-based changelog generator. Fast, supports conventional and unconventional commits, extensive template customization. Recommended over conventional-changelog (Node-based, slower). |
| GitHub Auto-generated Release Notes | built-in | Automatic release note generation | Native GitHub feature configured via `.github/release.yml`. Categorizes changes by PR labels. Zero dependencies, maintained by GitHub. Use this for release notes, git-cliff for CHANGELOG.md. |

**Recommendation:** Use GitHub auto-generated release notes for GitHub Releases. Use git-cliff to maintain CHANGELOG.md file in repository. Configure git-cliff via `.git-cliff.toml` to match your commit style.

### Documentation & Repository Presentation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| shields.io | hosted service | Dynamic badges for README | Industry-standard badge service. Supports GitHub Actions workflow status, release version, license, downloads, and 300+ other integrations. Free, fast CDN. |
| schneegans/dynamic-badges-action | v1.7+ | Custom dynamic badges | For badges that change with every commit (e.g., coverage, performance metrics). Creates JSON on Gist and uses shields.io/endpoint. |

**Badge recommendations:**
- GitHub Actions workflow status: `https://img.shields.io/github/actions/workflow/status/<user>/<repo>/<workflow>.yml?branch=main`
- Latest release: `https://img.shields.io/github/v/release/<user>/<repo>`
- License: `https://img.shields.io/github/license/<user>/<repo>`
- Downloads: `https://img.shields.io/github/downloads/<user>/<repo>/total`

### Tauri Updater Configuration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| tauri-plugin-updater | 2.10.0+ | Auto-update functionality for Tauri apps | Official Tauri plugin for in-app updates. Version 2.10+ supports new latest.json format with per-installer signatures. |
| tauri-action updater integration | included | Automatic latest.json generation | tauri-action with `includeUpdaterJson: true` generates latest.json and .sig files automatically. No manual signature management needed. |

**Security:** Updater signatures cannot be disabled (by design). Private key stored in GitHub Secrets (`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`). Public key in tauri.conf.json. Signatures change with each build - tauri-action handles this automatically.

### Refactoring & Renaming Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| IDE Rename Refactoring (VS Code F2) | Symbol-aware renaming | Use VS Code's built-in "Rename Symbol" (F2) for TypeScript/JavaScript. Renames across all files safely. |
| rust-analyzer Rename | Rust symbol renaming | Built into rust-analyzer (LSP). Use in VS Code or CLI via rust-analyzer rename-symbol. |
| find + sed (bash) | File content and path renaming | For bulk renaming in configs, docs, and file paths. Pattern: `find . -type f -name "*.json" -exec sed -i 's/p4now/depot/g' {} +` |
| git mv | File and directory renaming | Preserves Git history. Use `git mv old-path new-path` for all file moves. |

**Renaming strategy:**
1. Use IDE refactoring for code symbols (functions, types, variables)
2. Use git mv for file/directory structure changes
3. Use find + sed for configs, documentation, and package.json
4. Update tauri.conf.json identifier, productName, and bundle.identifier (affects app installation path)

## Installation

### GitHub Actions (no local install)
All CI/CD tools run in GitHub Actions. No local installation required.

### Local Development Tools

```bash
# Rust security tooling
cargo install cargo-audit
cargo install cargo-deny

# Changelog generation
cargo install git-cliff

# Initialize cargo-deny configuration
cargo deny init
```

### Windows Code Signing (for local testing)
```bash
# Install .NET 6+ (required for trusted-signing-cli)
winget install Microsoft.DotNet.SDK.8

# Install Azure CLI
winget install Microsoft.AzureCLI

# Install trusted-signing-cli
dotnet tool install --global Microsoft.Trusted.Signing.Cli
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Gitleaks | TruffleHog | Use TruffleHog for comprehensive pre-release audits (scans Docker images, S3 buckets, cloud storage). TruffleHog has 600+ detectors vs Gitleaks 350+. Trade-off: slower, more resource-intensive. |
| cargo-deny | cargo-audit only | Use just cargo-audit if you don't need license enforcement or duplicate detection. cargo-deny is superset of cargo-audit functionality. |
| Trivy | Snyk | Use Snyk if you need commercial support, better false-positive filtering, or integration with Snyk's vulnerability database (broader coverage than OSV/NVD). Trade-off: requires account, not fully open-source. |
| git-cliff | conventional-changelog | Use conventional-changelog if your team is heavily Node.js-focused and prefers JavaScript tooling. Trade-off: slower, less flexible templates. |
| Azure Trusted Signing | Traditional EV Certificate on HSM | Use traditional certificate if you already have one or cannot use cloud services. Trade-off: more expensive ($300-500/year), requires USB HSM device, less convenient for CI/CD. |
| GitHub Auto Release Notes | Release Drafter action | Use Release Drafter if you want staged draft releases or more control over release note formatting. Trade-off: additional configuration, not native GitHub feature. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| actions-rs/* actions | Unmaintained since 2021 | dtolnay/rust-toolchain for toolchain setup, cargo commands directly for build/test |
| OV Code Signing Certificates (post-June 2023) | No longer available for individual purchase, immediately trigger SmartScreen warnings | Azure Trusted Signing (EV equivalent, cloud-based, cheaper) |
| ggshield (GitGuardian CLI) | Commercial tool requiring account, less suitable for open-source projects | Gitleaks (fully open-source, no account required) |
| semantic-release | Opinionated release automation that controls versioning - not suitable for projects with manual version control | git-cliff + GitHub Releases + manual version bumps |
| CodeQL for dependency scanning | CodeQL is for static code analysis, not dependency scanning | Trivy or cargo-audit + npm audit for dependencies |

## Configuration Examples

### GitHub Actions Workflow - Release

Minimal workflow for Tauri release automation:

```yaml
name: Release
on:
  push:
    branches: [release]

jobs:
  release:
    permissions:
      contents: write  # Required for creating releases
    strategy:
      matrix:
        platform: [windows-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          cache: 'npm'

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies
        run: npm ci

      - name: Build and Release
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
        with:
          includeUpdaterJson: true
```

### GitHub Actions Workflow - Security Scanning

Comprehensive security scanning with SARIF upload:

```yaml
name: Security Scan
on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  scan:
    permissions:
      security-events: write  # Required for SARIF upload
      contents: read
      actions: read
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          vuln-type: 'library'
          severity: 'CRITICAL,HIGH'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'

      - name: Run cargo-deny
        uses: EmbarkStudios/cargo-deny-action@v1
```

### cargo-deny Configuration

Example `deny.toml` for open-source project with MIT license:

```toml
[advisories]
version = 2
ignore = []

[licenses]
version = 2
allow = [
    "MIT",
    "Apache-2.0",
    "Apache-2.0 WITH LLVM-exception",
    "BSD-3-Clause",
    "ISC",
]
confidence-threshold = 0.8

[bans]
multiple-versions = "warn"
wildcards = "allow"
highlight = "all"

[sources]
unknown-registry = "warn"
unknown-git = "warn"
allow-git = []
```

### git-cliff Configuration

Example `.git-cliff.toml` for conventional commits:

```toml
[changelog]
header = """
# Changelog\n
All notable changes to this project will be documented in this file.\n
"""
body = """
{% for group, commits in commits | group_by(attribute="group") %}
    ### {{ group | upper_first }}
    {% for commit in commits %}
        - {{ commit.message | upper_first }}\
    {% endfor %}
{% endfor %}\n
"""

[git]
conventional_commits = true
filter_unconventional = false
commit_parsers = [
    { message = "^feat", group = "Features"},
    { message = "^fix", group = "Bug Fixes"},
    { message = "^doc", group = "Documentation"},
    { message = "^perf", group = "Performance"},
    { message = "^refactor", group = "Refactoring"},
    { message = "^test", group = "Testing"},
    { message = "^chore", group = "Miscellaneous"},
]
```

### Tauri Updater Configuration

In `tauri.conf.json`, configure updater:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/<owner>/<repo>/releases/latest/download/latest.json"
      ],
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

Generate key pair:
```bash
npm run tauri signer generate -- -w ~/.tauri/signing-key
```

Store private key in GitHub Secrets:
- `TAURI_SIGNING_PRIVATE_KEY`: Content of private key file
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Password for private key

## Version Compatibility

| Technology | Compatible With | Notes |
|-----------|-----------------|-------|
| Tauri 2.0 | Rust 1.70+ | Minimum Rust version for Tauri 2.0 |
| tauri-plugin-updater 2.10+ | Tauri 2.0 | Required for new latest.json format with per-installer signatures |
| tauri-action@v0 | Tauri 2.0 | V0 supports Tauri 2.x; older versions for Tauri 1.x |
| cargo-deny 0.14+ | Rust 1.70+ | Latest version with SPDX 3.11 license identifiers |
| trusted-signing-cli | .NET 6+ | Requires .NET SDK 6.0 or higher |
| npm audit | npm 6+ | Built-in since npm 6, uses GitHub Advisory Database since npm 8 |

## Stack Patterns by Variant

**If planning public beta/early access:**
- Enable Tauri updater from day one
- Configure tauri-action with `includeUpdaterJson: true`
- Store signing keys in GitHub Secrets
- Users will receive automatic updates without re-downloading

**If targeting enterprise/IT-managed deployments:**
- Disable auto-updater (enterprise may block auto-updates)
- Focus on MSI installer for Windows (supports Group Policy deployment)
- Consider code signing certificate from recognized CA (not Azure Trusted Signing)
- Provide manual update instructions and release notes

**If open-source with community contributions:**
- Implement cargo-deny with strict license allowlist (avoid GPL contamination for MIT project)
- Run security scans on every PR (Gitleaks + Trivy)
- Enable GitHub Security tab with SARIF uploads
- Use git-cliff with conventional commits for community-readable changelog

**If closed-source or early development:**
- Security scanning still essential (prevent credential leaks)
- Code signing optional for internal testing (use self-signed)
- Auto-updates valuable for rapid iteration with testers
- Release automation reduces friction for frequent releases

## Tauri 2.0 Specific Considerations

**Bundle Targets:** Tauri 2.0 Windows defaults to NSIS and MSI installers. Configure via `bundle.targets` in tauri.conf.json:
- NSIS: Lightweight installer, supports auto-updater, recommended for consumer apps
- MSI: Enterprise-friendly, Group Policy deployment, recommended for IT-managed environments

**Identifier Changes:** Changing `identifier` in tauri.conf.json affects:
- Installation path: `%LOCALAPPDATA%\{identifier}`
- Registry keys: `HKCU\Software\{identifier}`
- Update mechanism: Different identifier = different app to Windows
- **Implication:** Changing identifier from `com.a.p4now` to `com.depot.app` means users must uninstall old version

**Icon Requirements:** Tauri 2.0 requires icons in multiple formats:
- `icon.ico` (Windows): 32x32, 128x128, 256x256 embedded sizes
- `icon.icns` (macOS): Multiple resolutions
- PNG icons: 32x32, 128x128, 128x128@2x

## Security Best Practices for Open-Source Release

1. **Credential Audit Before First Public Release:**
   - Run TruffleHog with `--since-commit <first-commit>` to scan entire history
   - Check for hardcoded IPs, internal paths, or machine names
   - Review `.git/config` for any internal URLs

2. **GitHub Secrets Configuration:**
   - Store all signing keys and Azure credentials in GitHub Secrets (never in code)
   - Use environment-specific secrets (production vs staging)
   - Enable "Required reviewers" for production environment

3. **Branch Protection:**
   - Require status checks to pass before merging to main/master
   - Require Gitleaks and Trivy scans to pass
   - Enable "Require signed commits" for added security

4. **Dependabot Configuration:**
   - Enable Dependabot for both npm and Cargo dependencies
   - Configure `.github/dependabot.yml` for automatic PR creation
   - Set update frequency to weekly for security updates

5. **Security Tab:**
   - Enable vulnerability alerts for repositories
   - Enable Dependabot security updates
   - Use SARIF uploads to centralize security findings

## Renaming Checklist (p4now → Depot)

**Required changes for complete rename:**

1. **Package identifiers:**
   - `package.json`: name field → "depot"
   - `src-tauri/Cargo.toml`: name field → "depot"
   - `src-tauri/Cargo.toml`: lib.name → "depot_lib"
   - `tauri.conf.json`: productName → "Depot"
   - `tauri.conf.json`: identifier → "com.depot.app" (WARNING: Breaking change for existing users)

2. **Window titles:**
   - `tauri.conf.json`: app.windows[].title → "Depot"

3. **Documentation:**
   - README.md: All references p4now → Depot
   - LICENSE: Update copyright holder if needed
   - CHANGELOG.md: Note rename in latest version entry

4. **Source code:**
   - Use IDE rename refactoring for any code symbols named "p4now" or "P4Now"
   - Search for string literals: `grep -r "p4now" src/ src-tauri/src/`

5. **Assets:**
   - Repository name: Rename on GitHub (Settings → Rename repository)
   - Icon files: Update if they contain "p4now" text
   - Screenshots: Retake if they show "p4now" in window title

6. **Git history:**
   - All handled by `git mv` and IDE refactoring (preserves history)
   - No need for history rewriting (Git tracks file renames)

## Sources

### Official Documentation (HIGH confidence)
- [Tauri 2.0 GitHub Actions Pipeline](https://v2.tauri.app/distribute/pipelines/github/) — Workflow configuration, token permissions
- [Tauri Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/) — Azure Trusted Signing, certificate types
- [Tauri Updater Plugin](https://v2.tauri.app/plugin/updater/) — Configuration, signature requirements
- [GitHub Docs: Uploading SARIF Files](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) — SARIF format, upload requirements
- [GitHub Docs: Auto-generated Release Notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes) — Native release notes feature
- [Shields.io GitHub Actions Badges](https://shields.io/badges/git-hub-actions-workflow-status) — Badge URL formats
- [RustSec Advisory Database](https://rustsec.org/) — cargo-audit data source
- [cargo-deny Documentation](https://embarkstudios.github.io/cargo-deny/) — Configuration, license checks
- [git-cliff Documentation](https://git-cliff.org/) — Configuration, conventional commits

### Security Tool Comparisons (MEDIUM confidence)
- [TruffleHog vs Gitleaks Comparison - Jit](https://www.jit.io/resources/appsec-tools/trufflehog-vs-gitleaks-a-detailed-comparison-of-secret-scanning-tools) — Performance, features comparison
- [Secret Scanner Comparison - Medium](https://medium.com/@navinwork21/secret-scanner-comparison-finding-your-best-tool-ed899541b9b6) — Tool capabilities
- [Top 8 Git Secrets Scanners 2026 - Jit](https://www.jit.io/resources/appsec-tools/git-secrets-scanners-key-features-and-top-tools-) — Current tool landscape

### Recent Best Practices (MEDIUM confidence - 2026)
- [How to Run Security Scanning with GitHub Actions - OneUpTime (2026-01-25)](https://oneuptime.com/blog/post/2026-01-25-security-scanning-github-actions/view) — Trivy + SARIF workflow examples
- [How to Automate Releases with GitHub Actions - OneUpTime (2026-01-25)](https://oneuptime.com/blog/post/2026-01-25-automate-releases-github-actions/view) — Changelog automation patterns
- [Sherlock Rust Security & Auditing Guide 2026](https://sherlock.xyz/post/rust-security-auditing-guide-2026) — cargo-auditable recommendations
- [Beyond Cargo Audit - Anchore (2025-12)](https://anchore.com/blog/beyond-cargo-audit-securing-your-rust-crates-in-container-images/) — cargo-auditable for deployed artifacts

### GitHub Action Repositories (HIGH confidence)
- [tauri-apps/tauri-action](https://github.com/tauri-apps/tauri-action) — Official Tauri release action
- [gitleaks/gitleaks-action](https://github.com/gitleaks/gitleaks-action) — Gitleaks integration
- [EmbarkStudios/cargo-deny-action](https://github.com/EmbarkStudios/cargo-deny-action) — cargo-deny integration
- [aquasecurity/trivy-action](https://github.com/aquasecurity/trivy-action) — Trivy scanner action

---
*Stack research for: GitHub Release Automation for Tauri 2.0 Desktop Application*
*Researched: 2026-02-05*
*Focus: Tools and workflows for preparing Depot (formerly P4Now) for public open-source release*
