import { useState, useCallback, useRef, useEffect } from 'react';
import { Tree } from 'react-arborist';
import { useFileTree } from './useFileTree';
import { FileNode, FileNodeData } from './FileNode';
import { FileContextMenu } from './FileContextMenu';
import { useDiff } from '@/hooks/useDiff';
import { useFileOperations } from '@/hooks/useFileOperations';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { P4File } from '@/types/p4';
import { AlertCircle } from 'lucide-react';
import { useDndManager } from '@/contexts/DndContext';

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
  const dndManager = useDndManager();
  const [contextMenu, setContextMenu] = useState<{
    file: P4File;
    x: number;
    y: number;
  } | null>(null);
  const selectedFile = useFileTreeStore(s => s.selectedFile);
  const setSelectedFile = useFileTreeStore(s => s.setSelectedFile);
  const { diffAgainstWorkspace } = useDiff();
  const { checkout, revert } = useFileOperations();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);

  // Measure container height and update on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        setContainerHeight(height);
      }
    };

    // Initial measurement
    updateHeight();

    // Update on window resize
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Listen for context-sensitive shortcut events
  useEffect(() => {
    const handleDiffSelected = () => {
      if (selectedFile) {
        handleDiffAgainstHave(selectedFile.depotPath, selectedFile.localPath);
      }
    };

    const handleHistorySelected = () => {
      if (selectedFile) {
        handleShowHistory(selectedFile.depotPath, selectedFile.localPath);
      }
    };

    const handleRevertSelected = () => {
      if (selectedFile) {
        revert([selectedFile.depotPath]);
      }
    };

    const handleCheckoutSelected = () => {
      if (selectedFile) {
        checkout([selectedFile.depotPath]);
      }
    };

    window.addEventListener('p4now:diff-selected', handleDiffSelected);
    window.addEventListener('p4now:history-selected', handleHistorySelected);
    window.addEventListener('p4now:revert-selected', handleRevertSelected);
    window.addEventListener('p4now:checkout-selected', handleCheckoutSelected);

    return () => {
      window.removeEventListener('p4now:diff-selected', handleDiffSelected);
      window.removeEventListener('p4now:history-selected', handleHistorySelected);
      window.removeEventListener('p4now:revert-selected', handleRevertSelected);
      window.removeEventListener('p4now:checkout-selected', handleCheckoutSelected);
    };
  }, [selectedFile, checkout, revert]);

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
    setSelectedFile(file); // Track selected file for keyboard shortcuts
    setContextMenu({
      file,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function handleShowHistory(depotPath: string, localPath: string) {
    // Navigate to file detail view instead of opening dialog
    useDetailPaneStore.getState().selectFile(depotPath, localPath);
  }

  function handleDiffAgainstHave(depotPath: string, localPath: string) {
    // For "Diff against Have", we need to get the have revision from the file
    // The "have" revision is the file's current revision (what's on disk)
    // We'll diff the local file against the head revision
    const file = findFileInTree(depotPath);
    if (file) {
      // Diff workspace file against the have revision (file.revision is the have rev)
      diffAgainstWorkspace(depotPath, localPath, file.revision);
    }
  }

  // Helper to find file in tree by depot path
  function findFileInTree(depotPath: string): P4File | null {
    function search(nodes: FileNodeData[]): P4File | null {
      for (const node of nodes) {
        if (node.file && node.file.depotPath === depotPath) {
          return node.file;
        }
        if (node.children) {
          const found = search(node.children);
          if (found) return found;
        }
      }
      return null;
    }
    return search(tree);
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 16}px` }}>
            <div className="w-4 h-4 bg-slate-700 rounded animate-pulse" />
            <div className="h-3.5 bg-slate-700 rounded animate-pulse" style={{ width: `${60 + (i * 7) % 40}%` }} />
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-red-400 p-4">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm text-center">Failed to load workspace files</p>
        <p className="text-xs text-muted-foreground text-center">{String(error)}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-accent hover:bg-accent/80 rounded text-sm text-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">No files in workspace</p>
      </div>
    );
  }

  // Tree view
  return (
    <div ref={containerRef} className="h-full w-full bg-background tree-container" data-testid="file-tree">
      <Tree
        data={enhancedTree(tree)}
        idAccessor="id"
        indent={16}
        rowHeight={28}
        height={containerHeight}
        overscanCount={10}
        disableDrag
        disableDrop
        disableEdit
        dndManager={dndManager}
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
          onShowHistory={handleShowHistory}
          onDiffAgainstHave={handleDiffAgainstHave}
        />
      )}
    </div>
  );
}
