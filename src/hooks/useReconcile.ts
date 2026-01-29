import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConnectionStore } from '@/stores/connectionStore';
import { invokeP4ReconcilePreview, invokeP4ReconcileApply, ReconcilePreview } from '@/lib/tauri';
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
  const { p4port, p4user, p4client } = useConnectionStore();

  /**
   * Preview reconcile operation (dry run)
   * Detects files that should be added, edited, or deleted
   */
  const reconcilePreview = useMutation<ReconcilePreview[], Error, void>({
    mutationFn: async () => {
      return invokeP4ReconcilePreview(
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );
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
      return invokeP4ReconcileApply(
        filePaths,
        changelistId,
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );
    },
    onSuccess: (_, { filePaths, changelistId }) => {
      const clTarget = changelistId ? `changelist ${changelistId}` : 'default changelist';
      toast.success(`Reconciled ${filePaths.length} file(s) to ${clTarget}`);
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });
      queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
      queryClient.invalidateQueries({ queryKey: ['p4', 'fstat'] });
    },
    onError: (error) => {
      toast.error(`Reconcile failed: ${error.message}`);
    },
  });

  return {
    reconcilePreview,
    reconcileApply,
  };
}
