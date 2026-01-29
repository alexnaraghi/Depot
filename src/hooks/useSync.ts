import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invokeP4Sync, invokeKillProcess, invokeP4Info, SyncProgress } from '@/lib/tauri';
import { useOperationStore } from '@/store/operation';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useConnectionStore } from '@/stores/connectionStore';

export interface SyncConflict {
  depotPath: string;
  action: string;
  revision: number;
}

/**
 * Hook for sync operations with progress streaming and conflict handling.
 *
 * Features:
 * - Streams progress to operation store and output panel
 * - Updates file tree store after each file syncs
 * - Detects conflicts from progress events
 * - Supports cancellation via process kill
 */
export function useSync() {
  const queryClient = useQueryClient();

  const {
    startOperation,
    setProcessId,
    updateMessage,
    updateProgress,
    setCancelling,
    completeOperation,
    addOutputLine,
    currentOperation,
  } = useOperationStore();

  const { updateFile } = useFileTreeStore();
  const { status, server, user, workspace } = useConnectionStore();
  const isConnected = status === 'connected';

  // Get client info for depot path (only when connected)
  const { data: clientInfo } = useQuery({
    queryKey: ['p4Info', server, user, workspace],
    queryFn: () => invokeP4Info(server ?? undefined, user ?? undefined, workspace ?? undefined),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: isConnected,
  });

  // Build depot path for syncing (e.g., "//stream/main/...")
  const depotPath = clientInfo?.client_stream
    ? `${clientInfo.client_stream}/...`
    : undefined;

  const [conflict, setConflict] = useState<SyncConflict | null>(null);
  const [totalFiles, setTotalFiles] = useState(0);
  const [syncedFiles, setSyncedFiles] = useState(0);

  /**
   * Execute sync operation with progress tracking.
   * @param paths - Paths to sync (empty array syncs entire workspace)
   * @param force - Force sync even on conflicts
   */
  const sync = useCallback(async (paths: string[] = [], force: boolean = false) => {
    // Check if operation already running
    if (currentOperation && currentOperation.status === 'running') {
      throw new Error('Another operation is already in progress');
    }

    const operationId = `sync-${Date.now()}`;
    startOperation(operationId, paths.length > 0 ? `sync ${paths.join(' ')}` : 'sync');

    // Reset state
    setConflict(null);
    setTotalFiles(0);
    setSyncedFiles(0);

    try {
      // Build sync args
      const syncArgs = [...paths];
      if (force) {
        syncArgs.unshift('-f');
      }

      // Pass depot path for syncing (avoids -d flag issues with DVCS)
      const processId = await invokeP4Sync(
        syncArgs,
        depotPath,
        server ?? undefined,
        user ?? undefined,
        workspace ?? undefined,
        (progress: SyncProgress) => {
          // Handle conflict detection
          if (progress.is_conflict) {
            setConflict({
              depotPath: progress.depot_path,
              action: progress.action,
              revision: progress.revision,
            });

            // Update message to show conflict
            updateMessage(`Conflict detected: ${progress.depot_path}`);

            // Log to output panel
            addOutputLine(
              `⚠️ CONFLICT: ${progress.depot_path} - ${progress.action}#${progress.revision}`,
              false
            );

            return;
          }

          // Track progress
          setSyncedFiles((prev) => {
            const newCount = prev + 1;
            setTotalFiles((total) => Math.max(total, newCount));

            // Update progress bar (0-100)
            if (totalFiles > 0) {
              updateProgress(Math.round((newCount / totalFiles) * 100));
            }

            return newCount;
          });

          // Update message with current file
          const fileName = progress.depot_path.split('/').pop() || progress.depot_path;
          updateMessage(`Syncing: ${fileName} (${syncedFiles + 1} files)`);

          // Log to output panel
          addOutputLine(
            `${progress.action} ${progress.depot_path}#${progress.revision}`,
            false
          );

          // Update file tree store with new revision
          updateFile(progress.depot_path, {
            revision: progress.revision,
            status: 'synced' as any, // Cast to avoid import cycle
          });
        }
      );

      setProcessId(processId);

      // Sync completes when backend process exits
      // For now, mark as complete (backend will send completion via events in future)
      completeOperation(true);

      // Invalidate file tree query to refresh all file states
      // This ensures reverted files, synced files, etc. are all updated
      await queryClient.invalidateQueries({ queryKey: ['fileTree'] });
    } catch (error) {
      completeOperation(false, String(error));
      throw error;
    }
  }, [
    currentOperation,
    startOperation,
    setProcessId,
    updateMessage,
    updateProgress,
    completeOperation,
    addOutputLine,
    updateFile,
    depotPath,
    syncedFiles,
    totalFiles,
    queryClient,
  ]);

  /**
   * Cancel ongoing sync operation.
   */
  const cancel = useCallback(async () => {
    if (!currentOperation?.processId) return;

    setCancelling();

    try {
      await invokeKillProcess(currentOperation.processId);
      completeOperation(false, 'Sync cancelled by user');

      // Reset state
      setConflict(null);
      setTotalFiles(0);
      setSyncedFiles(0);
    } catch (error) {
      completeOperation(false, `Cancel failed: ${error}`);
    }
  }, [currentOperation, setCancelling, completeOperation]);

  /**
   * Resolve conflict by skipping the file.
   */
  const skipConflict = useCallback(() => {
    if (!conflict) return;

    addOutputLine(`Skipped: ${conflict.depotPath}`, false);
    setConflict(null);

    // Continue sync (operation is still running)
  }, [conflict, addOutputLine]);

  /**
   * Resolve conflict by forcing sync (overwrite local).
   */
  const forceSync = useCallback(async () => {
    if (!conflict) return;

    const conflictPath = conflict.depotPath;
    setConflict(null);

    // Force sync just this file
    try {
      await sync([conflictPath], true);
    } catch (error) {
      addOutputLine(`Force sync failed: ${error}`, true);
    }
  }, [conflict, sync, addOutputLine]);

  return {
    sync,
    cancel,
    skipConflict,
    forceSync,
    conflict,
    isRunning: currentOperation?.status === 'running',
    isCancelling: currentOperation?.status === 'cancelling',
    canCancel: !!currentOperation?.processId && currentOperation.status === 'running',
    syncedFiles,
    totalFiles,
  };
}
