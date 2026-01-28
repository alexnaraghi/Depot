import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from '@/components/StatusBar';
import { OutputPanel } from '@/components/OutputPanel';
import { Toaster } from '@/components/Toaster';
import { MainLayout } from '@/components/MainLayout';
import { useP4Events } from '@/hooks/useP4Events';

// Create QueryClient outside component to avoid recreation on re-renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds as per 02-05 decision
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  // Subscribe to all P4 backend events for real-time updates
  useP4Events();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Main application layout */}
      <main className="flex-1 pb-32 overflow-hidden">
        <MainLayout />
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
