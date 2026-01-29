# Phase 07: Context Menus & Keyboard Shortcuts - Research

**Researched:** 2026-01-29
**Domain:** React keyboard shortcuts, context menus, command palette
**Confidence:** HIGH

## Summary

Phase 07 adds comprehensive keyboard accessibility to p4now through three complementary mechanisms: enhanced context menus, global keyboard shortcuts, and a command palette. The research reveals a mature ecosystem with well-established patterns.

**Context menus:** The project already uses custom React context menus following a successful pattern (FileContextMenu, ChangelistContextMenu with shared FileContextMenuItems). Radix UI provides accessible primitives (ContextMenu, DropdownMenu) that could improve accessibility, but the current approach is working well and consistent with the existing shadcn/ui components.

**Keyboard shortcuts:** `react-hotkeys-hook` is the clear standard in 2026 - lightweight (5KB), declarative, TypeScript-native, and used by thousands of production apps. It provides built-in scope management for context-sensitive shortcuts and ref-based focus control.

**Command palette:** `cmdk` is the industry standard, powering Linear, Raycast, OpenAI, and others. The shadcn/ui Command component provides a styled, accessible wrapper over cmdk that matches our existing component library perfectly.

**Primary recommendation:** Use react-hotkeys-hook for keyboard shortcuts, extend existing context menu pattern with Radix UI primitives for new menus (changelist header), use shadcn/ui Command component for command palette, and leverage Tauri's opener plugin for "Open in Explorer" functionality.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hotkeys-hook | ^4.5.x | Keyboard shortcuts | Most popular React hotkeys library in 2026; declarative, lightweight, scope-aware, TypeScript-native |
| cmdk | ^1.0.x | Command palette foundation | Industry standard (Linear, Raycast, OpenAI); fast filtering up to 2000+ items, accessible, unstyled |
| @radix-ui/react-context-menu | ^2.2.x | Context menu primitives | Accessible, keyboard-navigable, matches existing Radix UI usage in project |
| @radix-ui/react-dropdown-menu | ^2.1.x | Dropdown menu primitives | Same API as ContextMenu, for changelist header menus |
| @tauri-apps/plugin-opener | ^2.x | System file explorer integration | Official Tauri plugin for cross-platform "reveal in folder" |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Command | n/a (copy) | Styled command palette | Drop-in cmdk wrapper with Tailwind styling matching project theme |
| shadcn/ui ContextMenu | n/a (copy) | Styled context menu | Optional - for new context menus with consistent styling |
| shadcn/ui DropdownMenu | n/a (copy) | Styled dropdown menu | For changelist header menu with consistent styling |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-hotkeys-hook | react-keybinds, react-keyhub | More features but heavier, less community adoption |
| cmdk | kbar, react-command-palette | Good alternatives but cmdk is industry leader, better performance |
| Radix UI | Custom implementation | Project already uses Radix UI; custom would lose accessibility features |
| @tauri-apps/plugin-opener | Custom shell commands | Plugin is cleaner, cross-platform, officially supported |

**Installation:**

```bash
# Keyboard shortcuts
npm install react-hotkeys-hook

# Command palette foundation (if not using shadcn)
npm install cmdk

# Context menu primitives (if not already installed)
npm install @radix-ui/react-context-menu @radix-ui/react-dropdown-menu

# Tauri opener plugin already installed (verified in package.json)
```

**Shadcn/ui components:**

