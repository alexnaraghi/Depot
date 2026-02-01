import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ResolveBlockingOverlayProps {
  isOpen: boolean;
  filePath: string;
}

/**
 * Full-screen blocking overlay shown while external merge tool is running.
 *
 * Prevents user interaction with the app until merge tool exits.
 * User must complete their merge in the external tool to continue.
 */
export function ResolveBlockingOverlay({ isOpen, filePath }: ResolveBlockingOverlayProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={() => {
        // Prevent close - user must complete merge in external tool
      }}
    >
      <DialogContent
        className="max-w-md bg-slate-900/95 border-slate-700"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            Waiting for merge tool...
          </DialogTitle>
          <DialogDescription className="space-y-2 pt-2">
            <div className="font-mono text-xs text-muted-foreground break-all">
              {filePath}
            </div>
            <div className="text-sm">
              Complete your merge in the external tool to continue.
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
