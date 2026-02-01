import { NodeRendererProps } from 'react-arborist';
import { FolderOpen, Folder, File, AlertTriangle } from 'lucide-react';
import { P4File, FileStatus } from '@/types/p4';
import { FileStatusIcon } from './FileStatusIcon';
import { useUnresolvedFiles } from '@/hooks/useResolve';
import { cn } from '@/lib/utils';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { useSearchFilterStore } from '@/stores/searchFilterStore';
import Highlighter from 'react-highlight-words';

export interface FileNodeData {
  id: string;
  name: string;
  isFolder: boolean;
  file?: P4File;
  children?: FileNodeData[];
  onContextMenu?: (event: React.MouseEvent, file: P4File) => void;
  dimmed?: boolean;
  highlightRanges?: [number, number][];
}

/**
 * Tree node renderer for file/folder display in react-arborist
 * Handles both folders and files with status icons
 */
export function FileNode({ node, style, dragHandle }: NodeRendererProps<FileNodeData>) {
  const { name, isFolder, file, onContextMenu, dimmed, highlightRanges } = node.data;
  const isSelected = node.isSelected;
  const isOpen = node.isOpen;
  const { isFileUnresolved } = useUnresolvedFiles();

  // Check if this file has unresolved conflicts
  const isConflicted = file && (isFileUnresolved(file.depotPath) || file.status === FileStatus.Conflict);

  function handleContextMenu(event: React.MouseEvent) {
    if (dimmed) return; // Don't allow context menu on dimmed items
    if (!isFolder && file && onContextMenu) {
      event.preventDefault();
      onContextMenu(event, file);
    }
  }

  function handleClick() {
    if (dimmed) return; // Don't allow interaction with dimmed items
    if (node.isInternal) {
      // Folders toggle expand/collapse
      node.toggle();
    } else if (file) {
      // Files update detail pane
      useDetailPaneStore.getState().selectFile(file.depotPath, file.localPath);
      // Clear filter after navigating to file
      const isActive = useSearchFilterStore.getState().isActive;
      if (isActive) {
        useSearchFilterStore.getState().clearFilter();
      }
    }
  }

  return (
    <div
      ref={dragHandle}
      style={{ ...style, paddingLeft: (style.paddingLeft as number || 0) + 12 }}
      className={cn(
        'flex items-center gap-2 pr-3 py-1 text-sm overflow-hidden',
        !dimmed && 'cursor-pointer hover:bg-accent',
        !dimmed && isSelected && 'bg-blue-900/50',
        dimmed && 'opacity-30 pointer-events-none'
      )}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      tabIndex={dimmed ? -1 : undefined}
      aria-hidden={dimmed ? true : undefined}
      data-testid={!isFolder && file ? `file-node-${file.depotPath.replace(/[^a-zA-Z0-9]/g, '-')}` : undefined}
    >
      {/* Folder or file icon */}
      {isFolder ? (
        isOpen ? (
          <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )
      ) : (
        <div className="relative flex-shrink-0">
          <File className="w-4 h-4 text-muted-foreground" />
          {/* Conflict overlay icon */}
          {isConflicted && (
            <AlertTriangle className="w-3 h-3 text-yellow-500 absolute -bottom-1 -right-1" />
          )}
        </div>
      )}

      {/* Status icon for files */}
      {!isFolder && file && (
        <FileStatusIcon status={file.status} className="flex-shrink-0" />
      )}

      {/* File/folder name */}
      <span className="flex-1 truncate text-foreground">
        {!dimmed && highlightRanges && highlightRanges.length > 0 ? (
          <Highlighter
            searchWords={[]}
            autoEscape={true}
            textToHighlight={name}
            findChunks={() => highlightRanges.map(([start, end]) => ({ start, end }))}
            highlightClassName="bg-yellow-500/30 text-yellow-200"
          />
        ) : (
          name
        )}
      </span>

      {/* Revision number for files */}
      {!isFolder && file && (
        <span className="text-muted-foreground text-xs flex-shrink-0">
          #{file.revision}
        </span>
      )}
    </div>
  );
}
