# Requirements: Depot v6.0 Public Launch Preparation

**Defined:** 2026-02-05
**Core Value:** The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive even during network issues or long-running operations.
**Public Version:** v0.1.0 (early testing phase)

## v6.0 Requirements

Requirements for public GitHub launch. Each maps to roadmap phases.

### Security & Audit

- [ ] **SEC-01**: Scan entire Git history for credentials/secrets with Gitleaks or TruffleHog
- [ ] **SEC-02**: Audit .planning/ directory for sensitive information before keeping public
- [ ] **SEC-03**: Review all source code for hardcoded credentials, API keys, or internal server names
- [ ] **SEC-04**: Review and update .gitignore to prevent credential/settings commits

### Repository Preparation

- [ ] **REPO-01**: Add LICENSE file with MIT license and copyright 2026
- [ ] **REPO-02**: Rename application from "p4now" to "Depot" in package.json
- [ ] **REPO-03**: Rename application from "p4now" to "Depot" in Cargo.toml
- [ ] **REPO-04**: Choose and set permanent bundle identifier (recommend com.depot.app) in tauri.conf.json
- [ ] **REPO-05**: Update tauri.conf.json identifier, productName, and version to 0.1.0
- [ ] **REPO-06**: Update window title throughout application to reference "Depot"
- [ ] **REPO-07**: Update all code comments and documentation that reference "p4now"
- [ ] **REPO-08**: Verify app builds and runs after complete rename

### Documentation

- [ ] **DOCS-01**: Create comprehensive README.md with project overview
- [ ] **DOCS-02**: Add demo GIF or screenshot to README showing key features
- [ ] **DOCS-03**: Add quick start guide to README with installation instructions
- [ ] **DOCS-04**: Add P4V comparison section to README explaining advantages
- [ ] **DOCS-05**: Add prominent "Early Testing / v0.1 Alpha" disclaimer to README
- [ ] **DOCS-06**: Document prerequisites (Windows, Perforce CLI, p4.exe in PATH)
- [ ] **DOCS-07**: Add SmartScreen warning guidance for unsigned builds
- [ ] **DOCS-08**: Add explanation of .planning/ directory as agentic development showcase

### Release & Distribution

- [ ] **DIST-01**: Create GitHub Actions workflow for release builds using tauri-action
- [ ] **DIST-02**: Configure workflow to build both NSIS and MSI installers
- [ ] **DIST-03**: Add version display in app UI (About dialog or settings) that reads from tauri.conf.json automatically
- [ ] **DIST-04**: Test manual workflow trigger and verify GitHub Release creation
- [ ] **DIST-05**: Validate release binaries work on clean Windows installation

## Future Requirements

Deferred to post-v0.1 milestones based on adoption and feedback.

### Documentation (v0.2+)

- **DOCS-09**: CONTRIBUTING.md with detailed setup instructions
- **DOCS-10**: CODE_OF_CONDUCT.md for community guidelines
- **DOCS-11**: Issue templates for bug reports and feature requests
- **DOCS-12**: PR template with checklist

### Community Infrastructure (v0.2+)

- **COMM-01**: Enable GitHub Discussions for Q&A
- **COMM-02**: Add repository topics for discoverability (perforce, gui, tauri, version-control)
- **COMM-03**: Create issue labels (bug, enhancement, documentation, good-first-issue)
- **COMM-04**: SECURITY.md with vulnerability reporting process

### Advanced Distribution (v0.5+)

- **DIST-06**: Windows code signing certificate (Azure Trusted Signing or traditional)
- **DIST-07**: Automated changelog generation with git-cliff
- **DIST-08**: Tauri updater configuration for in-app updates

## Out of Scope

Explicitly excluded from this milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Code signing for v0.1 | Cost ($100-500/year) not justified for early testing; unsigned acceptable with README disclaimer |
| Multi-platform support (macOS, Linux) | Adds complexity and testing burden; Perforce primarily Windows; defer until Windows validated |
| Package managers (Chocolatey, winget) | Maintenance overhead for early testing; GitHub Releases sufficient for v0.1 |
| Auto-update mechanism | Requires code signing and backend infrastructure; defer until stable |
| Comprehensive test suite CI | E2E tests exist but require P4 server setup; not blocking for v0.1 |
| Telemetry/analytics | Privacy concerns and implementation complexity; defer until user base exists |
| Contributing templates | Defer until first external contributor appears |
| Extensive architecture docs | Keep it simple for v0.1; .planning/ already showcases development process |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 26 | Pending |
| SEC-02 | Phase 26 | Pending |
| SEC-03 | Phase 26 | Pending |
| SEC-04 | Phase 26 | Pending |
| REPO-01 | Phase 27 | Pending |
| REPO-02 | Phase 27 | Pending |
| REPO-03 | Phase 27 | Pending |
| REPO-04 | Phase 27 | Pending |
| REPO-05 | Phase 27 | Pending |
| REPO-06 | Phase 27 | Pending |
| REPO-07 | Phase 27 | Pending |
| REPO-08 | Phase 27 | Pending |
| DOCS-01 | Phase 28 | Pending |
| DOCS-02 | Phase 28 | Pending |
| DOCS-03 | Phase 28 | Pending |
| DOCS-04 | Phase 28 | Pending |
| DOCS-05 | Phase 28 | Pending |
| DOCS-06 | Phase 28 | Pending |
| DOCS-07 | Phase 28 | Pending |
| DOCS-08 | Phase 28 | Pending |
| DIST-01 | Phase 29 | Pending |
| DIST-02 | Phase 29 | Pending |
| DIST-03 | Phase 30 | Pending |
| DIST-04 | Phase 29 | Pending |
| DIST-05 | Phase 30 | Pending |

**Coverage:**
- v6.0 requirements: 25 total
- Mapped to phases: 25/25 ✓
- Unmapped: 0 ✓

**Phase mapping:**
- Phase 26 (Security Audit): 4 requirements
- Phase 27 (Application Rename): 8 requirements
- Phase 28 (Documentation): 8 requirements
- Phase 29 (Release Automation): 3 requirements
- Phase 30 (Final Validation): 2 requirements

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after roadmap creation*
