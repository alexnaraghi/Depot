import { useEffect, useRef } from 'react';
import { P4File, FileStatus } from '@/types/p4';
import { FileContextMenuItems } from '@/components/shared/FileContextMenuItems';
import { Download, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { invokeP4Sync, invokeP4ReconcileApply } from '@/lib/tauri';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface FileContextMenuProps {
  file: P4File;
  x: number;
  y: number;
  onClose: () => void;
  onShowHistory?: (depotPath: string, localPath: string) => void;
  onDiffAgainstHave?: (depotPath: string, localPath: string) => void;
}

/**
 * Context menu for file operations
 *
 * Provides:
 * - Checkout (when file is synced or out of date)
 * - Revert (when file is checked out)
 * - File History (always available)
 * - Diff against Have (when file is checked out)
 * - Copy local path
 *
 * Closes on click outside or Escape key
 */
export function FileContextMenu({ file, x, y, onClose, onShowHistory, onDiffAgainstHave }: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { p4port, p4user, p4client } = useConnectionStore();
  const queryClient = useQueryClient();

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Determine if workspace-specific operations are available
  const canSync = file.status === FileStatus.Synced || file.status === FileStatus.OutOfDate;
  const canAdd = file.status === FileStatus.Modified; // Modified files can be added via reconcile

  async function handleGetRevision() {
    try {
      toast.loading('Syncing file...', { id: 'sync-file' });

      // Sync specific file to latest revision
      await invokeP4Sync(
        [file.depotPath],
        undefined,
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined,
        () => {} // No progress callback needed for single file
      );

      // Refresh file tree
      await queryClient.invalidateQueries({ queryKey: ['fileTree'] });

      toast.success('File synced to latest revision', { id: 'sync-file' });
      onClose();
    } catch (error) {
      toast.error(`Failed to sync file: ${error}`, { id: 'sync-file' });
    }
  }

  async function handleAddToDepot() {
    try {
      toast.loading('Adding file to depot...', { id: 'add-file' });

      // Use reconcile to add the file
      await invokeP4ReconcileApply(
        [file.localPath],
        undefined, // Default changelist
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );

      // Refresh file tree and opened files
      await queryClient.invalidateQueries({ queryKey: ['fileTree'] });
      await queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });

      toast.success('File added to depot', { id: 'add-file' });
      onClose();
    } catch (error) {
      toast.error(`Failed to add file: ${error}`, { id: 'add-file' });
    }
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-48 bg-slate-900 border border-slate-700 rounded-md shadow-xl py-1"
      style={{ left: x, top: y }}
    >
      {/* Shared file operations */}
      <FileContextMenuItems
        file={file}
        onClose={onClose}
        onShowHistory={onShowHistory}
        onDiffAgainstHave={onDiffAgainstHave}
      />

      {/* Workspace-specific operations */}
      {(canSync || canAdd) && <div className="h-px bg-slate-700 my-1" />}

      {canSync && (
        <button
          onClick={handleGetRevision}
          className={cn(
            'w-full px-4 py-2 text-left text-sm text-slate-200',
            'hover:bg-slate-800 transition-colors',
            'flex items-center justify-between gap-6'
          )}
        >
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Get Revision
          </span>
        </button>
      )}

      {canAdd && (
        <button
          onClick={handleAddToDepot}
          className={cn(
            'w-full px-4 py-2 text-left text-sm text-slate-200',
            'hover:bg-slate-800 transition-colors',
            'flex items-center justify-between gap-6'
          )}
        >
          <span className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add to Depot
          </span>
        </button>
      )}
    </div>
  );
}
