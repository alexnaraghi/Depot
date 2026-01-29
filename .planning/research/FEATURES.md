# Feature Landscape: P4Now v2.0

**Domain:** Perforce GUI client (desktop, Windows)
**Researched:** 2026-01-28
**Confidence:** HIGH (based on official Perforce 2025.x documentation)

---

## Existing v1.0 Features (Already Built)

- Sync / Get Latest from depot
- View pending changelist (checked-out and modified files)
- Submit changes with changelist description
- Checkout files for editing
- Revert changes
- File status indicators
- Async non-blocking operations with cancellation

---

## v2.0 Table Stakes

Features users expect. Missing any of these makes v2.0 feel incomplete.

### 1. Connection Settings UI

**Complexity:** Medium | **Dependencies:** None (foundation for everything)

**Fields required:**
| Field | Env Var | Format | Notes |
|-------|---------|--------|-------|
| Server | P4PORT | `hostname:port` or `ssl:hostname:port` | Default port 1666 |
| User | P4USER | String | Required |
| Client/Workspace | P4CLIENT | String | Should offer browse after connection test |
| Charset | P4CHARSET | `auto`, `utf8`, `none`, etc. | Only for Unicode-mode servers. If set on non-Unicode server, error: "Unicode clients require a unicode enabled server." |

**Expected validation flow:**
1. User enters server + user
2. "Test Connection" runs `p4 -p <server> -u <user> info`
3. If Unicode server detected, prompt for charset (or default `auto`)
4. List workspaces: `p4 -p <server> -u <user> clients -u <user>`
5. User selects workspace
6. Save to app config (not system env vars -- avoid polluting system)

**P4V behavior:** Connection wizard on first launch. Recent connections saved in dropdown. Supports multiple simultaneous connections (tabs). For v2.0, single connection is fine; save recent connections for quick switching.

### 2. Connection Status Indicator

**Complexity:** Low | **Dependencies:** Connection settings

Show connected/disconnected/error state persistently. Poll with `p4 info` on a timer or detect failures from command execution. P4V shows a green/red icon in the status bar.

### 3. Multiple Changelists

**Complexity:** High | **Dependencies:** Existing pending changes view

**Core concepts:**
- **Default changelist:** Always exists, cannot be deleted. All newly opened files go here unless `-c` specified.
- **Numbered changelists:** Created explicitly. Have editable descriptions. Can be submitted independently.

**CLI commands:**
| Operation | Command |
|-----------|---------|
| Create | `p4 change -i` (pipe spec to stdin) |
| List pending | `p4 changes -s pending -u <user> -c <client>` |
| Move file | `p4 reopen -c <targetCL> <file>` |
| Move to default | `p4 reopen -c default <file>` |
| Edit description | `p4 change -o <num>`, modify, `p4 change -i` |
| Delete empty CL | `p4 change -d <num>` (fails if files remain) |

**P4V UI behavior:**
- Each changelist is a collapsible tree node showing its files
- Drag-and-drop files between changelists
- Right-click changelist > "New Pending Changelist"
- Right-click file > "Move to Another Changelist" > submenu of CLs
- Double-click description to edit inline
- Submit operates on a specific changelist
- Cannot delete CL that has files; must move/revert files first

### 4. File History Viewer

**Complexity:** Medium | **Dependencies:** None (new view)

**Columns (from `p4 filelog`):**
| Column | Description |
|--------|-------------|
| Revision | #1, #2, ... (newest first) |
| Action | add, edit, delete, branch, integrate, move/add, move/delete |
| Changelist | CL number |
| Date | Submission date/time |
| User | Who submitted |
| Description | CL description (first line or full) |
| File type | text, binary, unicode, etc. |

**Expected interactions:**
- Right-click revision: diff against previous, diff against workspace, get this revision
- Current workspace revision highlighted (red box in P4V)
- Show integration source info (where branched from)
- Click revision to see full changelist details

### 5. Right-Click Context Menus

**Complexity:** Low | **Dependencies:** Existing views + new features

**Pending changes view - on file:**
- Diff against depot (have revision)
- Revert
- Move to Another Changelist > [list of CLs]
- Shelve
- File History

**Pending changes view - on changelist:**
- Submit
- Shelve
- New Pending Changelist
- Edit Description
- Delete (if empty)

