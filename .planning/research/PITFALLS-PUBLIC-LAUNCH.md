# Pitfalls Research: Public Launch Preparation

**Domain:** Desktop Application Public Open-Source Release
**Project:** Depot (Tauri 2.0 + Rust + React, Windows-focused Perforce GUI)
**Researched:** 2026-02-05
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Credentials in Git History

**What goes wrong:**
Credentials, API keys, tokens, or secrets committed to Git remain in the repository history forever, even after deletion from current code. Automated bots scan GitHub for leaked credentials within minutes of making repositories public, often exploiting them within 5 minutes of exposure.

**Why it happens:**
- Developers commit `.env` files or config files with secrets during development
- Test data includes real credentials or tokens
- Internal server names, IP addresses, or authentication details in comments
- Debug configurations with hardcoded authentication
- The false belief that deleting files in a later commit removes them from history

**How to avoid:**
1. **Scan entire Git history BEFORE going public:**
   - Use Gitleaks: `gitleaks detect --source . --verbose`
   - Use TruffleHog: `trufflehog git file://. --only-verified`
   - Both tools scan all branches, tags, and deleted commits
2. **If secrets found, use git history rewriting:**
   - Use BFG Repo-Cleaner or git-filter-repo to purge secrets
   - Force-push cleaned history (acceptable when still private)
3. **Add pre-commit hooks to prevent future leaks:**
   - Install Gitleaks as pre-commit hook
   - Block commits containing patterns like API keys, tokens, passwords
4. **Audit these specific areas:**
   - All `.env*` files (should be in `.gitignore`)
   - `src-tauri/tauri.conf.json` for hardcoded paths
   - Test files with real P4 credentials
   - Comments containing internal server names or IPs
   - Debug configurations in IDE files

**Warning signs:**
- `.env` files tracked in Git (run: `git log --all --full-history -- "*.env"`)
- Grep finds credential-like patterns: `git grep -i "password\|token\|api.?key\|secret" $(git rev-list --all)`
- Internal server names or IPs in codebase
- Hardcoded authentication in test helpers

**Phase to address:**
**Phase 1: Security Audit** (MUST complete before any public activity)

---

### Pitfall 2: Incomplete Rename Breaking Build or Runtime

**What goes wrong:**
Renaming from "p4now" to "Depot" requires changing dozens of references across configuration files, build manifests, Rust code, and package files. Missing even one reference causes:
- Build failures (package name mismatches)
- Runtime errors (identifier mismatches)
- Broken imports (namespace changes)
- User data loss (app identifier change affects settings storage)

**Why it happens:**
- Rename tools only handle some file types
- Configuration files use different field names (`name`, `productName`, `identifier`, `package`)
- String literals in code not caught by refactoring tools
- Comments and documentation contain old name
- Visual Studio/Rust have different renaming scopes

**How to avoid:**
1. **Create comprehensive rename checklist:**
   - `package.json`: `"name": "p4now"` → `"name": "depot"`
   - `src-tauri/Cargo.toml`: `name = "p4now"` → `name = "depot"` AND `name = "p4now_lib"` → `name = "depot_lib"`
   - `src-tauri/tauri.conf.json`:
     - `"productName": "p4now"` → `"productName": "Depot"`
     - `"identifier": "com.a.p4now"` → `"com.a.depot"` (WARNING: breaks existing installations)
     - `"title": "p4now"` → `"title": "Depot"`
   - Window titles, error messages, user-facing strings
   - README, documentation, license headers
   - Git repository name on GitHub
   - E2E test configurations (`e2e/wdio.conf.ts`)
   - Tauri binary paths and process names
2. **Use automated tools where possible:**
   - Rust: Use Refactor → Rename for namespace changes
   - dotnet: Use ProjectRenamer tool
   - Find/replace with regex for string literals
3. **Test after rename:**
   - Full build from clean state: `npm run build`
   - E2E tests: `npm run test:e2e`
   - Fresh install and verify app starts
   - Verify settings persist (check storage paths)

**Warning signs:**
- Build errors mentioning old package name
- `cargo build` fails with "crate not found"
- Runtime errors about missing modules
- Settings don't persist after rename (storage path changed)
- Grep still finds old name: `rg -i "p4now" --type-not lock`

**Phase to address:**
**Phase 2: Rename Execution** (before any branding/documentation work)

---

### Pitfall 3: Changing Bundle Identifier Breaks Existing Installations

**What goes wrong:**
Changing the Tauri `identifier` field from `com.a.p4now` to `com.a.depot` creates a new app identity from the OS perspective. Existing installations:
- Won't automatically update to the new identifier
- Lose access to their settings (stored under old identifier path)
- Lose window position, size, and state
- Appear as a completely different app to Windows

