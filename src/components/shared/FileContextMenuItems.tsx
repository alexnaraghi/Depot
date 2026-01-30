import { Edit3, Undo2, Copy, History, GitCompare, FolderOpen } from 'lucide-react';
import { P4File, FileStatus } from '@/types/p4';
import { useFileOperations } from '@/hooks/useFileOperations';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { SHORTCUTS } from '@/lib/shortcuts';

interface FileContextMenuItemsProps {
  file: P4File;
  onClose: () => void;
  onShowHistory?: (depotPath: string, localPath: string) => void;
  onDiffAgainstHave?: (depotPath: string, localPath: string) => void;
}

/**
 * Shared file context menu items component
 *
 * Provides common file operation menu items used by both
 * FileContextMenu (workspace tree) and ChangelistContextMenu (changelist panel).
 *
 * Operations:
 * - Checkout (when file is synced or out of date)
 * - Revert (when file is checked out)
 * - File History (always available)
 * - Diff against Have (when file is checked out)
 * - Copy local path
 */
export function FileContextMenuItems({
  file,
  onClose,
  onShowHistory,
  onDiffAgainstHave,
}: FileContextMenuItemsProps) {
  const { checkout, revert } = useFileOperations();

  // Determine available actions based on file status
  const canCheckout = file.status === FileStatus.Synced || file.status === FileStatus.OutOfDate;
  const canRevert = file.status === FileStatus.CheckedOut ||
                    file.status === FileStatus.Added ||
                    file.status === FileStatus.Deleted;

  async function handleCheckout() {
    try {
      await checkout([file.depotPath]);
      onClose();
    } catch (error) {
      // Error already handled by useFileOperations with toast
    }
  }

  async function handleRevert() {
    try {
      await revert([file.depotPath]);
      onClose();
    } catch (error) {
      // Error already handled by useFileOperations with toast
    }
  }

  function handleCopyPath() {
    navigator.clipboard.writeText(file.localPath);
    toast.success('Local path copied to clipboard');
    onClose();
  }

  function handleShowHistory() {
    if (onShowHistory) {
      onShowHistory(file.depotPath, file.localPath);
    }
    onClose();
  }

  function handleDiffAgainstHave() {
    if (onDiffAgainstHave) {
      onDiffAgainstHave(file.depotPath, file.localPath);
    }
    onClose();
  }

  async function handleOpenInExplorer() {
    try {
      // Reveal the file in its directory (opens explorer and selects the file)
      await revealItemInDir(file.localPath);
      onClose();
    } catch (error) {
      toast.error(`Failed to open in explorer: ${error}`);
    }
  }

  return (
    <>
      {canCheckout && (
        <>
          <button
            onClick={handleCheckout}
            className={cn(
              'w-full px-4 py-2 text-left text-sm text-foreground',
              'hover:bg-accent',
              'flex items-center justify-between gap-6'
            )}
          >
            <span className="flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              Checkout for Edit
            </span>
          </button>
          <div className="h-px bg-border my-1" />
        </>
      )}

      {canRevert && (
        <>
          <button
            onClick={handleRevert}
            className={cn(
              'w-full px-4 py-2 text-left text-sm text-foreground',
              'hover:bg-accent',
              'flex items-center justify-between gap-6'
            )}
          >
            <span className="flex items-center gap-2">
              <Undo2 className="w-4 h-4" />
              Revert Changes
            </span>
            <span className="text-xs text-muted-foreground">{SHORTCUTS.REVERT.label}</span>
          </button>
          <div className="h-px bg-border my-1" />
        </>
      )}

      <button
        onClick={handleShowHistory}
        className={cn(
          'w-full px-4 py-2 text-left text-sm text-foreground',
          'hover:bg-accent',
          'flex items-center justify-between gap-6'
        )}
      >
        <span className="flex items-center gap-2">
          <History className="w-4 h-4" />
          File History
        </span>
        <span className="text-xs text-muted-foreground">{SHORTCUTS.HISTORY.label}</span>
      </button>

      {canRevert && (
        <button
          onClick={handleDiffAgainstHave}
          className={cn(
            'w-full px-4 py-2 text-left text-sm text-foreground',
            'hover:bg-accent',
            'flex items-center justify-between gap-6'
          )}
        >
          <span className="flex items-center gap-2">
            <GitCompare className="w-4 h-4" />
            Diff against Have
          </span>
          <span className="text-xs text-muted-foreground">{SHORTCUTS.DIFF.label}</span>
        </button>
      )}

      <div className="h-px bg-border my-1" />

      <button
        onClick={handleCopyPath}
        className={cn(
          'w-full px-4 py-2 text-left text-sm text-foreground',
          'hover:bg-accent',
          'flex items-center justify-between gap-6'
        )}
      >
        <span className="flex items-center gap-2">
          <Copy className="w-4 h-4" />
          Copy Local Path
        </span>
      </button>

      <button
        onClick={handleOpenInExplorer}
        className={cn(
          'w-full px-4 py-2 text-left text-sm text-foreground',
          'hover:bg-accent',
          'flex items-center justify-between gap-6'
        )}
      >
        <span className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          Open in Explorer
        </span>
      </button>
    </>
  );
}
