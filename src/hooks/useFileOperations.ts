import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOperationStore } from '@/store/operation';
import { invokeP4Edit, invokeP4Revert, invokeP4Submit } from '@/lib/tauri';
import toast from 'react-hot-toast';

interface RunOperationOptions<T> {
  operationId: string;
  operationName: string;
  command: string;
  fn: () => Promise<T>;
  onSuccess?: (result: T) => void;
  successMessage: string | ((result: T) => string);
  errorMessage: string;
  invalidateKeys: string[][];
}

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
   * Helper to run an operation with standard boilerplate
   * - Creates operation ID and starts operation
   * - Logs command to output panel
   * - Executes operation function
   * - Logs success output
   * - Completes operation
   * - Invalidates queries
   * - Shows toast notification
   * - Handles errors with logging and toast
   */
  const runOperation = useCallback(async <T,>(options: RunOperationOptions<T>): Promise<T> => {
    const {
      operationId,
      operationName,
      command,
      fn,
      onSuccess,
      successMessage,
      errorMessage,
      invalidateKeys,
    } = options;

    startOperation(operationId, operationName);
    addOutputLine(command, false);

    try {
      const result = await fn();

      // Call success callback if provided (for logging individual results)
      if (onSuccess) {
        onSuccess(result);
      }

      completeOperation(true);

      // Invalidate queries to refresh UI
      await Promise.all(
        invalidateKeys.map(key => queryClient.invalidateQueries({ queryKey: key }))
      );

      const message = typeof successMessage === 'function' ? successMessage(result) : successMessage;
      toast.success(message);

      return result;
    } catch (error) {
      addOutputLine(`Error: ${error}`, true);
      completeOperation(false, String(error));
      toast.error(`${errorMessage}: ${error}`);
      throw error;
    }
  }, [startOperation, completeOperation, addOutputLine, queryClient]);

  /**
   * Checkout files for editing
   *
   * @param paths - Depot paths to checkout
   * @param changelist - Optional changelist number (undefined = default)
   * @returns Array of checked out file info
   */
  const checkout = useCallback(async (paths: string[], changelist?: number) => {
    return runOperation({
      operationId: `edit-${Date.now()}`,
      operationName: `Checking out ${paths.length} file(s)`,
      command: `p4 edit ${paths.join(' ')}`,
      fn: () => invokeP4Edit(paths, changelist),
      onSuccess: (result) => {
        // Log each checked out file
        for (const file of result) {
          addOutputLine(`${file.depot_path}#${file.revision} - opened for ${file.action || 'edit'}`, false);
        }
      },
      successMessage: (result) => `Checked out ${result.length} file(s)`,
      errorMessage: 'Checkout failed',
      invalidateKeys: [
        ['fileTree'],
        ['p4', 'opened'],
        ['p4', 'changes'],
      ],
    });
  }, [runOperation, addOutputLine]);

  /**
   * Revert files to depot state (discard local changes)
   *
   * @param paths - Depot paths to revert
   * @returns Array of reverted depot paths
   */
  const revert = useCallback(async (paths: string[]) => {
    return runOperation({
      operationId: `revert-${Date.now()}`,
      operationName: `Reverting ${paths.length} file(s)`,
      command: `p4 revert ${paths.join(' ')}`,
      fn: () => invokeP4Revert(paths),
      onSuccess: (reverted) => {
        // Log each reverted file
        for (const depotPath of reverted) {
          addOutputLine(`${depotPath} - reverted`, false);
        }
      },
      successMessage: (reverted) => `Reverted ${reverted.length} file(s)`,
      errorMessage: 'Revert failed',
      invalidateKeys: [
        ['fileTree'],
        ['p4', 'opened'],
        ['p4', 'changes'],
      ],
    });
  }, [runOperation, addOutputLine]);

  /**
   * Submit changelist to depot
   *
   * @param changelist - Changelist number to submit
   * @param description - Optional changelist description
   * @returns Submitted changelist number
   */
  const submit = useCallback(async (changelist: number, description?: string) => {
    return runOperation({
      operationId: `submit-${Date.now()}`,
      operationName: `Submitting changelist ${changelist}`,
      command: `p4 submit -c ${changelist}`,
      fn: () => invokeP4Submit(changelist, description),
      onSuccess: (submittedCl) => {
        addOutputLine(`Change ${submittedCl} submitted.`, false);
      },
      successMessage: (submittedCl) => `Submitted as changelist ${submittedCl}`,
      errorMessage: 'Submit failed',
      invalidateKeys: [
        ['fileTree'],
        ['p4', 'opened'],
        ['p4', 'changes'],
      ],
    });
  }, [runOperation, addOutputLine]);

  return {
    checkout,
    revert,
    submit,
  };
}
