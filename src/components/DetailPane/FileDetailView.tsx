import { GitCompare, ExternalLink, FolderOpen, Edit3, Undo2, Loader2, Triangle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFileHistory } from '@/hooks/useFileHistory';
import { useFileOperations } from '@/hooks/useFileOperations';
import { useDiff } from '@/hooks/useDiff';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useUnresolvedFiles, useResolve } from '@/hooks/useResolve';
import { ResolveBlockingOverlay } from '@/components/dialogs/ResolveBlockingOverlay';
import { ResolveConfirmDialog } from '@/components/dialogs/ResolveConfirmDialog';
import { FileStatus } from '@/types/p4';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface FileDetailViewProps {
  depotPath: string;
  localPath: string;
}

/**
 * FileDetailView - Detail view for a selected file
 *
 * Displays:
 * - File metadata (name, revision, action, file type)
 * - Action buttons (Diff, Checkout, Revert, Open, Open in Explorer)
 * - Inline revision history table (with pagination)
 * - File properties (type, depot path, workspace path)
 *
 * History rows are clickable and drill into revision detail via drillToRevision.
 */
export function FileDetailView({ depotPath, localPath }: FileDetailViewProps) {
  const { revisions, isLoading, loadMore, hasMore } = useFileHistory(depotPath);
  const { checkout, revert } = useFileOperations();
  const { diffAgainstWorkspace } = useDiff();
  const { drillToRevision } = useDetailPaneStore();
  const { getFileByPath } = useFileTreeStore();
  const { isFileUnresolved } = useUnresolvedFiles();
  const { resolveAccept, launchMergeTool } = useResolve();

  // Resolve state
  const [isLaunching, setIsLaunching] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'theirs' | 'yours' | 'merge' | null>(null);

  // Extract filename
  const fileName = depotPath.split('/').pop() || depotPath;

  // Get file info from file tree store
  const fileInfo = getFileByPath(depotPath);

  // Determine available actions based on file status
  const canCheckout = fileInfo?.status === FileStatus.Synced || fileInfo?.status === FileStatus.OutOfDate;
  const canRevert =
    fileInfo?.status === FileStatus.CheckedOut ||
    fileInfo?.status === FileStatus.Added ||
    fileInfo?.status === FileStatus.Deleted;

  const handleDiff = () => {
    if (fileInfo?.revision !== undefined) {
      diffAgainstWorkspace(depotPath, localPath, fileInfo.revision);
    } else {
      toast.error('File revision not available');
    }
  };

  const handleCheckout = async () => {
    try {
      await checkout([depotPath]);
    } catch (error) {
      // Error already handled by useFileOperations with toast
    }
  };

  const handleRevert = async () => {
    try {
      await revert([depotPath]);
    } catch (error) {
      // Error already handled by useFileOperations with toast
    }
  };

  const handleOpen = async () => {
    try {
      await openPath(localPath);
    } catch (error) {
      toast.error(`Failed to open file: ${error}`);
    }
  };

  const handleOpenInExplorer = async () => {
    try {
      await revealItemInDir(localPath);
    } catch (error) {
      toast.error(`Failed to open in explorer: ${error}`);
    }
  };

  const handleHistoryRowClick = (revision: number) => {
    const revisionData = revisions.find((r) => r.rev === revision);
    if (revisionData) {
      drillToRevision(depotPath, localPath, revisionData);
    }
  };

  // Resolve handlers
  const handleLaunchMergeTool = async () => {
    setIsLaunching(true);
    try {
      const exitCode = await launchMergeTool(depotPath, localPath);
      if (exitCode === 0) {
        // Show confirmation dialog to accept merged result
        setConfirmAction('merge');
      } else {
        toast.error(`Merge tool exited with code ${exitCode}`);
      }
    } catch (error) {
      // Error already handled by useResolve with toast
    } finally {
      setIsLaunching(false);
    }
  };

  const handleResolveConfirm = async () => {
    if (!confirmAction) return;

    try {
      await resolveAccept(depotPath, confirmAction);
      setConfirmAction(null);
    } catch (error) {
      // Error already handled by useResolve with toast
    }
  };

  // Check if file is conflicted
  const isConflicted = isFileUnresolved(depotPath) || fileInfo?.status === FileStatus.Conflict;

  const formatDate = (epoch: number) => {
    return new Date(epoch * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const truncateDescription = (desc: string, maxLength: number = 60) => {
    if (desc.length <= maxLength) return desc;
    return desc.substring(0, maxLength) + '...';
  };

  return (
    <div className="flex flex-col h-full">
      {/* File info section */}
      <div className="border-b border-border p-4">
        <h2 className="text-xl font-semibold mb-1">{fileName}</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {fileInfo?.revision && <span>#{fileInfo.revision}</span>}
          {fileInfo?.action && (
            <>
              <span>·</span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  fileInfo.action === 'edit' && 'bg-blue-500/20 text-blue-400',
                  fileInfo.action === 'add' && 'bg-green-500/20 text-green-400',
                  fileInfo.action === 'delete' && 'bg-red-500/20 text-red-400'
                )}
              >
                {fileInfo.action}
              </span>
            </>
          )}
          {fileInfo?.fileType && (
            <>
              <span>·</span>
              <span>{fileInfo.fileType}</span>
            </>
          )}
        </div>
      </div>

      {/* Conflict banner */}
      {isConflicted && (
        <div className="bg-yellow-900/30 border-l-4 border-yellow-500 p-4 mb-4 rounded-r mx-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-400">
              This file has unresolved conflicts
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLaunchMergeTool}
              disabled={isLaunching}
              className="border-yellow-500/50 hover:bg-yellow-500/10"
            >
              Launch Merge Tool
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmAction('theirs')}
              disabled={isLaunching}
              className="border-yellow-500/50 hover:bg-yellow-500/10"
            >
              Accept Theirs
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmAction('yours')}
              disabled={isLaunching}
              className="border-yellow-500/50 hover:bg-yellow-500/10"
            >
              Accept Yours
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDiff}>
            <GitCompare className="w-4 h-4 mr-2" />
            Diff
          </Button>
          {canCheckout && (
            <Button variant="outline" size="sm" onClick={handleCheckout}>
              <Edit3 className="w-4 h-4 mr-2" />
              Checkout
            </Button>
          )}
          {canRevert && (
            <Button variant="outline" size="sm" onClick={handleRevert}>
              <Undo2 className="w-4 h-4 mr-2" />
              Revert
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleOpen}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Open
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenInExplorer}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Open in Explorer
          </Button>
        </div>
      </div>

      {/* Inline history table */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-3 text-foreground">HISTORY</h3>
          {isLoading && revisions.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : revisions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No revision history available
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground">Rev</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">CL</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">User</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Date</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {revisions.map((revision) => (
                    <tr
                      key={`${revision.rev}-${revision.change}`}
                      className="border-b border-border hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleHistoryRowClick(revision.rev)}
                    >
                      <td className="px-3 py-2 font-mono text-foreground">#{revision.rev}</td>
                      <td className="px-3 py-2 font-mono text-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Triangle className="w-3 h-3 text-muted-foreground fill-muted-foreground" />
                          {revision.change}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-foreground">{revision.user}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDate(revision.time)}</td>
                      <td className="px-3 py-2 text-muted-foreground" title={revision.desc}>
                        {truncateDescription(revision.desc)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button variant="outline" onClick={loadMore} disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'Load More'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Properties section */}
        <div className="border-t border-border p-4">
          <h3 className="text-sm font-semibold mb-3 text-foreground">PROPERTIES</h3>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">Type:</span>
            <span className="text-foreground font-mono">{fileInfo?.fileType || 'unknown'}</span>

            <span className="text-muted-foreground">Depot:</span>
            <span className="text-foreground font-mono break-all">{depotPath}</span>

            <span className="text-muted-foreground">Workspace:</span>
            <span className="text-foreground font-mono break-all">{localPath}</span>
          </div>
        </div>
      </div>

      {/* Resolve dialogs */}
      <ResolveBlockingOverlay isOpen={isLaunching} filePath={depotPath} />
      <ResolveConfirmDialog
        open={confirmAction === 'theirs'}
        title="Accept Theirs?"
        description="This will discard your local changes and use the depot version."
        onConfirm={handleResolveConfirm}
        onCancel={() => setConfirmAction(null)}
        confirmLabel="Accept Theirs"
        isDestructive={true}
      />
      <ResolveConfirmDialog
        open={confirmAction === 'yours'}
        title="Accept Yours?"
        description="This will keep your local changes and discard the depot changes."
        onConfirm={handleResolveConfirm}
        onCancel={() => setConfirmAction(null)}
        confirmLabel="Accept Yours"
      />
      <ResolveConfirmDialog
        open={confirmAction === 'merge'}
        title="Accept Merged Result?"
        description="Merge tool completed. Accept the merged result?"
        onConfirm={handleResolveConfirm}
        onCancel={() => setConfirmAction(null)}
        confirmLabel="Accept Merge"
      />
    </div>
  );
}
