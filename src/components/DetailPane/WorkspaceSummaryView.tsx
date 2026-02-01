import { useQueryClient } from '@tanstack/react-query';
import { FileEdit, GitBranch, Wifi } from 'lucide-react';
import { useConnectionStore } from '@/stores/connectionStore';
import { P4File } from '@/types/p4';
import { P4ChangelistInfo } from '@/lib/tauri';

/**
 * WorkspaceSummaryView - Dashboard shown when nothing is selected
 *
 * Displays workspace stats derived from existing query cache:
 * - File count from ['p4', 'opened'] query
 * - Changelist count from ['p4', 'changes'] query
 * - Connection info from connection store
 */
export function WorkspaceSummaryView() {
  const queryClient = useQueryClient();
  const { workspace, stream, user } = useConnectionStore();

  // Read from existing query cache
  const openedFiles = queryClient.getQueryData<P4File[]>(['p4', 'opened']) || [];
  const changelists = queryClient.getQueryData<P4ChangelistInfo[]>(['p4', 'changes']) || [];

  const fileCount = openedFiles.length;
  const clCount = changelists.length;

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="text-center max-w-md">
        <h2 className="text-lg font-semibold mb-6 text-foreground">Workspace Summary</h2>

        <div className="space-y-4 text-left">
          {/* File count */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <FileEdit className="w-5 h-5" />
            <span>
              {fileCount === 0 ? 'No files checked out' : `${fileCount} file${fileCount === 1 ? '' : 's'} checked out`}
            </span>
          </div>

          {/* Changelist count */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <GitBranch className="w-5 h-5" />
            <span>
              {clCount === 0 ? 'No pending changelists' : `${clCount} pending changelist${clCount === 1 ? '' : 's'}`}
            </span>
          </div>

          {/* Connection info */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <Wifi className="w-5 h-5" />
            <div className="flex flex-col">
              <span>Connected to {workspace || 'workspace'}</span>
              {stream && <span className="text-xs text-muted-foreground">{stream}</span>}
              {user && <span className="text-xs text-muted-foreground">User: {user}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
