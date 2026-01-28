import { create } from 'zustand';

export type OperationStatus = 'idle' | 'running' | 'cancelling' | 'error' | 'success';

export interface Operation {
  id: string;
  command: string;
  status: OperationStatus;
  message: string;
  progress?: number; // 0-100, undefined = indeterminate
  processId?: string; // Backend process ID for cancellation
  startedAt: number;
  error?: string;
}

export interface OutputLine {
  line: string;
  isStderr: boolean;
  timestamp: number;
}

interface OperationState {
  // Current operation (one at a time per CONTEXT.md)
  currentOperation: Operation | null;

  // Output lines for collapsible panel
  outputLines: OutputLine[];

  // Actions
  startOperation: (id: string, command: string, processId?: string) => void;
  updateProgress: (progress: number, message?: string) => void;
  updateMessage: (message: string) => void;
  setProcessId: (processId: string) => void;
  setCancelling: () => void;
  completeOperation: (success: boolean, error?: string) => void;
  clearOperation: () => void;

  // Output actions
  addOutputLine: (line: string, isStderr: boolean) => void;
  clearOutput: () => void;
}

export const useOperationStore = create<OperationState>((set, get) => ({
  currentOperation: null,
  outputLines: [],

  startOperation: (id, command, processId) => {
    set({
      currentOperation: {
        id,
        command,
        status: 'running',
        message: `Running: p4 ${command}`,
        processId,
        startedAt: Date.now(),
      },
      outputLines: [], // Clear previous output
    });
  },

  updateProgress: (progress, message) => {
    const current = get().currentOperation;
    if (current) {
      set({
        currentOperation: {
          ...current,
          progress,
          message: message ?? current.message,
        },
      });
    }
  },

  updateMessage: (message) => {
    const current = get().currentOperation;
    if (current) {
      set({
        currentOperation: { ...current, message },
      });
    }
  },

  setProcessId: (processId) => {
    const current = get().currentOperation;
    if (current) {
      set({
        currentOperation: { ...current, processId },
      });
    }
  },

  setCancelling: () => {
    const current = get().currentOperation;
    if (current) {
      set({
        currentOperation: {
          ...current,
          status: 'cancelling',
          message: 'Cancelling...',
        },
      });
    }
  },

  completeOperation: (success, error) => {
    const current = get().currentOperation;
    if (current) {
      set({
        currentOperation: {
          ...current,
          status: success ? 'success' : 'error',
          message: success ? 'Completed' : (error ?? 'Failed'),
          error,
          progress: success ? 100 : current.progress,
        },
      });

      // Auto-clear after success (status bar can show briefly)
      if (success) {
        setTimeout(() => {
          if (get().currentOperation?.id === current.id) {
            set({ currentOperation: null });
          }
        }, 2000);
      }
    }
  },

  clearOperation: () => {
    set({ currentOperation: null });
  },

  addOutputLine: (line, isStderr) => {
    set((state) => ({
      outputLines: [
        ...state.outputLines,
        { line, isStderr, timestamp: Date.now() },
      ],
    }));
  },

  clearOutput: () => {
    set({ outputLines: [] });
  },
}));
