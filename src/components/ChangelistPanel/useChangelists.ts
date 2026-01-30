import { useEffect, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useChangelistStore } from '@/stores/changelistStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { invokeP4Changes, invokeP4Opened, invokeP4DescribeShelved, type P4ShelvedFile } from '@/lib/tauri';
import { useOperationStore } from '@/store/operation';
import { getVerboseLogging } from '@/lib/settings';
import { buildChangelistTree, ChangelistTreeNode } from '@/utils/treeBuilder';
import { P4Changelist, P4File, FileStatus } from '@/types/p4';

/**
 * Hook for loading and managing changelist data
 *
 * Queries both changelists (p4 changes) and opened files (p4 opened),
 * then merges them to associate files with their changelists.
 *
 * Default changelist (id=0) always exists.
 */
export function useChangelists(): {
  treeData: ChangelistTreeNode[];
  isLoading: boolean;
  changelists: P4Changelist[];
} {
  const { changelists, setChangelists } = useChangelistStore();
  const { status, p4port, p4user, p4client } = useConnectionStore();
  const isConnected = status === 'connected';

  // Load pending changelists (only when connected)
  const { data: clData, isLoading: clLoading } = useQuery({
    queryKey: ['p4', 'changes', 'pending', p4port, p4user, p4client],
    queryFn: async () => {
      const { addOutputLine } = useOperationStore.getState();
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine('p4 changes -s pending', false);
      const result = await invokeP4Changes('pending', p4port ?? undefined, p4user ?? undefined, p4client ?? undefined);
      if (verbose) addOutputLine(`... returned ${result.length} items`, false);
      return result;
    },
    refetchOnWindowFocus: false,
    staleTime: 30000,
    enabled: isConnected,
  });

  // Load opened files (to associate with changelists) (only when connected)
  const { data: openedData, isLoading: openedLoading } = useQuery({
    queryKey: ['p4', 'opened', p4port, p4user, p4client],
    queryFn: async () => {
      const { addOutputLine } = useOperationStore.getState();
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine('p4 opened', false);
      const result = await invokeP4Opened(p4port ?? undefined, p4user ?? undefined, p4client ?? undefined);
      if (verbose) addOutputLine(`... returned ${result.length} items`, false);
      return result;
    },
    refetchOnWindowFocus: false,
    staleTime: 30000,
    enabled: isConnected,
  });

  // Merge changelist data with opened files
  useEffect(() => {
    if (!clData || !openedData) return;

    const clMap = new Map<number, P4Changelist>();

    // Initialize default changelist
    clMap.set(0, {
      id: 0,
      description: 'Default changelist',
      user: '',
      client: '',
      status: 'pending',
      files: [],
      fileCount: 0,
    });

    // Add named changelists
    for (const cl of clData) {
      clMap.set(cl.id, {
        id: cl.id,
        description: cl.description,
        user: cl.user,
        client: cl.client,
        status: cl.status as 'pending' | 'submitted' | 'shelved',
        files: [],
        fileCount: 0,
      });
    }

    // Associate files with changelists
    for (const file of openedData) {
      const clId = file.changelist ?? 0;
      const cl = clMap.get(clId);
      if (cl) {
        const p4File: P4File = {
          depotPath: file.depot_path,
          localPath: file.local_path,
          status: mapStatus(file.action),
          action: file.action as any,
          revision: file.revision,
          headRevision: file.head_revision,
          changelist: file.changelist,
          fileType: file.file_type,
          isDirectory: false,
        };
        cl.files.push(p4File);
        cl.fileCount++;
      }
    }

    setChangelists(Array.from(clMap.values()));
  }, [clData, openedData, setChangelists]);

  // Get numbered changelist IDs for shelved file queries
  const numberedClIds = useMemo(() => {
    return Array.from(changelists.values())
      .filter(cl => cl.id > 0)
      .map(cl => cl.id);
  }, [changelists]);

  // Query shelved files for each numbered changelist
  const shelvedQueries = useQueries({
    queries: numberedClIds.map(clId => ({
      queryKey: ['p4', 'shelved', clId],
      queryFn: async () => {
        const { addOutputLine } = useOperationStore.getState();
        const verbose = await getVerboseLogging();
        if (verbose) addOutputLine(`p4 describe -S ${clId}`, false);
        const result = await invokeP4DescribeShelved(
          clId,
          p4port ?? undefined,
          p4user ?? undefined,
          p4client ?? undefined
        );
        if (verbose) addOutputLine(`... returned ${result.length} items`, false);
        return result;
      },
      enabled: isConnected,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    })),
  });

  // Build shelved files map from query results
  const shelvedFilesMap = useMemo(() => {
    const map = new Map<number, P4ShelvedFile[]>();
    numberedClIds.forEach((clId, index) => {
      const query = shelvedQueries[index];
      if (query?.data && query.data.length > 0) {
        map.set(clId, query.data);
      }
    });
    return map;
  }, [numberedClIds, shelvedQueries]);

  // Build tree from store
  const treeData = useMemo(() => {
    const clArray = Array.from(changelists.values());
    // Always show default CL (id === 0), and numbered CLs with files or description
    const visible = clArray.filter(cl => cl.id === 0 || cl.fileCount > 0 || cl.description);
    // Sort: default CL first, then numbered CLs by ID ascending
    const sorted = visible.sort((a, b) => {
      if (a.id === 0) return -1;
      if (b.id === 0) return 1;
      return a.id - b.id;
    });
    return buildChangelistTree(sorted, shelvedFilesMap);
  }, [changelists, shelvedFilesMap]);

  const isLoading = clLoading || openedLoading;

  return {
    treeData,
    isLoading,
    changelists: Array.from(changelists.values()),
  };
}

/**
 * Map P4 action to FileStatus enum
 */
function mapStatus(action?: string): FileStatus {
  if (!action) return FileStatus.Synced;

  switch (action) {
    case 'edit':
      return FileStatus.CheckedOut;
    case 'add':
      return FileStatus.Added;
    case 'delete':
      return FileStatus.Deleted;
    default:
      return FileStatus.CheckedOut;
  }
}
