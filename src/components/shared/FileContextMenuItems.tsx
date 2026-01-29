import { Edit3, Undo2, Copy, History, GitCompare } from 'lucide-react';
import { P4File, FileStatus } from '@/types/p4';
import { useFileOperations } from '@/hooks/useFileOperations';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

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

  return (
    <>
      {canCheckout && (
        <button
          onClick={handleCheckout}
          className={cn(
            'w-full px-4 py-2 text-left text-sm text-slate-200',
            'hover:bg-slate-800 transition-colors',
            'flex items-center gap-2'
          )}
        >
          <Edit3 className="w-4 h-4" />
          Checkout for Edit
        </button>
      )}

      {canRevert && (
        <button
          onClick={handleRevert}
          className={cn(
            'w-full px-4 py-2 text-left text-sm text-slate-200',
            'hover:bg-slate-800 transition-colors',
            'flex items-center gap-2'
          )}
        >
          <Undo2 className="w-4 h-4" />
          Revert Changes
        </button>
      )}

      <button
        onClick={handleShowHistory}
        className={cn(
          'w-full px-4 py-2 text-left text-sm text-slate-200',
          'hover:bg-slate-800 transition-colors',
          'flex items-center gap-2'
        )}
      >
        <History className="w-4 h-4" />
        File History
      </button>

      {canRevert && (
        <button
          onClick={handleDiffAgainstHave}
          className={cn(
            'w-full px-4 py-2 text-left text-sm text-slate-200',
            'hover:bg-slate-800 transition-colors',
            'flex items-center gap-2'
          )}
        >
          <GitCompare className="w-4 h-4" />
          Diff against Have
        </button>
      )}

      <button
        onClick={handleCopyPath}
        className={cn(
          'w-full px-4 py-2 text-left text-sm text-slate-200',
          'hover:bg-slate-800 transition-colors',
          'flex items-center gap-2'
        )}
      >
        <Copy className="w-4 h-4" />
        Copy Local Path
      </button>
    </>
  );
}
