import { useState } from 'react';
import { P4Changelist, FileAction } from '@/types/p4';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { useShelvedFilesQuery, useShelve } from '@/hooks/useShelvedFiles';
import { invokeP4DeleteChange } from '@/lib/tauri';
import { useOperationStore } from '@/store/operation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SubmitDialog } from '@/components/ChangelistPanel/SubmitDialog';
import { EditDescriptionDialog } from '@/components/ChangelistPanel/EditDescriptionDialog';
import { Triangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface ChangelistDetailViewProps {
  changelist: P4Changelist;
}

/**
 * Detail view for changelist selection
 *
 * Shows CL number, status, description, action buttons, file list, and shelved files.
 * File clicks drill into FileDetailView with CL context.
 */
export function ChangelistDetailView({ changelist }: ChangelistDetailViewProps) {
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { addOutputLine } = useOperationStore();
  const queryClient = useQueryClient();
  const shelve = useShelve();
  const { data: shelvedFiles } = useShelvedFilesQuery(changelist.id);
  const drillToFile = useDetailPaneStore(s => s.drillToFile);

  const isPending = changelist.status === 'pending';
  const isSubmitted = changelist.status === 'submitted';
  const hasFiles = changelist.files.length > 0;
  const isNumbered = changelist.id > 0;
  const isEmpty = !hasFiles;

  const handleShelve = async () => {
    if (!hasFiles || !isNumbered) return;

    try {
      await shelve.mutateAsync({
        changelistId: changelist.id,
        filePaths: changelist.files.map(f => f.depotPath),
      });
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleDelete = async () => {
    if (!isEmpty || !isNumbered) return;

    const confirmed = window.confirm(
      `Delete changelist ${changelist.id}? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      addOutputLine(`p4 change -d ${changelist.id}`, false);
      await invokeP4DeleteChange(
        changelist.id
      );
      addOutputLine(`Change ${changelist.id} deleted.`, false);
      toast.success(`Deleted changelist ${changelist.id}`);

      // Invalidate queries to refresh
      await queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });

      // Clear selection to return to workspace summary
      useDetailPaneStore.getState().clear();
    } catch (error) {
      addOutputLine(`Error: ${error}`, true);
      toast.error(`Failed to delete changelist: ${error}`);
    }
  };

  const getActionBadgeColor = (action?: FileAction): string => {
    switch (action) {
      case FileAction.Edit:
        return 'bg-blue-900/30 text-blue-300';
      case FileAction.Add:
        return 'bg-green-900/30 text-green-300';
      case FileAction.Delete:
        return 'bg-red-900/30 text-red-300';
      case FileAction.Branch:
        return 'bg-purple-900/30 text-purple-300';
      case FileAction.Integrate:
        return 'bg-yellow-900/30 text-yellow-300';
      case FileAction.MoveAdd:
      case FileAction.MoveDelete:
        return 'bg-orange-900/30 text-orange-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Triangle className="w-4 h-4 text-muted-foreground fill-muted-foreground flex-shrink-0" />
          <h2 className="text-xl font-semibold">
            #{changelist.id === 0 ? 'Default' : changelist.id}
          </h2>
          <Badge variant={isPending ? 'default' : 'secondary'}>
            {isSubmitted ? 'Submitted' : 'Pending'}
          </Badge>
        </div>
        <p className={cn(
          "text-sm",
          changelist.description ? "text-foreground" : "text-muted-foreground italic"
        )}>
          {changelist.description || "No description"}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSubmitDialogOpen(true)}
          disabled={!hasFiles || !isPending}
        >
          Submit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShelve}
          disabled={!hasFiles || !isNumbered || shelve.isPending}
        >
          {shelve.isPending ? 'Shelving...' : 'Shelve'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={!isEmpty || !isNumbered}
        >
          Delete
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditDialogOpen(true)}
        >
          Edit Description
        </Button>
      </div>

      {/* File list */}
      {hasFiles && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
            FILES ({changelist.files.length})
          </h3>
          <div className="space-y-1">
            {changelist.files.map((file) => {
              const fileName = file.depotPath.split('/').pop() || file.depotPath;

              return (
                <div
                  key={file.depotPath}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded cursor-pointer',
                    'hover:bg-accent transition-colors'
                  )}
                  onClick={() => drillToFile(file.depotPath, file.localPath, changelist.id)}
                >
                  {/* Action badge */}
                  <Badge
                    className={cn('px-2 py-0.5 text-xs', getActionBadgeColor(file.action))}
                  >
                    {file.action || 'edit'}
                  </Badge>

                  {/* Filename */}
                  <span className="flex-1 truncate text-sm">{fileName}</span>

                  {/* Revision */}
                  {file.revision > 0 && (
                    <span className="text-xs text-muted-foreground">
                      #{file.revision}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shelved files section */}
      {shelvedFiles && shelvedFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
            SHELVED FILES ({shelvedFiles.length})
          </h3>
          <div className="space-y-1">
            {shelvedFiles.map((file) => {
              const fileName = file.depotPath.split('/').pop() || file.depotPath;

              return (
                <div
                  key={file.depotPath}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  {/* Shelved indicator */}
                  <Badge className="px-2 py-0.5 text-xs bg-violet-900/30 text-violet-300">
                    shelved
                  </Badge>

                  {/* Filename */}
                  <span className="flex-1 truncate text-sm text-violet-200">{fileName}</span>

                  {/* Action */}
                  <span className="text-xs text-violet-400">{file.action}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <SubmitDialog
        changelist={changelist}
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
      />
      <EditDescriptionDialog
        changelist={changelist}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
}
