import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOperationStore } from '@/store/operation';
import { useConnectionStore } from '@/stores/connectionStore';
import { invoke } from '@tauri-apps/api/core';
import { P4UnresolvedFile } from '@/types/p4';
import toast from 'react-hot-toast';

interface RunOperationOptions<T> {
  operationId: string;
  operationName: string;
  command: string;
  fn: () => Promise<T>;
  onSuccess?: (result: T) => void;
  onComplete?: (result: T) => { success: boolean; message?: string };
  successMessage?: string | ((result: T) => string);
  errorMessage: string;
  invalidateKeys: string[][];
}

/**
 * Hook for querying unresolved files requiring conflict resolution
 *
 * Provides:
 * - Query for fetching unresolved files
 * - Helper to check if specific file is unresolved
 */
export function useUnresolvedFiles() {
  const { p4port, p4user, p4client, status } = useConnectionStore();

  const query = useQuery({
    queryKey: ['p4', 'unresolved', p4port, p4user, p4client],
    queryFn: async () => {
      const result = await invoke<P4UnresolvedFile[]>('p4_fstat_unresolved', {
        server: p4port,
        user: p4user,
        client: p4client,
      });
      return result;
    },
    enabled: status === 'connected',
  });

  /**
   * Check if a specific file has unresolved conflicts
   */
  const isFileUnresolved = useCallback(
    (depotPath: string) => {
      if (!query.data) return false;
      return query.data.some((file) => file.depotPath === depotPath);
    },
    [query.data]
  );

  return {
    ...query,
    isFileUnresolved,
  };
}

/**
 * Hook for resolve operations with state management
 *
 * Provides:
 * - Quick resolve operations (accept theirs/yours/merge)
 * - Merge tool launching with blocking wait
 * - Query invalidation for UI refresh
 * - Toast notifications and error handling
 */
export function useResolve() {
  const queryClient = useQueryClient();
  const { startOperation, completeOperation, addOutputLine } = useOperationStore();
  const { p4port, p4user, p4client } = useConnectionStore();

  /**
   * Helper to run an operation with standard boilerplate
   * - Creates operation ID and starts operation
   * - Logs command to output panel
   * - Executes operation function
   * - Logs success output
   * - Completes operation
   * - Invalidates queries
   * - Shows toast notification (if successMessage provided)
   * - Handles errors with logging and toast
   */
  const runOperation = useCallback(async <T,>(options: RunOperationOptions<T>): Promise<T> => {
    const {
      operationId,
      operationName,
      command,
      fn,
      onSuccess,
      onComplete,
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

      // Allow custom completion logic (for operations where success is conditional)
      if (onComplete) {
        const { success, message } = onComplete(result);
        completeOperation(success, message);
      } else {
        completeOperation(true);
      }

      // Invalidate queries to refresh UI
      await Promise.all(
        invalidateKeys.map(key => queryClient.invalidateQueries({ queryKey: key }))
      );

      if (successMessage) {
        const message = typeof successMessage === 'function' ? successMessage(result) : successMessage;
        toast.success(message);
      }

      return result;
    } catch (error) {
      addOutputLine(`Error: ${error}`, true);
      completeOperation(false, String(error));
      toast.error(`${errorMessage}: ${error}`);
      throw error;
    }
  }, [startOperation, completeOperation, addOutputLine, queryClient]);

  /**
   * Accept resolve with specified mode
   *
   * @param depotPath - Depot path to resolve
   * @param mode - Resolution mode: 'theirs' (accept depot), 'yours' (keep local), 'merge' (accept merged result)
   */
  const resolveAccept = useCallback(
    async (depotPath: string, mode: 'theirs' | 'yours' | 'merge') => {
      return runOperation({
        operationId: `resolve-${Date.now()}`,
        operationName: `Resolving ${depotPath}`,
        command: `p4 resolve -a${mode[0]} ${depotPath}`,
        fn: () => invoke('p4_resolve_accept', {
          depotPath,
          mode,
          server: p4port,
          user: p4user,
          client: p4client,
        }),
        onSuccess: () => {
          addOutputLine(`${depotPath} - resolved (${mode})`, false);
        },
        successMessage: `Resolved using ${mode}`,
        errorMessage: 'Resolve failed',
        invalidateKeys: [
          ['p4', 'opened'],
          ['p4', 'changes'],
          ['p4', 'unresolved'],
          ['fileTree'],
        ],
      });
    },
    [runOperation, addOutputLine, p4port, p4user, p4client]
  );

  /**
   * Launch external merge tool for manual conflict resolution
   *
   * @param depotPath - Depot path to resolve
   * @param localPath - Local filesystem path
   * @returns Exit code from merge tool (0 = success)
   */
  const launchMergeTool = useCallback(
    async (depotPath: string, localPath: string) => {
      return runOperation({
        operationId: `merge-tool-${Date.now()}`,
        operationName: `Launching merge tool for ${depotPath}`,
        command: `Launching merge tool for ${depotPath}`,
        fn: () => invoke<number>('launch_merge_tool', {
          depotPath,
          localPath,
          server: p4port,
          user: p4user,
          client: p4client,
        }),
        onSuccess: (exitCode) => {
          if (exitCode === 0) {
            addOutputLine(`Merge tool completed successfully`, false);
          } else {
            addOutputLine(`Merge tool exited with code ${exitCode}`, true);
          }
        },
        onComplete: (exitCode) => ({
          success: exitCode === 0,
          message: exitCode === 0 ? undefined : `Merge tool exited with code ${exitCode}`,
        }),
        errorMessage: 'Failed to launch merge tool',
        invalidateKeys: [
          ['p4', 'opened'],
          ['p4', 'changes'],
          ['p4', 'unresolved'],
          ['fileTree'],
        ],
      });
    },
    [runOperation, addOutputLine, p4port, p4user, p4client]
  );

  return {
    resolveAccept,
    launchMergeTool,
  };
}