**Workspace view - on file:**
- Checkout (Edit)
- Add (if not in depot)
- Diff against depot
- File History
- Get Revision (sync specific file)
- Reconcile (if file appears modified)

### 6. Keyboard Shortcuts

**Complexity:** Low | **Dependencies:** All existing commands

**P4V has surprisingly few built-in shortcuts.** Most operations require right-clicking. This is a gap we exploit.

**Recommended shortcuts:**
| Operation | Shortcut | Rationale |
|-----------|----------|-----------|
| Refresh | F5 | Universal standard |
| Get Latest / Sync | Ctrl+G | Frequent operation |
| Checkout / Edit | Ctrl+E | Quick file editing |
| Revert | Ctrl+Shift+R | Needs modifier to prevent accidental use |
| Submit | Ctrl+Enter | Natural "send" gesture |
| Diff against depot | Ctrl+D | Quick diff review |
| File History | Ctrl+H | History mnemonic |
| New Changelist | Ctrl+N | Standard "new" |
| Search | Ctrl+F | Universal standard |
| Reconcile | Ctrl+Shift+E | "Edit offline" mnemonic |

**Differentiator opportunity:** Add a command palette (Ctrl+K or Ctrl+Shift+P) with fuzzy search for all operations. This alone beats P4V for keyboard users.

### 7. Reconcile Offline Work

**Complexity:** Medium | **Dependencies:** Existing pending changes, multiple changelists (for target CL selection)

**What `p4 reconcile` detects:**
1. **Modified files** not opened for edit -- opens for edit
2. **New files** not in depot -- opens for add
3. **Missing files** deleted locally -- opens for delete
4. **Moved files** -- compares adds+deletes by content similarity, converts to move pairs

**P4V UI presentation:**
- "Reconcile Offline Work" dialog with preview
- Grouped by action type (edit/add/delete)
- Checkboxes for individual file selection
- Target changelist picker
- Respects P4IGNORE file by default

**CLI flags:**
| Flag | Purpose |
|------|---------|
| `-n` | Preview only (dry run) -- use this first |
| `-a` | Only detect adds |
| `-e` | Only detect edits |
| `-d` | Only detect deletes |
| `-m` | Improve performance for large files |
| `-w` | Ignore whitespace changes |
| `-I` | Ignore P4IGNORE file |

**Recommended implementation:** Run `p4 reconcile -n` first to show preview. Let user select/deselect files. Then run `p4 reconcile` on selected files with target changelist.

**Auto-detection (explore):** File system watcher for external changes. Must be opt-in. Flag for deeper research -- complexity is high, benefit uncertain.

### 8. Display Current Stream/Repository

**Complexity:** Low | **Dependencies:** Connection settings

**What `p4 info` returns:** Server address, server version, client name, client root, client stream (if applicable), user name.

**What to show in persistent header/statusbar:**
- Server address (abbreviated: `ssl:perforce:1666` -> `perforce`)
- Current workspace name
- Current stream name and type (if streams workspace)
- If not streams: depot path from workspace mapping

**P4V behavior:** Workspace icon in toolbar indicates current stream. Stream name visible. Can drag workspace icon to switch streams (we should NOT implement this -- too complex).

### 9. Shelve/Unshelve

**Complexity:** Medium | **Dependencies:** Multiple changelists

**Shelve workflow:**
1. Right-click changelist > Shelve
2. Dialog: checkboxes for each file, "Revert after shelve" option
3. Run `p4 shelve -c <CL>` (or `-r` to replace existing shelf)
4. Shelved files appear as distinct section under the changelist

**Unshelve workflow:**
1. Right-click shelved changelist > Unshelve
2. Dialog: file selection, target changelist picker
3. Options: "Delete shelf after unshelve", "Revert before unshelve"
4. Run `p4 unshelve -s <sourceCL> -c <targetCL>`
5. If conflict: file flagged as unresolved, needs `p4 resolve`

**CLI mapping:**
| Operation | Command |
|-----------|---------|
| Shelve | `p4 shelve -c <CL>` |
| Replace shelf | `p4 shelve -c <CL> -r` |
| Delete shelf | `p4 shelve -d -c <CL>` |
| Unshelve | `p4 unshelve -s <CL> -c <targetCL>` |
| List shelved files | `p4 describe -S -s <CL>` |

