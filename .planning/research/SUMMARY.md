# Project Research Summary

**Project:** Depot (renaming from P4Now)
**Domain:** Open-Source Desktop Application Public Launch
**Milestone:** v6.0 Public Launch Preparation (internal), v0.1 (public version)
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

Depot is ready for public launch from a technical maturity standpoint (v5.0 achieved production-grade stability), but requires critical preparatory work before exposing the repository publicly. This research identifies a **security-first approach** where credential scanning and renaming must complete before any public-facing work begins.

The recommended approach balances transparency (keeping .planning/ artifacts public as a showcase of agentic development) with pragmatism (v0.1 versioning, unsigned binaries, and prominent alpha disclaimers). The architecture already supports the infrastructure needed—Tauri 2.0's bundler, GitHub Actions workflows, and standard open-source project artifacts integrate cleanly with the existing codebase.

**Critical path identified:** Security audit → Complete rename → Documentation → Release automation → Public launch. The rename is particularly sensitive because changing the Tauri bundle identifier (`com.a.p4now` → `com.depot.app`) is a one-time decision that affects all future installations. Missing credentials in Git history represents the highest-risk pitfall—automated bots scan public GitHub repositories within minutes of publication.

## Key Findings

### Recommended Stack

The public launch stack builds on Tauri 2.0 foundations with GitHub-native automation and security scanning.

**Core technologies:**

- **GitHub Actions + tauri-apps/tauri-action@v0** — Official Tauri CI/CD integration with multi-platform builds, automatic release creation, and updater.json generation. Handles Windows builds with optional code signing.

- **Gitleaks + TruffleHog** — Credential scanning for Git history. Gitleaks recommended for CI pipeline (fast, 350+ patterns). TruffleHog for comprehensive pre-launch audit (600+ detectors with API verification).

- **cargo-deny + Trivy** — Rust dependency security. cargo-deny enforces license policy and detects vulnerabilities. Trivy provides unified SARIF output for GitHub Security tab integration.

- **Azure Trusted Signing (optional)** — Modern Windows code signing service. Provides immediate SmartScreen reputation without USB HSM. However, defer to post-v0.1—unsigned binaries acceptable for early testing with proper README disclaimers.

- **git-cliff** — Changelog generation from conventional commits. Rust-based, fast, highly customizable. Use for CHANGELOG.md maintenance while GitHub auto-release notes handle release pages.

**Version strategy:**
- `tauri.conf.json` version: `0.1.0` (public-facing, signals early testing)
- Internal milestone tracking: `v6.0 Public Launch Preparation`
- Pre-release flag on GitHub releases for all v0.x versions

### Expected Features

Research identified a clear MVP boundary for v0.1 public launch.

**Must have (table stakes for ANY open-source project):**
- LICENSE file (MIT) — Legal requirement
- README.md with quick start — Entry point, must include demo GIF/video
- CONTRIBUTING.md — Build instructions and contribution process
- Issue templates — Bug report and feature request (`.github/ISSUE_TEMPLATE/`)
- .gitignore audit — No secrets, Tauri artifacts, or credentials
- Security audit — Gitleaks scan of entire Git history before going public
- Version number in app — For bug reports (read from `package.json`)
- GitHub Releases with binaries — Downloadable .exe/.msi, not source-only

**Should have (competitive advantages for Depot):**
- .planning/ directory showcase — Demonstrates agentic development methodology
- P4V comparison guide — Helps target users evaluate and switch
- Demo GIF/video in README — Shows value in 10 seconds
- Early testing disclaimer — Honest v0.1 versioning prevents over-promising
- GitHub Discussions enabled — Separates Q&A from bug tracking
- Changelog/release notes — Transparency about changes

**Defer to v0.2-0.5:**
- Automated CI/CD (GitHub Actions for build verification)
- Architecture documentation (contributor onboarding)
- Pre-built .msi installer (start with NSIS .exe)
- Contributor recognition (all-contributors bot)
- README badges (build status, release version)

**Future consideration (v1.0+):**
- Code signing certificate — Eliminates SmartScreen warnings (costs $100-400/year)
- Multi-platform support (macOS, Linux)
- Package manager distribution (winget, Chocolatey)
- Auto-update mechanism (Tauri plugin available but requires signing)

