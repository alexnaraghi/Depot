# Technology Stack: v2.0 Additions

**Project:** p4now
**Researched:** 2026-01-28
**Scope:** New libraries/plugins needed for v2.0 features only

## Existing Stack (Do Not Change)

| Technology | Version | Purpose |
|------------|---------|---------|
| Tauri | 2.x | Desktop framework |
| React | 19.x | UI framework |
| TanStack Query | 5.x | Async state |
| Zustand | 5.x | Client state |
| shadcn/ui + Radix | various | UI components |
| Tailwind CSS | 3.x | Styling |
| react-arborist | 3.x | File tree |
| tauri-plugin-shell | 2.x | p4.exe spawning |
| lucide-react | 0.563+ | Icons |
| react-hot-toast | 2.x | Notifications |

## New Additions

### 1. Context Menus: shadcn/ui Context Menu (Radix)

**Add:** `@radix-ui/react-context-menu` via `npx shadcn@latest add context-menu`
**Confidence:** HIGH

**Why:** shadcn/ui already provides a Context Menu component built on Radix primitives. The project already uses Radix (`@radix-ui/react-alert-dialog`, `@radix-ui/react-collapsible`, etc.). Adding a separate library would introduce styling inconsistency and unnecessary weight.

**Capabilities:** Right-click trigger positioned at pointer, submenus, checkable items (radio/checkbox), separator groups, keyboard navigation, portal rendering, full accessibility.

