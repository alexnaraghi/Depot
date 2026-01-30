# Feature Research: P4Now v3.0

**Domain:** Perforce GUI client for daily development workflows
**Researched:** 2026-01-29
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in a Perforce GUI. Missing these means the product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Resolve: Conflict detection after sync** | P4V displays question mark badge on files needing resolution; users expect visual indication | LOW | Already have file status system; add "?" badge for needs-resolve state |
| **Resolve: Launch external merge tool** | P4V uses "Run Merge Tool" option in resolve dialog; external merge is standard workflow | MEDIUM | Similar to existing diff tool integration; use P4MERGE env var or setting |
| **Resolve: Accept source/target/merged options** | P4V provides Accept Source, Accept Target, Accept Merged in resolve dialog | LOW | CLI commands: `p4 resolve -at/-ay/-am` |
| **Resolve: Mark resolved and submit** | Can't submit until conflicts resolved; blocking operation | LOW | Run `p4 resolve` then enable submit |
| **Depot browser: Full depot hierarchy tree** | P4V shows entire depot tree in left pane; users navigate folders like file explorer | MEDIUM | Similar to workspace tree (already exists); use `p4 dirs` recursively |
| **Depot browser: Sync files/folders** | Right-click depot folder → Get Latest Revision is core workflow | LOW | Run `p4 sync <depot-path>` on selection |
| **Depot browser: Checkout for edit** | Right-click depot file → Check Out is standard operation | LOW | Run `p4 edit <depot-path>` |
| **Depot browser: View file history** | Right-click depot file → View History shows revision timeline | LOW | Already have history viewer; pass depot path instead of workspace path |
| **Depot browser: Diff operations** | Diff workspace vs depot, diff between revisions from depot view | MEDIUM | Already have diff integration; adapt for depot paths |
| **Workspace switching: Select different workspace** | P4V has workspace dropdown; users switch contexts frequently | MEDIUM | Update P4CLIENT env var, reload workspace state |
| **Workspace switching: Show available workspaces** | P4V lists all workspaces owned by current user via `p4 clients -u <user>` | LOW | Simple CLI query, display in dropdown |
| **Stream switching: Change current stream** | P4V provides "Work in this Stream" right-click option; fundamental to stream-based workflows | MEDIUM | Run `p4 switch <stream>` or update workspace then sync |
| **Stream switching: Auto-shelve default CL files** | P4V (2019.1+) auto-shelves default CL files when switching streams with "Switched branch shelf" description | MEDIUM | Prevents losing work when switching; users expect this |
| **Stream switching: Reconcile before reuse** | P4V offers "Run reconcile before reusing workspace" preference when switching streams | LOW | Optional workflow; detects offline changes before switch |
| **Search: Interact with file results** | Users expect to right-click search results and perform operations (diff, history, checkout) | MEDIUM | Search results need context menu integration; not just read-only display |
| **Search: Jump to changelist/author** | Clicking CL number or author in search should filter/navigate to that view | LOW | Already have changelist search; add navigation from results |
| **Auto-refresh: Periodic workspace polling** | P4V has "Check server for updates every n minutes" setting; users expect current status | MEDIUM | Poll `p4 changes -m 1` and `p4 opened` on interval; configurable timer |
| **Auto-refresh: File status updates** | P4V automatically refreshes file badges showing locks, edits by others | MEDIUM | Query periodically; show blue badges for other users' actions |
| **Auto-refresh: Manual refresh action** | Users expect a Refresh button when auto-update is insufficient | LOW | Already in v3.0 bug fixes; invalidate queries |

### Differentiators (Competitive Advantage)

