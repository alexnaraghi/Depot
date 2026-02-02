import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConnectionStore } from '@/stores/connectionStore';
import { invokeP4Depots, invokeP4Dirs, invokeP4Files } from '@/lib/tauri';

export interface DepotNodeData {
  id: string;           // Depot path (e.g., "//depot/projects")
  name: string;         // Display name (last path segment)
  isFolder: boolean;
  isDepotRoot?: boolean;
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
        isDepotRoot: true,
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

  // Clear local state when disconnected
  useEffect(() => {
    if (!isConnected) {
      setTreeData([]);
      loadedPaths.current.clear();
    }
  }, [isConnected]);

  const loadChildren = useCallback(async (depotPath: string) => {
    if (loadedPaths.current.has(depotPath)) return;
    loadedPaths.current.add(depotPath); // Mark immediately to prevent duplicate calls

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
          // Tauri serializes Rust snake_case as camelCase
          const path = (f as any).depotPath ?? (f as any).depot_path ?? '';
          const segments = path.split('/').filter((s: string) => s);
          const name = segments[segments.length - 1] || 'unknown';
          return { id: path, name, isFolder: false };
        });
      const children = [...dirNodes, ...fileNodes];

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
