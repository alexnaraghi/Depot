import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useConnectionStore } from '@/stores/connectionStore';
import { useOperationStore } from '@/store/operation';
import { invokeP4CreateChange, invokeP4EditChangeDescription, invokeP4Opened, invokeP4Reopen } from '@/lib/tauri';
import { useQueryClient } from '@tanstack/react-query';
import { P4Changelist } from '@/types/p4';
import toast from 'react-hot-toast';

interface EditDescriptionDialogProps {
  changelist: P4Changelist | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog for editing a changelist description
 *
 * Special case: default CL (id === 0) creates a new numbered changelist instead.
 * Shows textarea pre-filled with current description.
 * Updates description via invokeP4EditChangeDescription.
 * Invalidates TanStack Query cache on success.
 */
export function EditDescriptionDialog({
  changelist,
  open,
  onOpenChange,
}: EditDescriptionDialogProps) {
  const { p4port, p4user, p4client } = useConnectionStore();
  const { addOutputLine } = useOperationStore();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize description from changelist when dialog opens
  useEffect(() => {
    if (open && changelist) {
      setDescription(changelist.description);
    }
  }, [open, changelist]);

  const handleSubmit = async () => {
    if (!changelist || !description.trim()) return;

    setIsSubmitting(true);
    try {
      // Special case: default CL (id === 0) creates a new numbered changelist
      if (changelist.id === 0) {
        addOutputLine('p4 change -o (new changelist)', false);
        const newClId = await invokeP4CreateChange(
          description,
          p4port ?? undefined,
          p4user ?? undefined,
          p4client ?? undefined
        );
        addOutputLine(`Change ${newClId} created.`, false);

        // Move files from default CL to new numbered CL
        const openedFiles = await invokeP4Opened(
          p4port ?? undefined,
          p4user ?? undefined,
          p4client ?? undefined
        );
        const defaultClFiles = openedFiles.filter(f => f.changelist === 0);

        if (defaultClFiles.length > 0) {
          addOutputLine(`p4 reopen -c ${newClId} (${defaultClFiles.length} files)`, false);
          await invokeP4Reopen(
            defaultClFiles.map(f => f.depot_path),
            newClId,
            p4port ?? undefined,
            p4user ?? undefined,
            p4client ?? undefined
          );
          addOutputLine(`Moved ${defaultClFiles.length} files to changelist ${newClId}.`, false);
          toast.success(`Created changelist #${newClId} with ${defaultClFiles.length} files`);
        } else {
          toast.success(`Created changelist #${newClId}`);
        }

        // Invalidate both changes and opened queries
        queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
        queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });
      } else {
        addOutputLine(`p4 change -i (edit changelist ${changelist.id})`, false);
        await invokeP4EditChangeDescription(
          changelist.id,
          description,
          p4port ?? undefined,
          p4user ?? undefined,
          p4client ?? undefined
        );
        addOutputLine(`Change ${changelist.id} updated.`, false);
        toast.success(`Updated changelist #${changelist.id}`);
        queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
      }
      onOpenChange(false);
    } catch (error) {
      addOutputLine(`Error: ${error}`, true);
      toast.error(`Failed to update changelist: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!changelist) return null;

  const isDefault = changelist.id === 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isDefault ? 'Create Numbered Changelist' : `Edit Changelist #${changelist.id}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isDefault
              ? 'The default changelist cannot have a description. Entering a description will create a new numbered changelist.'
              : 'Update the description for this changelist.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-24 px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Enter changelist description..."
            disabled={isSubmitting}
            autoFocus
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={isSubmitting || !description.trim()}
          >
            {isSubmitting ? (isDefault ? 'Creating...' : 'Updating...') : (isDefault ? 'Create' : 'Update')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
