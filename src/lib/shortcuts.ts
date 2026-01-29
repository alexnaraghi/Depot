/**
 * Centralized keyboard shortcut registry
 *
 * Single source of truth for all keyboard shortcuts in the application.
 * Maps action names to key combinations and display labels.
 */

export const SHORTCUTS = {
  REFRESH: { keys: 'f5', label: 'F5' },
  SYNC: { keys: 'ctrl+shift+s', label: 'Ctrl+Shift+S' },
  SUBMIT: { keys: 'ctrl+shift+enter', label: 'Ctrl+Shift+Enter' },
  REVERT: { keys: 'ctrl+shift+r', label: 'Ctrl+Shift+R' },
  DIFF: { keys: 'ctrl+d', label: 'Ctrl+D' },
  HISTORY: { keys: 'ctrl+h', label: 'Ctrl+H' },
  NEW_CHANGELIST: { keys: 'ctrl+shift+n', label: 'Ctrl+Shift+N' },
  COMMAND_PALETTE: { keys: 'ctrl+shift+p,ctrl+comma', label: 'Ctrl+Shift+P' },
} as const;

/**
 * Helper function to get the human-readable label for a shortcut
 */
export function formatShortcutLabel(shortcutKey: keyof typeof SHORTCUTS): string {
  return SHORTCUTS[shortcutKey].label;
}