**Key behavior:** Shelving does NOT create file history. Unshelving does NOT remove the shelf (explicit delete required). Shelving from default CL creates a new numbered CL.

### 10. Search Submitted Changelists

**Complexity:** Medium | **Dependencies:** None (new view)

**P4V filter capabilities:**
- By user (with wildcards: `*bert*`, `ava*`, exact match)
- By workspace
- By file path
- By date/changelist range
- NO native description search (P4V limitation!)

**CLI approach:**
| Filter | Command |
|--------|---------|
| By user | `p4 changes -s submitted -u <user>` |
| By path | `p4 changes -s submitted //depot/path/...` |
| By date range | `p4 changes -s submitted @2026/01/01,@2026/01/28` |
| By CL number | `p4 changes -s submitted @<num>,@<num>` |
| With descriptions | `p4 changes -s submitted -l` (long output) |
| Max results | `p4 changes -s submitted -m 100` |

**Description search:** No server-side filter exists. Must fetch changelists with `-l` and filter client-side. This is a known P4V gap -- implementing it is a differentiator.

**Result display columns:** CL number, date, user, workspace, description (truncated).

### 11. External Diff Tool Integration

**Complexity:** Low-Medium | **Dependencies:** File history (for revision comparison)

**Configuration model:**
- P4V: Edit > Preferences > Diff tab. Browse for executable. Arguments with `%1` / `%2` placeholders.
- P4 CLI: `P4DIFF` env var for diff tool, `P4MERGE` for merge tool.
- P4Now should store in app config, not system env vars.

**Settings UI fields:**
- Diff tool path (file browser)
- Arguments pattern (default: `%1 %2`)
- Common presets: P4Merge, Beyond Compare, WinMerge, VS Code

**What gets compared:**
| Comparison | How |
|------------|-----|
| Workspace vs depot head | `p4 print -o <temp> <file>` then launch tool with temp + workspace |
| Workspace vs specific revision | `p4 print -o <temp> <file>#<rev>` then launch tool |
| Two revisions | `p4 print` both to temp files, launch tool |
| Shelved vs depot | `p4 print` shelved + head to temp files |

**Note:** `p4 diff` uses P4DIFF but `p4 diff2` does NOT. Better to always use `p4 print` to temp files and launch tool directly for consistency.

### 12. Improved Visual Design

**Complexity:** Medium | **Dependencies:** All views (cross-cutting)

Not a single feature but a quality pass. Specific to v2.0:
- Consistent spacing, typography, color palette
- Dark mode support (Windows 11 native)
- Proper loading states and skeletons
- Better file status icons
- Professional look competitive with modern dev tools

---

## v2.0 Differentiators

Features that set P4Now apart from P4V. Not expected, but create competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Command palette** | Ctrl+K fuzzy search for all operations. P4V has nothing like this. | Medium | Single biggest keyboard UX win. |
| **Description search** | Search submitted CLs by description text. P4V cannot do this. | Medium | Client-side indexing of fetched CL descriptions. |
| **Instant reconcile preview** | Show reconcile results progressively as `p4 reconcile -n` streams. P4V blocks. | Medium | Leverages existing async architecture. |
| **Non-blocking shelve/unshelve** | P4V blocks during shelve. Show progress, allow cancel. | Low | Already have async infrastructure. |
| **Inline changelist editing** | Edit CL descriptions without modal dialog. P4V uses modals. | Low | Direct contentEditable or input field. |
| **Connection profiles** | Save multiple server connections, quick-switch dropdown. P4V buries this. | Low | Store in app config. Header dropdown. |
| **Quick changelist move** | Move files between CLs via inline dropdown, no dialog needed. | Low | Dropdown selector instead of P4V's dialog. |

---

## Anti-Features