Features that set P4Now apart from P4V. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Non-blocking resolve workflow** | P4V uses modal dialogs; P4Now can show resolve state in main view without blocking | LOW | Align with Core Value: never trap user in modals |
| **Inline resolve status in file list** | Show resolve state as badge in existing file tree instead of separate dialog | LOW | Cleaner than P4V's separate Resolve window |
| **Depot browser: Visual sync state indicators** | Show which depot files are synced, out-of-date, or not in workspace with color-coded badges | MEDIUM | P4V shows this with various badges; we can be clearer |
| **Depot browser: Keyboard-first navigation** | Depot tree navigable with arrow keys, operations via keyboard shortcuts | LOW | P4V has basic keyboard support (Ctrl+9 for depot tree); we can excel here |
| **Fast depot tree lazy loading** | Load depot children on-demand instead of entire tree upfront | MEDIUM | P4V can be slow with large depots; virtualization helps |
| **Workspace switch without modal dialog** | Dropdown selector in header instead of P4V's Edit Current Workspace dialog | LOW | Faster workflow; no context switch |
| **Stream switch: Preview sync size** | Show how many files will change before committing to stream switch | MEDIUM | P4V doesn't show this; reduces surprises |
| **Stream switch: Shelf work-in-progress automatically** | Auto-shelve numbered CLs too, not just default CL (P4V only auto-shelves default) | MEDIUM | Better safety; prevents lost work |
| **Search: Unified omnisearch** | Single search box for files, CLs, users, depot paths instead of separate dialogs | MEDIUM | P4V has separate search modes; unified is faster |
| **Search: Real-time filtering** | Filter-as-you-type from prefetched cache instead of server round-trips | LOW | Already doing this for CL search; extend to files |
| **Auto-refresh: Smart polling** | Only poll when window is focused; pause when inactive to save server load | LOW | Better server citizenship than P4V |
| **Auto-refresh: Visual refresh indicator** | Show "Updated 2s ago" instead of silent updates | LOW | User confidence that data is current |
| **Auto-refresh: Detect other users' locks** | Highlight files locked by teammates before attempting checkout | MEDIUM | Prevents "file locked" errors; proactive UX |
| **Instant operations** | No loading spinners for local state changes (workspace switch, CL switching) | LOW | P4V shows loading for everything; we can be snappier |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Built-in merge UI** | P4V has P4Merge bundled; users may expect inline merging | Complex 3-way merge UI; high maintenance; external tools (P4Merge, VS Code) are better | Launch external merge tool; support configurable merge tool paths |
| **Interactive resolve wizard** | P4V has step-by-step resolve dialog walking through each file | Modal workflow traps user; breaks Core Value (never blocked) | Show all files needing resolve in main view; resolve independently |
| **Automatic resolve without preview** | "Just resolve automatically" seems fast | Can silently accept wrong merge; dangerous for conflicts | Require explicit user action; show preview of what will be resolved |
| **Real-time auto-refresh on every change** | "Always show latest state immediately" | Excessive server load; distracting badge changes during active work | Configurable polling interval (default 5 min); manual refresh button |
| **Depot browser: Expand entire depot tree** | "Show me everything" seems comprehensive | 100k+ files brings GUI to crawl; P4V has this issue | Lazy load on-demand; bookmarks for common paths |
| **Stream graph visualization** | P4V has stream graph; users may request it | DAG layout is extremely complex; niche feature for daily workflow | List streams in dropdown; show parent/child relationships textually |
| **Multi-workspace support** | "Work on multiple streams simultaneously" | State management complexity; sync conflicts; workspace pollution | Single workspace; fast switching with auto-shelve |
| **Workspace editor** | P4V allows editing workspace view mappings | Advanced operation; easy to break workspace; risks data loss | Read-only view; link to P4V for editing |
| **Background sync during switch** | "Switch streams instantly while syncing in background" | File system inconsistency; race conditions; cannot work safely | Block on sync; show progress; ensure consistent state |
| **Auto-unshelve after stream switch** | P4V auto-shelves then auto-unshelves when returning to stream | File conflicts if depot changed; silent errors | Auto-shelve on leave; manual unshelve on return (user choice) |

## Feature Dependencies

```
Resolve Workflow
    └──requires──> External merge tool setting (v3.0)
                    └──requires──> Existing diff tool pattern (v2.0)
    └──requires──> File status badge system (v1.0)
    └──enhances──> Sync operation (v1.0)
    └──enhances──> Unshelve operation (v2.0)

Depot Browser
    └──requires──> Tree virtualization (v2.0 - react-arborist)
    └──requires──> File operations (sync, checkout, history, diff) (v1.0-v2.0)
    └──enhances──> Workspace browser (v2.0)

Workspace Switching
    └──requires──> Connection settings system (v2.0)
    └──requires──> Workspace state reload (v1.0)
    └──conflicts──> Multi-workspace support (anti-feature)

Stream Switching
    └──requires──> Workspace switching (v3.0)
    └──requires──> Shelve/unshelve operations (v2.0)
    └──enhances──> Auto-shelve workflow (v2.0)
    └──optional──> Reconcile operation (v2.0)

Actionable Search
    └──requires──> Existing search (v2.0)
    └──requires──> Context menus (v2.0)
    └──requires──> File operations (v1.0-v2.0)

Auto-refresh
    └──requires──> Query invalidation pattern (v2.0)
    └──requires──> File status system (v1.0)
    └──enhances──> Workspace state (v1.0)
```

### Dependency Notes