### Architecture Approach

Public launch requires integrating standard open-source artifacts with the existing Tauri 2.0 architecture.

**Major integration points:**

1. **Repository structure changes** — Add `.github/workflows/`, `LICENSE`, `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md` at project root.

2. **Rename execution** — Update `package.json` (name), `src-tauri/Cargo.toml` (name + lib name), `src-tauri/tauri.conf.json` (productName, identifier, title). The identifier change from `com.a.p4now` to `com.depot.app` is permanent—affects installation paths and settings storage.

3. **GitHub Actions workflows** — Three workflows in `.github/workflows/`:
   - `ci.yml` — Build verification on push/PR
   - `security-scan.yml` — npm audit + cargo audit on schedule
   - `publish.yml` — Release automation on version tags

4. **Windows installer configuration** — Tauri bundler generates both NSIS (.exe) and MSI installers. Use `downloadBootstrapper` for WebView2 (most systems have it pre-installed). Code signing optional for v0.1.

5. **Settings migration consideration** — Identifier change breaks existing installations. Document in README that pre-release users need to re-enter connection settings (automated migration deferred to avoid complexity).

**Data flow (automated release):**
```
Developer: git tag v0.1.0 && git push --tags
    ↓
GitHub Actions: Trigger publish.yml
    ↓
Runner: Build frontend + backend + bundle installers
    ↓
tauri-action: Upload to GitHub Release (draft)
    ↓
Developer: Review draft, edit notes, publish
```

**Build artifacts:**
- `depot.exe` (portable, no installer)
- `depot_0.1.0_x64-setup.exe` (NSIS installer, recommended)
- `depot_0.1.0_x64.msi` (MSI installer, enterprise)
- `SHA256SUMS.txt` (checksums)

### Critical Pitfalls

Research identified 10 critical pitfalls with prevention strategies for each phase.

**Top 5 pitfalls by severity:**

1. **Credentials in Git history** (CRITICAL)
   - Automated bots scan public repos within minutes, exploit within 5 minutes
   - Prevention: Run Gitleaks + TruffleHog on entire history BEFORE going public
   - Recovery: Use BFG Repo-Cleaner to purge history, rotate all credentials

2. **Incomplete rename breaking build** (HIGH)
   - Missing references cause build failures, runtime errors, settings loss
   - Prevention: Comprehensive checklist covering package.json, Cargo.toml, tauri.conf.json, window titles, and code strings
   - Recovery: Grep for old name (`rg -i "p4now"`), update all references, test build + E2E

3. **Changing bundle identifier breaks existing installations** (HIGH)
   - Identifier change creates new app identity—existing users lose settings
   - Prevention: Choose final identifier NOW (`com.depot.app`), never change after first public release
   - Recovery: Accept breaking change, document migration, provide settings migration tool

4. **Unsigned binary triggers SmartScreen warnings** (MEDIUM)
   - Users see "Windows Defender SmartScreen prevented..." and abandon installation
   - Prevention: Accept for v0.1 with README disclaimer, include bypass instructions with screenshots
   - Alternative: Purchase code signing cert ($100-400/year), but warnings persist until reputation builds

5. **Over-promising stability for v0.1** (MEDIUM)
   - Users expect production quality but encounter crashes and breaking changes
   - Prevention: Prominent alpha disclaimer in README, "Known Limitations" section, v0.x versioning
   - Recovery: Add disclaimer retroactively, create "Known Issues" wiki, pin issue explaining alpha status

**Phase-specific critical warnings:**
- **Phase 1 (Security Audit):** HIGH RISK — Credentials in Git history
- **Phase 2 (Rename):** CRITICAL — Identifier change is permanent, choose carefully
- **Phase 3 (Documentation):** MEDIUM RISK — Missing alpha disclaimer leads to user frustration
- **Phase 5 (Automation):** HIGH RISK — Release workflow fails on first public run if not tested

## Implications for Roadmap

Based on combined research, the roadmap must follow a strict dependency order with security and rename as blocking prerequisites.

