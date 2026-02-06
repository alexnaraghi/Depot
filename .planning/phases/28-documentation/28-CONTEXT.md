# Phase 28: Documentation - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Create comprehensive documentation for public GitHub repository. Deliver README with project overview, quick start guide, P4V comparison, and alpha disclaimer. Include community files (CONTRIBUTING, CODE_OF_CONDUCT, SECURITY) and issue templates. Does NOT include video tutorials, extended examples beyond quick start, or feature-specific deep dives.

</domain>

<decisions>
## Implementation Decisions

### README Structure
- Core sections only: Overview, Alpha Disclaimer, Quick Start, P4V Comparison
- No separate features list - capabilities emerge from comparison table
- No dedicated "Why Depot?" motivation section - keep focused
- Alpha disclaimer appears after overview, before quick start (prominent warning section)
- Single high-quality screenshot showing main interface (no GIF, no multi-screenshot gallery)
- .planning/ directory: Brief mention only ("Built with Claude GSD methodology - see .planning/")

### P4V Comparison Format
- Feature table format (side-by-side: Feature | P4V | Depot)
- Acknowledge gaps: Include rows for major missing features marked "Not yet implemented"
- Tone: Respectful alternative (neutral "different approach" not "better than" language)

### Claude's Discretion
- Which specific features to highlight in comparison table (balance performance + UX wins)
- Exact table structure and column headers
- Quick start depth (installation + first workflow vs installation only)
- Prerequisite documentation detail (Windows, p4.exe, PATH)
- SmartScreen warning guidance placement and wording
- Community file templates (CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue templates)

</decisions>

<specifics>
## Specific Ideas

- Comparison table should be honest about gaps - early adopters appreciate transparency
- Screenshot should capture the main workspace: file tree, pending tab, connection indicator visible

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 28-documentation*
*Context gathered: 2026-02-05*
