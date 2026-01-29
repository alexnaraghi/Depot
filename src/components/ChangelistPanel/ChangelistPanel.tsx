import { useCallback, useState } from 'react';
import { Tree, MoveHandler } from 'react-arborist';
import { useChangelists } from './useChangelists';
import { ChangelistNode } from './ChangelistNode';
import { SubmitDialog } from './SubmitDialog';
import { CreateChangelistDialog } from './CreateChangelistDialog';
import { EditDescriptionDialog } from './EditDescriptionDialog';
import { ChangelistTreeNode } from '@/utils/treeBuilder';
import { P4Changelist } from '@/types/p4';
import { invokeP4Edit, invokeP4DeleteChange } from '@/lib/tauri';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';

interface ChangelistPanelProps {
  className?: string;
}

/**
 * Changelist sidebar panel
 *
 * Shows all pending changelists with file counts.
 * Expand changelist to see files.
 * Drag files between changelists to move them.
 * Submit button appears on hover for changelists with files.
 */
export function ChangelistPanel({ className }: ChangelistPanelProps) {
  const { treeData, isLoading } = useChangelists();
  const { p4port, p4user, p4client } = useConnectionStore();
  const queryClient = useQueryClient();
  const [selectedChangelist, setSelectedChangelist] = useState<P4Changelist | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Handle drag-and-drop between changelists
  const handleMove: MoveHandler<ChangelistTreeNode> = useCallback(async ({ dragIds, parentId }) => {
    // parentId is the changelist ID we're dropping onto
    if (!parentId) return;

    // Extract changelist number from parentId (it's just the number as string)
    const targetClId = parseInt(parentId, 10);
    if (isNaN(targetClId)) return;

    // Get depot paths of dragged files
    const filePaths: string[] = [];
    for (const dragId of dragIds) {
      // dragId format: "{changelist.id}-{depot_path}"
      // Extract depot path by removing the "{changelist.id}-" prefix
      const parts = dragId.split('-');
      if (parts.length >= 2) {
        // Rejoin with '-' in case the depot path contains dashes
        const depotPath = parts.slice(1).join('-');
        filePaths.push(depotPath);
      }
    }

    if (filePaths.length === 0) return;

    try {
      // Move files to new changelist via p4 edit -c <changelist>
      // Note: p4 edit with already-opened files acts as p4 reopen, moving
      // files to the specified changelist. See 02-03-PLAN.md Task 2 for details.
      await invokeP4Edit(filePaths, targetClId);
      toast.success(`Moved ${filePaths.length} file(s) to changelist ${targetClId}`);
    } catch (error) {
      toast.error(`Failed to move files: ${error}`);
    }
  }, []);

  // Handle submit button click on changelist
  const handleSubmitClick = useCallback((cl: P4Changelist) => {
    setSelectedChangelist(cl);
    setSubmitDialogOpen(true);
  }, []);

  // Handle edit button click on changelist
  const handleEditClick = useCallback((cl: P4Changelist) => {
    setSelectedChangelist(cl);
    setEditDialogOpen(true);
  }, []);

  // Handle delete button click on changelist
  const handleDeleteClick = useCallback(async (cl: P4Changelist) => {
    // Validation: cannot delete default or non-empty changelist
    if (cl.id === 0) {
      toast.error('Cannot delete default changelist');
      return;
    }
    if (cl.fileCount > 0) {
      toast.error('Cannot delete changelist with files');
      return;
    }

    try {
      await invokeP4DeleteChange(cl.id, p4port ?? undefined, p4user ?? undefined, p4client ?? undefined);
      toast.success(`Deleted changelist #${cl.id}`);
      queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
    } catch (error) {
      toast.error(`Failed to delete changelist: ${error}`);
    }
  }, [p4port, p4user, p4client, queryClient]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <div className="text-slate-400 text-sm">Loading changelists...</div>
      </div>
    );
  }

  // Empty state
  if (treeData.length === 0) {
    return (
      <div className={cn('p-4', className)}>
        <h2 className="text-lg font-semibold mb-4">Pending Changes</h2>
        <div className="text-slate-400 text-sm">No pending changes</div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-between p-4 pb-2">
        <h2 className="text-lg font-semibold">Pending Changes</h2>
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="p-1 hover:bg-slate-700 rounded transition-colors"
          title="New Changelist"
        >
          <Plus className="w-5 h-5 text-slate-300" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tree<ChangelistTreeNode>
          data={treeData}
          width="100%"
          height={400}
          indent={16}
          rowHeight={32}
          openByDefault
          disableDrag={(node) => (node.data as unknown as ChangelistTreeNode).type === 'changelist'}
          disableDrop={({ parentNode }) => parentNode.data.type === 'file'}
          onMove={handleMove}
        >
          {({ node, style, dragHandle, tree }) => (
            <ChangelistNode
              node={node}
              style={style}
              dragHandle={dragHandle}
              tree={tree}
              onSubmit={() => {
                if (node.data.type === 'changelist') {
                  handleSubmitClick(node.data.data as P4Changelist);
                }
              }}
              onEdit={() => {
                if (node.data.type === 'changelist') {
                  handleEditClick(node.data.data as P4Changelist);
                }
              }}
              onDelete={() => {
                if (node.data.type === 'changelist') {
                  handleDeleteClick(node.data.data as P4Changelist);
                }
              }}
            />
          )}
        </Tree>
      </div>

      <SubmitDialog
        changelist={selectedChangelist}
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
      />
      <CreateChangelistDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      <EditDescriptionDialog
        changelist={selectedChangelist}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
}
