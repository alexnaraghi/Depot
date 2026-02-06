# Roadmap: Depot (P4Now)

## Milestones

- ✅ **v1.0 MVP** - Phases 1-2 (shipped 2026-01-28)
- ✅ **v2.0 Feature Complete** - Phases 3-8 (shipped 2026-01-30)
- ✅ **v3.0 Daily Driver** - Phases 9-15 (shipped 2026-02-01)
- ✅ **v4.0 Road to P4V Killer** - Phases 16-20 (shipped 2026-02-03)
- ✅ **v5.0 Large Depot Scale** - Phases 21-25 (shipped 2026-02-05)
- 🚧 **v6.0 Public Launch Preparation** - Phases 26-30 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-2) - SHIPPED 2026-01-28</summary>

See .planning/milestones/ for archived roadmap details.

</details>

<details>
<summary>✅ v2.0 Feature Complete (Phases 3-8) - SHIPPED 2026-01-30</summary>

See .planning/milestones/ for archived roadmap details.

</details>

<details>
<summary>✅ v3.0 Daily Driver (Phases 9-15) - SHIPPED 2026-02-01</summary>

See .planning/milestones/ for archived roadmap details.

</details>

<details>
<summary>✅ v4.0 Road to P4V Killer (Phases 16-20) - SHIPPED 2026-02-03</summary>

See .planning/milestones/ for archived roadmap details.

</details>

<details>
<summary>✅ v5.0 Large Depot Scale (Phases 21-25) - SHIPPED 2026-02-05</summary>

See .planning/milestones/ for archived roadmap details.

</details>

### 🚧 v6.0 Public Launch Preparation (In Progress)

**Milestone Goal:** Prepare Depot (renamed from P4Now) for public release on GitHub with proper licensing, documentation, security audit, and release automation. Public version: v0.1.0 (early testing phase).

**Phase Numbering:**
- Integer phases (26-30): Planned milestone work
- Decimal phases (if needed): Urgent insertions (marked with INSERTED)

- [ ] **Phase 26: Security Audit** - Scan for credentials and audit repository before public release
- [ ] **Phase 27: Application Rename** - Rename from "p4now" to "Depot" across all artifacts
- [ ] **Phase 28: Documentation** - Create README, LICENSE, and community files for public repo
- [ ] **Phase 29: Release Automation** - Set up GitHub Actions for automated release builds
- [ ] **Phase 30: Final Validation** - Smoke test and validate release binaries before public launch

## Phase Details

### Phase 26: Security Audit
**Goal**: Repository is safe for public release with no credentials or sensitive information in Git history or source code

**Depends on**: Nothing (first phase, BLOCKING all subsequent work)

**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04

**Success Criteria** (what must be TRUE):
  1. Gitleaks scan of entire Git history completes with zero credential detections
  2. TruffleHog comprehensive audit confirms no verified secrets in repository
  3. All source code files reviewed with no hardcoded credentials, API keys, or internal server names
  4. .gitignore updated to prevent future credential commits (Tauri artifacts, certificates, credentials)
  5. .planning/ directory audited and cleared for public showcase (no sensitive internal context)

**Plans**: 2 plans

Plans:
- [ ] 26-01-PLAN.md - Automated security scanning with Gitleaks and TruffleHog
- [ ] 26-02-PLAN.md - Manual code review, .planning audit, and .gitignore update

### Phase 27: Application Rename
**Goal**: Application completely renamed from "p4now" to "Depot" with verified build and permanent bundle identifier set

**Depends on**: Phase 26 (security must be verified before any public-facing changes)

**Requirements**: REPO-01, REPO-02, REPO-03, REPO-04, REPO-05, REPO-06, REPO-07, REPO-08

**Success Criteria** (what must be TRUE):
  1. MIT LICENSE file exists at project root with copyright 2026
  2. package.json shows name "depot" and version "0.1.0"
  3. Cargo.toml shows name "depot" and lib name "depot_lib"
  4. tauri.conf.json shows productName "Depot", identifier "com.depot.app" (PERMANENT), title "Depot", and version "0.1.0"
  5. All window titles, code comments, and documentation reference "Depot" (verified via grep)
  6. Application builds successfully with `npm run tauri build`
  7. Built application runs and displays "Depot" branding throughout UI