```bash
# Command palette (styled cmdk wrapper)
npx shadcn@latest add command

# Context menu (styled Radix wrapper) - optional
npx shadcn@latest add context-menu

# Dropdown menu (styled Radix wrapper) - for changelist header
npx shadcn@latest add dropdown-menu
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── ui/
│   │   ├── command.tsx              # Shadcn command palette component
│   │   ├── context-menu.tsx         # Shadcn context menu wrapper (optional)
│   │   └── dropdown-menu.tsx        # Shadcn dropdown menu wrapper
│   ├── CommandPalette.tsx           # Global command palette container
│   ├── shared/
│   │   └── FileContextMenuItems.tsx # Existing shared menu items (keep)
│   ├── FileTree/
│   │   └── FileContextMenu.tsx      # Existing (enhance with shortcuts display)
│   └── ChangelistPanel/
│       ├── ChangelistContextMenu.tsx      # Existing (enhance with shortcuts)
│       └── ChangelistHeaderMenu.tsx       # NEW - for CL header operations
├── hooks/
│   ├── useHotkeys.ts                # Centralized shortcut registry
│   └── useCommandPalette.ts         # Command palette state
└── lib/
    └── shortcuts.ts                 # Shortcut definitions & platform formatting
```

### Pattern 1: Centralized Shortcut Registry

**What:** Single source of truth for all keyboard shortcuts with platform-aware formatting

**When to use:** Always - prevents conflicts, enables display in menus/tooltips, supports future configurability

**Example:**

```typescript
// src/lib/shortcuts.ts
export type ShortcutKey =
  | 'refresh'
  | 'sync'
  | 'submit'
  | 'revert'
  | 'diff'
  | 'history'
  | 'newChangelist'
  | 'commandPalette';

export interface Shortcut {
  key: string;              // react-hotkeys-hook format: "ctrl+shift+s"
  label: string;            // Display format: "Ctrl+Shift+S"
  description: string;
  scope?: 'global' | 'file-selected';
}

export const shortcuts: Record<ShortcutKey, Shortcut> = {
  refresh: {
    key: 'f5',
    label: 'F5',
    description: 'Refresh workspace',
    scope: 'global',
  },
  sync: {
    key: 'ctrl+shift+s',
    label: 'Ctrl+Shift+S',
    description: 'Sync to latest',
    scope: 'global',
  },
  submit: {
    key: 'ctrl+shift+enter',
    label: 'Ctrl+Shift+Enter',
    description: 'Submit changelist',
    scope: 'global',
  },
  revert: {
    key: 'ctrl+shift+r',
    label: 'Ctrl+Shift+R',
    description: 'Revert selected files',
    scope: 'file-selected',
  },
  diff: {
    key: 'ctrl+d',
    label: 'Ctrl+D',
    description: 'Diff selected file',
    scope: 'file-selected',
  },
  history: {
    key: 'ctrl+h',
    label: 'Ctrl+H',
    description: 'Show file history',
    scope: 'file-selected',
  },
  newChangelist: {
    key: 'ctrl+shift+n',
    label: 'Ctrl+Shift+N',
    description: 'Create new changelist',
    scope: 'global',
  },
  commandPalette: {
    key: 'ctrl+shift+p,ctrl+comma',
    label: 'Ctrl+Shift+P',
    description: 'Open command palette',
    scope: 'global',
  },
};

// Platform-aware formatting helper
export function formatShortcut(key: ShortcutKey): string {
  return shortcuts[key].label;
}
```

**Source:** Centralized approach inspired by VS Code's keybindings architecture

### Pattern 2: Global Shortcuts with Context-Sensitivity

**What:** Global keyboard listeners that check context (e.g., file selected) before executing

**When to use:** For file-specific operations that should only work when files are selected

**Example:**

```typescript
// src/hooks/useGlobalShortcuts.ts
import { useHotkeys } from 'react-hotkeys-hook';
import { shortcuts } from '@/lib/shortcuts';
import { useChangelistStore } from '@/stores/changelistStore';

export function useGlobalShortcuts() {
  const { selectedFiles } = useChangelistStore();
  const hasFileSelected = selectedFiles.length > 0;

  // Global shortcuts - always active
  useHotkeys(shortcuts.refresh.key, () => handleRefresh(), {
    preventDefault: true,
  });

  useHotkeys(shortcuts.sync.key, () => handleSync(), {
    preventDefault: true,
  });

  // Context-sensitive - only when file selected
  useHotkeys(
    shortcuts.diff.key,
    () => handleDiff(),
    {
      enabled: hasFileSelected,
      preventDefault: true,
    }
  );

  useHotkeys(
    shortcuts.revert.key,
    () => handleRevert(),
    {
      enabled: hasFileSelected,
      preventDefault: true,
    }
  );
}
```

