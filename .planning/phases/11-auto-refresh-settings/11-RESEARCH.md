# Phase 11: Auto-Refresh + Settings - Research

**Researched:** 2026-01-31
**Domain:** TanStack Query auto-refresh, React window focus detection, Tauri file picker, application settings UI
**Confidence:** HIGH

## Summary

This phase adds configurable auto-refresh functionality to keep workspace state synchronized with the Perforce server, plus extends the settings dialog to include external editor configuration and auto-refresh interval settings. The implementation leverages TanStack Query v5's built-in `refetchInterval` option with conditional logic to pause during active operations and when the window is inactive/minimized.

**Key findings:**
- TanStack Query v5 supports `refetchInterval` as a number, false, or function that returns interval based on query state
- The `enabled` option is the standard way to pause queries conditionally (during active operations)
- Tauri v2 provides window focus/blur events via `getCurrentWindow().listen('tauri://blur')` and `getCurrentWindow().listen('tauri://focus')`
- The existing operation store (`useOperationStore`) tracks active operations perfectly for gating auto-refresh
- Tauri dialog plugin provides native file picker for browsing to executable paths
- The existing settings infrastructure (tauri-plugin-store, settings schema, SettingsDialog) is already established and working

**Primary recommendation:** Use TanStack Query's conditional `enabled` option to pause auto-refresh during active operations, combine with window focus state tracking to handle minimize/inactive scenarios. Extend existing settings infrastructure with new fields and UI sections.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.90.20 | Auto-refresh via refetchInterval | Already used throughout app, industry standard for React data fetching |
| @tauri-apps/api | ^2 | Window focus/blur detection | Official Tauri API, only way to detect window state in Tauri apps |
| @tauri-apps/plugin-store | ^2.4.2 | Settings persistence | Already used, official Tauri settings storage |
| @tauri-apps/plugin-dialog | ^2 | Native file picker for editor path | Official Tauri plugin for native OS dialogs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | Settings schema validation | Already used for P4Settings type |
| react-hook-form | ^7.71.1 | Settings form state | Already used in SettingsDialog |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| refetchInterval | setInterval + manual refetch | More complexity, duplicates TanStack Query's built-in capability |
| Window focus events | Browser Page Visibility API | Doesn't work reliably in Tauri apps, window events are more accurate |
| Custom file input | HTML file input | Doesn't allow browsing to executables or arbitrary paths on all platforms |

**Installation:**
```bash
# Dialog plugin if not already installed
npm run tauri add dialog
```

## Architecture Patterns

### Recommended Integration Points

```
src/
├── hooks/
│   ├── useAutoRefresh.ts        # Hook for conditional auto-refresh logic
│   └── useWindowFocus.ts        # Hook for tracking window focus state
├── lib/
│   └── settings.ts              # Extend with new settings fields (autoRefreshInterval, editorPath)
├── types/
│   └── settings.ts              # Extend P4Settings schema with new fields
└── components/
    └── SettingsDialog.tsx       # Add new sections for editor and auto-refresh
```

### Pattern 1: Conditional Auto-Refresh with `enabled`

**What:** Use TanStack Query's `enabled` option to conditionally enable/disable auto-refresh based on operation state and window focus.

**When to use:** For all queries that should auto-refresh (p4 changes, p4 opened, p4 shelved).

**Example:**
```typescript
// In useChangelists.ts or similar query hooks
const { currentOperation } = useOperationStore();
const isWindowFocused = useWindowFocus();
const { autoRefreshInterval } = await loadSettings();

const isAutoRefreshEnabled =
  isConnected &&
  !currentOperation && // No active operations
  isWindowFocused && // Window is focused
  autoRefreshInterval > 0; // User enabled auto-refresh

useQuery({
  queryKey: ['p4', 'changes', 'pending', p4port, p4user, p4client],
  queryFn: async () => { /* ... */ },
  enabled: isAutoRefreshEnabled,
  refetchInterval: autoRefreshInterval || false,
  // ... other options
});
```

### Pattern 2: Window Focus State Hook

**What:** React hook that tracks window focus/blur state using Tauri events.

**When to use:** When you need to know if the window is focused/visible for pausing auto-refresh.