**Why it happens:**
- Bundle identifier is used by OS for app identity, storage paths, and update tracking
- Tauri uses identifier for settings storage via `tauri-plugin-store`
- Windows uses identifier for app registration and SmartScreen reputation
- Developers don't realize identifier change is a breaking change for users

**How to avoid:**
1. **Choose final identifier NOW before any testing:**
   - Use `com.depot.app` (professional, matches GitHub org if you create one)
   - Or keep `com.a.depot` if this is personal branding
   - NEVER change after first public release
2. **If you MUST change identifier:**
   - Document as breaking change in release notes
   - Provide migration tool to copy settings from old to new path
   - Accept that SmartScreen reputation resets (see Pitfall 5)
3. **Settings migration strategy:**
   - Detect old settings path on first launch
   - Copy settings to new path
   - Show migration notice to users
   - Leave old settings intact (don't delete)

**Warning signs:**
- Identifier doesn't match intended public brand
- Identifier contains personal username or temporary names
- Test installations lose settings after identifier change

**Phase to address:**
**Phase 2: Rename Execution** (decide identifier before any testing)

---

### Pitfall 4: Unsigned Windows Binary Triggers SmartScreen Warnings

**What goes wrong:**
Unsigned Windows executables trigger "Windows Defender SmartScreen prevented an unrecognized app from starting" warnings. Users must click "More info" then "Run anyway" to install, causing:
- Users abandoning installation (perceive as malware)
- Reduced trust in the application
- Support burden explaining warnings
- Reputation damage on first impression

**Why it happens:**
- Windows requires code signing certificates to avoid SmartScreen warnings
- Since March 2024, even EV certificates require reputation building (no instant bypass)
- Reputation builds slowly over time (months, thousands of downloads)
- Microsoft changed SmartScreen to trust-based model in 2024-2026

**How to avoid:**
**Option 1: Accept unsigned for v0.1 early testing (RECOMMENDED for now)**
- Document prominently in README: "Early alpha, unsigned binary, expect SmartScreen warnings"
- Provide instructions with screenshots on bypassing SmartScreen
- Explain this is normal for new open-source projects
- Plan to get code signing certificate if project gains traction

**Option 2: Get code signing certificate**
- Purchase OV or EV code signing certificate ($100-400/year)
- Note: Certificate does NOT eliminate warnings immediately
- SmartScreen still shows warnings until reputation builds
- Reputation requires months and thousands of downloads
- Configure Tauri for code signing in `tauri.conf.json`:
  ```json
  "bundle": {
    "windows": {
      "certificateThumbprint": "CERTIFICATE_THUMBPRINT",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
  ```

**Option 3: Microsoft Trusted Signing (2026 solution)**
- Microsoft's fully managed signing solution
- Eliminates SmartScreen prompts without reputation building
- Research if available for individual developers in 2026

**Warning signs:**
- No code signing configuration in `tauri.conf.json`
- README doesn't mention SmartScreen warnings
- GitHub releases don't include security disclaimer
- Users report "Windows blocked this app" in issues

**Phase to address:**
**Phase 4: Distribution Preparation** (before inviting testers)

---

### Pitfall 5: Release Workflow Fails on First Public Run

**What goes wrong:**
GitHub Actions workflows that work in private repos fail when going public due to:
- Missing secrets (only configured in private repo settings)
- Workflows triggered by other workflows (GitHub limitation)
- Draft vs. published release confusion
- YAML syntax errors not caught locally
- Tag hash doesn't include workflow fixes
- Permissions issues with public repository tokens

**Why it happens:**
- Workflows aren't tested in public context until launch
- GitHub has different behavior for public vs. private repos
- Secrets don't transfer when making repo public
- Workflow triggers behave differently for automated releases
- First public run is the first time external contributors could trigger workflows

**How to avoid:**
1. **Test release workflow BEFORE going public:**
   - Create test release in private repo
   - Verify all steps complete successfully
   - Check artifact uploads work
   - Verify release notes generation works
2. **Audit required secrets:**
   - Document all required secrets in README or CONTRIBUTING.md
   - For public launch, you likely don't need secrets yet (no code signing, no deployment)
   - If using code signing, ensure `WINDOWS_CERTIFICATE` and `WINDOWS_CERTIFICATE_PASSWORD` are set
3. **Use manual trigger for first public release:**
   ```yaml
   on:
     workflow_dispatch:  # Manual trigger
     release:
       types: [published]  # Not 'created' - avoid drafts
   ```
4. **Common GitHub Actions pitfalls:**
   - Use `published` not `created` (avoids draft releases triggering)
   - Don't use workflows to create releases that trigger other workflows
   - Update tag hash if fixing workflow (old tag hash lacks fixes)
   - Check artifact retention limits (90 days for free accounts)
5. **Validate workflow syntax:**
   - Use GitHub's workflow validator before committing
   - Test with `act` locally (GitHub Actions simulator)
   - Review Actions tab after push to see if workflow recognized

**Warning signs:**
- No GitHub Actions workflows exist yet
- Workflows haven't been tested in private repo
- Secrets referenced but not documented
- Release workflow contains complex triggers (chained workflows)
- Workflow uses features that require GitHub Pro (longer artifacts, etc.)

**Phase to address:**
**Phase 5: Automation Setup** (after rename, before public launch)

---

### Pitfall 6: Missing Prerequisites in Documentation

**What goes wrong:**
README installation instructions assume readers have prerequisites installed. New users following instructions encounter:
- "Command not found" errors (missing Rust, Node, Tauri CLI)
- Wrong versions (Tauri v1 vs. v2, Node 16 vs. 20)
- Platform-specific errors (missing Windows build tools)
- Confusing error messages with no clear fix
- Users abandon setup and never try the app

**Why it happens:**
- Developers already have environment configured
- "Works on my machine" blindness
- Assuming readers know the stack (Rust + Node + Tauri)
- Not testing setup on clean machine
- Documentation updated after environment evolved

**How to avoid:**
1. **List ALL prerequisites with exact versions:**
   ```markdown
   ## Prerequisites
   - **Windows 10/11** (primary platform)
   - **Node.js 20+** - [Download](https://nodejs.org/)
   - **Rust 1.75+** - [Install via rustup](https://rustup.rs/)
   - **Visual Studio Build Tools** (for Rust on Windows)
     - Install "Desktop development with C++" workload
     - Or install via: `npm install --global windows-build-tools`
   - **Perforce client (p4.exe)** - Must be in PATH
     - [Download P4V](https://www.perforce.com/downloads/helix-visual-client-p4v)
   ```
2. **Include verification steps:**
   ```markdown
   Verify prerequisites:
   ```bash
   node --version  # Should show v20.x or higher
   cargo --version # Should show 1.75.x or higher
   p4 -V           # Should show P4/NTX64/...
   ```
   ```
3. **Test setup on clean machine:**
   - Use Windows VM or fresh Windows install
   - Follow README instructions exactly
   - Document every error encountered
   - Add missing steps to README
4. **Link to official installation guides:**
   - Don't replicate full Rust install instructions
   - Link to rustup.rs with specific flags if needed
   - Link to Node.js download page
5. **Platform-specific notes:**
   ```markdown
   ### Windows-Specific Setup
   - Ensure P4 is in your PATH (verify with `p4 -V`)
   - If Rust build fails, install Visual Studio Build Tools
   - Some antivirus software may block Tauri dev server (port 1420)
   ```

**Warning signs:**
- README has no prerequisites section
- Prerequisites don't mention versions
- No verification steps provided
- Setup instructions not tested on clean machine
- GitHub issues asking "How do I install Rust?"

**Phase to address:**
**Phase 3: Documentation Creation** (before inviting any testers)

---

### Pitfall 7: Over-Promising Stability for v0.1 Alpha

**What goes wrong:**
Users expect production-ready software but encounter:
- Crashes and data loss
- Missing features shown in screenshots
- Breaking changes between versions
- Bugs that "should have been caught"
- Frustration and negative first impressions

**Why it happens:**
- Developer excitement leads to overpromising
- Screenshots show polished features but core is unstable
- "It works for me" doesn't translate to "it works for everyone"
- No clear disclaimer that this is early alpha
- Version number (v0.1) too subtle to communicate instability

**How to avoid:**
1. **Prominent alpha disclaimer in README:**
   ```markdown
   # Depot

   > **⚠️ EARLY ALPHA - v0.1**
   > This is an early testing release. Expect bugs, crashes, and breaking changes.
   > **Not recommended for production use.** Use at your own risk.
   >
   > Please report issues on [GitHub Issues](link) — all feedback helps!
   ```
2. **Set clear expectations about stability:**
   ```markdown
   ## Current Status (v0.1)

   **What works:**
   - View pending changelists
   - Submit changes
   - View file history

   **Known limitations:**
   - No offline mode
   - Limited error handling
   - Windows-only (macOS/Linux untested)
   - May crash with large changelists

   **What's coming:**
   - See [Roadmap](link) for planned features
   ```
3. **Alpha testing guidance:**
   - Recommend test repositories, not production work
   - Advise keeping P4V installed as backup
   - Warn about potential data loss
   - Set expectations: "Testing, not production use"
4. **Version number communicates maturity:**
   - v0.1.x = early alpha (current)
   - v0.5.x = late alpha (feature-complete but unstable)
   - v1.0.x = stable release (production-ready)
5. **Release notes emphasize "testing" not "using":**
   ```markdown
   ## v0.1.0 - Initial Alpha Release

   This is an **early testing release** to gather feedback from the community.
   Please help us improve by reporting bugs and suggesting features.

   **This release is NOT production-ready.** Use P4V for critical work.
   ```
6. **GitHub issue templates guide feedback:**
   - Pre-filled "Is this a bug or expected alpha limitation?"
   - Encourage feature requests
   - Thank users for testing

**Warning signs:**
- No stability disclaimer in README
- Screenshots show polished UI but alpha warning missing
- Release notes don't mention limitations
- Version number suggests stability (v1.0 when it's alpha)
- No guidance on what "testing" means

**Phase to address:**
**Phase 3: Documentation Creation** (set expectations before first tester)

---

### Pitfall 8: Missing or Incorrect MIT License Attribution

**What goes wrong:**
Choosing MIT license but missing:
- `LICENSE` file in repository root
- Copyright year and holder name
- License headers in source files (optional but recommended)
- Attribution for third-party dependencies
- License compatibility issues with dependencies

**Why it happens:**
- "I'll add the license later" (then forget)
- Copy-paste LICENSE without updating copyright holder
- Not checking dependency licenses
- Assuming MIT allows everything (it requires attribution)
- Not understanding MIT requirements

**How to avoid:**
1. **Add LICENSE file NOW (before going public):**
   ```
   MIT License

   Copyright (c) 2026 [Your Name or GitHub username]

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE.
   ```
2. **Update copyright holder:**
   - Use your name, GitHub username, or "The Depot Authors"
   - Use current year (2026)
3. **Audit dependency licenses:**
   - Run: `npm list` and check package licenses
   - Run: `cargo tree` and check crate licenses
   - Ensure no GPL dependencies (incompatible with MIT for binary distribution)
   - Verify all dependencies are MIT, Apache, or other permissive licenses
4. **Add NOTICES or THIRD-PARTY-LICENSES if needed:**
   - Some licenses (Apache 2.0) require attribution in NOTICE file
   - List major dependencies and their licenses
   - Not required for MIT but good practice for transparency
5. **README license section:**
   ```markdown
   ## License

   This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

   ### Third-Party Licenses

   This project uses several open-source libraries. See [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md) for details.
   ```

**Warning signs:**
- No LICENSE file in repository
- LICENSE says "Copyright (c) [year] [fullname]" (template not updated)
- README doesn't mention license
- Dependencies include GPL libraries
- No attribution for vendored code

**Phase to address:**
**Phase 3: Documentation Creation** (required before public launch)

---

### Pitfall 9: Publishing npm Package Accidentally

**What goes wrong:**
`package.json` has `"private": true` which is good for preventing accidental npm publish. However, if you later decide to publish (unlikely for Tauri app but possible for shared libraries), forgetting to remove this field causes publish to fail. Conversely, removing it too early could accidentally publish to npm during development.

For a Tauri desktop app (not an npm library), you should keep `"private": true` permanently.

**Why it happens:**
- Confusion about whether Tauri app is an npm package (it's not, it's a desktop app)
- Copy-paste package.json from library template
- Misunderstanding npm's "private packages" concept

**How to avoid:**
1. **Keep `"private": true` in package.json:**
   - Depot is a desktop application, not an npm package
   - Users install via GitHub Releases (binary), not npm
   - The `private` field prevents accidental `npm publish`
2. **If you extract shared components as libraries:**
   - Create separate package.json for library
   - Remove `"private": true` only in library package
   - Keep main app package.json private
3. **Document installation method in README:**
   ```markdown
   ## Installation

   Download the latest installer from [Releases](https://github.com/you/depot/releases).

   This is a desktop application, not an npm package. Do not install via `npm install`.
   ```

**Warning signs:**
- Package.json missing `"private": true`
- README suggests `npm install depot` (wrong for desktop app)
- Confusion about distribution method

**Phase to address:**
**Phase 2: Rename Execution** (verify private field during package.json update)

---

### Pitfall 10: .planning Directory Leaks Internal Context

**What goes wrong:**
The `.planning/` directory contains 89 completed plans with:
- Internal notes and thought processes
- Design decisions and rationale
- Debugging sessions
- TODOs with personal context
- Potentially embarrassing comments or shortcuts

Making this public could:
- Expose information you'd rather keep private
- Reveal planned features that may never ship
- Show incomplete thoughts or wrong assumptions
- Create support burden ("Why didn't you implement the plan?")

**Why it happens:**
- Project context says .planning/ artifacts "stay public" (showcasing agentic development)
- Not reviewing content for public consumption
- Assuming planning docs are benign
- Not considering how external readers interpret internal docs

**How to avoid:**
1. **Review .planning/ content for public suitability:**
   - Remove or redact personal information
   - Remove internal server names, paths, or credentials
   - Remove TODOs with personal context
   - Remove embarrassing comments or shortcuts
2. **OR keep .planning/ public as intended:**
   - If showcasing agentic development is a goal, keep it
   - Review for sensitive info but embrace transparency
   - Add README.md to `.planning/` explaining purpose:
     ```markdown
     # Planning Artifacts

     This directory contains the GSD (Get Shit Done) planning artifacts
     used to build Depot with agentic AI assistance (Claude Code).

     These files showcase the agentic development process and provide
     insight into design decisions and rationale.

     Note: Plans may describe features not yet implemented or abandoned.
     See PROJECT.md for current status.
     ```
3. **Decision: Public or private?**
   - **Public**: Showcases process, builds trust, unique differentiator
   - **Private**: Keeps internal context private, avoids confusion
   - Document decision in PROJECT.md

**Warning signs:**
- .planning/ contains credentials, secrets, or PII
- Personal TODOs reference non-public information
- Plans reveal security vulnerabilities
- No explanation of .planning/ for external readers

**Phase to address:**
**Phase 1: Security Audit** (decide whether to keep public, redact if needed)

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Credentials in Git history | Immediate exploitation, data breach | Scan with Gitleaks/TruffleHog before going public |
| Hardcoded P4 server paths | Exposes internal infrastructure | Audit code for internal server names/IPs |
| Test data with real credentials | Credential theft | Use fake/sanitized test data only |
| .env files tracked in Git | API key theft | Verify .env in .gitignore, scan history |
| Personal info in comments | Privacy violation | Search for names, emails, internal references |
| Debug endpoints enabled | Unauthorized access | Remove debug-only code before release |
| API keys in frontend code | Key theft (source maps, bundle analysis) | Never embed API keys in frontend (Depot doesn't have external APIs, but principle applies) |

## Renaming Gotchas

| File/Location | Field to Update | Impact if Missed |
|---------------|----------------|------------------|
| package.json | `"name": "p4now"` | Build fails, wrong package name |
| Cargo.toml | `name = "p4now"` | Rust build fails, crate not found |
| Cargo.toml | `name = "p4now_lib"` | Lib name mismatch, linker errors |
| tauri.conf.json | `"productName": "p4now"` | Wrong window title, app name |
| tauri.conf.json | `"identifier": "com.a.p4now"` | Settings lost, SmartScreen reset |
| tauri.conf.json | `"title": "p4now"` | Wrong window title |
| e2e/wdio.conf.ts | Binary path references | E2E tests fail to find app |
| README, docs | All references | Confusion, broken instructions |
| GitHub repo name | Repository name | Links break, clone instructions wrong |

## Release Workflow Pitfalls

| Issue | Symptom | Prevention |
|-------|---------|------------|
| Missing secrets | Workflow fails at signing step | Document required secrets, use manual trigger for first run |
| Draft vs published | Workflow triggers on draft save | Use `types: [published]` not `created` |
| Tag hash outdated | Fixed workflow doesn't run | Update tag to commit with fixes |
| Workflow triggers workflow | Second workflow doesn't trigger | Use `workflow_dispatch` for chained workflows |
| YAML syntax error | Workflow not recognized | Validate with GitHub's workflow validator |
| Artifact retention | Artifacts deleted after 90 days | Document retention limits, plan for long-term storage |
| Public repo permissions | Workflow can't write releases | Verify GITHUB_TOKEN permissions for public repo |

## Documentation Pitfalls

| Pitfall | User Impact | Prevention |
|---------|-------------|------------|
| Missing prerequisites | "Command not found" errors, abandonment | Test setup on clean Windows VM |
| No version requirements | Wrong versions installed, mysterious errors | Specify exact versions (Node 20+, Rust 1.75+) |
| Assuming P4 knowledge | Confusion about setup, can't test | Link to P4 docs, explain prerequisites |
| No SmartScreen guidance | Users think app is malware, don't install | Document SmartScreen warnings with screenshots |
| Outdated instructions | Instructions don't work, frustration | Update docs with each release, test on clean machine |
| No stability disclaimer | Users expect production quality, disappointed | Prominent alpha warning in README |
| Missing build instructions | Contributors can't build, can't contribute | Full build/dev/test instructions in CONTRIBUTING.md |

## Early Testing Communication Pitfalls

| Mistake | Result | Better Approach |
|---------|--------|-----------------|
| Version number implies stability (v1.0) | Users expect production quality | Use v0.1.x for alpha, v0.5.x for beta, v1.0+ for stable |
| No known limitations section | Every bug is a surprise | Document known issues prominently |
| Screenshots show polish but no warning | Users expect everything to work | Add "Work in Progress" watermarks or alpha banner |
| Roadmap promises too much | Disappointment when features cut | Label roadmap items as "planned" not "coming soon" |
| No guidance on testing vs. production | Users risk real work | Explicitly recommend test repositories only |
| Missing feedback channels | Bugs go unreported | Prominent GitHub Issues link, bug report template |
| No "thank you for testing" messaging | Users feel like free QA | Acknowledge testers, thank for contributions |

## Licensing Pitfalls

| Issue | Risk | Prevention |
|-------|------|------------|
| No LICENSE file | Legal ambiguity, users can't fork | Add LICENSE file NOW |
| Wrong copyright holder | Legal disputes | Update template with your name/username |
| GPL dependency | License incompatibility | Audit dependencies, avoid GPL |
| Missing NOTICE for Apache deps | License violation | Check Apache 2.0 dependencies, add NOTICE if required |
| No dependency license audit | Unknowingly violating licenses | Run `npm list` and `cargo tree`, verify licenses |
| License mismatch (README vs LICENSE) | Confusion | Ensure README matches LICENSE file |

## Windows-Specific Pitfalls

| Pitfall | Impact | Prevention |
|---------|--------|------------|
| Unsigned binary | SmartScreen warnings scare users away | Document warnings, plan for code signing if popular |
| No Visual Studio Build Tools | Rust build fails on clean machine | Document in prerequisites |
| Missing P4 in PATH | App can't find P4, mysterious errors | Verify P4 installation in prerequisites |
| Icon missing/wrong size | Unprofessional appearance | Verify icons in `src-tauri/icons/` |
| Installer not tested on clean machine | Install fails for users | Test installer on clean Windows VM |
| No uninstaller | Users can't cleanly remove | Tauri provides uninstaller, verify it works |

## "Looks Done But Isn't" Checklist

Before marking "ready for public launch":

- [ ] **Git history scanned:** Run Gitleaks and TruffleHog, verify no secrets
- [ ] **Rename complete:** Search codebase for "p4now", verify 0 results (except this doc)
- [ ] **LICENSE file added:** Verify LICENSE exists, copyright updated, MIT license
- [ ] **README created:** Prerequisites, installation, build instructions, alpha disclaimer
- [ ] **Identifier chosen:** Tauri identifier won't change again (`com.a.depot` or `com.depot.app`)
- [ ] **Release workflow tested:** Run workflow in private repo, verify builds complete
- [ ] **Clean machine test:** Install on clean Windows VM following README
- [ ] **.gitignore audit:** Verify .env, logs, build artifacts ignored
- [ ] **SmartScreen documented:** README explains warnings, provides bypass instructions
- [ ] **Version number appropriate:** v0.1.x for alpha, not v1.0.x
- [ ] **Known limitations documented:** README lists what works and what doesn't
- [ ] **Issue templates created:** Bug report and feature request templates
- [ ] **CONTRIBUTING.md created:** Build instructions, contribution process, code of conduct
- [ ] **Dependencies audited:** No GPL licenses, all dependencies MIT/Apache compatible
- [ ] **.planning/ decision made:** Keep public (with redaction) or add to .gitignore

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Credentials in public history | HIGH | 1. Revoke/rotate all exposed credentials<br>2. Use BFG Repo-Cleaner to purge history<br>3. Force-push cleaned history<br>4. Notify users to re-clone<br>5. Monitor for exploitation |
| Incomplete rename | MEDIUM | 1. Grep for old name: `rg -i "p4now"`<br>2. Update all references<br>3. Test build and E2E tests<br>4. Push fix as patch release |
| Wrong identifier shipped | HIGH | 1. Accept breaking change<br>2. Bump version to v0.2<br>3. Document migration steps<br>4. Provide settings migration tool |
| Unsigned binary scared users | LOW | 1. Add SmartScreen documentation to README<br>2. Create issue explaining warnings<br>3. Plan for code signing in future |
| Release workflow failed | MEDIUM | 1. Fix workflow locally<br>2. Tag new commit with fixed workflow<br>3. Manually create release with artifacts<br>4. Document fix in release notes |
| Missing prerequisites | LOW | 1. Update README with prerequisites<br>2. Test on clean machine<br>3. Create installation guide with screenshots<br>4. Link from GitHub Issues |
| Over-promised stability | MEDIUM | 1. Add prominent alpha disclaimer<br>2. Create "Known Issues" wiki page<br>3. Pin issue explaining alpha status<br>4. Update release notes with limitations |
| GPL dependency discovered | MEDIUM | 1. Replace GPL dependency with MIT/Apache alternative<br>2. Audit all dependencies<br>3. Document license in THIRD-PARTY-LICENSES<br>4. Bump version |
| .planning leaked sensitive info | HIGH | 1. Purge sensitive commits from history (BFG)<br>2. Force-push cleaned history<br>3. Add .planning/ to .gitignore if keeping private<br>4. Rotate any exposed credentials |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Credentials in Git history | Phase 1: Security Audit | Gitleaks scan passes, no secrets found |
| Incomplete rename | Phase 2: Rename Execution | Build passes, E2E tests pass, grep finds 0 "p4now" |
| Wrong identifier | Phase 2: Rename Execution | Identifier finalized, documented in PROJECT.md |
| Unsigned binary warnings | Phase 4: Distribution Prep | README documents SmartScreen, screenshots provided |
| Release workflow failure | Phase 5: Automation Setup | Workflow runs successfully in private repo |
| Missing prerequisites | Phase 3: Documentation | Clean machine test passes |
| Over-promised stability | Phase 3: Documentation | README has alpha disclaimer, known issues listed |
| Missing LICENSE | Phase 3: Documentation | LICENSE file exists, copyright updated |
| npm publish accident | Phase 2: Rename Execution | `"private": true` in package.json |
| .planning/ sensitive info | Phase 1: Security Audit | .planning/ reviewed, sensitive info removed or made private |

## Phase-Specific Warnings

### Phase 1: Security Audit
- **HIGH RISK:** Credentials in Git history — Use Gitleaks/TruffleHog NOW
- **HIGH RISK:** .planning/ may contain sensitive info — Review before going public
- **MEDIUM RISK:** Hardcoded paths/servers — Audit Rust and TypeScript code
- **Action:** Create `.env.example` with fake data, verify `.env` in `.gitignore`

### Phase 2: Rename Execution
- **CRITICAL:** Identifier change breaks existing installs — Choose FINAL identifier
- **HIGH RISK:** Incomplete rename breaks build — Create comprehensive checklist
- **MEDIUM RISK:** Cargo.toml lib name mismatch — Update `p4now_lib` to `depot_lib`
- **Action:** Test build + E2E tests after EVERY rename change

### Phase 3: Documentation Creation
- **HIGH RISK:** Missing alpha disclaimer — Users expect production quality
- **MEDIUM RISK:** Missing prerequisites — Users can't build/run
- **MEDIUM RISK:** No LICENSE file — Legal ambiguity
- **Action:** Test setup instructions on clean Windows VM

### Phase 4: Distribution Preparation
- **MEDIUM RISK:** Unsigned binary scares users — Document SmartScreen warnings
- **LOW RISK:** Wrong icon size — Verify icons exist and render correctly
- **Action:** Create installer, test on clean machine

### Phase 5: Automation Setup
- **HIGH RISK:** Release workflow fails on first public run — Test in private first
- **MEDIUM RISK:** Missing secrets documentation — Contributors can't run workflow
- **Action:** Manual workflow trigger for first release

### Phase 6: Community Setup
- **MEDIUM RISK:** No issue templates — Bug reports lack info
- **LOW RISK:** No CONTRIBUTING.md — Contributors don't know process
- **Action:** Create templates, link from README

## Tools and Commands

### Security Scanning
```bash
# Scan for secrets in entire Git history
gitleaks detect --source . --verbose --no-git

# Alternative: TruffleHog
trufflehog git file://. --only-verified

# Find credentials manually
git grep -i "password\|token\|api.?key\|secret" $(git rev-list --all)
```

### Rename Verification
```bash
# Find remaining references to old name (case-insensitive, all files)
rg -i "p4now" --type-not lock

# Count occurrences
rg -i "p4now" --stats
```

### Dependency License Audit
```bash
# npm dependencies
npm list --depth=0

# Rust dependencies
cargo tree --depth 1

# Check specific licenses
cargo license
```

### Build Verification
```bash
# Clean build
rm -rf node_modules dist target
npm install
npm run build

# E2E tests
npm run test:e2e
```

### Release Workflow Test
```bash
# Validate GitHub Actions syntax
gh workflow view release.yml

# Simulate locally (requires `act`)
act -n  # Dry-run
```

## Sources

### Security & Credentials
- [Desktop Application Security Testing Checklist 2025 - AFINE](https://afine.com/desktop-application-security-testing-checklist/)
- [Top 8 Git Secrets Scanners in 2026 | Jit](https://www.jit.io/resources/appsec-tools/git-secrets-scanners-key-features-and-top-tools-)
- [GitHub Secret Leaks: 13 Million API Credentials in Public Repos](https://medium.com/@instatunnel/github-secret-leaks-the-13-million-api-credentials-sitting-in-public-repos-1a3babfb68b1)
- [How to Remove Secrets from Git History Safely](https://techcommunity.microsoft.com/blog/azureinfrastructureblog/how-to-safely-remove-secrets-from-your-git-history-the-right-way/4464722)
- [TruffleHog vs. Gitleaks: Detailed Comparison](https://www.jit.io/resources/appsec-tools/trufflehog-vs-gitleaks-a-detailed-comparison-of-secret-scanning-tools)

### Code Signing & SmartScreen
- [Windows Code Signing | Tauri](https://v2.tauri.app/distribute/sign/windows/)
- [Windows Code Signing Discussion | Tauri](https://github.com/orgs/tauri-apps/discussions/5739)
- [Secure Tauri/Windows Code Signing with Certum HSM](https://defguard.net/blog/windows-codesign-certum-hsm/)
- [How to avoid SmartScreen warnings](https://www.advancedinstaller.com/prevent-smartscreen-from-appearing.html)

### Renaming & Dependencies
- [Renaming Projects in .NET | Medium](https://medium.com/@tudor.wolff/renaming-projects-in-net-ccfb43979f46)
- [Specifying Dependencies - The Cargo Book](https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html)
- [Renaming dependencies in Cargo.toml | Issue #5653](https://github.com/rust-lang/cargo/issues/5653)

### GitHub Actions & Workflows
- [Troubleshooting GitHub Actions Workflow Failures](https://www.mindfulchase.com/explore/troubleshooting-tips/ci-cd-continuous-integration-continuous-deployment/troubleshooting-github-actions-fixing-workflow-failures,-secrets-issues,-matrix-errors,-caching-bugs,-and-runtime-problems-in-ci-cd-pipelines.html)
- [GitHub Actions Release Trigger Not Working](https://www.w3tutorials.net/blog/github-actions-on-release-created-workflow-trigger-not-working/)

### Documentation & Community
- [README Best Practices | GitHub](https://github.com/jehna/readme-best-practices)
- [How to Write a Beginner-Friendly README | 2025 Guide](https://www.readmecodegen.com/blog/beginner-friendly-readme-guide-open-source-projects)
- [Setting guidelines for repository contributors | GitHub Docs](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors)
- [Contributing Template | GitHub](https://github.com/nayafia/contributing-template)

### Licensing
- [Licensing a repository - GitHub Docs](https://docs.github.com/articles/licensing-a-repository)
- [What GitHub License to Choose? 2026 Guide](https://flavor365.com/how-to-choose-the-right-license-for-your-github-project/)
- [The Legal Side of Open Source](https://opensource.guide/legal/)

### Alpha Testing & Expectations
- [Alpha Testing: Definition and Best Practices | BrowserStack](https://www.browserstack.com/guide/alpha-testing)
- [Complete Guide to Alpha Testing](https://www.gocodeo.com/post/complete-guide-to-alpha-testing)
- [Software release life cycle - Wikipedia](https://en.wikipedia.org/wiki/Software_release_life_cycle)

### Tauri-Specific
- [Tauri Bundle Configuration](https://v2.tauri.app/reference/config/)
- [How to change bundle identifier | Discussion #6417](https://github.com/tauri-apps/tauri/discussions/6417)
- [Bundle Identifier | Tauri by Simon](https://tauri.by.simon.hyll.nu/concepts/tauri/bundle_identifier/)

---

*Pitfalls research for: Depot Public Launch Preparation*
*Researched: 2026-02-05*
*Confidence: HIGH (based on official documentation, 2026 web research, and Tauri-specific sources)*
