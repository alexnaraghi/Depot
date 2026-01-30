import { useState, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useQueryClient } from '@tanstack/react-query';
import { FileTree } from '@/components/FileTree/FileTree';
import { ChangelistPanel } from '@/components/ChangelistPanel/ChangelistPanel';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { SettingsDialog } from '@/components/SettingsDialog';
import { SearchBar } from '@/components/SearchBar';
import { CommandPalette } from '@/components/CommandPalette';
import { SyncConflictDialog } from '@/components/dialogs/SyncConflictDialog';
import { ReconcilePreviewDialog } from '@/components/dialogs/ReconcilePreviewDialog';
import { useConnectionStore } from '@/stores/connectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useSync } from '@/hooks/useSync';
import { useFileOperations } from '@/hooks/useFileOperations';
import { useDiff } from '@/hooks/useDiff';
import { ChevronLeft, ChevronRight, Settings, RefreshCw, Download, FolderSync, Plus, FileEdit, Undo2, GitCompare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndContext } from '@/contexts/DndContext';
import { SHORTCUTS } from '@/lib/shortcuts';

/**
 * Main application layout
 *
 * Layout structure:
 * - Unified header with repository info, action buttons, and utilities
 * - Main area: file tree (flexible width)
 * - Resizable sidebar: changelist panel
 * - Sidebar can be collapsed/expanded
 */