**Plans**: 4 plans

Plans:
- [ ] 27-01-PLAN.md - Core rename (Cargo.toml, tauri.conf.json, package.json, index.html)
- [ ] 27-02-PLAN.md - E2E test configuration updates
- [ ] 27-03-PLAN.md - Version display and dynamic window title
- [ ] 27-04-PLAN.md - Verification grep and build/launch test

### Phase 28: Documentation
**Goal**: Comprehensive documentation exists for public GitHub repository with README, quick start, P4V comparison, and community guidelines

**Depends on**: Phase 27 (documentation references new "Depot" name)

**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, DOCS-07, DOCS-08

**Success Criteria** (what must be TRUE):
  1. README.md exists with project overview, demo GIF/screenshot, and feature highlights
  2. README includes quick start guide with installation instructions and prerequisites
  3. README includes P4V comparison section explaining Depot's advantages
  4. README has prominent "Early Testing / v0.1 Alpha" disclaimer setting proper expectations
  5. Prerequisites documented (Windows, Perforce CLI, p4.exe in PATH)
  6. SmartScreen warning guidance included with bypass instructions for unsigned builds
  7. .planning/ directory explained as showcase of agentic development methodology
  8. CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, and issue templates exist
  9. User has manually verified documentation

**Plans**: 3 plans

Plans:
- [x] 28-01-PLAN.md - Core README (overview, alpha disclaimer, quick start, P4V comparison, SmartScreen guidance)
- [x] 28-02-PLAN.md - Community files (CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue templates)
- [x] 28-03-PLAN.md - User verification checkpoint

### Phase 29: Release Automation
**Goal**: GitHub Actions workflow automates release builds with NSIS and MSI installers published to GitHub Releases

**Depends on**: Phase 27 (rename complete), Phase 28 (documentation references workflows)

**Requirements**: DIST-01, DIST-02, DIST-04

**Success Criteria** (what must be TRUE):
  1. .github/workflows/publish.yml workflow exists using tauri-apps/tauri-action
  2. Workflow configured to build both NSIS (.exe) and MSI installers
  3. Workflow tested with manual trigger and creates GitHub Release draft successfully
  4. Release includes uploadable installers (depot_0.1.0_x64-setup.exe, depot_0.1.0_x64.msi, checksums)
  5. Workflow marks v0.x releases as pre-release automatically

**Plans**: 2 plans

Plans:
- [ ] 29-01-PLAN.md - Create release workflow with tauri-action and update CONTRIBUTING.md
- [ ] 29-02-PLAN.md - Verify workflow via manual trigger and confirm release creation

### Phase 30: Final Validation
**Goal**: Release binaries validated on clean Windows installation and all features smoke tested before public launch

**Depends on**: Phase 26, 27, 28, 29 (all preparatory work complete)

**Requirements**: DIST-03, DIST-05

**Success Criteria** (what must be TRUE):
  1. Version number displayed in app UI (About or settings) reading from tauri.conf.json automatically
  2. Release binary tested on clean Windows VM with successful installation
  3. All core features smoke tested (connection, file tree with 10K+ files, changelists, shelving, conflict resolution)
  4. Settings persistence verified with new identifier (com.depot.client)
  5. Installer SmartScreen bypass process validated and matches README guidance

**Plans**: 1 plan

Plans:
- [x] 30-01-PLAN.md - Manual verification and smoke testing

## Progress

**Execution Order:**
Phases execute in numeric order: 26 → 27 → 28 → 29 → 30

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 26. Security Audit | v6.0 | 2/2 | Complete | 2026-02-05 |
| 27. Application Rename | v6.0 | 4/4 | Complete | 2026-02-06 |
| 28. Documentation | v6.0 | 3/3 | Complete | 2026-02-06 |
| 29. Release Automation | v6.0 | 2/2 | Complete | 2026-02-06 |
| 30. Final Validation | v6.0 | 1/1 | Complete | 2026-02-06 |

---

*Roadmap created: 2026-02-05*
*Last updated: 2026-02-06 after Phase 29 execution completed*
