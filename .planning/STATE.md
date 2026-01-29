# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-28)

**Core value:** The user is never blocked — operations are always cancellable, errors are non-blocking, and the app remains responsive.
**Current focus:** v2.0 Feature Complete — Phase 07 Context Menus & Keyboard Shortcuts

## Current Position

Milestone: v2.0 Feature Complete
Phase: 06 of 08 (Shelve & Reconcile) — COMPLETE
Plan: 03 of 03 complete
Status: Phase complete, verified
Last activity: 2026-01-29 — Completed Phase 06 (Shelve & Reconcile)

Progress: [#########################...] 96% (25/~26 plans estimated)

## Performance Metrics

**Velocity:**
- Total plans completed: 25 (14 v1.0 + 11 v2.0)
- Average duration: 7 min
- Total execution time: ~175 min (104 v1.0 + ~71 v2.0)

## Accumulated Context

### Decisions

All v1.0 decisions documented in PROJECT.md Key Decisions table.

**v2.0 Decisions (Phases 03-04):**

| ID | Phase | Decision | Rationale |
|----|-------|----------|-----------|
| D-03-01-01 | 03-01 | Use tauri-plugin-store for settings persistence | Official Tauri plugin, provides simple key-value store with automatic save |
| D-03-01-02 | 03-01 | All P4 commands accept optional connection args | Allows UI to override env vars with saved settings, enables connection testing |
| D-03-01-03 | 03-01 | Connection store tracks status with typed state transitions | Clear state machine for connection lifecycle (disconnected/connecting/connected/error) |
| D-03-02-01 | 03-02 | Use form.watch() for Browse button values | getValues() returns stale values before Controller onChange flushes |
| D-03-02-02 | 03-02 | Override P4PORT/P4USER/P4CLIENT env vars + clear P4CONFIG | Complete isolation from DVCS/P4CONFIG that override -p/-u/-c args |
| D-03-02-03 | 03-02 | Gate frontend queries on connection status | Prevents querying before settings loaded and connection established |
| D-04-01-01 | 04-01 | p4_create_change removes Files section from template | New changelists should be created empty |
| D-04-01-02 | 04-01 | p4_reopen preferred over p4_edit for file movement | Makes file movement intent explicit and clear |
| D-04-01-03 | 04-01 | p4_edit_change_description wraps existing private function | Reuse existing form-parsing logic, avoid duplication |
| D-04-02-01 | 04-02 | Default CL always visible with muted styling | Default CL serves as consistent anchor and drop target |
| D-04-02-02 | 04-02 | Editing default CL description creates new numbered changelist | Reflects P4's actual behavior - default CL cannot have a description |
| D-04-02-03 | 04-02 | Delete validation prevents deletion of default or non-empty CLs | Default CL is permanent, non-empty CLs would orphan files |
| D-04-03-01 | 04-03 | Follow FileContextMenu.tsx pattern for context menu | Consistency with existing codebase patterns |
| D-04-03-02 | 04-03 | Use invokeP4Reopen for both DnD and context menu moves | Makes file movement intent explicit per D-04-01-02 |
| D-05-01-01 | 05-01 | Parse filelog indexed fields in single record | p4 filelog -ztag produces indexed fields (rev0, change0, etc.) in one record |
| D-05-01-02 | 05-01 | Use tempfile::Builder with .keep() for persistent temp files | Enables syntax highlighting in diff tools, prevents premature deletion |
| D-05-01-03 | 05-01 | Support placeholder and append-style diff tool arguments | Supports both modern and traditional diff tool argument patterns |
| D-05-02-01 | 05-02 | useFileHistory uses incremental maxRevisions for pagination | Starts with 50 revisions, Load More increments by 50, simple without complex cursor management |
| D-05-02-02 | 05-02 | Diff against Have uses file.revision (have revision) | Matches P4V behavior, shows uncommitted local changes |
| D-05-02-03 | 05-02 | File History always available, Diff against Have when checked out | History useful for all files, diff only makes sense for modified files |
| D-05-02-04 | 05-02 | Diff tool settings in SettingsDialog with optional arguments | Flexible configuration supporting various diff tools with different argument patterns |
| D-05-03-01 | 05-03 | Prefetch changelists with always-enabled query | Makes search feel instant, 5-minute cache prevents excessive backend calls |
| D-05-03-02 | 05-03 | Client-side filtering for instant results | All filtering in useMemo on cached data, auto-detects search type (number/user/description) |
| D-05-03-03 | 05-03 | GitKraken-style expandable search bar | Icon button expands to input with dropdown results, 300ms debounce |
| D-05-03-04 | 05-03 | Added time field to P4Changelist | Users need to know when changelists were submitted for search context |
| D-06-02-01 | 06-02 | Shelved files as special tree node type (shelved-section) | Integrates cleanly with react-arborist virtualization, maintains visual hierarchy |
| D-06-02-02 | 06-02 | Conflict detection before unshelve compares depot paths | Warns user when shelved files overlap with opened files to prevent conflicts |
| D-06-02-03 | 06-02 | Purple/violet color scheme for shelved files | Visual distinction from pending files using violet-400/violet-300 colors |
| D-06-02-04 | 06-02 | Shelve action only for numbered changelists | Default CL cannot have shelves per Perforce rules |
| D-06-03-01 | 06-03 | ReconcilePreviewDialog uses mutation not query for preview scan | User triggers reconcile manually, mutation provides explicit loading/error states |
| D-06-03-02 | 06-03 | Select all files by default after scan | Most common workflow is reconcile all detected changes, user can deselect unwanted files |
| D-06-03-03 | 06-03 | Group files by action type with color-coded badges | Visual clarity for add (green), edit (yellow), delete (red) operations |

### Pending Todos

1. **Add click-to-dismiss for toasts** (ui) — `.planning/todos/pending/2026-01-28-toast-click-to-dismiss.md`
2. **Fix changelist drag and drop** (ui) — `.planning/todos/pending/2026-01-29-fix-changelist-drag-and-drop.md`
3. **Move files when editing default CL description** (ui) — `.planning/todos/pending/2026-01-29-move-files-when-editing-default-cl-description.md`
4. **Unshelve file to same changelist, not default** (ui) — `.planning/todos/pending/2026-01-29-unshelve-to-same-changelist.md`

### Blockers/Concerns

None active.

## Session Continuity

Last session: 2026-01-29
Stopped at: Completed Phase 06 (Shelve & Reconcile)
Resume file: None

---
**v2.0 In Progress:** Phases 03-06 complete (11/11 plans), Phase 07-08 remaining (~1-2 plans)
