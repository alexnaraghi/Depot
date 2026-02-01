import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConnectionStore } from '@/stores/connectionStore';
import { invokeP4Depots, invokeP4Dirs, invokeP4Files } from '@/lib/tauri';

export interface DepotNodeData {
  id: string;           // Depot path (e.g., "//depot/projects")
  name: string;         // Display name (last path segment)
  isFolder: boolean;
  children?: DepotNodeData[];  // undefined = leaf, [] = folder (empty or unloaded)
}

/**
 * Hook for managing depot tree data with lazy loading.
 *
 * Folders always have children array (empty until loaded).
 * Files have no children property (leaves).
 * Track loaded paths separately to know when to fetch.
 */
export function useDepotTree() {
  const { p4port, p4user, p4client, status } = useConnectionStore();
  const isConnected = status === 'connected';

  const [treeData, setTreeData] = useState<DepotNodeData[]>([]);
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const loadedPaths = useRef<Set<string>>(new Set());

  // Fetch depot roots on mount
  const { isLoading, error } = useQuery({
    queryKey: ['depot', 'roots', p4port, p4user],
    queryFn: async () => {
      const depots = await invokeP4Depots(p4port ?? undefined, p4user ?? undefined);

      const roots: DepotNodeData[] = depots.map(depot => ({
        id: `//${depot.name}`,
        name: depot.name,
        isFolder: true,
        children: [], // Empty until expanded
      }));

      loadedPaths.current.clear();
      setTreeData(roots);
      return roots;
    },
    enabled: isConnected,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const loadChildren = useCallback(async (depotPath: string) => {
    if (loadedPaths.current.has(depotPath)) return;

    setLoadingPaths(prev => new Set(prev).add(depotPath));

    try {
      const [dirs, fileResults] = await Promise.all([
        invokeP4Dirs(
          `${depotPath}/*`,
          false,
          p4port ?? undefined,
          p4user ?? undefined,
          p4client ?? undefined
        ),
        invokeP4Files(
          `${depotPath}/*`,
          1000,
          p4port ?? undefined,
          p4user ?? undefined,
          p4client ?? undefined
        ),
      ]);

      const dirNodes: DepotNodeData[] = dirs.map(dirPath => {
        const segments = dirPath.split('/').filter(s => s);
        const name = segments[segments.length - 1];
        return { id: dirPath, name, isFolder: true, children: [] };
      });

      const fileNodes: DepotNodeData[] = fileResults
        .filter(f => f.action !== 'delete')
        .map(f => {
          const segments = f.depot_path.split('/').filter(s => s);
          const name = segments[segments.length - 1];
          return { id: f.depot_path, name, isFolder: false };
        });

      const children = [...dirNodes, ...fileNodes];
      loadedPaths.current.add(depotPath);

      setTreeData(prevTree => {
        const updateNode = (nodes: DepotNodeData[]): DepotNodeData[] => {
          return nodes.map(node => {
            if (node.id === depotPath) {
              return { ...node, children };
            } else if (node.children && node.children.length > 0) {
              return { ...node, children: updateNode(node.children) };
            }
            return node;
          });
        };
        return updateNode(prevTree);
      });
    } catch (err) {
      console.error(`Failed to load children for ${depotPath}:`, err);
    } finally {
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