**Example:**
```typescript
// src/hooks/useWindowFocus.ts
import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function useWindowFocus() {
  const [isFocused, setIsFocused] = useState(true); // Start optimistic

  useEffect(() => {
    const appWindow = getCurrentWindow();

    const setupListeners = async () => {
      // Listen to focus events
      const unlistenFocus = await appWindow.listen('tauri://focus', () => {
        setIsFocused(true);
      });

      // Listen to blur events (covers minimize + inactive)
      const unlistenBlur = await appWindow.listen('tauri://blur', () => {
        setIsFocused(false);
      });

      // Cleanup
      return () => {
        unlistenFocus();
        unlistenBlur();
      };
    };

    const unlisten = setupListeners();
    return () => {
      unlisten.then(cleanup => cleanup());
    };
  }, []);

  return isFocused;
}
```

### Pattern 3: Settings Extension

**What:** Extend existing settings schema and persistence layer with new fields.

**When to use:** Adding new configurable options without breaking existing settings.

**Example:**
```typescript
// types/settings.ts
export const settingsSchema = z.object({
  // Existing fields
  p4port: z.string().min(1, 'Server address is required'),
  p4user: z.string().min(1, 'Username is required'),
  p4client: z.string().min(1, 'Workspace is required'),
  diffToolPath: z.string(),
  diffToolArgs: z.string(),
  verboseLogging: z.boolean(),

  // New fields for Phase 11
  editorPath: z.string(),
  autoRefreshInterval: z.number().min(0).max(600000), // 0 = disabled, max 10 minutes
});

export const defaultSettings: P4Settings = {
  // Existing defaults
  p4port: '',
  p4user: '',
  p4client: '',
  diffToolPath: '',
  diffToolArgs: '',
  verboseLogging: false,

  // New defaults
  editorPath: '',
  autoRefreshInterval: 300000, // 5 minutes default
};
```

### Pattern 4: File Picker Button

**What:** Button that opens native file picker dialog to browse for executable paths.

**When to use:** When user needs to select an executable or file path (editor, diff tool, etc.).

**Example:**
```typescript
import { open } from '@tauri-apps/plugin-dialog';

const handleBrowseEditor = async () => {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: 'Executable',
        extensions: ['exe'] // Windows; adjust per platform if needed
      }
    ]
  });

  if (selected) {
    form.setValue('editorPath', selected as string);
  }
};
```

### Anti-Patterns to Avoid

- **Don't use `setInterval` for auto-refresh:** TanStack Query's `refetchInterval` is more robust and handles cleanup, pause/resume, and error states automatically.

- **Don't disable auto-refresh globally:** Use the `enabled` option per-query to pause conditionally rather than changing `refetchInterval` to false globally.

- **Don't poll when window is minimized:** This wastes resources and can cause performance issues, especially on slower P4 servers.

- **Don't forget to handle 0 interval:** When user sets interval to 0 (disabled), treat as `false` in `refetchInterval` option.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auto-refresh timer logic | Custom setInterval + cleanup + pause/resume | TanStack Query `refetchInterval` | Built-in pause on unmount, error handling, background tab detection with `refetchIntervalInBackground` |
| Window focus detection | Polling document.hasFocus() | Tauri window events ('tauri://focus', 'tauri://blur') | Event-driven, works with minimize state, no polling overhead |
| File picker dialog | Custom HTML file input | Tauri dialog plugin `open()` | Native OS dialog, supports browsing to executables, better UX |
| Settings validation | Manual validation | Zod schema validation | Type-safe, already integrated with react-hook-form |

**Key insight:** TanStack Query handles nearly all auto-refresh complexity if you use `enabled` and `refetchInterval` correctly. Don't try to build a custom polling system.

## Common Pitfalls

### Pitfall 1: Race Conditions Between Manual Refresh and Auto-Refresh

**What goes wrong:** Manual refresh button triggers `invalidateQueries` while auto-refresh interval also fires, causing duplicate fetches and UI flicker.

**Why it happens:** Both manual and automatic refetch mechanisms compete for the same queries.

**How to avoid:** TanStack Query handles this automatically via request deduplication. Multiple refetch requests within a short timeframe are merged. No special handling needed.

**Warning signs:** Multiple identical P4 commands in verbose logging output within a short time.

### Pitfall 2: Auto-Refresh During Active Operations

**What goes wrong:** User is syncing files or submitting a changelist, and auto-refresh triggers a query invalidation mid-operation, causing stale data to be fetched or confusing UI state.

**Why it happens:** `refetchInterval` timer fires independently of operation state unless explicitly disabled.

