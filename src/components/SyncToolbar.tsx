import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSync } from '@/hooks/useSync';
import { SyncConflictDialog } from '@/components/dialogs/SyncConflictDialog';

/**
 * Toolbar for sync operations.
 *
 * Features:
 * - Sync button with loading state (spinning icon)
 * - Cancel button appears when syncing
 * - Progress counter (files synced)
 * - Current file name display
 * - Conflict dialog integration
 */
export function SyncToolbar() {
  const {
    sync,
    cancel,
    skipConflict,
    forceSync,
    conflict,
    isRunning,
    isCancelling,
    canCancel,
    syncedFiles,
    totalFiles,
  } = useSync();

  const handleSync = async () => {
    try {
      await sync([]);
    } catch (error) {
      // Error is already handled by useSync and shown in operation store
      console.error('Sync failed:', error);
    }
  };

  const handleCancel = async () => {
    try {
      await cancel();
    } catch (error) {
      console.error('Cancel failed:', error);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700">
        {/* Sync button */}
        <Button
          onClick={handleSync}
          disabled={isRunning || isCancelling}
          variant="default"
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`}
          />
          {isRunning ? 'Syncing...' : 'Sync Workspace'}
        </Button>

        {/* Cancel button (only visible when syncing) */}
        {canCancel && (
          <Button
            onClick={handleCancel}
            disabled={isCancelling}
            variant="outline"
            size="sm"
            className="border-slate-600 hover:bg-slate-700"
          >
            <X className="h-4 w-4 mr-2" />
            {isCancelling ? 'Cancelling...' : 'Cancel'}
          </Button>
        )}

        {/* Progress display */}
        {isRunning && (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="font-mono">
              {syncedFiles} {totalFiles > 0 ? `/ ${totalFiles}` : ''} files
            </span>
          </div>
        )}
      </div>

      {/* Conflict resolution dialog */}
      <SyncConflictDialog
        conflict={conflict}
        onSkip={skipConflict}
        onOverwrite={forceSync}
      />
    </>
  );
}
