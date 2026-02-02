import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useConnectionStore } from '@/stores/connectionStore';
import { invokeP4ReconcilePreview, invokeP4ReconcileApply, invokeP4Info, ReconcilePreview } from '@/lib/tauri';
import { useOperationStore } from '@/store/operation';
import { getVerboseLogging } from '@/lib/settings';
import toast from 'react-hot-toast';

/**
 * Hook for P4 reconcile operations
 *
 * Provides:
 * - reconcilePreview: Scan workspace for offline changes (dry run)
 * - reconcileApply: Apply reconcile to selected files with optional target changelist
 */
export function useReconcile() {
  const queryClient = useQueryClient();
  const { status, p4port, p4user, p4client } = useConnectionStore();
  const isConnected = status === 'connected';

  // Get client info for depot path (only when connected)
  const { data: clientInfo } = useQuery({
    queryKey: ['p4Info', p4port, p4user, p4client],
    queryFn: async () => {
      const { addOutputLine } = useOperationStore.getState();
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine('p4 info', false);
      const result = await invokeP4Info();
      if (verbose) addOutputLine('... ok', false);
      return result;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: isConnected,
  });

  // Build depot path for reconcile (e.g., "//stream/main/...")
  const depotPath = clientInfo?.client_stream
    ? `${clientInfo.client_stream}/...`
    : undefined;

  /**
   * Preview reconcile operation (dry run)
   * Detects files that should be added, edited, or deleted
   */
  const reconcilePreview = useMutation<ReconcilePreview[], Error, void>({
    mutationFn: async () => {
      const { addOutputLine } = useOperationStore.getState();
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine('p4 reconcile -n', false);
      const result = await invokeP4ReconcilePreview(depotPath);
      if (verbose) addOutputLine(`... returned ${result.length} items`, false);
      return result;
    },
  });

  /**
   * Apply reconcile to selected files
   * @param filePaths - Depot paths to reconcile
   * @param changelistId - Optional target changelist (undefined = default)
   */
  const reconcileApply = useMutation<
    string,
    Error,
    { filePaths: string[]; changelistId?: number }
  >({
    mutationFn: async ({ filePaths, changelistId }) => {
      const { addOutputLine } = useOperationStore.getState();
      addOutputLine(`p4 reconcile ${filePaths.join(' ')}`, false);
      return invokeP4ReconcileApply(filePaths, changelistId);
    },
    onSuccess: (result, { changelistId }) => {
      const { addOutputLine } = useOperationStore.getState();
      addOutputLine(result, false);
      const clTarget = changelistId ? `changelist ${changelistId}` : 'default changelist';
      const fileCount = result.trim().split('\n').filter(l => l.trim().length > 0).length;
      toast.success(`Reconciled ${fileCount} file(s) to ${clTarget}`);
      // Invalidate queries to refresh UI
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] }),
        queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] }),
        queryClient.invalidateQueries({ queryKey: ['p4', 'fstat'] }),
      ]);
    },
    onError: (error) => {
      const { addOutputLine } = useOperationStore.getState();
      addOutputLine(`Error: ${error}`, true);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Reconcile failed: ${msg}`);
    },
  });

  return {
    reconcilePreview,
    reconcileApply,
  };
}
