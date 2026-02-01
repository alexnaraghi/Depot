import { Edit3, Undo2, Copy, History, GitCompare, FolderOpen, ExternalLink, AlertTriangle } from 'lucide-react';
import { P4File, FileStatus } from '@/types/p4';
import { useFileOperations } from '@/hooks/useFileOperations';
import { useUnresolvedFiles } from '@/hooks/useResolve';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { SHORTCUTS } from '@/lib/shortcuts';

interface FileContextMenuItemsProps {
  file: P4File;
  onClose: () => void;
  onShowHistory?: (depotPath: string, localPath: string) => void;
  onDiffAgainstHave?: (depotPath: string, localPath: string) => void;
  onResolve?: (depotPath: string, localPath: string) => void;
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
  onResolve,
}: FileContextMenuItemsProps) {
  const { checkout, revert } = useFileOperations();
  const { isFileUnresolved } = useUnresolvedFiles();

  // Determine available actions based on file status
  const canCheckout = file.status === FileStatus.Synced || file.status === FileStatus.OutOfDate;
  const canRevert = file.status === FileStatus.CheckedOut ||
                    file.status === FileStatus.Added ||
                    file.status === FileStatus.Deleted;
  const isConflicted = isFileUnresolved(file.depotPath) || file.status === FileStatus.Conflict;

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

  async function handleOpen() {
    if (!file.localPath) {
      toast.error('No local path available');
      return;
    }
    try {
      await openPath(file.localPath);
      onClose();
    } catch (error) {
      toast.error(`Failed to open file: ${error}`);
    }
  }

  async function handleOpenInExplorer() {
    if (!file.localPath) {
      toast.error('No local path available');
      return;
    }
    try {
      await revealItemInDir(file.localPath);
      onClose();
    } catch (error) {
      toast.error(`Failed to open in explorer: ${error}`);
    }
  }

  function handleResolve() {
    if (onResolve) {
      onResolve(file.depotPath, file.localPath);
    }
    onClose();
  }

  return (
    <>
      {isConflicted && (
        <>
          <button
            onClick={handleResolve}
            className={cn(
              'w-full px-4 py-2 text-left text-sm text-yellow-400',
              'hover:bg-accent',
              'flex items-center justify-between gap-6'
            )}
            data-testid="context-menu-resolve"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Resolve...
            </span>
          </button>
          <div className="h-px bg-border my-1" />
        </>
      )}

      {canCheckout && (
        <>
          <button
            onClick={handleCheckout}
            className={cn(
              'w-full px-4 py-2 text-left text-sm text-foreground',
              'hover:bg-accent',
              'flex items-center justify-between gap-6'
            )}
            data-testid="context-menu-checkout"
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
            data-testid="context-menu-revert"
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
        onClick={handleOpen}
        className={cn(
          'w-full px-4 py-2 text-left text-sm text-foreground',
          'hover:bg-accent',
          'flex items-center justify-between gap-6'
        )}
      >
        <span className="flex items-center gap-2">
          <ExternalLink className="w-4 h-4" />
          Open
        </span>
      </button>

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
