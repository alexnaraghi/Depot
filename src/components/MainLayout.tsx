import { useState, useEffect } from 'react';
import { FileTree } from '@/components/FileTree/FileTree';
import { ChangelistPanel } from '@/components/ChangelistPanel/ChangelistPanel';
import { SyncToolbar } from '@/components/SyncToolbar';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { SettingsDialog } from '@/components/SettingsDialog';
import { SearchBar } from '@/components/SearchBar';
import { useConnectionStore } from '@/stores/connectionStore';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndContext } from '@/contexts/DndContext';

/**
 * Main application layout
 *
 * Layout structure:
 * - Header with title and sync toolbar
 * - Main area: file tree (flexible width)
 * - Resizable sidebar: changelist panel
 * - Sidebar can be collapsed/expanded
 */
export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { workspace, stream } = useConnectionStore();

  const handleMouseDown = () => {
    setIsResizing(true);
  };

  // Add/remove mouse event listeners for resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new sidebar width from right edge
      const newWidth = window.innerWidth - e.clientX;

      // Constrain between min (200px) and max (50% of window)
      const minWidth = 200;
      const maxWidth = window.innerWidth * 0.5;
      const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      setSidebarWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing])

  return (
    <DndProvider backend={HTML5Backend}>
    <DndContext>
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700">
        <div className="px-4 py-2 flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-slate-100">P4Now</h1>

          {/* Workspace and stream display */}
          <div className="flex-1 flex items-baseline gap-2">
            <span className="font-medium text-slate-100">
              {workspace || 'No workspace'}
            </span>
            {stream && (
              <span className="text-sm text-slate-400">{stream}</span>
            )}
          </div>

          {/* Search, connection status, and settings */}
          <div className="flex items-center gap-2">
            <SearchBar />
            <ConnectionStatus />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              className="text-slate-400 hover:text-slate-100"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <SyncToolbar />
      </header>

      {/* Settings dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* File tree - takes remaining space */}
        <main className="flex-1 overflow-hidden bg-slate-950">
          <FileTree />
        </main>

        {/* Resize handle */}
        {!sidebarCollapsed && (
          <div
            onMouseDown={handleMouseDown}
            className="w-1 bg-slate-700 hover:bg-blue-500 cursor-col-resize active:bg-blue-600 transition-colors"
          />
        )}

        {/* Sidebar */}
        <aside
          className="bg-slate-900 border-l border-slate-700 flex flex-col transition-all duration-200"
          style={{
            width: sidebarCollapsed ? 0 : `${sidebarWidth}px`,
            minWidth: sidebarCollapsed ? 0 : '200px',
            maxWidth: sidebarCollapsed ? 0 : '50vw',
          }}
        >
          {!sidebarCollapsed && (
            <>
              {/* Collapse button */}
              <div className="flex justify-end p-2 border-b border-slate-700">
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Collapse sidebar"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Changelist panel */}
              <ChangelistPanel className="flex-1 overflow-hidden" />
            </>
          )}
        </aside>

        {/* Expand button when sidebar is collapsed */}
        {sidebarCollapsed && (
          <div className="bg-slate-900 border-l border-slate-700 w-8 flex items-center justify-center">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Expand sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
    </DndContext>
    </DndProvider>
  );
}