- **Resolve requires External merge tool:** Same pattern as diff tool integration (v2.0); reuse settings UI and process launching
- **Resolve enhances Sync and Unshelve:** Both operations can create conflicts requiring resolution
- **Depot browser reuses existing patterns:** Tree component, file operations, status badges all exist
- **Workspace switching conflicts with Multi-workspace:** Design decision (v1.0) to simplify; fast switching is alternative
- **Stream switching requires Workspace switching:** Streams are workspace configurations; switching stream = switching workspace config
- **Stream switching enhances Shelve:** Auto-shelving work when switching is key workflow improvement over P4V
- **Actionable search extends existing search:** v2.0 has search UI; v3.0 adds interactions (operations on results)
- **Auto-refresh uses Query invalidation:** TanStack Query pattern (v2.0 decision); periodic invalidation triggers refetch

## MVP Definition (v3.0 Scope)

### Launch With (v3.0)

Essential features for daily contributor evaluation.

- [x] **Resolve: Conflict detection** - Show "?" badge for files needing resolution after sync/unshelve
- [x] **Resolve: Launch merge tool** - Run configured external merge tool on conflicted files
- [x] **Resolve: Accept options** - Accept source/target/merged via context menu or command palette
- [x] **Depot browser: Tree view** - Navigate depot hierarchy in left pane (alongside workspace tree)
- [x] **Depot browser: Basic operations** - Sync, checkout, history, diff from depot paths
- [x] **Workspace switching: Dropdown selector** - List workspaces, switch via header dropdown (non-modal)
- [x] **Stream switching: Switch command** - Change workspace stream with auto-shelve of default CL
- [x] **Search: Context menu integration** - Right-click search results for operations (diff, history, checkout)
- [x] **Auto-refresh: Configurable polling** - Setting for refresh interval (default 5 min); poll workspace state
- [x] **Auto-refresh: Manual refresh** - Refresh button (bug fix from v3.0 list)
- [x] **External editor setting** - Configure editor launch command

### Add After Validation (v3.x)

Features to add once core workflows validated by contributors.

- [ ] **Resolve: Batch resolve** - Resolve multiple files with same strategy (accept source all, accept target all)
- [ ] **Resolve: Conflict preview** - Show conflict hunks inline before launching merge tool
- [ ] **Depot browser: Bookmarks** - Save common depot paths for quick navigation (P4V has this)
- [ ] **Depot browser: Folder diff** - Diff two depot folders or depot folder vs workspace folder
- [ ] **Stream switching: Sync size preview** - Show file count and MB to sync before confirming switch
- [ ] **Stream switching: Auto-shelve numbered CLs** - Extend auto-shelve to numbered CLs, not just default
- [ ] **Search: Unified omnisearch** - Single search box for files, CLs, users, depot paths
- [ ] **Auto-refresh: Smart polling** - Pause when window inactive; resume when focused
- [ ] **Auto-refresh: Lock detection** - Show blue badges for files locked by other users

### Future Consideration (v4+)

Features to defer until product-market fit established and contributor feedback analyzed.

- [ ] **Stream list view** - Show all streams in dropdown with parent/child relationships
- [ ] **Workspace spec viewer** - Read-only view of workspace view mappings and settings
- [ ] **Depot browser: Advanced diff** - Diff any two depot revisions (not just adjacent)
- [ ] **Multi-file history** - Show combined history for multiple selected files
- [ ] **Auto-refresh indicator** - "Updated 2s ago" timestamp in UI
- [ ] **Keyboard-first depot navigation** - Full keyboard shortcuts for depot operations

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Resolve: Conflict detection | HIGH | LOW | P1 |
| Resolve: Launch merge tool | HIGH | MEDIUM | P1 |
| Resolve: Accept options | HIGH | LOW | P1 |
| Depot browser: Tree view | HIGH | MEDIUM | P1 |
| Depot browser: Basic operations | HIGH | LOW | P1 |
| Workspace switching: Dropdown | HIGH | MEDIUM | P1 |
| Stream switching: Switch command | HIGH | MEDIUM | P1 |
| Search: Context menu integration | MEDIUM | MEDIUM | P1 |
| Auto-refresh: Configurable polling | MEDIUM | MEDIUM | P1 |
| Auto-refresh: Manual refresh | MEDIUM | LOW | P1 |
| External editor setting | LOW | LOW | P1 |
| Resolve: Batch resolve | MEDIUM | MEDIUM | P2 |
| Depot browser: Bookmarks | MEDIUM | LOW | P2 |
| Stream switching: Sync preview | MEDIUM | MEDIUM | P2 |
| Search: Unified omnisearch | MEDIUM | MEDIUM | P2 |
| Auto-refresh: Smart polling | LOW | LOW | P2 |
| Stream list view | LOW | LOW | P3 |
| Workspace spec viewer | LOW | MEDIUM | P3 |
| Keyboard-first depot navigation | MEDIUM | LOW | P3 |

