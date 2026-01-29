import { useEffect, useRef } from 'react';
import { P4File } from '@/types/p4';
import { FileContextMenuItems } from '@/components/shared/FileContextMenuItems';

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

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-48 bg-slate-900 border border-slate-700 rounded-md shadow-xl py-1"
      style={{ left: x, top: y }}
    >
      <FileContextMenuItems
        file={file}
        onClose={onClose}
        onShowHistory={onShowHistory}
        onDiffAgainstHave={onDiffAgainstHave}
      />
    </div>
  );
}
