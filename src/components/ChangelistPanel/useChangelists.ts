import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChangelistStore } from '@/stores/changelistStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { invokeP4Changes, invokeP4Opened, invokeP4DescribeShelvedBatch, type P4ShelvedFile, type ShelvedBatchProgress } from '@/lib/tauri';
import { useOperationStore } from '@/store/operation';
import { getVerboseLogging, getAutoRefreshInterval } from '@/lib/settings';
import { useWindowFocus } from '@/hooks/useWindowFocus';
import { buildChangelistTree, ChangelistTreeNode } from '@/utils/treeBuilder';
import { P4Changelist, P4File, FileStatus } from '@/types/p4';
import toast from 'react-hot-toast';

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
  const { currentOperation } = useOperationStore();
  const isWindowFocused = useWindowFocus();
  const isConnected = status === 'connected';

  // Load auto-refresh interval from settings
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);
  useEffect(() => {
    getAutoRefreshInterval().then(setAutoRefreshInterval);
  }, []);

  // Auto-refresh is active when:
  // 1. Connected to P4
  // 2. No active operation
  // 3. Window is focused
  // 4. User has enabled auto-refresh (interval > 0)
  const isAutoRefreshActive =
    isConnected &&
    !currentOperation &&
    isWindowFocused &&
    autoRefreshInterval > 0;

  // Compute refetch interval value (number | false)
  const refetchIntervalValue: number | false = isAutoRefreshActive ? autoRefreshInterval : false;

  // Load pending changelists (only when connected)
  const { data: clData, isLoading: clLoading } = useQuery({
    queryKey: ['p4', 'changes', 'pending', p4port, p4user, p4client],
    queryFn: async () => {
      const { addOutputLine } = useOperationStore.getState();
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine('p4 changes -s pending', false);
      const result = await invokeP4Changes('pending');
      if (verbose) addOutputLine(`... returned ${result.length} items`, false);
      return result;
    },
    refetchOnWindowFocus: false,
    staleTime: 30000,
    enabled: isConnected,
    refetchInterval: refetchIntervalValue,
  });

  // Load opened files (to associate with changelists) (only when connected)
  const { data: openedData, isLoading: openedLoading } = useQuery({
    queryKey: ['p4', 'opened', p4port, p4user, p4client],
    queryFn: async () => {
      const { addOutputLine } = useOperationStore.getState();
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine('p4 opened', false);
      const result = await invokeP4Opened();
      if (verbose) addOutputLine(`... returned ${result.length} items`, false);
      return result;
    },
    refetchOnWindowFocus: false,
    staleTime: 30000,
    enabled: isConnected,
    refetchInterval: refetchIntervalValue,
  });

  // Clear store when disconnected (bypass setChangelists which preserves default CL)
  useEffect(() => {
    if (!isConnected) {
      useChangelistStore.setState({ changelists: new Map(), isLoading: false });
    }
  }, [isConnected]);

  // Merge changelist data with opened files
  useEffect(() => {
    if (!isConnected || !clData || !openedData) return;

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

  // Query shelved files for all numbered changelists in batch
  const { data: shelvedFilesMap = new Map() } = useQuery({
    queryKey: ['p4', 'shelved-batch', numberedClIds.join(',')],
    queryFn: async () => {
      if (numberedClIds.length === 0) return new Map<number, P4ShelvedFile[]>();

      const { startOperation, updateProgress, completeOperation, addOutputLine } = useOperationStore.getState();
      const results = new Map<number, P4ShelvedFile[]>();
      const verbose = await getVerboseLogging();

      // Start operation for progress display
      startOperation('shelved-batch', `describe -S ${numberedClIds.length} CLs`);
      if (verbose) addOutputLine(`p4 describe -S ${numberedClIds.join(' ')}`, false);

      try {
        const processId = await invokeP4DescribeShelvedBatch(
          numberedClIds,
          (progress: ShelvedBatchProgress) => {
            if (progress.type === 'progress') {
              const pct = Math.round((progress.loaded / progress.total) * 100);
              updateProgress(pct, `Loading shelved files... (${progress.loaded}/${progress.total})`);
            } else if (progress.type === 'result') {
              if (progress.result.files) {
                results.set(progress.result.changelistId, progress.result.files);
              }
            } else if (progress.type === 'complete') {
              if (progress.errorCount > 0 && !progress.cancelled) {
                toast(`Loaded ${progress.successCount} of ${progress.successCount + progress.errorCount} changelists`, {
                  icon: '\u26A0\uFE0F', // Warning emoji
                  duration: 4000,
                });
              }
              if (verbose) {
                addOutputLine(`... loaded ${progress.successCount} CLs${progress.errorCount > 0 ? `, ${progress.errorCount} errors` : ''}`, false);
              }
              completeOperation(progress.errorCount === 0 || progress.cancelled);
            }
          }
        );

        // Store processId for cancellation - this wires to the cancel button in status bar
        // via existing useOperationStore pattern (cancel button calls ProcessManager.cancel with this ID)
        useOperationStore.getState().setProcessId(processId);

        // Wait briefly for all results to arrive (batch completes quickly)
        // The Channel delivers results, we just need to return the accumulated map
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        if (verbose) addOutputLine(`... error: ${error}`, true);
        completeOperation(false, String(error));
      }

      return results;
    },
    enabled: isConnected && numberedClIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchInterval: refetchIntervalValue,
  });

  // Build tree from store
  const treeData = useMemo(() => {
    const clArray = Array.from(changelists.values());
    // Always show default CL (id === 0), and numbered CLs with files or description
    const visible = clArray.filter(cl => cl.id === 0 || cl.fileCount > 0 || cl.description || shelvedFilesMap.has(cl.id));
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