**Known issue:** Context menu position does not always reset on consecutive right-clicks (Radix primitives issue #2611). Acceptable for a desktop app where right-click targets are distinct elements (file rows, changelist headers).

**Do NOT add:** react-contexify, react-contextmenu, rctx-contextmenu. Radix covers this completely and matches existing styling.

### 2. Drag and Drop: @dnd-kit

**Add:** `@dnd-kit/core@^6.3.1` + `@dnd-kit/sortable@^10.0.0` + `@dnd-kit/utilities@^3.2.2`
**Confidence:** HIGH

**Why:** dnd-kit is the standard React DnD library. Lightweight (~10kb core, zero external dependencies), accessible with keyboard support, and works well with React 19. It does NOT use the HTML5 Drag and Drop API -- this is a benefit here since cross-window drag is not needed, and custom sensors provide better control for moving files between changelist panels.

**Use case:** Drag files from one changelist to another. Use `DndContext` with multiple `useDroppable` changelist containers and `useDraggable` file items. `@dnd-kit/sortable` handles reordering within a list if needed.

**Tradeoff:** Last release was roughly a year ago, but the library is stable and feature-complete for this use case. 2000+ npm dependents. No viable maintained alternative exists in the React ecosystem (react-beautiful-dnd is deprecated by Atlassian).

### 3. Keyboard Shortcuts: Two-Layer Approach

**In-app shortcuts (Ctrl+S submit, Ctrl+R refresh, etc.):**
**Add:** Nothing. Write a custom `useHotkey(key, handler)` hook wrapping `document.addEventListener('keydown', ...)`.
**Confidence:** HIGH

**Why:** In-app keyboard shortcuts are trivially handled with DOM events. Adding react-hotkeys-hook or similar adds unnecessary abstraction over what is a 15-line hook. The shadcn/ui Command component (see Search below) already provides its own keyboard handling for the command palette.

**Global shortcuts (work when app is not focused):**
**Add (Rust):** `tauri-plugin-global-shortcut = "2"` in Cargo.toml
**Add (JS):** `@tauri-apps/plugin-global-shortcut@^2`
**Confidence:** HIGH

**Why:** Official Tauri 2 plugin maintained by the Tauri team. Supports `Modifiers + Code` combinations. Required only if you want shortcuts to work when the app window is not focused (e.g., global "bring to front" shortcut). For v2.0, this may be deferred -- most shortcuts only need to work when the app is focused.

**Recommendation:** Start with in-app shortcuts only (zero dependencies). Add global-shortcut plugin later if users request it.

### 4. Settings/Preferences Storage: tauri-plugin-store

**Add (Rust):** `tauri-plugin-store = "2"` in Cargo.toml
**Add (JS):** `@tauri-apps/plugin-store@^2`
**Confidence:** HIGH

**Why:** Official Tauri 2 plugin. Persistent key-value store saved as JSON to disk. Auto-saves on graceful close, manual `save()` available. Perfect for:
- P4 connection settings (port, user, client, charset)
- External diff tool path
- Keyboard shortcut bindings
- UI preferences (column widths, panel sizes)

**Use `LazyStore`** for convenience -- only loads from disk on first access:
```typescript
import { LazyStore } from '@tauri-apps/plugin-store'
const settings = new LazyStore('settings.json')
```

**Do NOT use:** localStorage (data loss on WebView updates, not accessible from Rust side), SQLite/tauri-plugin-sql (overkill for settings), custom file I/O (reinventing the wheel).

### 5. Search/Filter UI: shadcn/ui Command (cmdk)

**Add:** `cmdk` via `npx shadcn@latest add command`
**Confidence:** HIGH

**Why:** shadcn/ui Command component wraps cmdk (powers Linear, Raycast command palettes). Provides fuzzy search, keyboard navigation (arrows, Enter, Escape), grouping, empty states. Use for:
- **Search submitted changelists:** `CommandDialog` triggered by Ctrl+K
- **Filter file lists inline:** `CommandInput` as a search/filter box within panels

Already fits the Radix + Tailwind stack perfectly. Zero styling conflicts.

### 6. External Diff Tool Integration: No New Dependencies

**Confidence:** HIGH

Already have `tauri-plugin-shell` which spawns external processes. Launching a diff tool is:
```rust
Command::new("p4merge").args(&[left, right]).spawn()
```

Store the diff tool executable path in tauri-plugin-store. Provide a settings UI for users to browse/select their preferred tool. No new crate or JS package needed.

### 7. Rust Crates: No New Additions Needed

**Confidence:** MEDIUM

The existing setup (`tokio`, `serde`, `serde_json`, `tauri-plugin-shell`) supports all new P4 operations. File history (`p4 filelog`), shelve (`p4 shelve`), unshelve (`p4 unshelve`), changelists (`p4 changes`, `p4 change`), reconcile (`p4 reconcile`), connection info (`p4 info`) are all CLI commands with stdout parsing. The existing pattern handles them all.

**Only add if needed later:** `chrono` for date parsing if P4 timestamp formats prove unwieldy with string splitting.

## Summary: Installation Commands

```bash
# JS dependencies (new)
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @tauri-apps/plugin-store

# shadcn/ui components (copies code, no runtime dependency added)
npx shadcn@latest add context-menu command

# Rust dependencies (add to src-tauri/Cargo.toml)
# tauri-plugin-store = "2"

# OPTIONAL (defer unless global shortcuts needed)
# npm install @tauri-apps/plugin-global-shortcut
# Cargo.toml: tauri-plugin-global-shortcut = "2"
```

## What NOT to Add

| Library | Why Not |
|---------|---------|
| react-contexify / react-contextmenu | shadcn/ui Context Menu covers this with consistent Radix styling |
| react-hotkeys-hook | 15-line custom hook is sufficient; avoids unnecessary abstraction |
| react-beautiful-dnd | Deprecated by Atlassian, unmaintained |
| react-dnd | More complex API than dnd-kit, HTML5 backend has quirks |
| cmdk (direct npm install) | Install via shadcn CLI for themed components |
| Any Rust P4 client crate | p4.exe CLI spawning is simpler and already proven in v1 |
| tauri-plugin-sql / SQLite | Overkill for settings storage |
| react-window / react-virtuoso | Already using react-arborist for tree virtualization; evaluate later if flat list perf is an issue |

## Tauri Plugin Registration

Both new Tauri plugins must be registered in `src-tauri/src/lib.rs`:

```rust
fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        // .plugin(tauri_plugin_global_shortcut::Builder::new().build()) // if added
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        // ... rest of setup
}
```

And permissions added to `src-tauri/capabilities/default.json`:
```json
{
  "permissions": [
    "store:allow-get",
    "store:allow-set",
    "store:allow-save",
    "store:allow-load"
  ]
}
```

## Sources

- [shadcn/ui Context Menu](https://ui.shadcn.com/docs/components/context-menu) - Component docs
- [Radix UI Context Menu Primitive](https://www.radix-ui.com/primitives/docs/components/context-menu) - Underlying primitive
- [Radix Context Menu position issue #2611](https://github.com/radix-ui/primitives/issues/2611) - Known issue
- [dnd-kit documentation](https://docs.dndkit.com) - API and concepts
- [@dnd-kit/core on npm](https://www.npmjs.com/package/@dnd-kit/core) - v6.3.1, last published ~1yr ago
- [Tauri 2 Global Shortcut Plugin](https://v2.tauri.app/plugin/global-shortcut/) - Official docs
- [Tauri 2 Store Plugin](https://v2.tauri.app/plugin/store/) - Official docs
- [shadcn/ui Command (cmdk)](https://ui.shadcn.com/docs/components/command) - Search component
- [Persistent state in Tauri apps (Aptabase)](https://aptabase.com/blog/persistent-state-tauri-apps) - Store vs SQL vs localStorage guidance
