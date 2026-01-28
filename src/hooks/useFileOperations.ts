import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOperationStore } from '@/store/operation';
import { invokeP4Edit, invokeP4Revert, invokeP4Submit } from '@/lib/tauri';
import toast from 'react-hot-toast';

/**
 * Hook for P4 file operations with state management
 *
 * Provides checkout, revert, and submit operations with:
 * - Operation store integration for status bar feedback
 * - Query invalidation for UI refresh after server confirmation
 * - Toast notifications for user feedback
 * - Output panel logging
 * - Error handling
 */
export function useFileOperations() {
  const queryClient = useQueryClient();
  const { startOperation, completeOperation, addOutputLine } = useOperationStore();

  /**
   * Checkout files for editing
   *
   * @param paths - Depot paths to checkout
   * @param changelist - Optional changelist number (undefined = default)
   * @returns Array of checked out file info
   */
  const checkout = useCallback(async (paths: string[], changelist?: number) => {
    const operationId = `edit-${Date.now()}`;
    startOperation(operationId, `Checking out ${paths.length} file(s)`);

    // Log to output panel
    addOutputLine(`p4 edit ${paths.join(' ')}`, false);

    try {
      const result = await invokeP4Edit(paths, changelist);

      // Log each checked out file
      for (const file of result) {
        addOutputLine(`${file.depot_path}#${file.revision} - opened for ${file.action || 'edit'}`, false);
      }

      completeOperation(true);

      // Invalidate queries to refresh file tree and changelist panel
      await queryClient.invalidateQueries({ queryKey: ['fileTree'] });
      await queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });
      await queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });

      toast.success(`Checked out ${result.length} file(s)`);
      return result;
    } catch (error) {
      addOutputLine(`Error: ${error}`, true);
      completeOperation(false, String(error));
      toast.error(`Checkout failed: ${error}`);
      throw error;
    }
  }, [startOperation, completeOperation, addOutputLine, queryClient]);

  /**
   * Revert files to depot state (discard local changes)
   *
   * @param paths - Depot paths to revert
   * @returns Array of reverted depot paths
   */
  const revert = useCallback(async (paths: string[]) => {
    const operationId = `revert-${Date.now()}`;
    startOperation(operationId, `Reverting ${paths.length} file(s)`);

    // Log to output panel
    addOutputLine(`p4 revert ${paths.join(' ')}`, false);

    try {
      const reverted = await invokeP4Revert(paths);

      // Log each reverted file
      for (const depotPath of reverted) {
        addOutputLine(`${depotPath} - reverted`, false);
      }

      completeOperation(true);

      // Invalidate queries to refresh file tree and changelist panel
      await queryClient.invalidateQueries({ queryKey: ['fileTree'] });
      await queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });
      await queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });

      toast.success(`Reverted ${reverted.length} file(s)`);
      return reverted;
    } catch (error) {
      addOutputLine(`Error: ${error}`, true);
      completeOperation(false, String(error));
      toast.error(`Revert failed: ${error}`);
      throw error;
    }
  }, [startOperation, completeOperation, addOutputLine, queryClient]);

  /**
   * Submit changelist to depot
   *
   * @param changelist - Changelist number to submit
   * @param description - Optional changelist description
   * @returns Submitted changelist number
   */
  const submit = useCallback(async (changelist: number, description?: string) => {
    const operationId = `submit-${Date.now()}`;
    startOperation(operationId, `Submitting changelist ${changelist}`);

    // Log to output panel
    addOutputLine(`p4 submit -c ${changelist}`, false);

    try {
      const submittedCl = await invokeP4Submit(changelist, description);

      addOutputLine(`Change ${submittedCl} submitted.`, false);
      completeOperation(true);

      // Invalidate queries to refresh file tree and changelist panel
      await queryClient.invalidateQueries({ queryKey: ['fileTree'] });
      await queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });
      await queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });

      toast.success(`Submitted as changelist ${submittedCl}`);
      return submittedCl;
    } catch (error) {
      addOutputLine(`Error: ${error}`, true);
      completeOperation(false, String(error));
      toast.error(`Submit failed: ${error}`);
      throw error;
    }
  }, [startOperation, completeOperation, addOutputLine, queryClient]);

  return {
    checkout,
    revert,
    submit,
  };
}