**How to avoid:**
```typescript
const { currentOperation } = useOperationStore();
const isAutoRefreshEnabled = isConnected && !currentOperation && isWindowFocused;

useQuery({
  queryKey: ['p4', 'changes'],
  queryFn: async () => { /* ... */ },
  enabled: isAutoRefreshEnabled, // Pause when operation is active
  refetchInterval: autoRefreshInterval || false,
});
```

**Warning signs:** Workspace state flickering or reverting during long operations like sync or submit.

### Pitfall 3: Forgetting refetchIntervalInBackground

**What goes wrong:** Auto-refresh continues firing when window is minimized or in background, wasting resources and potentially slowing down the user's actual work.

**Why it happens:** TanStack Query's default `refetchIntervalInBackground` is `false` in v5, but it's important to understand the interaction with window focus.

**How to avoid:** Rely on `enabled` option with window focus state rather than `refetchIntervalInBackground`. The `enabled: false` approach is cleaner and more explicit.

**Warning signs:** P4 commands running when app is minimized (check verbose logging).

### Pitfall 4: Not Handling Settings Migration

**What goes wrong:** Existing users upgrade to Phase 11, but new settings fields are missing from their saved settings, causing undefined values.

**Why it happens:** `tauri-plugin-store` returns stored values as-is without applying new defaults.

**How to avoid:** The existing `loadSettings()` pattern already handles this correctly with `|| defaultSettings.field` fallback:
```typescript
export async function loadSettings(): Promise<P4Settings> {
  const store = await getStore();
  return {
    // Existing fields
    p4port: (await store.get<string>('p4port')) || defaultSettings.p4port,

    // New fields automatically get defaults if not present
    editorPath: (await store.get<string>('editorPath')) || defaultSettings.editorPath,
    autoRefreshInterval: (await store.get<number>('autoRefreshInterval')) ?? defaultSettings.autoRefreshInterval,
  };
}
```

**Warning signs:** Settings UI shows blank values after upgrade or auto-refresh doesn't work for existing users.

### Pitfall 5: Invalid Interval Values

**What goes wrong:** User enters a very short interval (e.g., 100ms) or a massive interval (hours), causing performance issues or appearing broken.

**Why it happens:** No min/max validation on the interval input field.

**How to avoid:**
- Use Zod schema validation with `.min(0).max(600000)` (0 to 10 minutes)
- Add helpful placeholder text like "5000 (5 seconds) to 600000 (10 minutes), or 0 to disable"
- Consider a select dropdown with preset intervals instead of free-form input

**Warning signs:** App becomes slow/unresponsive (too short) or auto-refresh appears not to work (too long).

## Code Examples

Verified patterns from existing codebase and official sources:

### Extending Settings Schema
```typescript
// src/types/settings.ts
import { z } from 'zod';

export const settingsSchema = z.object({
  // Connection settings (existing)
  p4port: z.string().min(1, 'Server address is required'),
  p4user: z.string().min(1, 'Username is required'),
  p4client: z.string().min(1, 'Workspace is required'),

  // Tool settings (existing + new)
  diffToolPath: z.string(),
  diffToolArgs: z.string(),
  editorPath: z.string(), // NEW: Phase 11

  // App settings (existing + new)
  verboseLogging: z.boolean(),
  autoRefreshInterval: z.number().min(0).max(600000), // NEW: Phase 11, 0 = disabled
});

export type P4Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: P4Settings = {
  p4port: '',
  p4user: '',
  p4client: '',
  diffToolPath: '',
  diffToolArgs: '',
  editorPath: '', // NEW
  verboseLogging: false,
  autoRefreshInterval: 300000, // NEW: 5 minutes default
};
```