**Priority key:**
- P1: Must have for v3.0 launch (daily driver readiness)
- P2: Should have post-v3.0 (contributor feedback-driven)
- P3: Nice to have in future (v4+ consideration)

## Competitor Feature Analysis: P4V vs P4Now

| Feature | P4V | P4Now Approach |
|---------|-----|----------------|
| **Resolve workflow** | Modal "Resolve" dialog blocking other work; step-through wizard | Non-blocking resolve state in main file list; resolve files independently; no wizard |
| **Depot browser** | Full depot tree in left pane; slow with large depots; context menu operations | Lazy-loaded tree; virtualization; same operations; keyboard-first |
| **Workspace switching** | Edit Current Workspace dialog (modal); shows all workspaces via separate search | Header dropdown (non-modal); filter-as-you-type; instant switch |
| **Stream switching** | Right-click stream → Work in this Stream; auto-shelve default CL only (2019.1+) | Dropdown or command palette; auto-shelve all CLs; preview sync size |
| **Search** | Separate Find File, Find Changelist, Go To Spec dialogs; results read-only | Unified search with context menu for operations; actionable results |
| **Auto-refresh** | "Check server every n minutes" setting; silent updates; no pause on inactive | Configurable interval; smart pause when inactive; visual indicator |
| **File status badges** | Red badges (you), blue badges (others); tooltip for details; multiple badges possible | Same color system; extend with resolve state ("?"); consistent with P4V |
| **External tool integration** | P4MERGE env var; Preferences → Diff → Applications; complex setup | Settings UI for diff/merge/editor paths; simple configuration |
| **Performance** | Slow with large depots; high memory; occasional crashes | Rust backend; virtualized trees; async operations; responsive |
| **UI paradigm** | Modal dialogs; blocking workflows; cluttered interface; many windows | Non-blocking; single window; command palette; keyboard shortcuts |

## Sources

**Official Perforce Documentation (HIGH confidence):**
- [Resolve files - P4V Documentation](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/branches.resolve.html)
- [Display revision history - P4V](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/files.history.html)
- [Reconcile offline work - P4V](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/using.offline.html)
- [Shelve files - P4V Documentation](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/files.shelve.html)
- [Shelve streams - P4V Documentation](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/streams.shelved.html)
- [Search and filter - P4V Documentation](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/using.filters.html)
- [P4V icons - P4V Documentation](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/using.icons.html)
- [p4 sync - P4 CLI Documentation (2025.2)](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_sync.html)
- [p4 reconcile - P4 CLI Documentation](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_reconcile.html)

**Official Perforce Manuals (HIGH confidence):**
- [Create and manage workspaces - P4V](https://www.perforce.com/manuals/p4v/Content/P4V/using.workspaces.html)
- [Switch between streams - DVCS](https://www.perforce.com/manuals/dvcs/Content/DVCS/streams.switch.html)
- [Behavior preferences - P4V](https://www.perforce.com/manuals/p4v/Content/P4V/configuring.preferences.behavior.html)
- [Performance preferences - P4V](https://www.perforce.com/manuals/p4v/Content/P4V/configuring.preferences.server.html)
- [Streams preferences - P4V](https://www.perforce.com/manuals/p4v/Content/P4V/configuring.preferences.streams.html)
- [The folder diff utility - P4V](https://www.perforce.com/manuals/p4v/Content/P4V/advanced_files.folder_diff.html)
- [Diff files and folders - P4V Documentation](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/files.diff.html)
- [Merge files between codelines - P4V](https://www.perforce.com/manuals/p4v/Content/P4V/branches.merging.html)

**Video Tutorials (MEDIUM confidence):**
- [Resolving Conflicts in P4V - Perforce](https://www.perforce.com/video-tutorials/vcs/resolving-conflicts-p4v)
- [Switching Streams and Workspaces - Perforce](https://www.perforce.com/video-tutorials/vcs/switching-streams-workspaces)

**Community Sources (LOW-MEDIUM confidence):**
- [P4V usability issues - GitHub Gist](https://gist.github.com/gorlak/abbf2ed0b60169afd4189744a7d0c38b)
- [P4V deficiencies compared to P4Win - DevOpsSchool](https://www.devopsschool.com/blog/p4v-deficiencies-compared-to-p4win/)

---
*Feature research for: P4Now v3.0 - Perforce GUI for daily development workflows*
*Researched: 2026-01-29*
*Confidence: HIGH (official documentation verified via WebFetch and WebSearch)*
