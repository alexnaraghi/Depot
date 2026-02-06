# Phase 27: Application Rename - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete application rebrand from "p4now" to "Depot" across all artifacts, code, and configuration files. This includes product name, bundle identifier (permanent: com.depot.app), version number (v0.1.0), and all references throughout the codebase. Verified build ensures the rename is complete and correct.

</domain>

<decisions>
## Implementation Decisions

### Branding Details
- Product name always capitalized as "Depot" (title case) throughout UI
- No tagline - just "Depot" standalone
- Window titles show "Depot - [workspace]" when connected to server
- Keep "p4now" references in git history/commit messages for historical context
- Remove all "p4now" references from source code, configs, and documentation

### Migration Handling
- No migration concerns - pre-v1.0 breaking changes are acceptable
- No README migration notice needed - limited private testing audience
- Assume no existing p4now installations to handle

### Version Messaging
- Version number displayed in settings panel footer
- Display format: "v0.1.0 (Alpha)" to set stability expectations
- Version sourced from tauri.conf.json (single source of truth)
- No update checking mechanism - defer to future phase

### Verification Scope
- Successful build criteria: (1) builds without errors, (2) application launches
- Smoke test only: launch app, verify Depot branding appears, basic UI loads
- Comprehensive grep verification: search entire codebase for "p4now" references (excluding git history)
- Build failures or verification issues: stop immediately and fix before proceeding

### Claude's Discretion
- Exact order of file updates during rename
- Commit message structure and granularity
- Specific grep patterns and exclusions for verification

</decisions>

<specifics>
## Specific Ideas

- Bundle identifier "com.depot.app" is PERMANENT - changing after public release breaks user installations
- Version display appears in settings footer (not About dialog or window title)
- Window title format: "Depot - [workspace]" provides context without cluttering

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 27-application-rename*
*Context gathered: 2026-02-05*