### Settings Persistence Layer
```typescript
// src/lib/settings.ts (extend existing functions)
export async function loadSettings(): Promise<P4Settings> {
  const store = await getStore();
  return {
    // Existing fields
    p4port: (await store.get<string>('p4port')) || defaultSettings.p4port,
    p4user: (await store.get<string>('p4user')) || defaultSettings.p4user,
    p4client: (await store.get<string>('p4client')) || defaultSettings.p4client,
    diffToolPath: (await store.get<string>('diffToolPath')) || defaultSettings.diffToolPath,
    diffToolArgs: (await store.get<string>('diffToolArgs')) || defaultSettings.diffToolArgs,
    verboseLogging: (await store.get<boolean>('verboseLogging')) ?? defaultSettings.verboseLogging,

    // New fields
    editorPath: (await store.get<string>('editorPath')) || defaultSettings.editorPath,
    autoRefreshInterval: (await store.get<number>('autoRefreshInterval')) ?? defaultSettings.autoRefreshInterval,
  };
}

export async function saveSettings(settings: P4Settings): Promise<void> {
  const store = await getStore();
  // Existing fields
  await store.set('p4port', settings.p4port);
  await store.set('p4user', settings.p4user);
  await store.set('p4client', settings.p4client);
  await store.set('diffToolPath', settings.diffToolPath);
  await store.set('diffToolArgs', settings.diffToolArgs);
  await store.set('verboseLogging', settings.verboseLogging);

  // New fields
  await store.set('editorPath', settings.editorPath);
  await store.set('autoRefreshInterval', settings.autoRefreshInterval);

  await store.save();
}

// Helper to get autoRefreshInterval without loading all settings
export async function getAutoRefreshInterval(): Promise<number> {
  const store = await getStore();
  return (await store.get<number>('autoRefreshInterval')) ?? defaultSettings.autoRefreshInterval;
}
```

### Window Focus Hook
```typescript
// src/hooks/useWindowFocus.ts
import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Hook to track window focus state.
 * Returns false when window is minimized, inactive, or blurred.
 * Returns true when window is focused and active.
 */
export function useWindowFocus(): boolean {
  const [isFocused, setIsFocused] = useState(true); // Start optimistic

  useEffect(() => {
    const appWindow = getCurrentWindow();

    const setupListeners = async () => {
      // Listen to focus events
      const unlistenFocus = await appWindow.listen('tauri://focus', () => {
        setIsFocused(true);
      });

      // Listen to blur events (covers minimize + inactive)
      const unlistenBlur = await appWindow.listen('tauri://blur', () => {
        setIsFocused(false);
      });

      return () => {
        unlistenFocus();
        unlistenBlur();
      };
    };

    const unlisten = setupListeners();
    return () => {
      unlisten.then(cleanup => cleanup());
    };
  }, []);

  return isFocused;
}
```

### Conditional Auto-Refresh in Query Hook
```typescript
// src/components/ChangelistPanel/useChangelists.ts (modified)
import { useQuery } from '@tanstack/react-query';
import { useOperationStore } from '@/store/operation';
import { useWindowFocus } from '@/hooks/useWindowFocus';
import { getAutoRefreshInterval } from '@/lib/settings';
import { useEffect, useState } from 'react';

export function useChangelists() {
  const { changelists, setChangelists } = useChangelistStore();
  const { status, p4port, p4user, p4client } = useConnectionStore();
  const { currentOperation } = useOperationStore();
  const isWindowFocused = useWindowFocus();
  const isConnected = status === 'connected';

  // Load auto-refresh interval from settings
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);
  useEffect(() => {
    getAutoRefreshInterval().then(setAutoRefreshInterval);
  }, []);

  // Auto-refresh is enabled when:
  // 1. Connected to P4
  // 2. No active operation
  // 3. Window is focused
  // 4. User has enabled auto-refresh (interval > 0)
  const isAutoRefreshEnabled =
    isConnected &&
    !currentOperation &&
    isWindowFocused &&
    autoRefreshInterval > 0;

  // Load pending changelists
  const { data: clData, isLoading: clLoading } = useQuery({
    queryKey: ['p4', 'changes', 'pending', p4port, p4user, p4client],
    queryFn: async () => { /* existing implementation */ },
    enabled: isAutoRefreshEnabled,
    refetchInterval: autoRefreshInterval || false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  // ... rest of implementation
}
```

