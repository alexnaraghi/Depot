import { NodeRendererProps } from 'react-arborist';
import { FolderOpen, Folder, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DepotNodeData } from './useDepotTree';

export interface DepotNodeProps extends NodeRendererProps<DepotNodeData> {
  loadingPaths: Set<string>;
}

/**
 * Tree node renderer for depot items in react-arborist
 * Displays folder icons with expand/collapse and loading states
 */
export function DepotNode({ node, style, loadingPaths }: DepotNodeProps) {
  const { name, isFolder } = node.data;
  const isSelected = node.isSelected;
  const isOpen = node.isOpen;
  const isLoading = loadingPaths.has(node.data.id);

  function handleClick() {
    if (isFolder) {
      // Folders toggle expand/collapse
      node.toggle();
    }
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
    >
      {/* Folder icon */}
      {isFolder && (
        <>
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground flex-shrink-0 animate-spin" />
          ) : isOpen ? (
            <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
        </>
      )}

      {/* Folder name */}
      <span className="flex-1 truncate text-foreground">
        {name}
      </span>
    </div>
  );
}
