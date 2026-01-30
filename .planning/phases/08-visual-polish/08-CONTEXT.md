# Phase 08: Visual Polish - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the app look professional and feel polished with consistent design, loading states, and modern developer tool aesthetics. Dark theme only. No new features — polish existing surfaces.

</domain>

<decisions>
## Implementation Decisions

### Design reference & tone
- Dark, minimal aesthetic — reference GitKraken for overall feel
- Blue accents like VS Code (not teal/cyan)
- Dark only — no light mode (future phase if ever)
- Clear panel borders between sections (VS Code-style splits, not borderless)
- No animations or transitions — static, snappy UI

### Loading & empty states
- Claude's discretion on loading pattern per context (skeletons vs spinners)
- Empty states: text only, muted styling ("No pending files" etc.), no illustrations or icons
- Universal spinner in status bar/footer to indicate any in-progress operation
- Cancel button for operations deferred to a later phase

### Spacing & typography
- GitKraken-level density — comfortable/moderate, information-dense but not cramped
- Section headers get background bar treatment (subtle background behind header text)
- Keep Lucide icons throughout — already in use, stay consistent

### Unified top bar
- Consolidate the two existing top bars into a single bar
- **Left:** Repository and Stream text with labels above values (GitKraken-style). Remove "P4Now" text. Text-only for now (future: clickable buttons)
- **Center:** Perforce action buttons — Refresh, Sync, Reconcile, Add (new CL), Checkout, Revert, Diff
- **Right:** Search, connection status indicator, settings button
- All elements already exist across the two bars — this is a layout consolidation, not new functionality

### Header button style
- GitKraken-style buttons: large icon with smaller text below
- No borders on buttons — only highlight on hover
- All hover/selection behavior consistent between buttons
- Context-sensitive greying: Checkout/Revert/Diff greyed out when no file selected
- Command palette (Ctrl+K) remains as keyboard-first alternative

### Dialog consistency
- All dialogs must follow dark theme — currently inconsistent
- Uniform dialog styling across settings, history, reconcile, and all other dialogs

### Claude's Discretion
- Font choice for UI text
- Exact loading pattern per operation (skeleton vs spinner)
- Spacing/padding values
- Exact color values within the blue accent / dark minimal direction
- Status bar layout and content

</decisions>

<specifics>
## Specific Ideas

- "Follow GitKraken" for density, header button style, and header info layout
- "Blue like VS Code" for accent colors
- Header buttons: large icon, small text below, no border, hover highlight only
- Repository/Stream labels above values in header bar, remove app name text

</specifics>

<deferred>
## Deferred Ideas

- Light mode / theme toggle — future phase
- Cancel button for in-progress operations — future phase
- Making Repository/Stream clickable to change workspace — future phase

</deferred>

---

*Phase: 08-visual-polish*
*Context gathered: 2026-01-29*