### Phase 1: Security Audit (BLOCKING — MUST BE FIRST)

**Rationale:** Credentials in public Git history cannot be unpublished. Automated bots scan within minutes. This phase gates ALL subsequent work.

**Delivers:**
- Gitleaks scan of entire Git history (all branches, tags, deleted commits)
- TruffleHog comprehensive audit (verified secrets only)
- .gitignore updated with Tauri artifacts, certificates, and credential patterns
- .planning/ directory reviewed for sensitive information (keep public as showcase, but redact any internal server names/IPs)

**Addresses (from FEATURES.md):**
- Table stakes: Security audit (no hardcoded credentials)
- Table stakes: .gitignore for Tauri (prevent future leaks)

**Avoids (from PITFALLS.md):**
- Pitfall #1: Credentials in Git history (CRITICAL)
- Pitfall #10: .planning/ directory leaks internal context

**Confidence:** HIGH (tools and process well-documented)

**Research flag:** SKIP — Security scanning is standard practice with established tooling.

---

### Phase 2: Rename Execution (BLOCKING — DEPENDS ON PHASE 1)

**Rationale:** All subsequent documentation, workflows, and branding reference the new name. Doing this later creates merge conflicts and missed references.

**Delivers:**
- `package.json` updated: `"name": "depot"`, `"version": "0.1.0"` (public)
- `src-tauri/Cargo.toml` updated: `name = "depot"`, lib `name = "depot_lib"`
- `src-tauri/tauri.conf.json` updated:
  - `"productName": "Depot"`
  - `"identifier": "com.depot.app"` (PERMANENT — never change)
  - `"title": "Depot"`
- All code references (Rust, TypeScript, tests) updated via grep and replace
- Build verified: `npm run build && npm run tauri build`
- E2E tests pass (confirms no breaking changes)

**Addresses (from FEATURES.md):**
- Anti-feature: Publishing npm package accidentally (verify `"private": true`)

**Avoids (from PITFALLS.md):**
- Pitfall #2: Incomplete rename breaking build (HIGH)
- Pitfall #3: Wrong identifier shipped (HIGH)
- Pitfall #9: npm package published accidentally

**Confidence:** HIGH (straightforward search/replace with verification)

**Research flag:** SKIP — Standard refactoring task.

---

### Phase 3: Documentation Creation (DEPENDS ON PHASE 2)

**Rationale:** GitHub displays these files immediately upon public launch. Incomplete docs signal unprofessionalism and confuse potential contributors.

