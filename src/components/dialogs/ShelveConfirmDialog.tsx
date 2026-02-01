import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ShelveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: Array<{ depot_path: string; action?: string; changelist?: number }>;
  onConfirm: () => void;
  onCancel: () => void;
  isShelving: boolean;
}

/**
 * Confirmation dialog for shelving files before stream switch.
 *
 * Displays a list of files that will be shelved to a new changelist
 * before switching streams, giving the user a chance to review and confirm.
 */
export function ShelveConfirmDialog({
  open,
  onOpenChange,
  files,
  onConfirm,
  onCancel,
  isShelving,
}: ShelveConfirmDialogProps) {
  // Group files by changelist
  const groupedFiles = files.reduce((acc, file) => {
    const clId = file.changelist || 0;
    if (!acc[clId]) {
      acc[clId] = [];
    }
    acc[clId].push(file);
    return acc;
  }, {} as Record<number, typeof files>);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isShelving) {
      onCancel();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Shelve Files Before Switching?</DialogTitle>
          <DialogDescription>
            The following files have pending changes. They will be shelved to a new changelist before switching streams.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[300px] overflow-y-auto space-y-4">
          {Object.entries(groupedFiles).map(([clId, clFiles]) => (
            <div key={clId}>
              <div className="text-sm font-medium mb-2 text-muted-foreground">
                {clId === '0' ? 'Default Changelist' : `CL #${clId}`}
              </div>
              <div className="space-y-1">
                {clFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-accent"
                  >
                    <span className="text-xs text-muted-foreground min-w-[50px]">
                      {file.action || 'edit'}
                    </span>
                    <span className="font-mono text-xs flex-1 truncate" title={file.depot_path}>
                      {file.depot_path}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isShelving}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isShelving}
          >
            {isShelving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Shelving...
              </>
            ) : (
              'Shelve & Switch'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
