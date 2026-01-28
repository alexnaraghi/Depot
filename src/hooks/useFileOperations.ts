import { useCallback } from 'react';
import { useOperationStore } from '@/store/operation';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { invokeP4Edit, invokeP4Revert, invokeP4Submit } from '@/lib/tauri';
import toast from 'react-hot-toast';
import { FileStatus } from '@/types/p4';

/**
 * Hook for P4 file operations with state management
 *
 * Provides checkout, revert, and submit operations with:
 * - Operation store integration for status bar feedback
 * - File tree store updates after server confirmation
 * - Toast notifications for user feedback
 * - Error handling
 */
export function useFileOperations() {
  const { startOperation, completeOperation } = useOperationStore();
  const { updateFile } = useFileTreeStore();

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

    try {
      const result = await invokeP4Edit(paths, changelist);

      // Update store with new file status (after server confirmation)
      for (const file of result) {
        updateFile(file.depot_path, {
          status: FileStatus.CheckedOut,
          action: file.action as any,
          changelist: file.changelist,
        });
      }

      completeOperation(true);
      toast.success(`Checked out ${result.length} file(s)`);
      return result;
    } catch (error) {
      completeOperation(false, String(error));
      toast.error(`Checkout failed: ${error}`);
      throw error;
    }
  }, [startOperation, completeOperation, updateFile]);

  /**
   * Revert files to depot state (discard local changes)
   *
   * @param paths - Depot paths to revert
   * @returns Array of reverted depot paths
   */
  const revert = useCallback(async (paths: string[]) => {
    const operationId = `revert-${Date.now()}`;
    startOperation(operationId, `Reverting ${paths.length} file(s)`);

    try {
      const reverted = await invokeP4Revert(paths);

      // Update store: reverted files are now synced
      for (const depotPath of reverted) {
        updateFile(depotPath, {
          status: FileStatus.Synced,
          action: undefined,
          changelist: undefined,
        });
      }

      completeOperation(true);
      toast.success(`Reverted ${reverted.length} file(s)`);
      return reverted;
    } catch (error) {
      completeOperation(false, String(error));
      toast.error(`Revert failed: ${error}`);
      throw error;
    }
  }, [startOperation, completeOperation, updateFile]);

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

    try {
      const submittedCl = await invokeP4Submit(changelist, description);
      completeOperation(true);
      toast.success(`Submitted as changelist ${submittedCl}`);
      return submittedCl;
    } catch (error) {
      completeOperation(false, String(error));
      toast.error(`Submit failed: ${error}`);
      throw error;
    }
  }, [startOperation, completeOperation]);

  return {
    checkout,
    revert,
    submit,
  };
}
