import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getActionBadgeColor } from '@/lib/actionBadges';
import { cn } from '@/lib/utils';
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
 * Shows changelist info, editable description, and file list with action badges.
 * Uses Dialog primitive (not AlertDialog) for workflow-style interactions.
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
  // Re-sync if changelist.description changes while dialog is open
  useEffect(() => {
    if (open && changelist) {
      setDescription(changelist.description);
    }
  }, [open, changelist?.description]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[80vh] flex flex-col"
        data-testid="submit-dialog"
      >
        <DialogHeader>
          <DialogTitle>
            Submit Changelist {changelist.id === 0 ? '(Default)' : changelist.id}
          </DialogTitle>
          <DialogDescription>
            {changelist.files.length} file{changelist.files.length !== 1 ? 's' : ''} will be submitted.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Description section */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-24 px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Enter changelist description..."
              disabled={isSubmitting}
              data-testid="submit-description"
            />
          </div>

          {/* File list section with action badges */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              FILES ({changelist.files.length})
            </h3>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {changelist.files.map((file) => {
                const fileName = file.depotPath.split('/').pop() || file.depotPath;

                return (
                  <div
                    key={file.depotPath}
                    className="flex items-center gap-2 px-3 py-2 rounded hover:bg-accent"
                  >
                    <Badge
                      className={cn('px-2 py-0.5 text-xs', getActionBadgeColor(file.action))}
                    >
                      {file.action || 'edit'}
                    </Badge>
                    <span className="flex-1 truncate text-sm">{fileName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !description.trim()}
            data-testid="submit-confirm-button"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
