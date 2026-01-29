import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { P4File, P4Changelist } from '@/types/p4';
import { invokeP4Reopen } from '@/lib/tauri';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface ChangelistContextMenuProps {
  files: P4File[];
  changelists: P4Changelist[];
  currentChangelistId: number;
  x: number;
  y: number;
  onClose: () => void;
}

/**
 * Context menu for changelist file operations
 *
 * Provides:
 * - Move to Changelist submenu (lists all available changelists except current)
 *
 * Closes on click outside or Escape key
 */
export function ChangelistContextMenu({
  files,
  changelists,
  currentChangelistId,
  x,
  y,
  onClose,
}: ChangelistContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const { p4port, p4user, p4client } = useConnectionStore();
  const queryClient = useQueryClient();

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        (!submenuRef.current || !submenuRef.current.contains(event.target as Node))
      ) {
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

  // Filter out current changelist from submenu
  const availableChangelists = changelists.filter((cl) => cl.id !== currentChangelistId);

  async function handleMoveToChangelist(targetId: number) {
    try {
      const filePaths = files.map((f) => f.depotPath);
      await invokeP4Reopen(
        filePaths,
        targetId,
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );

      const targetLabel = targetId === 0 ? 'Default' : `#${targetId}`;
      toast.success(`Moved ${files.length} file(s) to changelist ${targetLabel}`);

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
      queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });

      onClose();
    } catch (error) {
      toast.error(`Failed to move files: ${error}`);
      onClose();
    }
  }

  const fileCount = files.length;
  const menuLabel = fileCount > 1 ? `Move ${fileCount} files to Changelist` : 'Move to Changelist';

  return (
    <>
      <div
        ref={menuRef}
        className="fixed z-50 min-w-48 bg-slate-900 border border-slate-700 rounded-md shadow-xl py-1"
        style={{ left: x, top: y }}
      >
        <button
          onMouseEnter={() => setSubmenuOpen(true)}
          onMouseLeave={() => setSubmenuOpen(false)}
          className={cn(
            'w-full px-4 py-2 text-left text-sm text-slate-200',
            'hover:bg-slate-800 transition-colors',
            'flex items-center justify-between gap-2'
          )}
        >
          <span>{menuLabel}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Submenu */}
      {submenuOpen && (
        <div
          ref={submenuRef}
          className="fixed z-50 min-w-64 max-w-80 bg-slate-900 border border-slate-700 rounded-md shadow-xl py-1"
          style={{ left: x + 192, top: y }}
          onMouseEnter={() => setSubmenuOpen(true)}
          onMouseLeave={() => setSubmenuOpen(false)}
        >
          {availableChangelists.length === 0 ? (
            <div className="px-4 py-2 text-sm text-slate-400">No other changelists available</div>
          ) : (
            availableChangelists.map((cl) => (
              <button
                key={cl.id}
                onClick={() => handleMoveToChangelist(cl.id)}
                className={cn(
                  'w-full px-4 py-2 text-left text-sm text-slate-200',
                  'hover:bg-slate-800 transition-colors',
                  'truncate'
                )}
                title={cl.description}
              >
                {cl.id === 0 ? 'Default' : `#${cl.id} — ${cl.description}`}
              </button>
            ))
          )}
        </div>
      )}
    </>
  );
}