Things to deliberately NOT build in v2.0.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Stream graph visualization** | DAG layout is extremely complex. P4V's took years and is still mediocre. | Show stream name/type as text in statusbar. |
| **Time-lapse view** | Line-by-line blame slider across all revisions. Enormous UI effort for niche use. | Show file history table. Diff between any two revisions. Defer to v3+. |
| **Built-in merge/resolve UI** | 3-way merge is a separate product category. P4Merge is free. | Launch P4Merge or configured external merge tool. |
| **Image diff viewer** | Visual diff for BMP/GIF/JPG/PNG. Very niche. | Launch external diff tool for images. |
| **Branch/integrate operations** | Complex P4 operations with many edge cases. | Defer entirely. Not core developer workflow. |
| **Job/fix tracking** | P4 supports linking CLs to jobs. Rarely used outside enterprise. | Show raw description field only. |
| **Auto-background refresh** | Constant `p4 fstat` polling hammers server, slows UI. P4V does this badly. | Manual refresh with F5. Show staleness timestamp. |
| **Full workspace/stream switching** | P4V supports drag-to-switch with auto-shelve. Complex state management. | Show current stream info only. Switch via settings. |
| **Modal dialogs for everything** | P4V's biggest UX pain point. Blocks all work. | Use inline panels, sidebars, dropdowns. Only confirm destructive actions with modals. |

---

## Feature Dependencies (v2.0)

```
Connection Settings ──> Connection Status Indicator
                   ──> Stream/Repo Display
                   ──> ALL other features (implicit)

Existing Pending Changes ──> Multiple Changelists (extends current view)
                         ──> Right-click Context Menus (adds to current view)
                         ──> Shelve/Unshelve (operates on CLs)

Multiple Changelists ──> Shelve/Unshelve (shelve targets specific CL)
                     ──> Reconcile (files opened into chosen CL)
                     ──> Drag-drop files between CLs

File History ──> External Diff (diff revision vs workspace/previous)

Keyboard Shortcuts ──> Independent (can wire up to any existing command)

Search Changelists ──> Independent (new view, uses p4 changes)

Visual Design ──> Cross-cutting (applies to all views)
```

---

## MVP Phasing Recommendation

### Phase 1: Foundation
1. **Connection settings UI** -- everything else depends on this
2. **Connection status indicator** -- pairs naturally
3. **Display current stream/repo** -- pairs naturally, same data source
4. **Keyboard shortcuts** -- low effort, high impact, improves all testing

### Phase 2: Core Workflow Extensions
5. **Multiple changelists** -- fundamental P4 workflow gap in v1.0
6. **Right-click context menus** -- makes existing + new features accessible
7. **Shelve/unshelve** -- depends on multiple changelists being solid

### Phase 3: Investigation & History
8. **Reconcile offline work** -- medium complexity, needs good preview UI
9. **File history viewer** -- new view, independent work
10. **External diff tool** -- pairs with file history for revision comparison

### Phase 4: Search & Polish
11. **Search submitted changelists** -- needs caching strategy for description search
12. **Improved visual design** -- quality pass across all views

**Ordering rationale:**
- Connection settings first: dependency for all server features
- Multiple changelists before shelve: shelve operates on specific changelists
- Keyboard shortcuts early: low cost, high value, accelerates developer testing
- Search last: description search requires client-side indexing, no server support
- Visual design last: polish pass after all functional surfaces exist

---

## Sources

- [P4V Shelve Files (2025.4)](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/files.shelve.html)
- [P4VS Unshelve Files (2025.1)](https://help.perforce.com/helix-core/integrations-plugins/p4vs/current/Content/P4VS/managing.shelving.unshelving.html)
- [p4 shelve CLI reference (2025.2)](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_shelve.html)
- [p4 reconcile CLI reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_reconcile.html)
- [P4V File History](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/files.history.html)
- [P4V Keyboard Shortcuts](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/using.access-keys.html)
- [P4V Shortcuts Preferences](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/configuring.preferences.shortcuts.html)
- [P4V Search and Filter](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/using.filters.html)
- [P4V Stream Graph](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/streams.graph.html)
- [P4CHARSET reference (2025.2)](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/P4CHARSET.html)
- [P4V Diff Preferences](https://www.perforce.com/manuals/p4v/Content/P4V/configuring.preferences.diff.html)
- [p4 reopen reference](https://www.perforce.com/manuals/cmdref/Content/CmdRef/p4_reopen.html)
- [Move files between changelists](https://www.perforce.com/manuals/p4guide/Content/P4Guide/move-files-between-changelists.html)
