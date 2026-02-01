import { NodeRendererProps } from 'react-arborist';
import { FolderOpen, Folder, File } from 'lucide-react';
import { P4File } from '@/types/p4';
import { FileStatusIcon } from './FileStatusIcon';
import { cn } from '@/lib/utils';
import { useDetailPaneStore } from '@/stores/detailPaneStore';

export interface FileNodeData {
  id: string;
  name: string;
  isFolder: boolean;
  file?: P4File;
  children?: FileNodeData[];
  onContextMenu?: (event: React.MouseEvent, file: P4File) => void;
}

/**
 * Tree node renderer for file/folder display in react-arborist
 * Handles both folders and files with status icons
 */
export function FileNode({ node, style, dragHandle }: NodeRendererProps<FileNodeData>) {
  const { name, isFolder, file, onContextMenu } = node.data;
  const isSelected = node.isSelected;
  const isOpen = node.isOpen;

  function handleContextMenu(event: React.MouseEvent) {
    if (!isFolder && file && onContextMenu) {
      event.preventDefault();
      onContextMenu(event, file);
    }
  }

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        'flex items-center gap-2 px-2 py-1 cursor-pointer text-sm',
        'hover:bg-accent',
        isSelected && 'bg-blue-900/50'
      )}
      onClick={() => {
        if (node.isInternal) {
          // Folders toggle expand/collapse
          node.toggle();
        } else if (file) {
          // Files update detail pane
          useDetailPaneStore.getState().selectFile(file.depotPath, file.localPath);
        }
      }}
      onContextMenu={handleContextMenu}
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
        <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      )}

      {/* Status icon for files */}
      {!isFolder && file && (
        <FileStatusIcon status={file.status} className="flex-shrink-0" />
      )}

      {/* File/folder name */}
      <span className="flex-1 truncate text-foreground">{name}</span>

      {/* Revision number for files */}
      {!isFolder && file && (
        <span className="text-muted-foreground text-xs flex-shrink-0">
          #{file.revision}
        </span>
      )}
    </div>
  );
}
