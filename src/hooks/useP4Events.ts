import { useEffect } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useChangelistStore } from '@/stores/changelistStore';
import { FileStatus, FileAction } from '@/types/p4';

/**
 * Event payload types
 */
interface FileStatusChangedEvent {
  depotPath: string;
  status: FileStatus;
  action?: FileAction;
  revision?: number;
}

interface ChangelistUpdatedEvent {
  id: number;
  description?: string;
  fileCount?: number;
}

interface SyncProgressEvent {
  depotPath: string;
  action: string;
  revision: number;
}

interface OperationCompleteEvent {
  operation: string;
  success: boolean;
  error?: string;
}

/**
 * Configuration for selective event subscription
 */
export interface UseP4EventsConfig {
  fileStatus?: boolean;
  changelists?: boolean;
  syncProgress?: boolean;
  operationComplete?: boolean;
}

/**
 * Hook for subscribing to Tauri backend events
 * Automatically updates stores when events are received
 *
 * Usage:
 * ```typescript
 * // Subscribe to all events
 * useP4Events();
 *
 * // Subscribe selectively
 * useP4Events({ fileStatus: true, changelists: false });
 * ```
 */
export function useP4Events(config?: UseP4EventsConfig) {
  const { updateFile } = useFileTreeStore();
  const { updateChangelist } = useChangelistStore();

  // Default: subscribe to all events
  const subscribeToFileStatus = config?.fileStatus ?? true;
  const subscribeToChangelists = config?.changelists ?? true;
  const subscribeToSyncProgress = config?.syncProgress ?? true;
  const subscribeToOperationComplete = config?.operationComplete ?? true;

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    // File status changed event
    if (subscribeToFileStatus) {
      listen<FileStatusChangedEvent>('file-status-changed', (event) => {
        const { depotPath, status, action, revision } = event.payload;

        updateFile(depotPath, {
          status,
          action,
          ...(revision !== undefined && { revision }),
        });
      }).then((unlisten) => {
        unlisteners.push(unlisten);
      });
    }

    // Changelist updated event
    if (subscribeToChangelists) {
      listen<ChangelistUpdatedEvent>('changelist-updated', (event) => {
        const { id, description, fileCount } = event.payload;

        updateChangelist(id, {
          ...(description !== undefined && { description }),
          ...(fileCount !== undefined && { fileCount }),
        });
      }).then((unlisten) => {
        unlisteners.push(unlisten);
      });
    }

    // Sync progress event (could be used for progress indicators)
    if (subscribeToSyncProgress) {
      listen<SyncProgressEvent>('sync-progress', (event) => {
        const { depotPath, revision } = event.payload;

        // Update file revision as sync progresses
        updateFile(depotPath, { revision });
      }).then((unlisten) => {
        unlisteners.push(unlisten);
      });
    }

    // Operation complete event (for logging/debugging)
    if (subscribeToOperationComplete) {
      listen<OperationCompleteEvent>('operation-complete', (event) => {
        const { operation, success, error } = event.payload;

        // Log to console for debugging
        if (success) {
          console.log(`[P4 Event] Operation completed: ${operation}`);
        } else {
          console.error(`[P4 Event] Operation failed: ${operation}`, error);
        }
      }).then((unlisten) => {
        unlisteners.push(unlisten);
      });
    }

    // Cleanup: remove all listeners on unmount
    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [
    subscribeToFileStatus,
    subscribeToChangelists,
    subscribeToSyncProgress,
    subscribeToOperationComplete,
    updateFile,
    updateChangelist,
  ]);
}
