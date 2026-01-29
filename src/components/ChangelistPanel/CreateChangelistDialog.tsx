import { useState } from 'react';
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
import { invokeP4CreateChange } from '@/lib/tauri';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface CreateChangelistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog for creating a new changelist with a description
 *
 * Shows textarea for description entry.
 * Creates changelist via invokeP4CreateChange.
 * Invalidates TanStack Query cache on success.
 */
export function CreateChangelistDialog({
  open,
  onOpenChange,
}: CreateChangelistDialogProps) {
  const { p4port, p4user, p4client } = useConnectionStore();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return;

    setIsSubmitting(true);
    try {
      const newClId = await invokeP4CreateChange(
        description,
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );
      toast.success(`Created changelist #${newClId}`);
      queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
      setDescription('');
      onOpenChange(false);
    } catch (error) {
      toast.error(`Failed to create changelist: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>New Changelist</AlertDialogTitle>
          <AlertDialogDescription>
            Enter a description for the new changelist.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            {isSubmitting ? 'Creating...' : 'Create'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
