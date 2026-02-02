import { useEffect } from 'react';
import { useCommandStore, AppCommand } from '@/stores/commandStore';

/**
 * Hook to listen for command dispatches.
 *
 * Automatically subscribes to command store and calls handler when the specified command is dispatched.
 * Handles cleanup automatically.
 *
 * @param command - The command name to listen for
 * @param handler - Callback to execute when command is dispatched
 */
export function useCommand(command: AppCommand, handler: () => void) {
  useEffect(() => {
    let lastSeq = -1;

    const unsubscribe = useCommandStore.subscribe((state) => {
      // Only execute if the command matches and seq changed (new dispatch)
      if (state.pendingCommand === command && state.seq !== lastSeq) {
        lastSeq = state.seq;
        handler();
      }
    });

    return unsubscribe;
  }, [command, handler]);
}