**Delivers:**
- `LICENSE` — MIT license with copyright holder and year
- `README.md` — Project overview, demo GIF/video, quick start, P4V comparison, alpha disclaimer, .planning/ explanation
- `CONTRIBUTING.md` — Prerequisites, build instructions, PR process
- `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1
- `SECURITY.md` — Vulnerability reporting policy
- `.github/ISSUE_TEMPLATE/bug_report.md` — Bug report template
- `.github/ISSUE_TEMPLATE/feature_request.md` — Feature request template
- `.github/pull_request_template.md` — PR checklist

**Addresses (from FEATURES.md):**
- Table stakes: LICENSE file (MIT)
- Table stakes: README with quick start
- Table stakes: CONTRIBUTING.md
- Table stakes: Issue templates
- Table stakes: Code of Conduct
- Differentiator: .planning/ directory explanation
- Differentiator: P4V comparison guide
- Differentiator: Demo GIF/video in README
- Differentiator: Early testing disclaimer

**Avoids (from PITFALLS.md):**
- Pitfall #6: Missing prerequisites in documentation
- Pitfall #7: Over-promising stability for v0.1
- Pitfall #8: Missing or incorrect MIT license attribution

**Confidence:** HIGH (templates available, content straightforward)

**Research flag:** SKIP — Documentation writing is well-understood.

**Special note:** Demo GIF/video creation requires tool selection (ScreenToGif recommended for Windows). 20-30 second recording showing core workflow (sync, edit, submit).

---

### Phase 4: Distribution Preparation (DEPENDS ON PHASE 2 & 3)

**Rationale:** Users need downloadable binaries, not just source code. This phase prepares installer configuration and SmartScreen guidance.

**Delivers:**
- `tauri.conf.json` installer config:
  - `"targets": ["nsis", "msi"]` (both formats)
  - `"webviewInstallMode": "downloadBootstrapper"` (most systems have WebView2)
- README updated with SmartScreen warning guidance (screenshots of bypass process)
- Installer tested on clean Windows VM
- Version displayed in app (verify source: `package.json`)

**Addresses (from FEATURES.md):**
- Table stakes: GitHub Releases with binaries
- Table stakes: Version number in app

**Avoids (from PITFALLS.md):**
- Pitfall #4: Unsigned binary triggers SmartScreen warnings (document workaround)

**Confidence:** HIGH (Tauri bundler is well-documented)

**Research flag:** SKIP — Standard Tauri configuration.

**Code signing decision:** DEFER to post-v0.1. Unsigned is acceptable for early testing with proper README disclaimers. Azure Trusted Signing or traditional EV cert can be added later if project gains traction.

---

### Phase 5: Automation Setup (DEPENDS ON PHASE 2, 3, 4)

**Rationale:** Automated releases ensure consistent builds and reduce manual errors. Draft releases allow review before publishing.

**Delivers:**
- `.github/workflows/ci.yml` — Build verification on push/PR to main
- `.github/workflows/security-scan.yml` — npm audit + cargo audit on schedule
- `.github/workflows/publish.yml` — Release automation on version tags:
  - Uses `tauri-apps/tauri-action@v0`
  - Creates draft release (manual publish step)
  - Uploads NSIS + MSI installers + checksums
  - Marks as pre-release for v0.x versions
- Workflows tested in private repo before going public
- Secrets documented (none required for v0.1 unsigned builds)

**Addresses (from FEATURES.md):**
- Should have: Automated CI/CD (deferred from P2 to here)
- Should have: Changelog/release notes (GitHub auto-generated)

**Avoids (from PITFALLS.md):**
- Pitfall #5: Release workflow fails on first public run

**Confidence:** HIGH (tauri-action is official and well-maintained)

**Research flag:** SKIP — GitHub Actions workflows are standard.

**Special note:** Use manual trigger (`workflow_dispatch`) for first release to validate process.

---

### Phase 6: Community Setup (CAN PARALLELIZE WITH PHASE 5)

**Rationale:** Separates Q&A from bug tracking and provides contributor guidelines.

**Delivers:**
- GitHub Discussions enabled with categories:
  - General (announcements)
  - Ideas (feature requests)
  - Q&A (support)
  - Show and tell (community projects)
- GitHub Topics configured: `perforce`, `gui`, `tauri`, `windows`, `desktop-app`
- Repository description: "A modern Windows Perforce GUI built with Tauri"
- Issue labels configured: `good first issue`, `bug`, `enhancement`, `question`, `help wanted`, `documentation`

**Addresses (from FEATURES.md):**
- Table stakes: Project description/topics
- Differentiator: GitHub Discussions enabled

**Avoids:** No specific pitfalls, but improves community experience.

**Confidence:** HIGH (trivial GitHub configuration)

**Research flag:** SKIP — Standard community infrastructure.

---

### Phase 7: Final Smoke Test (DEPENDS ON ALL PREVIOUS PHASES)

**Rationale:** Last validation before public launch. Catches any breaking changes from rename or configuration updates.

**Delivers:**
- Release binary built locally (not via CI)
- All validated features tested (see PROJECT.md requirements):
  - Connection management
  - File tree with 10K+ files
  - Changelist operations
  - Shelving/unshelving
  - Conflict resolution
- Installer tested on clean Windows VM
- Settings persistence verified with new identifier (`com.depot.app`)
- E2E tests pass

**Addresses:** Quality assurance before public exposure

**Avoids:** Shipping broken v0.1 release

**Confidence:** HIGH (existing test infrastructure)

**Research flag:** SKIP — Standard QA process.

---

### Phase 8: Public Launch (DEPENDS ON PHASE 7 PASSING)

**Rationale:** Final commit and repository visibility change.

**Delivers:**
- Git tag created: `v0.1.0`
- Tag pushed: `git push --tags`
- Release workflow triggered (creates draft)
- Draft release reviewed and published
- Repository made public on GitHub
- Announcement posts (optional: Reddit r/perforce, Twitter, etc.)

**Addresses:** Go-live milestone

**Avoids:** Premature launch before quality validation

**Confidence:** HIGH (final execution step)

---

### Phase Ordering Rationale

**Strict dependencies:**
1. **Security audit BEFORE rename** — Can't fix leaked credentials after repo is public
2. **Rename BEFORE documentation** — Docs reference the new name throughout
3. **Documentation BEFORE automation** — Workflows reference docs (e.g., "See CONTRIBUTING.md")
4. **Distribution prep BEFORE automation** — Workflows build installers with correct config
5. **All phases BEFORE final smoke test** — Tests validate the complete package
6. **Smoke test BEFORE public launch** — Quality gate

**Parallelization opportunities:**
- Phase 5 (Automation) and Phase 6 (Community) can run simultaneously
- Phase 3 (Documentation) and Phase 4 (Distribution) have minimal dependencies (can overlap)

**Critical path (blocking):**
```
Phase 1 (Security) → Phase 2 (Rename) → Phase 3 (Docs) → Phase 7 (Smoke Test) → Phase 8 (Launch)
                                             ↓
                                        Phase 4 (Distribution) → Phase 5 (Automation)
