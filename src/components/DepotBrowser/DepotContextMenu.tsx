import { useEffect, useRef } from 'react';
import { Download, Edit3, History, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { invokeP4Sync, invokeP4Edit } from '@/lib/tauri';
import { useConnectionStore } from '@/stores/connectionStore';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface DepotContextMenuProps {
  depotPath: string;
  isFolder: boolean;
  x: number;
  y: number;
  onClose: () => void;
}

/**
 * Context menu for depot file/folder operations
 *
 * Provides:
 * - Sync to Workspace (folders and files)
 * - Checkout for Edit (files only)
 * - File History (files only)
 * - Copy Depot Path (always available)
 *
 * Closes on click outside or Escape key
 */
export function DepotContextMenu({ depotPath, isFolder, x, y, onClose }: DepotContextMenuProps) {
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

  async function handleSync() {
    try {
      toast.loading('Syncing...', { id: 'sync-depot' });

      await invokeP4Sync(
        [depotPath],
        undefined,
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined,
        () => {} // No progress callback needed
      );

      // Refresh file tree and opened files
      await queryClient.invalidateQueries({ queryKey: ['fileTree'] });
      await queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });

      toast.success('Synced', { id: 'sync-depot' });
      onClose();
    } catch (error) {
      toast.error(`Failed to sync: ${error}`, { id: 'sync-depot' });
    }
  }

  async function handleCheckout() {
    try {
      toast.loading('Checking out...', { id: 'checkout-depot' });

      await invokeP4Edit(
        [depotPath],
        undefined,
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );

      // Refresh opened files
      await queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });

      toast.success('Checked out', { id: 'checkout-depot' });
      onClose();
    } catch (error) {
      toast.error(`Failed to checkout: ${error}`, { id: 'checkout-depot' });
    }
  }

  function handleHistory() {
    // Navigate detail pane to file view with empty localPath (depot-only)
    useDetailPaneStore.getState().selectFile(depotPath, '');
    onClose();
  }

  function handleCopyPath() {
    navigator.clipboard.writeText(depotPath);
    toast.success('Copied');
    onClose();
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-48 bg-background border border-border rounded-md shadow-xl py-1"
      style={{ left: x, top: y }}
    >
      {/* Sync to Workspace */}
      <button
        onClick={handleSync}
        className={cn(
          'w-full px-4 py-2 text-left text-sm text-foreground',
          'hover:bg-accent',
          'flex items-center justify-between gap-6'
        )}
      >
        <span className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Sync to Workspace
        </span>
      </button>

      {/* Checkout for Edit (files only) */}
      {!isFolder && (
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
      )}

      {/* File History (files only) */}
      {!isFolder && (
        <button
          onClick={handleHistory}
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
        </button>
      )}

      <div className="h-px bg-border my-1" />

      {/* Copy Depot Path */}
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
          Copy Depot Path
        </span>
      </button>
    </div>
  );
}
