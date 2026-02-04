import { FileAction } from '@/types/p4';

/**
 * Get badge color for file action
 *
 * Color scheme:
 * - edit: blue (bg-blue-900/30 text-blue-300)
 * - add: green (bg-green-900/30 text-green-300)
 * - delete: red (bg-red-900/30 text-red-300)
 * - branch: purple (bg-purple-900/30 text-purple-300)
 * - integrate: yellow (bg-yellow-900/30 text-yellow-300)
 * - move/add, move/delete: orange (bg-orange-900/30 text-orange-300)
 *
 * @param action - File action (FileAction enum or string)
 * @returns Tailwind class string for badge styling
 */
export const getActionBadgeColor = (action?: FileAction | string): string => {
  const actionLower = typeof action === 'string' ? action.toLowerCase() : action;
  switch (actionLower) {
    case FileAction.Edit:
    case 'edit':
      return 'bg-blue-900/30 text-blue-300';
    case FileAction.Add:
    case 'add':
      return 'bg-green-900/30 text-green-300';
    case FileAction.Delete:
    case 'delete':
      return 'bg-red-900/30 text-red-300';
    case FileAction.Branch:
    case 'branch':
      return 'bg-purple-900/30 text-purple-300';
    case FileAction.Integrate:
    case 'integrate':
      return 'bg-yellow-900/30 text-yellow-300';
    case FileAction.MoveAdd:
    case 'move/add':
    case FileAction.MoveDelete:
    case 'move/delete':
      return 'bg-orange-900/30 text-orange-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

/**
 * Format action label for display
 *
 * Converts "move/add" to "move / add" for better readability.
 * Defaults to 'edit' if no action provided.
 *
 * @param action - File action (FileAction enum or string)
 * @returns Formatted lowercase action string
 */
export const formatActionLabel = (action?: FileAction | string): string => {
  if (!action) return 'edit';
  const actionStr = typeof action === 'string' ? action.toLowerCase() : action;
  // Convert "move/add" to "move / add" for display
  if (actionStr === 'move/add' || actionStr === FileAction.MoveAdd) {
    return 'move / add';
  }
  if (actionStr === 'move/delete' || actionStr === FileAction.MoveDelete) {
    return 'move / delete';
  }
  return actionStr;
};
