import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOperationStore } from '@/store/operation';
import { useConnectionStore } from '@/stores/connectionStore';
import { invoke } from '@tauri-apps/api/core';
import { P4UnresolvedFile } from '@/types/p4';
import toast from 'react-hot-toast';

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
   * Accept resolve with specified mode
   *
   * @param depotPath - Depot path to resolve
   * @param mode - Resolution mode: 'theirs' (accept depot), 'yours' (keep local), 'merge' (accept merged result)
   */
  const resolveAccept = useCallback(
    async (depotPath: string, mode: 'theirs' | 'yours' | 'merge') => {
      const operationId = `resolve-${Date.now()}`;
      startOperation(operationId, `Resolving ${depotPath}`);

      // Log to output panel
      addOutputLine(`p4 resolve -a${mode[0]} ${depotPath}`, false);

      try {
        await invoke('p4_resolve_accept', {
          depotPath,
          mode,
          server: p4port,
          user: p4user,
          client: p4client,
        });

        addOutputLine(`${depotPath} - resolved (${mode})`, false);
        completeOperation(true);

        // Invalidate all relevant queries
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] }),
          queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] }),
          queryClient.invalidateQueries({ queryKey: ['p4', 'unresolved'] }),
          queryClient.invalidateQueries({ queryKey: ['fileTree'] }),
        ]);

        toast.success(`Resolved using ${mode}`);
      } catch (error) {
        addOutputLine(`Error: ${error}`, true);
        completeOperation(false, String(error));
        toast.error(`Resolve failed: ${error}`);
        throw error;
      }
    },
    [startOperation, completeOperation, addOutputLine, queryClient, p4port, p4user, p4client]
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
      const operationId = `merge-tool-${Date.now()}`;
      startOperation(operationId, `Launching merge tool for ${depotPath}`);

      // Log to output panel
      addOutputLine(`Launching merge tool for ${depotPath}`, false);

      try {
        const exitCode = await invoke<number>('launch_merge_tool', {
          depotPath,
          localPath,
          server: p4port,
          user: p4user,
          client: p4client,
        });

        if (exitCode === 0) {
          addOutputLine(`Merge tool completed successfully`, false);
          completeOperation(true);
        } else {
          addOutputLine(`Merge tool exited with code ${exitCode}`, true);
          completeOperation(false, `Merge tool exited with code ${exitCode}`);
        }

        // Invalidate queries regardless of exit code (user may have made changes)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] }),
          queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] }),
          queryClient.invalidateQueries({ queryKey: ['p4', 'unresolved'] }),
          queryClient.invalidateQueries({ queryKey: ['fileTree'] }),
        ]);

        return exitCode;
      } catch (error) {
        addOutputLine(`Error: ${error}`, true);
        completeOperation(false, String(error));
        toast.error(`Failed to launch merge tool: ${error}`);
        throw error;
      }
    },
    [startOperation, completeOperation, addOutputLine, queryClient, p4port, p4user, p4client]
  );

  return {
    resolveAccept,
    launchMergeTool,
  };
}
