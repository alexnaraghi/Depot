import { useRef, useEffect, useState, useCallback } from 'react';
import { Tree } from 'react-arborist';
import { useDepotTree } from './useDepotTree';
import { DepotNode } from './DepotNode';
import { DepotContextMenu } from './DepotContextMenu';
import { AlertCircle } from 'lucide-react';
import { useDndManager } from '@/contexts/DndContext';

/**
 * Main depot browser component
 *
 * Displays depot roots in a virtualized tree with lazy-loading
 * subdirectories on expand. Does not apply workspace search filter.
 */
export function DepotBrowser() {
  const { treeData, isLoading, error, loadChildren, loadingPaths } = useDepotTree();
  const dndManager = useDndManager();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);
  const [contextMenu, setContextMenu] = useState<{ depotPath: string; isFolder: boolean; x: number; y: number } | null>(null);

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
    const resizeObserver = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Handle node toggle - load children on expand
  const handleToggle = useCallback((nodeId: string) => {
    loadChildren(nodeId); // loadChildren already skips if already loaded
  }, [loadChildren]);

  // Handle context menu
  const handleContextMenu = useCallback((menu: { depotPath: string; isFolder: boolean; x: number; y: number }) => {
    setContextMenu(menu);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div ref={containerRef} className="flex flex-col h-full bg-background">
        <div className="p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 2) * 16}px` }}>
              <div className="w-4 h-4 bg-slate-700 rounded animate-pulse" />
              <div className="h-3.5 bg-slate-700 rounded animate-pulse" style={{ width: `${50 + (i * 5) % 30}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div ref={containerRef} className="flex flex-col h-full bg-background">
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-red-400 p-4">
          <AlertCircle className="w-8 h-8" />
          <p className="text-sm text-center">Could not load depots</p>
          <p className="text-xs text-muted-foreground text-center">{String(error)}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (treeData.length === 0) {
    return (
      <div ref={containerRef} className="flex flex-col h-full bg-background">
        <div className="flex items-center justify-center flex-1">
          <p className="text-sm text-muted-foreground">No depots found</p>
        </div>
      </div>
    );
  }

  // Tree view
  return (
    <div ref={containerRef} className="h-full w-full bg-background">
      <Tree
        data={treeData}
        idAccessor="id"
        width="100%"
        indent={16}
        rowHeight={28}
        height={containerHeight}
        overscanCount={10}
        disableDrag
        disableDrop
        disableEdit
        dndManager={dndManager}
        onToggle={handleToggle}
      >
        {(props) => <DepotNode {...props} loadingPaths={loadingPaths} onContextMenu={handleContextMenu} />}
      </Tree>

      {/* Context menu */}
      {contextMenu && (
        <DepotContextMenu
          depotPath={contextMenu.depotPath}
          isFolder={contextMenu.isFolder}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
