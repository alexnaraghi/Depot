import { useOperationStore } from '@/store/operation';
import { useP4Command } from '@/hooks/useP4Command';
import { Progress } from '@/components/ui/progress';
import { Loader2, X } from 'lucide-react';

/**
 * VS Code-style status bar showing current operation.
 * Per CONTEXT.md:
 * - Progress bar when p4 provides progress info, indeterminate spinner otherwise
 * - Cancel button appears only during active cancellable operations
 * - Unobtrusive but informative
 */
export function StatusBar() {
  const { currentOperation } = useOperationStore();
  const { cancel, canCancel, isCancelling } = useP4Command();

  // Don't render if no operation
  if (!currentOperation) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-6 bg-accent border-t border-border px-4 flex items-center" data-testid="status-bar">
        <span className="text-xs text-muted-foreground">Ready</span>
      </div>
    );
  }

  const { status, message, progress } = currentOperation;
  const isActive = status === 'running' || status === 'cancelling';
  const isError = status === 'error';
  const isSuccess = status === 'success';

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 h-6 border-t px-4 flex items-center justify-between text-xs ${
        isError
          ? 'bg-destructive/20 border-destructive/30 text-destructive'
          : isSuccess
          ? 'bg-emerald-900/50 border-emerald-800/30 text-emerald-200'
          : 'bg-primary/20 border-primary/30 text-primary'
      }`}
      data-testid="status-bar"
    >
      {/* Left: Operation status */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Spinner or progress */}
        {isActive && (
          progress === undefined ? (
            <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
          ) : (
            <Progress value={progress} className="w-24 h-1.5 flex-shrink-0" />
          )
        )}

        {/* Message - truncate if too long */}
        <span className="truncate">{message}</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        {canCancel && (
          <button
            onClick={cancel}
            disabled={isCancelling}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Cancel operation"
          >
            <X className="h-3 w-3" />
            <span>Cancel</span>
          </button>
        )}
      </div>
    </div>
  );
}
