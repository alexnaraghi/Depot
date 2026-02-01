import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConnectionStore } from '@/stores/connectionStore';
import { invokeP4Depots, invokeP4Dirs } from '@/lib/tauri';

export interface DepotNodeData {
  id: string;           // Depot path (e.g., "//depot/projects")
  name: string;         // Display name (last path segment)
  isFolder: boolean;    // Always true for dirs; files not loaded by default
  children: DepotNodeData[] | null;  // null = not yet loaded, [] = loaded but empty
}

/**
 * Hook for managing depot tree data with lazy loading
 *
 * Fetches depot roots on mount, provides loadChildren function
 * for lazy-loading subdirectories when user expands folders.
 *
 * Uses TanStack Query for caching with 5-minute staleTime.
 */
export function useDepotTree() {
  const { p4port, p4user, p4client, status } = useConnectionStore();
  const isConnected = status === 'connected';

  // Tree data state (managed locally for incremental updates)
  const [treeData, setTreeData] = useState<DepotNodeData[]>([]);

  // Track which paths are currently loading
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  // Fetch depot roots on mount
  const { isLoading, error } = useQuery({
    queryKey: ['depot', 'roots', p4port, p4user],
    queryFn: async () => {
      const depots = await invokeP4Depots(p4port ?? undefined, p4user ?? undefined);

      // Transform depot roots into DepotNodeData
      const roots: DepotNodeData[] = depots.map(depot => ({
        id: `//${depot.name}`,
        name: depot.name,
        isFolder: true,
        children: null, // Not yet loaded
      }));

      setTreeData(roots);
      return roots;
    },
    enabled: isConnected,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  /**
   * Load children for a depot folder path
   * Called when user expands a folder node
   */
  const loadChildren = useCallback(async (depotPath: string) => {
    // Mark as loading
    setLoadingPaths(prev => new Set(prev).add(depotPath));

    try {
      // Query subdirectories
      const dirs = await invokeP4Dirs(
        `${depotPath}/*`,
        false,
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );

      // Transform to DepotNodeData
      const children: DepotNodeData[] = dirs.map(dirPath => {
        // Extract last path segment for display name
        const segments = dirPath.split('/').filter(s => s);
        const name = segments[segments.length - 1];

        return {
          id: dirPath,
          name,
          isFolder: true,
          children: null, // Not yet loaded
        };
      });

      // Update tree data - find the parent node and set its children
      setTreeData(prevTree => {
        const updateNode = (nodes: DepotNodeData[]): DepotNodeData[] => {
          return nodes.map(node => {
            if (node.id === depotPath) {
              // Found the parent - set its children
              return { ...node, children };
            } else if (node.children) {
              // Recursively search children
              return { ...node, children: updateNode(node.children) };
            }
            return node;
          });
        };

        return updateNode(prevTree);
      });
    } catch (err) {
      console.error(`Failed to load children for ${depotPath}:`, err);
      // Set empty children array on error so user can retry by collapsing/expanding
      setTreeData(prevTree => {
        const updateNode = (nodes: DepotNodeData[]): DepotNodeData[] => {
          return nodes.map(node => {
            if (node.id === depotPath) {
              return { ...node, children: [] };
            } else if (node.children) {
              return { ...node, children: updateNode(node.children) };
            }
            return node;
          });
        };
        return updateNode(prevTree);
      });
    } finally {
      // Remove loading state
      setLoadingPaths(prev => {
        const next = new Set(prev);
        next.delete(depotPath);
        return next;
      });
    }
  }, [p4port, p4user, p4client]);

  return {
    treeData,
    isLoading,
    error,
    loadChildren,
    loadingPaths,
  };
}
