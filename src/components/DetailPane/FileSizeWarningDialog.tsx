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

interface FileSizeWarningDialogProps {
  open: boolean;
  fileSize: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Format bytes to human-readable file size.
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Warning dialog shown when user attempts to load a large file (1-10MB).
 * Allows user to confirm they want to proceed despite potential slowness.
 */
export function FileSizeWarningDialog({
  open,
  fileSize,
  onConfirm,
  onCancel,
}: FileSizeWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Large File Warning</AlertDialogTitle>
          <AlertDialogDescription>
            This file is {formatFileSize(fileSize)}. Loading large files may be slow and could
            impact application performance.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Load Anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