### Settings Dialog UI Extension
```typescript
// src/components/SettingsDialog.tsx (add new section after Logging section)

{/* Editor Tool section */}
<div className="border-t border-border pt-4 mt-2">
  <h3 className="text-sm font-medium text-foreground mb-3">External Editor</h3>

  <FormField
    control={form.control}
    name="editorPath"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Editor Path</FormLabel>
        <div className="flex gap-2">
          <FormControl>
            <Input
              placeholder="code, notepad++, /path/to/editor"
              {...field}
              className="flex-1"
            />
          </FormControl>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              const selected = await open({
                multiple: false,
                directory: false,
                filters: [{ name: 'Executable', extensions: ['exe'] }]
              });
              if (selected) {
                field.onChange(selected);
              }
            }}
          >
            Browse
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Path to your external text editor (e.g., code, notepad++, or full path)
        </p>
        <FormMessage />
      </FormItem>
    )}
  />
</div>

{/* Auto-Refresh section */}
<div className="border-t border-border pt-4 mt-2">
  <h3 className="text-sm font-medium text-foreground mb-3">Auto-Refresh</h3>

  <FormField
    control={form.control}
    name="autoRefreshInterval"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Refresh Interval (milliseconds)</FormLabel>
        <FormControl>
          <Input
            type="number"
            placeholder="300000 (5 minutes)"
            {...field}
            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
          />
        </FormControl>
        <p className="text-xs text-muted-foreground">
          Auto-refresh workspace state every X milliseconds. Set to 0 to disable.
          Default: 300000 (5 minutes). Range: 0 to 600000 (10 minutes).
        </p>
        <FormMessage />
      </FormItem>
    )}
  />
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual setInterval + cleanup | TanStack Query `refetchInterval` | TanStack Query v3+ (2021) | Automatic cleanup, pause on unmount, better error handling |
| Checking document.hasFocus() | Window focus/blur events | Standard practice | Event-driven, more reliable, works with minimize |
| HTML file input | Tauri dialog plugin | Tauri v2 (2023) | Native OS dialogs, better UX, supports executable selection |
| refetchInterval as number only | refetchInterval as function | TanStack Query v4 (2022) | Conditional intervals based on query state (e.g., error backoff) |

**Deprecated/outdated:**
- `refetchIntervalInBackground` default changed from `true` to `false` in v5 (better battery/performance)
- Function signature for `refetchInterval` changed in v5: now receives only `query` object, not `data` as first parameter

## Open Questions

Things that couldn't be fully resolved:

1. **Should auto-refresh use the same interval for all queries?**
   - What we know: Current manual refresh invalidates all three query types together (opened, changes, shelved).
   - What's unclear: Whether different queries should have different intervals (e.g., shelved files change less frequently).
   - Recommendation: Start with single global interval for simplicity, can optimize later based on user feedback.

2. **Should the settings dialog show interval in seconds or milliseconds?**
   - What we know: TanStack Query uses milliseconds. Current code uses milliseconds for staleTime.
   - What's unclear: Which is more user-friendly (milliseconds are precise but less intuitive).
   - Recommendation: Display in seconds with conversion to milliseconds internally, or provide preset options (1m, 5m, 10m).

3. **Should editor path be validated before saving?**
   - What we know: Diff tool path is not validated, only stored as string.
   - What's unclear: Whether we should verify the executable exists before saving.
   - Recommendation: No validation - let user save any path (they might be using PATH-based commands like "code" or "notepad++"). Show error when launching if path is invalid.

## Sources

### Primary (HIGH confidence)
- TanStack Query v5 useQuery reference: https://tanstack.com/query/v5/docs/framework/react/reference/useQuery
- TanStack Query v5 auto-refetching example: https://tanstack.com/query/v5/docs/framework/react/examples/auto-refetching
- Tauri v2 Window API: https://v2.tauri.app/reference/javascript/api/namespacewindow/
- Tauri v2 Dialog Plugin: https://v2.tauri.app/plugin/dialog/
- Existing codebase patterns (useChangelists, useFileTree, SettingsDialog, useOperationStore)

### Secondary (MEDIUM confidence)
- [Disabling/Pausing Queries | TanStack Query React Docs](https://tanstack.com/query/v4/docs/framework/react/guides/disabling-queries) - verified `enabled` option pattern
- [Window Focus Refetching | TanStack Query React Docs](https://tanstack.com/query/v4/docs/react/guides/window-focus-refetching) - background refetch behavior
- [Tauri window events discussion](https://github.com/tauri-apps/tauri/discussions/5881) - community patterns for focus detection
- [Tauri Shell Plugin](https://v2.tauri.app/plugin/shell/) - alternative to opener for launching editors

### Tertiary (LOW confidence)
- WebSearch discussions on refetchInterval patterns - common issues and solutions from community
- GitHub discussions on pausing polling - verified no built-in "pause" method, `enabled` is the pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use except dialog plugin (official Tauri plugin)
- Architecture: HIGH - Patterns verified in existing codebase (query hooks, settings persistence, operation store)
- Pitfalls: MEDIUM - Common patterns from TanStack Query docs and community discussions, race condition handling verified in docs

**Research date:** 2026-01-31
**Valid until:** 2026-03-15 (45 days - TanStack Query and Tauri are stable, slow-moving APIs)
