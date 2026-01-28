import { useState, useCallback } from 'react';
import { Tree } from 'react-arborist';
import { useFileTree } from './useFileTree';
import { FileNode, FileNodeData } from './FileNode';
import { FileContextMenu } from './FileContextMenu';
import { P4File } from '@/types/p4';
import { Loader2, FolderOpen, AlertCircle } from 'lucide-react';

/**
 * Main file tree component
 *
 * Displays workspace files in hierarchical tree with:
 * - Virtualized rendering via react-arborist
 * - Context menu on right-click (files only)
 * - Loading/error/empty states
 * - File status icons and revision numbers
 */
export function FileTree() {
  const { tree, isLoading, error, refetch } = useFileTree();
  const [contextMenu, setContextMenu] = useState<{
    file: P4File;
    x: number;
    y: number;
  } | null>(null);

  // Attach onContextMenu handler to tree data
  const enhancedTree = useCallback(
    (data: FileNodeData[]): FileNodeData[] => {
      return data.map((node) => ({
        ...node,
        onContextMenu: handleContextMenu,
        children: node.children ? enhancedTree(node.children) : undefined,
      }));
    },
    []
  );

  function handleContextMenu(event: React.MouseEvent, file: P4File) {
    event.preventDefault();
    setContextMenu({
      file,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Loading workspace files...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-red-400 p-4">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm text-center">Failed to load workspace files</p>
        <p className="text-xs text-slate-500 text-center">{String(error)}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm text-slate-200 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
        <FolderOpen className="w-8 h-8" />
        <p className="text-sm">No files in workspace</p>
      </div>
    );
  }

  // Tree view
  return (
    <div className="h-full w-full bg-slate-950">
      <Tree
        data={enhancedTree(tree)}
        idAccessor="id"
        indent={16}
        rowHeight={28}
        overscanCount={10}
        disableDrag
        disableDrop
        disableEdit
      >
        {FileNode}
      </Tree>

      {/* Context menu */}
      {contextMenu && (
        <FileContextMenu
          file={contextMenu.file}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
