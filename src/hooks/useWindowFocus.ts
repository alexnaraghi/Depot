import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Hook to track window focus state.
 * Returns false when window is minimized, inactive, or blurred.
 * Returns true when window is focused and active.
 */
export function useWindowFocus(): boolean {
  const [isFocused, setIsFocused] = useState(true); // Start optimistic

  useEffect(() => {
    const appWindow = getCurrentWindow();

    const setupListeners = async () => {
      // Listen to focus events
      const unlistenFocus = await appWindow.listen('tauri://focus', () => {
        setIsFocused(true);
      });

      // Listen to blur events (covers minimize + inactive)
      const unlistenBlur = await appWindow.listen('tauri://blur', () => {
        setIsFocused(false);
      });

      return () => {
        unlistenFocus();
        unlistenBlur();
      };
    };

    const unlisten = setupListeners();
    return () => {
      unlisten.then(cleanup => cleanup());
    };
  }, []);

  return isFocused;
}
