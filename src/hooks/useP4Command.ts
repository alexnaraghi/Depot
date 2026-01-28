import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { invokeP4Command, invokeSpawnP4, invokeKillProcess, OutputLine } from '@/lib/tauri';
import { useOperationStore } from '@/store/operation';

/**
 * Hook for short p4 commands that return a result.
 * Good for: p4 info, p4 client, p4 where
 */
export function useP4Query(command: string, args: string[] = [], options?: {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
}) {
  const fullArgs = [command, ...args];

  return useQuery({
    queryKey: ['p4', command, ...args],
    queryFn: async () => {
      return invokeP4Command(fullArgs);
    },
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
  });
}

/**
 * Hook for executing p4 commands with operation tracking.
 * Good for: any command that should show in status bar
 */
export function useP4Command() {
  const {
    currentOperation,
    startOperation,
    setProcessId,
    updateMessage,
    setCancelling,
    completeOperation,
    addOutputLine,
  } = useOperationStore();

  const execute = useCallback(async (
    command: string,
    args: string[] = [],
    options?: {
      streaming?: boolean;
    }
  ): Promise<string | void> => {
    // Check if operation already running
    if (currentOperation && currentOperation.status === 'running') {
      throw new Error('Another operation is already in progress');
    }

    const operationId = `${command}-${Date.now()}`;
    const fullArgs = [command, ...args];

    startOperation(operationId, fullArgs.join(' '));

    try {
      if (options?.streaming) {
        // Long-running command with streaming output
        const processId = await invokeSpawnP4(fullArgs, (output: OutputLine) => {
          addOutputLine(output.line, output.is_stderr);
          // Update message with last line (simple progress indicator)
          if (!output.is_stderr) {
            updateMessage(output.line);
          }
        });

        setProcessId(processId);

        // Note: For streaming commands, completion is detected by process exit
        // which we'd handle via a completion channel. For now, mark as complete
        // after spawn returns (caller handles waiting if needed).
        completeOperation(true);
        return processId;
      } else {
        // Short command, wait for result
        const result = await invokeP4Command(fullArgs);
        completeOperation(true);
        return result;
      }
    } catch (error) {
      completeOperation(false, String(error));
      throw error;
    }
  }, [currentOperation, startOperation, setProcessId, updateMessage, completeOperation, addOutputLine]);

  const cancel = useCallback(async () => {
    if (!currentOperation?.processId) return;

    setCancelling();

    try {
      await invokeKillProcess(currentOperation.processId);
      completeOperation(false, 'Cancelled by user');
    } catch (error) {
      completeOperation(false, `Cancel failed: ${error}`);
    }
  }, [currentOperation, setCancelling, completeOperation]);

  return {
    execute,
    cancel,
    isRunning: currentOperation?.status === 'running',
    isCancelling: currentOperation?.status === 'cancelling',
    canCancel: !!currentOperation?.processId && currentOperation.status === 'running',
  };
}

/**
 * Hook specifically for streaming commands with progress tracking.
 * Good for: p4 sync (long-running with output)
 */
export function useP4StreamingCommand() {
  const { execute, cancel, isRunning, isCancelling, canCancel } = useP4Command();

  const executeStreaming = useCallback(
    (command: string, args: string[] = []) => {
      return execute(command, args, { streaming: true });
    },
    [execute]
  );

  return {
    execute: executeStreaming,
    cancel,
    isRunning,
    isCancelling,
    canCancel,
  };
}
