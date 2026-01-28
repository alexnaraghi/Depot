import { AlertTriangle } from 'lucide-react';
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
import { SyncConflict } from '@/hooks/useSync';

interface SyncConflictDialogProps {
  conflict: SyncConflict | null;
  onSkip: () => void;
  onOverwrite: () => void;
}

/**
 * Dialog for resolving sync conflicts.
 *
 * When a sync operation detects a conflict (local edits vs depot changes),
 * this dialog prompts the user to choose:
 * - Skip: Continue sync without this file (keep local changes)
 * - Overwrite: Force sync this file (discard local changes)
 */
export function SyncConflictDialog({
  conflict,
  onSkip,
  onOverwrite,
}: SyncConflictDialogProps) {
  if (!conflict) return null;

  // Extract file name from depot path
  const fileName = conflict.depotPath.split('/').pop() || conflict.depotPath;

  return (
    <AlertDialog open={!!conflict}>
      <AlertDialogContent className="bg-slate-800 border-slate-700">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            <AlertDialogTitle className="text-slate-100">
              Sync Conflict Detected
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-slate-300 space-y-3">
            <div>
              <strong className="text-slate-200">File:</strong>{' '}
              <code className="text-sm bg-slate-900 px-2 py-1 rounded">
                {fileName}
              </code>
            </div>
            <div>
              <strong className="text-slate-200">Depot path:</strong>{' '}
              <code className="text-sm bg-slate-900 px-2 py-1 rounded">
                {conflict.depotPath}
              </code>
            </div>
            <div>
              <strong className="text-slate-200">Server action:</strong>{' '}
              {conflict.action}#{conflict.revision}
            </div>
            <div className="pt-2 border-t border-slate-700">
              The server wants to update this file, but you have local changes.
              Choose how to proceed:
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onSkip}
            className="bg-slate-700 hover:bg-slate-600 text-slate-100"
          >
            Skip (Keep Local)
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onOverwrite}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            Overwrite (Force Sync)
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
