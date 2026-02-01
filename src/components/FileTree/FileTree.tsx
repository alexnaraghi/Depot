import { useState, useCallback, useRef, useEffect, useDeferredValue } from 'react';
import { Tree } from 'react-arborist';
import { useFileTree } from './useFileTree';
import { FileNode, FileNodeData } from './FileNode';
import { FileContextMenu } from './FileContextMenu';
import { useDiff } from '@/hooks/useDiff';
import { useFileOperations } from '@/hooks/useFileOperations';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { useSearchFilterStore } from '@/stores/searchFilterStore';
import { P4File } from '@/types/p4';
import { AlertCircle } from 'lucide-react';
import { useDndManager } from '@/contexts/DndContext';
import createFuzzySearch from '@nozbe/microfuzz';
import { cn } from '@/lib/utils';

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

  // Search filtering
  const filterTerm = useSearchFilterStore(s => s.filterTerm);
  const isActive = useSearchFilterStore(s => s.isActive);
  const setFileTreeMatchCount = useSearchFilterStore(s => s.setFileTreeMatchCount);
  const deferredFilterTerm = useDeferredValue(filterTerm);

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

  // Apply fuzzy filtering to tree
  const filterResults = useCallback((data: FileNodeData[], term: string) => {
    if (!term.trim()) {
      // No filter - return all nodes as matching with no highlights
      return {
        tree: data,
        matchCount: 0,
      };
    }

    // Collect all file paths for fuzzy searching
    const collectFiles = (nodes: FileNodeData[]): Array<{ path: string; name: string; node: FileNodeData }> => {
      const files: Array<{ path: string; name: string; node: FileNodeData }> = [];
      for (const node of nodes) {
        if (!node.isFolder && node.file) {
          // Match against file name (last segment)
          const fileName = node.name;
          files.push({ path: node.file.depotPath, name: fileName, node });
        }
        if (node.children) {
          files.push(...collectFiles(node.children));
        }
      }
      return files;
    };

    const allFiles = collectFiles(data);

    // Create fuzzy searcher over file metadata objects
    const fuzzySearch = createFuzzySearch(allFiles, { getText: (item) => [item.name] });
    const matchResults = fuzzySearch(term);

    // Build set of matching depot paths and their highlight ranges
    const matchMap = new Map<string, [number, number][]>();
    for (const result of matchResults) {
      // result.item is the file object
      const file = result.item;
      // matches is FuzzyMatches = Array<HighlightRanges | null>
      // For single-string matching, we just use the first element
      const highlightRanges = result.matches[0];
      if (highlightRanges) {
        matchMap.set(file.path, highlightRanges);
      }
    }

    // Recursively mark nodes as dimmed or highlighted
    const applyFilter = (nodes: FileNodeData[]): FileNodeData[] => {
      return nodes.map(node => {
        if (node.isFolder) {
          // Folder: recursively process children
          const filteredChildren = node.children ? applyFilter(node.children) : undefined;
          // Folder is dimmed if ALL its children are dimmed
          const allChildrenDimmed = filteredChildren && filteredChildren.length > 0
            && filteredChildren.every(child => child.dimmed);
          return {
            ...node,
            children: filteredChildren,
            dimmed: allChildrenDimmed,
          };
        } else {
          // File: check if it matches
          const depotPath = node.file?.depotPath;
          if (depotPath && matchMap.has(depotPath)) {
            return {
              ...node,
              dimmed: false,
              highlightRanges: matchMap.get(depotPath),
            };
          } else {
            return {
              ...node,
              dimmed: true,
            };
          }
        }
      });
    };

    return {
      tree: applyFilter(data),
      matchCount: matchResults.length,
    };
  }, []);

  // Apply filter and report match count
  const { tree: filteredTree, matchCount } = filterResults(tree, deferredFilterTerm);

  useEffect(() => {
    setFileTreeMatchCount(matchCount);
  }, [matchCount, setFileTreeMatchCount]);

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
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center justify-between px-4 py-2 bg-secondary/50">
          <h2 className="text-lg font-semibold">Workspace</h2>
        </div>
        <div className="p-3 space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 16}px` }}>
              <div className="w-4 h-4 bg-slate-700 rounded animate-pulse" />
              <div className="h-3.5 bg-slate-700 rounded animate-pulse" style={{ width: `${60 + (i * 7) % 40}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center justify-between px-4 py-2 bg-secondary/50">
          <h2 className="text-lg font-semibold">Workspace</h2>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-red-400 p-4">
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
      </div>
    );
  }

  // Empty state
  if (tree.length === 0) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center justify-between px-4 py-2 bg-secondary/50">
          <h2 className="text-lg font-semibold">Workspace</h2>
        </div>
        <div className="flex items-center justify-center flex-1">
          <p className="text-sm text-muted-foreground">No files in workspace</p>
        </div>
      </div>
    );
  }

  // Tree view
  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full w-full bg-background tree-container flex flex-col",
        isActive && "bg-blue-950/20"
      )}
      data-testid="file-tree"
    >
      <div className="flex items-center justify-between px-4 py-2 bg-secondary/50">
        <h2 className="text-lg font-semibold">Local</h2>
      </div>
      <div className="flex-1 overflow-hidden">
        <Tree
          data={enhancedTree(filteredTree)}
          idAccessor="id"
          width="100%"
          indent={16}
          rowHeight={32}
          height={containerHeight}
          overscanCount={10}
          disableDrag
          disableDrop
          disableEdit
          dndManager={dndManager}
        >
          {FileNode}
        </Tree>
      </div>

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
