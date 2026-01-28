import { Toaster as HotToaster } from 'react-hot-toast';

/**
 * Toast notification container.
 * Per CONTEXT.md:
 * - Non-blocking error notifications
 * - Auto-dismiss after 5-10 seconds
 * - Positioned bottom-right (above status bar)
 */
export function Toaster() {
  return (
    <HotToaster
      position="bottom-right"
      toastOptions={{
        // Default duration: 5 seconds
        duration: 5000,

        // Styling to match app theme
        style: {
          background: '#1e293b', // slate-800
          color: '#f1f5f9', // slate-100
          border: '1px solid #334155', // slate-700
        },

        // Error toasts stay longer
        error: {
          duration: 8000,
          style: {
            background: '#7f1d1d', // red-900
            color: '#fef2f2', // red-50
            border: '1px solid #991b1b', // red-800
          },
        },

        // Success toasts are brief
        success: {
          duration: 3000,
          style: {
            background: '#14532d', // green-900
            color: '#f0fdf4', // green-50
            border: '1px solid #166534', // green-800
          },
        },
      }}
      // Position above status bar (24px = h-6)
      containerStyle={{
        bottom: 32,
      }}
    />
  );
}
