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
import { useFileOperations } from '@/hooks/useFileOperations';
import { P4Changelist } from '@/types/p4';

interface SubmitDialogProps {
  changelist: P4Changelist | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: (newChangelistId: number) => void;
}

/**
 * Submit dialog for submitting a changelist
 *
 * Shows changelist info, editable description, and file list.
 * Disables submit if description is empty.
 * Shows loading state during submission.
 */
export function SubmitDialog({
  changelist,
  open,
  onOpenChange,
  onSubmitted,
}: SubmitDialogProps) {
  const { submit } = useFileOperations();
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize description from changelist when dialog opens
  useEffect(() => {
    if (open && changelist) {
      setDescription(changelist.description);
    }
  }, [open, changelist]);

  const handleSubmit = async () => {
    if (!changelist) return;

    setIsSubmitting(true);
    try {
      const newClId = await submit(changelist.id, description);
      onOpenChange(false);
      onSubmitted?.(newClId);
    } catch (error) {
      // Error already handled by useFileOperations (toast)
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!changelist) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Submit Changelist {changelist.id === 0 ? '(Default)' : changelist.id}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {changelist.fileCount} file(s) will be submitted.
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
          />
        </div>

        <div className="mb-4 max-h-32 overflow-y-auto">
          <div className="text-sm text-slate-400 mb-1">Files:</div>
          {changelist.files.map((file) => (
            <div key={file.depotPath} className="text-sm text-slate-300 truncate">
              {file.depotPath.split('/').pop()}
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={isSubmitting || !description.trim()}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
