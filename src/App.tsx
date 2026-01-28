import { useState } from 'react';
import { StatusBar } from '@/components/StatusBar';
import { OutputPanel } from '@/components/OutputPanel';
import { Toaster } from '@/components/Toaster';
import { useP4Command } from '@/hooks/useP4Command';
import toast from 'react-hot-toast';

function App() {
  const { execute, isRunning } = useP4Command();
  const [result, setResult] = useState<string | null>(null);

  // Demo: Test p4 info command
  const handleTestInfo = async () => {
    try {
      const output = await execute('info');
      if (output) {
        setResult(output);
        toast.success('p4 info completed');
      }
    } catch (error) {
      toast.error(`Command failed: ${error}`);
    }
  };

  // Demo: Test streaming command (would need p4 connected)
  const handleTestSync = async () => {
    try {
      await execute('sync', ['-n'], { streaming: true });
      toast.success('Sync preview completed');
    } catch (error) {
      toast.error(`Sync failed: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Main content area */}
      <main className="flex-1 p-4 pb-32">
        <h1 className="text-2xl font-bold mb-4">P4Now</h1>
        <p className="text-slate-400 mb-6">
          Non-blocking Perforce GUI — Phase 1 Foundation Test
        </p>

        {/* Test buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={handleTestInfo}
            disabled={isRunning}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded transition-colors"
          >
            Test p4 info
          </button>
          <button
            onClick={handleTestSync}
            disabled={isRunning}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded transition-colors"
          >
            Test p4 sync -n
          </button>
        </div>

        {/* Result display */}
        {result && (
          <div className="bg-slate-800 rounded p-4 font-mono text-sm whitespace-pre-wrap">
            {result}
          </div>
        )}
      </main>

      {/* Output panel (above status bar) */}
      <div className="fixed bottom-6 left-0 right-0">
        <OutputPanel />
      </div>

      {/* Status bar (fixed at bottom) */}
      <StatusBar />

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}

export default App;
