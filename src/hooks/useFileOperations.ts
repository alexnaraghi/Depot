import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOperationStore } from '@/store/operation';
import { invokeP4Edit, invokeP4Revert, invokeP4Submit, invokeP4Fstat, P4FileInfo } from '@/lib/tauri';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { P4File, FileStatus, FileAction } from '@/types/p4';
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
 * Maps P4FileInfo from backend to P4File type for frontend
 * (duplicated from useFileTree.ts to avoid circular dependency)
 */
function mapP4FileInfo(info: P4FileInfo): P4File {
  let status: FileStatus;
  if (info.action) {
    switch (info.action) {
      case 'add':
        status = FileStatus.Added;
        break;
      case 'delete':
        status = FileStatus.Deleted;
        break;
      case 'edit':
        status = FileStatus.CheckedOut;
        break;
      default:
        status = FileStatus.CheckedOut;
    }
  } else if (info.revision < info.head_revision) {
    status = FileStatus.OutOfDate;
  } else if (info.status === 'conflict') {
    status = FileStatus.Conflict;
  } else if (info.status === 'modified') {
    status = FileStatus.Modified;
  } else {
    status = FileStatus.Synced;
  }

  return {
    depotPath: info.depot_path,
    localPath: info.local_path,
    status,
    action: info.action as FileAction | undefined,
    revision: info.revision,
    headRevision: info.head_revision,
    changelist: info.changelist,
    fileType: info.file_type,
    isDirectory: false,
  };
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
   * Update file tree store with fresh data for specific files
   * @param depotPaths - Array of depot paths to refresh
   */
  const updateAffectedFiles = useCallback(async (depotPaths: string[]) => {
    if (depotPaths.length === 0) return;

    try {
      // Query fresh data for affected files only
      const updatedFileInfos = await invokeP4Fstat(depotPaths);
      const updatedFiles = updatedFileInfos.map(mapP4FileInfo);

      // Update file tree store with new data
      const fileTreeStore = useFileTreeStore.getState();
      const updatesMap = new Map<string, Partial<P4File>>();

      updatedFiles.forEach((file) => {
        updatesMap.set(file.depotPath, file);
      });

      // Use batch update for efficiency
      fileTreeStore.batchUpdateFiles(updatesMap);

      // Also update ALL query cache entries for file tree (there may be multiple with different depotPath values)
      queryClient.setQueriesData(
        { queryKey: ['fileTree'] },
        (oldData: P4File[] | undefined) => {
          if (!oldData) return oldData;

          // Update the affected files in the cache
          return oldData.map((file) => {
            const update = updatesMap.get(file.depotPath);
            return update ? { ...file, ...update } : file;
          });
        }
      );
    } catch (error) {
      console.warn('Failed to update affected files:', error);
      // Fall back to invalidation if targeted update fails
      await queryClient.invalidateQueries({ queryKey: ['fileTree'] });
    }
  }, [queryClient]);

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
    const result = await runOperation({
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
        // Don't invalidate fileTree - use targeted update instead
        ['p4', 'opened'],
        ['p4', 'changes'],
      ],
    });

    // Update only the affected files instead of invalidating entire tree
    await updateAffectedFiles(paths);

    return result;
  }, [runOperation, addOutputLine, updateAffectedFiles]);

  /**
   * Revert files to depot state (discard local changes)
   *
   * @param paths - Depot paths to revert
   * @returns Array of reverted depot paths
   */
  const revert = useCallback(async (paths: string[]) => {
    const result = await runOperation({
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
        // Don't invalidate fileTree - use targeted update instead
        ['p4', 'opened'],
        ['p4', 'changes'],
      ],
    });

    // Update only the affected files instead of invalidating entire tree
    await updateAffectedFiles(paths);

    return result;
  }, [runOperation, addOutputLine, updateAffectedFiles]);

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
