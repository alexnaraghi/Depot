import { History, GitCompare, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFileHistory } from '@/hooks/useFileHistory';
import { useDiff } from '@/hooks/useDiff';
import { cn } from '@/lib/utils';

interface FileHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depotPath: string;
  localPath: string;
}

/**
 * File History Dialog
 *
 * Displays revision history for a file with diff actions:
 * - Diff vs Previous: Compare with previous revision
 * - Diff vs Workspace: Compare with local workspace file
 * - Load More: Fetch additional revisions
 */
export function FileHistoryDialog({
  open,
  onOpenChange,
  depotPath,
  localPath,
}: FileHistoryDialogProps) {
  const { revisions, isLoading, loadMore, hasMore } = useFileHistory(depotPath, open);
  const { diffRevisions, diffAgainstWorkspace } = useDiff();

  const handleDiffPrevious = (index: number) => {
    if (index >= revisions.length - 1) return;
    const current = revisions[index];
    const previous = revisions[index + 1];
    diffRevisions(depotPath, previous.rev, current.rev);
  };

  const handleDiffWorkspace = (revision: number) => {
    diffAgainstWorkspace(depotPath, localPath, revision);
  };

  const formatDate = (epoch: number) => {
    return new Date(epoch * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateDescription = (desc: string, maxLength: number = 60) => {
    if (desc.length <= maxLength) return desc;
    return desc.substring(0, maxLength) + '...';
  };

  // Extract filename from depot path
  const fileName = depotPath.split('/').pop() || depotPath;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            <DialogTitle>File History: {fileName}</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">{depotPath}</p>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : revisions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No revision history available
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 sticky top-0 bg-slate-900">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Rev</th>
                  <th className="px-3 py-2 font-medium">Change</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {revisions.map((revision, index) => {
                  const isFirstRevision = index === revisions.length - 1;
                  const isAddAction = revision.action === 'add' || revision.action === 'branch';
                  const canDiffPrevious = !isFirstRevision && !isAddAction;

                  return (
                    <tr
                      key={`${revision.rev}-${revision.change}`}
                      className="border-b border-slate-800 hover:bg-slate-800/50"
                    >
                      <td className="px-3 py-2 font-mono text-slate-300">
                        #{revision.rev}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-300">
                        {revision.change}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            revision.action === 'edit' && 'bg-blue-500/20 text-blue-400',
                            revision.action === 'add' && 'bg-green-500/20 text-green-400',
                            revision.action === 'delete' && 'bg-red-500/20 text-red-400',
                            revision.action === 'branch' && 'bg-purple-500/20 text-purple-400',
                            revision.action === 'integrate' && 'bg-yellow-500/20 text-yellow-400'
                          )}
                        >
                          {revision.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-400">
                        {formatDate(revision.time)}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {revision.user}
                      </td>
                      <td className="px-3 py-2 text-slate-400" title={revision.desc}>
                        {truncateDescription(revision.desc)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDiffPrevious(index)}
                            disabled={!canDiffPrevious}
                            title={
                              isFirstRevision
                                ? 'First revision - no previous'
                                : isAddAction
                                ? 'Cannot diff add/branch actions'
                                : 'Diff vs Previous'
                            }
                            className="h-7 px-2"
                          >
                            <GitCompare className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDiffWorkspace(revision.rev)}
                            title="Diff vs Workspace"
                            className="h-7 px-2"
                          >
                            <GitCompare className="w-4 h-4 text-blue-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {hasMore && (
          <div className="flex justify-center pt-4 border-t border-slate-700">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
