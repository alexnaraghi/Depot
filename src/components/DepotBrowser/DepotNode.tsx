import { NodeRendererProps } from 'react-arborist';
import { FolderOpen, Folder, Loader2, FileIcon, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DepotNodeData } from './useDepotTree';
import { useDetailPaneStore } from '@/stores/detailPaneStore';

export interface DepotNodeProps extends NodeRendererProps<DepotNodeData> {
  loadingPaths: Set<string>;
  onContextMenu: (menu: { depotPath: string; isFolder: boolean; x: number; y: number }) => void;
}

/**
 * Tree node renderer for depot items in react-arborist
 * Displays folder icons with expand/collapse and loading states
 */
export function DepotNode({ node, style, loadingPaths, onContextMenu }: DepotNodeProps) {
  const { name, isFolder } = node.data;
  const isSelected = node.isSelected;
  const isOpen = node.isOpen;
  const isLoading = loadingPaths.has(node.data.id);

  function handleClick() {
    if (isFolder) {
      // Folders toggle expand/collapse
      node.toggle();
    } else {
      // Files show in detail pane (depot-only, no localPath)
      useDetailPaneStore.getState().selectFile(node.data.id, '');
    }
  }

  function handleContextMenuEvent(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu({
      depotPath: node.data.id,
      isFolder: node.data.isFolder,
      x: e.clientX,
      y: e.clientY,
    });
  }

  return (
    <div
      style={{ ...style, paddingLeft: (style.paddingLeft as number || 0) + 12 }}
      className={cn(
        'flex items-center gap-2 pr-3 py-1 text-sm overflow-hidden',
        'cursor-pointer hover:bg-accent',
        isSelected && 'bg-blue-900/50'
      )}
      onClick={handleClick}
      onContextMenu={handleContextMenuEvent}
    >
      {/* Icon */}
      {node.data.isDepotRoot ? (
        <Database className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      ) : isFolder ? (
        <>
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground flex-shrink-0 animate-spin" />
          ) : isOpen ? (
            <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
        </>
      ) : (
        <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      )}

      {/* Name */}
      <span className="flex-1 truncate text-foreground">
        {name}
      </span>
    </div>
  );
}
