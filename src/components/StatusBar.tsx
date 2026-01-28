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
      <div className="fixed bottom-0 left-0 right-0 h-6 bg-slate-800 border-t border-slate-700 px-4 flex items-center">
        <span className="text-xs text-slate-400">Ready</span>
      </div>
    );
  }

  const { status, message, progress } = currentOperation;
  const isActive = status === 'running' || status === 'cancelling';
  const isError = status === 'error';
  const isSuccess = status === 'success';

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 h-6 border-t px-4 flex items-center justify-between text-xs transition-colors ${
        isError
          ? 'bg-red-900 border-red-800 text-red-100'
          : isSuccess
          ? 'bg-green-900 border-green-800 text-green-100'
          : 'bg-blue-900 border-blue-800 text-blue-100'
      }`}
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
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