**Source:** [React Hotkeys Hook documentation](https://react-hotkeys-hook.vercel.app/) - enabled option pattern

### Pattern 3: Context Menu with Shortcut Display

**What:** Show keyboard shortcuts right-aligned in context menus (VS Code style)

**When to use:** All context menu items that have keyboard shortcuts

**Example:**

```typescript
// Existing FileContextMenu.tsx - enhanced with shortcut display
import { shortcuts } from '@/lib/shortcuts';

<button
  onClick={handleDiff}
  className={cn(
    'w-full px-4 py-2 text-left text-sm text-slate-200',
    'hover:bg-slate-800 transition-colors',
    'flex items-center justify-between gap-6'  // Changed: justify-between for spacing
  )}
>
  <span className="flex items-center gap-2">
    <GitCompare className="w-4 h-4" />
    Diff against Have
  </span>
  <span className="text-xs text-slate-400 opacity-70">
    {shortcuts.diff.label}
  </span>
</button>
```

**CSS approach:**

```css
/* Alternative: use justify-between on flex container */
.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px; /* Minimum space between label and shortcut */
}

.menu-shortcut {
  margin-left: auto; /* Push to right */
  color: rgba(148, 163, 184, 0.7); /* Muted color */
  font-size: 0.75rem;
  white-space: nowrap; /* Prevent wrapping */
}
```

**Source:** [VS Code keybindings UI](https://code.visualstudio.com/docs/getstarted/userinterface) and [React context menu styling patterns](https://blog.logrocket.com/creating-react-context-menu/)

### Pattern 4: Command Palette with Dialog

**What:** Modal command palette triggered by keyboard shortcut with fuzzy search

**When to use:** For quick access to all operations without mouse navigation

**Example:**

```typescript
// src/components/CommandPalette.tsx
import { useEffect, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { shortcuts } from '@/lib/shortcuts';

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  // Listen for palette trigger shortcuts (Ctrl+Shift+P or Ctrl+,)
  useHotkeys(shortcuts.commandPalette.key, () => setOpen(true), {
    preventDefault: true,
    enableOnFormTags: false, // Don't trigger in input fields
  });

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="File Operations">
          <CommandItem onSelect={() => handleDiff()}>
            <span>Diff against Have</span>
            <span className="ml-auto text-xs text-slate-400">
              {shortcuts.diff.label}
            </span>
          </CommandItem>
          <CommandItem onSelect={() => handleRevert()}>
            <span>Revert Changes</span>
            <span className="ml-auto text-xs text-slate-400">
              {shortcuts.revert.label}
            </span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Workspace">
          <CommandItem onSelect={() => handleRefresh()}>
            <span>Refresh Workspace</span>
            <span className="ml-auto text-xs text-slate-400">
              {shortcuts.refresh.label}
            </span>
          </CommandItem>
          <CommandItem onSelect={() => handleSync()}>
            <span>Sync to Latest</span>
            <span className="ml-auto text-xs text-slate-400">
              {shortcuts.sync.label}
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

**Source:** [Shadcn Command component docs](https://ui.shadcn.com/docs/components/command) and [cmdk GitHub examples](https://github.com/dip/cmdk)

### Pattern 5: "Open in Explorer" with Tauri Opener

**What:** Reveal file in system file explorer (Windows Explorer, Finder, etc.)

**When to use:** Context menu option for any file operation

**Example:**

```typescript
// In FileContextMenuItems.tsx or FileContextMenu.tsx
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';

async function handleOpenInExplorer() {
  try {
    await revealItemInDir(file.localPath);
    onClose();
  } catch (error) {
    toast.error(`Failed to open in explorer: ${error}`);
  }
}

// In menu JSX
<button
  onClick={handleOpenInExplorer}
  className={cn(
    'w-full px-4 py-2 text-left text-sm text-slate-200',
    'hover:bg-slate-800 transition-colors',
    'flex items-center gap-2'
  )}
>
  <FolderOpen className="w-4 h-4" />
  Open in Explorer
</button>
```

**Source:** [Tauri Opener Plugin documentation](https://v2.tauri.app/plugin/opener/) and [GitHub issue #4062](https://github.com/tauri-apps/tauri/issues/4062)

### Pattern 6: Changelist Header Dropdown Menu

**What:** Radix UI DropdownMenu for changelist header actions (triggered by button click, not right-click)

**When to use:** Operations on changelist headers (Submit, Shelve, Edit, Delete)

**Example:**

```typescript
// src/components/ChangelistPanel/ChangelistHeaderMenu.tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';

interface ChangelistHeaderMenuProps {
  changelist: P4Changelist;
  hasShelvedFiles: boolean;
}

export function ChangelistHeaderMenu({ changelist, hasShelvedFiles }: ChangelistHeaderMenuProps) {
  const isEmpty = changelist.files.length === 0;
  const isDefault = changelist.id === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-1 hover:bg-slate-700 rounded">
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {!isEmpty && (
          <>
            <DropdownMenuItem onSelect={() => handleSubmit()}>
              Submit
              <span className="ml-auto text-xs text-slate-400">
                {shortcuts.submit.label}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleShelve()}>
              Shelve
            </DropdownMenuItem>
          </>
        )}

        {hasShelvedFiles && (
          <DropdownMenuItem onSelect={() => handleUnshelve()}>
            Unshelve
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => handleNewChangelist()}>
          New Changelist
          <span className="ml-auto text-xs text-slate-400">
            {shortcuts.newChangelist.label}
          </span>
        </DropdownMenuItem>

        {!isDefault && (
          <DropdownMenuItem onSelect={() => handleEditDescription()}>
            Edit Description
          </DropdownMenuItem>
        )}

        {!isDefault && isEmpty && (
          <DropdownMenuItem onSelect={() => handleDelete()}>
            Delete Changelist
          </DropdownMenuItem>
        )}

        {!isEmpty && (
          <DropdownMenuItem onSelect={() => handleRevert()}>
            Revert All Files
            <span className="ml-auto text-xs text-slate-400">
              {shortcuts.revert.label}
            </span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Source:** [Radix UI DropdownMenu docs](https://www.radix-ui.com/primitives/docs/components/dropdown-menu)

### Anti-Patterns to Avoid

- **Multiple global listeners for same shortcut:** Use centralized registry and `enabled` option to conditionally activate shortcuts
- **Hardcoded shortcut strings in components:** Always reference central `shortcuts` object for consistency
- **Blocking shortcuts in dialogs:** Use `enableOnFormTags: false` and scope management, don't globally disable
- **Custom context menus without accessibility:** Use Radix UI primitives for keyboard navigation and ARIA attributes
- **Inline shortcut formatting logic:** Use centralized `formatShortcut()` helper for platform-aware display

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard shortcut management | Custom event listeners per component | react-hotkeys-hook | Handles cleanup, conflicts, scopes, focus, platform differences; battle-tested |
| Command palette fuzzy search | Custom filter logic | cmdk built-in filtering | Optimized for 2000+ items, handles Unicode, scoring, ranking |
| Context menu positioning | Manual x/y calculation with viewport detection | Radix UI ContextMenu | Handles collision detection, RTL, nested menus, focus trap, escape handling |
| Shortcut formatter | Custom string replacement | Platform detection + template | Windows/Mac modifier keys differ (Ctrl vs Cmd), symbol vs text (⌘ vs Cmd) |
| "Open in Explorer" | Platform-specific shell commands | @tauri-apps/plugin-opener | Cross-platform, handles spaces in paths, security-reviewed |
| Focus trapping in command palette | Custom keydown handler | cmdk Dialog + Radix Dialog primitive | Screen reader support, escape handling, restore focus on close |

**Key insight:** Keyboard interaction is accessibility-critical. Custom implementations almost always miss edge cases (screen readers, RTL, focus restoration, browser differences). Use battle-tested primitives.

## Common Pitfalls

### Pitfall 1: Shortcut Conflicts with Browser/OS

**What goes wrong:** User presses Ctrl+W (close tab in browsers) or Ctrl+N (new window) and loses work instead of triggering app shortcut

**Why it happens:** Browser default actions run before or alongside React handlers; preventDefault may not work for some browser shortcuts

**How to avoid:**
- Avoid browser-reserved shortcuts: Ctrl+W, Ctrl+N, Ctrl+T, Ctrl+Tab, F11
- Use compound shortcuts for destructive actions: Ctrl+Shift+R instead of Ctrl+R
- Test in different browsers - some shortcuts are inconsistent
- Document P4V defaults if they exist (research found limited P4V shortcut documentation)

**Warning signs:** Users report "shortcut doesn't work" or "browser closed when I pressed X"

### Pitfall 2: Shortcuts Fire in Text Inputs

**What goes wrong:** User types in changelist description field, presses Ctrl+S to save, but triggers global Sync operation instead

**Why it happens:** Global keyboard listeners don't check if focus is in an input/textarea/contenteditable element

**How to avoid:**
- Use `enableOnFormTags: false` option in react-hotkeys-hook
- Alternative: Check `event.target.tagName` before handling
- Exception: Command palette trigger (Ctrl+Shift+P) should work everywhere

**Warning signs:** Users complain shortcuts interfere with typing

**Example:**

```typescript
useHotkeys(shortcuts.sync.key, () => handleSync(), {
  preventDefault: true,
  enableOnFormTags: false, // Don't trigger when typing
});
```

**Source:** [React-hotkeys-hook enableOnFormTags option](https://react-hotkeys-hook.vercel.app/)

### Pitfall 3: Dialog Keyboard Conflicts

**What goes wrong:** User opens Submit dialog, presses Escape to close it, but also triggers other shortcuts; or Enter submits form AND triggers unrelated command

**Why it happens:** Multiple keyboard listeners active simultaneously without priority/scope management

**How to avoid:**
- Radix Dialog automatically traps focus and handles Escape
- Disable global shortcuts when dialogs open using `enabled` option
- Dialog-specific shortcuts (Enter = submit, Escape = close) are handled by dialog component
- Use state to track dialog open/closed: `const [dialogOpen, setDialogOpen] = useState(false)`

**Warning signs:** Unexpected behavior when dialogs are open, multiple actions triggered

**Example:**

```typescript
const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

// Disable global shortcuts when dialog open
useHotkeys(shortcuts.diff.key, () => handleDiff(), {
  enabled: !submitDialogOpen && hasFileSelected,
  preventDefault: true,
});
```

**Source:** [React modal keyboard accessibility](https://dev.to/colettewilson/how-i-approach-keyboard-accessibility-for-modals-in-react-152p)

### Pitfall 4: Context Menu Without Keyboard Navigation

**What goes wrong:** Users can right-click to open menu but can't navigate it with arrow keys or select with Enter

**Why it happens:** Custom context menus often implement positioning but forget keyboard interaction and ARIA attributes

**How to avoid:**
- Use Radix UI ContextMenu/DropdownMenu primitives for automatic keyboard nav
- If keeping custom implementation: Add arrow key handlers, Enter/Space selection, Escape to close, focus management
- Add proper ARIA: role="menu", aria-label, aria-activedescendant

**Warning signs:** Accessibility testing fails, keyboard-only users can't use context menus

**Source:** [Radix UI Context Menu accessibility features](https://www.radix-ui.com/primitives/docs/components/context-menu)

### Pitfall 5: Shortcut Label Platform Inconsistency

**What goes wrong:** Show "Ctrl+K" on Mac (should be "⌘K" or "Cmd+K") or vice versa

**Why it happens:** Hardcoded shortcut labels don't detect platform

**How to avoid:**
- Detect platform: `navigator.platform` or `window.navigator.userAgent`
- Map keys: Ctrl → ⌘ (or Cmd), Alt → ⌥ (Option) on Mac
- Use symbols on Mac (⌘⌥⇧), text on Windows (Ctrl, Alt, Shift)
- Store both formats in shortcuts registry

**Warning signs:** User reports "shortcut doesn't match displayed hint"

**Example:**

```typescript
// src/lib/shortcuts.ts
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

export function formatShortcutForDisplay(key: string): string {
  if (isMac) {
    return key
      .replace('ctrl+', '⌘')
      .replace('alt+', '⌥')
      .replace('shift+', '⇧')
      .toUpperCase();
  }
  return key
    .replace('ctrl+', 'Ctrl+')
    .replace('alt+', 'Alt+')
    .replace('shift+', 'Shift+')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
```

**Source:** [VS Code keybindings cross-platform display](https://code.visualstudio.com/docs/configure/keybindings)

### Pitfall 6: Command Palette Performance with Large Command Lists

**What goes wrong:** Command palette lags when filtering with 500+ commands

**Why it happens:** Filtering runs on every keystroke without debouncing or optimization

**How to avoid:**
- cmdk handles up to 2000-3000 items efficiently (built-in optimization)
- For more: Set `shouldFilter={false}` and implement custom filtering
- Use `CommandGroup` to organize commands (improves visual scanning)
- Limit displayed results with `CommandList` max height and virtual scrolling

**Warning signs:** Typing in command palette feels slow, UI freezes

**Source:** [cmdk performance documentation](https://github.com/dip/cmdk)

## Code Examples

Verified patterns from official sources:

### Basic Keyboard Shortcut Hook

```typescript
// Source: https://react-hotkeys-hook.vercel.app/
import { useHotkeys } from 'react-hotkeys-hook';

function MyComponent() {
  useHotkeys('ctrl+k', () => {
    console.log('Ctrl+K pressed');
  }, {
    preventDefault: true,
    enableOnFormTags: false,
  });
}
```

### Context-Sensitive Shortcut

```typescript
// Source: https://react-hotkeys-hook.vercel.app/ (enabled option)
import { useHotkeys } from 'react-hotkeys-hook';

function FileOperations() {
  const { selectedFiles } = useStore();
  const hasSelection = selectedFiles.length > 0;

  useHotkeys('ctrl+d', () => handleDiff(), {
    enabled: hasSelection, // Only when files selected
    preventDefault: true,
  });
}
```

### Command Palette Dialog

```typescript
// Source: https://ui.shadcn.com/docs/components/command
import { CommandDialog, CommandInput, CommandList, CommandItem } from '@/components/ui/command';
import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

function App() {
  const [open, setOpen] = useState(false);

  useHotkeys('ctrl+k', () => setOpen(true), {
    preventDefault: true,
    enableOnFormTags: false,
  });

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search commands..." />
      <CommandList>
        <CommandItem onSelect={() => handleAction()}>
          Action Name
        </CommandItem>
      </CommandList>
    </CommandDialog>
  );
}
```

### Radix DropdownMenu with Shortcuts

```typescript
// Source: https://www.radix-ui.com/primitives/docs/components/dropdown-menu
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

function ChangelistHeader() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Options</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => handleSubmit()}>
          <span>Submit</span>
          <span className="ml-auto text-xs opacity-60">Ctrl+Enter</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Open in Explorer (Tauri)

```typescript
// Source: https://v2.tauri.app/plugin/opener/
import { revealItemInDir } from '@tauri-apps/plugin-opener';

async function showInExplorer(filePath: string) {
  try {
    await revealItemInDir(filePath);
  } catch (error) {
    console.error('Failed to reveal file:', error);
  }
}
```

### Multiple Shortcut Triggers (OR logic)

```typescript
// Source: https://react-hotkeys-hook.vercel.app/
import { useHotkeys } from 'react-hotkeys-hook';

function CommandPalette() {
  // Ctrl+Shift+P OR Ctrl+, triggers palette
  useHotkeys('ctrl+shift+p,ctrl+comma', () => setOpen(true), {
    preventDefault: true,
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-hotkeys (greena13) | react-hotkeys-hook | 2020-2021 | Hook-based API simpler than HOC/component approach; better TypeScript support |
| Custom command palette | cmdk as standard | 2022-2023 | Industry consolidation; Linear/Raycast popularized cmdk; better accessibility out of box |
| Custom context menus | Radix UI primitives | 2021-2022 | Accessibility requirements tightened; custom implementations lack keyboard nav, screen reader support |
| Manual shortcut display | Centralized registry | Ongoing trend | Supports future customization; easier to maintain; consistent display |
| Platform-specific shell commands | Tauri plugins | 2023-2024 (Tauri v2) | Plugin system matured; cleaner APIs; better security model |

**Deprecated/outdated:**

- **react-hotkeys (greena13):** Still works but HOC pattern is outdated; use react-hotkeys-hook instead (hook-based)
- **Manual Tauri shell commands for "open in explorer":** Use @tauri-apps/plugin-opener (official, cross-platform, simpler)
- **kbar without React 18:** Requires React 18+; some legacy projects stuck on older approach
- **Hardcoded Ctrl labels on Mac:** Platform detection is now standard; users expect proper modifier key symbols

## Open Questions

Things that couldn't be fully resolved:

1. **P4V Default Keyboard Shortcuts**
   - What we know: P4V has keyboard shortcuts configurable in Preferences > Shortcuts; documentation shows only Ctrl+9 (Depot Tree) and Ctrl+0 (Workspace Tree) as examples
   - What's unclear: Full list of P4V default shortcuts not published in online docs; would need to check within P4V application itself
   - Recommendation: Test p4now shortcuts in real workflow, avoid obvious conflicts (Ctrl+9/0), prioritize VS Code-style conventions (more familiar to developers). If user feedback indicates P4V conflicts, investigate specific shortcuts and adjust.

2. **Dialog Keyboard Shortcut Suppression**
   - What we know: Radix Dialog handles Escape and focus trapping; we can use `enabled` option to disable global shortcuts
   - What's unclear: Should Enter/Ctrl+Enter in Submit dialog trigger global shortcuts or only dialog actions? User preference may vary.
   - Recommendation: Start with global shortcuts disabled when ANY dialog is open (safest, most predictable). Track dialog state in a global store or context if needed. Consider user feedback - if users want some shortcuts to work in dialogs, add granular control later.

3. **Command Palette Command Organization**
   - What we know: Commands can be grouped (File Operations, Workspace, Changelist, etc.), shadcn Command supports CommandGroup
   - What's unclear: Best grouping strategy for p4now - by operation type? by frequency? by entity (file vs changelist)?
   - Recommendation: Group by entity/context (File Operations, Changelist Operations, Workspace Operations, View/Navigation). Start with alphabetical within groups. If user feedback suggests frequency-based or recency-based ordering, implement later (cmdk supports custom sorting).

4. **Keyboard Shortcut for "Open in Explorer"**
   - What we know: This is a common operation, should be in context menus
   - What's unclear: Should it have a global keyboard shortcut? What would be appropriate that doesn't conflict?
   - Recommendation: Context menu only initially (no global shortcut). File explorers typically don't have shortcuts for "reveal in explorer" - it's a secondary action. If users request it, consider Ctrl+Shift+E (VS Code terminal focus) or Ctrl+Shift+O (open).

## Sources

### Primary (HIGH confidence)

- [React Hotkeys Hook](https://react-hotkeys-hook.vercel.app/) - Official documentation for keyboard shortcuts library
- [react-hotkeys-hook GitHub](https://github.com/JohannesKlauss/react-hotkeys-hook) - Source code and examples
- [cmdk GitHub](https://github.com/dip/cmdk) - Official cmdk repository with API documentation
- [Shadcn/ui Command Component](https://ui.shadcn.com/docs/components/command) - Styled cmdk wrapper documentation
- [Radix UI Context Menu](https://www.radix-ui.com/primitives/docs/components/context-menu) - Official primitives docs
- [Radix UI Dropdown Menu](https://www.radix-ui.com/primitives/docs/components/dropdown-menu) - Official primitives docs
- [Tauri Opener Plugin](https://v2.tauri.app/plugin/opener/) - Official Tauri plugin documentation
- [VS Code Keybindings](https://code.visualstudio.com/docs/configure/keybindings) - Platform-aware shortcut display patterns

### Secondary (MEDIUM confidence)

- [LogRocket: React Command Palette](https://blog.logrocket.com/react-command-palette-tailwind-css-headless-ui/) - Command palette implementation tutorial
- [LogRocket: Creating React Context Menu](https://blog.logrocket.com/creating-react-context-menu/) - Context menu patterns and styling
- [DEV: React Keyboard Shortcuts with React-Keyhub](https://dev.to/xenral/react-keyboard-shortcuts-boost-app-performance-using-react-keyhub-25co) - Alternative library comparison
- [DEV: Building Hotkeys in React Apps](https://dev.to/koraflux/building-hotkeys-in-react-apps-2p5d) - Keyboard shortcut patterns
- [DEV: Modal Keyboard Accessibility](https://dev.to/colettewilson/how-i-approach-keyboard-accessibility-for-modals-in-react-152p) - Dialog keyboard handling
- [Medium: Supercharge React with react-hotkeys-hook](https://medium.com/@aswanth6000/supercharge-your-react-apps-with-react-hotkeys-hook-f7352e0e4a69) - Tutorial and best practices
- [GitHub: Tauri "Show in Finder/Explorer" Issue #4062](https://github.com/tauri-apps/tauri/issues/4062) - Community solutions for reveal in explorer
- [GitHub: Tauri Plugins "Show in Finder/Explorer" Issue #999](https://github.com/tauri-apps/plugins-workspace/issues/999) - Plugin-specific discussion

### Tertiary (LOW confidence)

- [Perforce P4V Shortcuts Documentation](https://www.perforce.com/manuals/p4v/Content/P4V/using.access-keys.html) - Limited shortcut examples; full list not documented online (redirects to help.perforce.com)
- WebSearch results for React keyboard shortcut libraries 2026 - Multiple sources agree on react-hotkeys-hook as current standard
- WebSearch results for command palette libraries 2026 - Industry consensus on cmdk (Linear, Raycast, OpenAI usage cited)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - react-hotkeys-hook and cmdk are clearly established standards with wide adoption and active maintenance
- Architecture: HIGH - Patterns verified from official documentation and production examples; project already uses compatible patterns (Radix UI, shadcn)
- Pitfalls: MEDIUM-HIGH - Common issues well-documented in accessibility guides and library docs; some specific to this project (P4V shortcuts) are LOW confidence pending testing

**Research date:** 2026-01-29

**Valid until:** ~60 days (April 2026) - Stable ecosystem; react-hotkeys-hook and cmdk are mature; Radix UI updates rarely break APIs; Tauri plugins stable in v2