```

**Total estimated effort:** 5-7 days for single developer (assuming demo video and installer testing on clean VM)

### Research Flags

**All phases use standard patterns — no additional research needed:**
- Phase 1: Gitleaks/TruffleHog usage is well-documented
- Phase 2: Rename is standard refactoring
- Phase 3: Documentation templates available
- Phase 4: Tauri bundler configuration is straightforward
- Phase 5: GitHub Actions workflows are standard
- Phase 6: GitHub UI configuration (trivial)
- Phase 7: Testing existing features
- Phase 8: Execution only

**If expanding scope in future:**
- **Code signing deep-dive** — Research Azure Trusted Signing vs. traditional EV certs (Phase 4+)
- **Multi-platform builds** — Research macOS/Linux P4 CLI compatibility (post-v1.0)
- **Auto-update implementation** — Research Tauri updater plugin + signing requirements (post-v1.0)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies have official Tauri 2.0 integration or are GitHub-native. tauri-apps/tauri-action is official and actively maintained. |
| Features | HIGH | MVP definition is conservative (table stakes only). Differentiators are low-complexity (documentation, showcase). Anti-features correctly identified (code signing, multi-platform deferred). |
| Architecture | HIGH | All integration points verified with official Tauri docs. Rename checklist is comprehensive. Workflow patterns are industry-standard (draft releases, pre-release flags). |
| Pitfalls | HIGH | Research synthesis covered security (credentials), renaming (identifier permanence), distribution (SmartScreen), and documentation (prerequisites, alpha disclaimers). Sources include official Tauri docs, GitHub best practices, and 2026 security research. |

**Overall confidence:** HIGH

All research areas converge on a clear, low-risk launch path with well-documented technologies and processes.

### Gaps to Address

**Minor gaps (resolvable during execution):**

1. **Demo GIF/video creation** — README requires visual demo. Tool selection needed (recommendation: ScreenToGit for Windows). Effort: 1-2 hours to record and edit 20-30 second core workflow demo.

2. **Clean Windows VM for testing** — Smoke test requires fresh environment. Setup: Download Windows 11 Dev VM from Microsoft or use Hyper-V. Effort: 1 hour setup + test time.

3. **Code signing decision finalization** — Research identified options (Azure Trusted Signing, traditional EV cert) but recommends deferring for v0.1. Document decision rationale in README. Effort: 30 minutes.

4. **Settings migration strategy** — Identifier change breaks pre-release users' settings. Research recommends manual (document in README) vs. automated (migration code). Finalize during Phase 2. Effort: 1 hour if automated, 15 minutes if documented.

5. **.planning/ content review** — Verify no internal server names, IPs, or sensitive TODOs. Research recommends keeping public as showcase but with redaction. Effort: 2-3 hours to audit 89 files.

**No major unknowns.** All gaps are execution details, not research gaps.

## Sources

### Primary Sources (HIGH confidence)

**Tauri 2.0 Official Documentation:**
- [GitHub Actions Pipeline](https://v2.tauri.app/distribute/pipelines/github/) — Workflow configuration
- [Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/) — Azure Trusted Signing, certificates
- [Windows Installer Configuration](https://v2.tauri.app/distribute/windows-installer/) — NSIS, MSI, WebView2
- [Tauri Configuration Reference](https://v2.tauri.app/reference/config/) — Bundle settings, identifiers
- [Tauri Updater Plugin](https://v2.tauri.app/plugin/updater/) — Auto-update (future consideration)

**GitHub Resources:**
- [tauri-apps/tauri-action](https://github.com/tauri-apps/tauri-action) — Official release action
- [GitHub Docs: Auto-generated Release Notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)
- [GitHub Docs: SARIF Upload](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github)
- [GitHub Docs: Issue Templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates)
- [GitHub Docs: Contributor Guidelines](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors)

**Security Tools:**
- [Gitleaks](https://github.com/gitleaks/gitleaks) — Secret scanning (350+ patterns)
- [TruffleHog](https://github.com/trufflesecurity/trufflehog) — Deep secret scanning (600+ detectors)
- [cargo-deny](https://embarkstudios.github.io/cargo-deny/) — Rust dependency policy
- [Trivy](https://github.com/aquasecurity/trivy) — Multi-language vulnerability scanner

### Secondary Sources (MEDIUM confidence)

**Open Source Best Practices:**
- [Open Source Guides - Starting a Project](https://opensource.guide/starting-a-project/)
- [CNCF - Outlining OSS Project Structure](https://www.cncf.io/blog/2023/04/03/outlining-the-structure-of-your-open-source-software-project/)
- [Awesome README - Curated List](https://github.com/matiassingers/awesome-readme)
- [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) — Code of Conduct template

**Security Research (2026):**
- [TruffleHog vs Gitleaks Comparison - Jit](https://www.jit.io/resources/appsec-tools/trufflehog-vs-gitleaks-a-detailed-comparison-of-secret-scanning-tools)
- [GitHub Secret Leaks: 13M API Credentials](https://medium.com/@instatunnel/github-secret-leaks-the-13-million-api-credentials-sitting-in-public-repos-1a3babfb68b1)
- [How to Remove Secrets from Git History Safely](https://techcommunity.microsoft.com/blog/azureinfrastructureblog/how-to-safely-remove-secrets-from-your-git-history-the-right-way/4464722)

**Distribution Research:**
- [Windows SmartScreen Bypass Guide](https://www.advancedinstaller.com/prevent-smartscreen-from-appearing.html)
- [Tauri Code Signing Discussion](https://github.com/orgs/tauri-apps/discussions/5739)
- [Certum Open Source Code Signing](https://certum.store/open-source-code-signing-on-simplysign.html) — Future reference

### Tertiary Sources (Context only)

**Alpha Testing Guidance:**
- [Alpha Testing Best Practices - BrowserStack](https://www.browserstack.com/guide/alpha-testing)
- [Software Release Life Cycle - Wikipedia](https://en.wikipedia.org/wiki/Software_release_life_cycle)

---

## Ready for Roadmap

**Status:** READY

This summary provides:
- Clear phase structure with dependencies
- Specific deliverables for each phase
- Pitfall prevention mapped to phases
- Confidence assessment (HIGH across all areas)
- No blocking research gaps

**Next step:** Orchestrator can proceed to requirements definition and roadmap creation using this summary as foundation.

**Key recommendations for roadmap:**
1. Enforce strict Phase 1 → Phase 2 → Phase 7 dependency (security → rename → smoke test)
2. Use Phase 3/4 parallelization opportunity to save time
3. Keep all 8 phases in sequence—no phase should be skipped or reordered
4. Each phase has clear exit criteria (documented in "Delivers" sections)

---

*Research completed: 2026-02-05*
*Synthesis confidence: HIGH*
*Ready for roadmap: YES*