export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const { workspace, stream } = useConnectionStore();
  const selectedFile = useFileTreeStore(s => s.selectedFile);
  const queryClient = useQueryClient();

  // Sync and file operations
  const { sync, skipConflict, forceSync, conflict, isRunning, isCancelling } = useSync();
  const { checkout, revert } = useFileOperations();
  const { diffAgainstWorkspace } = useDiff();

  // Expose queryClient globally for command palette
  useEffect(() => {
    (window as any).__queryClient = queryClient;
  }, [queryClient]);

  // Toolbar action handlers
  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  const handleSync = async () => {
    try {
      await sync([]);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleReconcile = () => {
    setReconcileDialogOpen(true);
  };

  const handleNewChangelist = () => {
    window.dispatchEvent(new CustomEvent('p4now:new-changelist'));
  };

  const handleCheckout = () => {
    if (selectedFile) {
      checkout([selectedFile.depotPath]);
    }
  };

  const handleRevert = () => {
    if (selectedFile) {
      revert([selectedFile.depotPath]);
    }
  };

  const handleDiff = () => {
    if (selectedFile) {
      diffAgainstWorkspace(selectedFile.depotPath, selectedFile.localPath);
    }
  };

  // Global keyboard shortcuts
  useHotkeys(SHORTCUTS.REFRESH.keys, handleRefresh, { enableOnFormTags: false, preventDefault: true });
  useHotkeys(SHORTCUTS.SYNC.keys, handleSync, { enableOnFormTags: false, preventDefault: true });
  useHotkeys(SHORTCUTS.NEW_CHANGELIST.keys, handleNewChangelist, { enableOnFormTags: false, preventDefault: true });

  // Command palette shortcuts
  useHotkeys(SHORTCUTS.COMMAND_PALETTE.keys, () => {
    setCommandPaletteOpen(true);
  }, { enableOnFormTags: false, preventDefault: true });

  // Context-sensitive shortcuts - still dispatch events for FileTree/ChangelistPanel to handle
  // (they have access to more context like local paths)
  useHotkeys(SHORTCUTS.DIFF.keys, () => {
    window.dispatchEvent(new CustomEvent('p4now:diff-selected'));
  }, { enableOnFormTags: false, preventDefault: true });

  useHotkeys(SHORTCUTS.HISTORY.keys, () => {
    window.dispatchEvent(new CustomEvent('p4now:history-selected'));
  }, { enableOnFormTags: false, preventDefault: true });

  useHotkeys(SHORTCUTS.REVERT.keys, () => {
    window.dispatchEvent(new CustomEvent('p4now:revert-selected'));
  }, { enableOnFormTags: false, preventDefault: true });

  useHotkeys(SHORTCUTS.SUBMIT.keys, () => {
    window.dispatchEvent(new CustomEvent('p4now:submit'));
  }, { enableOnFormTags: false, preventDefault: true });

  // Listen for 'p4now:open-settings' custom event to open settings dialog
  useEffect(() => {
    const handleOpenSettings = () => setSettingsOpen(true);
    window.addEventListener('p4now:open-settings', handleOpenSettings);
    return () => window.removeEventListener('p4now:open-settings', handleOpenSettings);
  }, []);

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
      {/* Unified Header Toolbar */}
      <header className="bg-slate-900 border-b border-slate-700">
        <div className="flex items-center justify-between px-3 py-1.5">

          {/* LEFT: Repository and Stream info */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Repository</span>
              <span className="text-sm font-medium text-slate-200">{workspace || 'No workspace'}</span>
            </div>
            {stream && (
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Stream</span>
                <span className="text-sm font-medium text-slate-200">{stream}</span>
              </div>
            )}
          </div>

          {/* CENTER: Action buttons - GitKraken style (icon above text, no borders) */}
          <div className="flex items-center gap-1">
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              title={`Refresh (${SHORTCUTS.REFRESH.label})`}
            >
              <RefreshCw className="w-5 h-5" />
              <span className="text-[10px]">Refresh</span>
            </button>

            {/* Sync */}
            <button
              onClick={handleSync}
              disabled={isRunning || isCancelling}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
              title={`Sync Workspace (${SHORTCUTS.SYNC.label})`}
            >
              <Download className={`w-5 h-5 ${isRunning ? 'animate-spin' : ''}`} />
              <span className="text-[10px]">Sync</span>
            </button>

            {/* Reconcile */}
            <button
              onClick={handleReconcile}
              disabled={isRunning || isCancelling}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Reconcile Workspace"
            >
              <FolderSync className="w-5 h-5" />
              <span className="text-[10px]">Reconcile</span>
            </button>

            {/* New Changelist */}
            <button
              onClick={handleNewChangelist}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              title={`New Changelist (${SHORTCUTS.NEW_CHANGELIST.label})`}
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px]">New CL</span>
            </button>

            {/* Checkout */}
            <button
              onClick={handleCheckout}
              disabled={!selectedFile}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Checkout for Edit"
            >
              <FileEdit className="w-5 h-5" />
              <span className="text-[10px]">Checkout</span>
            </button>

            {/* Revert */}
            <button
              onClick={handleRevert}
              disabled={!selectedFile}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
              title={`Revert (${SHORTCUTS.REVERT.label})`}
            >
              <Undo2 className="w-5 h-5" />
              <span className="text-[10px]">Revert</span>
            </button>

            {/* Diff */}
            <button
              onClick={handleDiff}
              disabled={!selectedFile}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
              title={`Diff (${SHORTCUTS.DIFF.label})`}
            >
              <GitCompare className="w-5 h-5" />
              <span className="text-[10px]">Diff</span>
            </button>
          </div>

          {/* RIGHT: Search, connection status, settings */}
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
      </header>

      {/* Settings dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Command palette */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

      {/* Sync conflict dialog */}
      <SyncConflictDialog
        conflict={conflict}
        onSkip={skipConflict}
        onOverwrite={forceSync}
      />

      {/* Reconcile preview dialog */}
      <ReconcilePreviewDialog
        open={reconcileDialogOpen}
        onOpenChange={setReconcileDialogOpen}
      />

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
            className="w-1 bg-slate-700 hover:bg-blue-500 cursor-col-resize active:bg-blue-600"
          />
        )}

        {/* Sidebar */}
        <aside
          className="bg-slate-900 border-l border-slate-700 flex flex-col"
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
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
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
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
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
