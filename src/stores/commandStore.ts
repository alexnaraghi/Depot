import { create } from 'zustand';

export type AppCommand =
  | 'sync'
  | 'reconcile'
  | 'new-changelist'
  | 'submit'
  | 'checkout-selected'
  | 'diff-selected'
  | 'revert-selected'
  | 'history-selected'
  | 'focus-search'
  | 'open-settings'
  | 'open-connection';

interface CommandState {
  /** Monotonically increasing counter to distinguish repeated same-command dispatches */
  seq: number;
  /** The pending command, or null if none */
  pendingCommand: AppCommand | null;
  dispatch: (command: AppCommand) => void;
  clear: () => void;
}

export const useCommandStore = create<CommandState>((set) => ({
  seq: 0,
  pendingCommand: null,
  dispatch: (command) => set((s) => ({ pendingCommand: command, seq: s.seq + 1 })),
  clear: () => set({ pendingCommand: null }),
}));
