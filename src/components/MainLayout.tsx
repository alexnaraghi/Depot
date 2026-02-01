import { useState, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useQueryClient } from '@tanstack/react-query';
import { FileTree } from '@/components/FileTree/FileTree';
import { ChangelistPanel } from '@/components/ChangelistPanel/ChangelistPanel';
import { DetailPane } from '@/components/DetailPane/DetailPane';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { SettingsDialog } from '@/components/SettingsDialog';
import { SearchBar } from '@/components/SearchBar';
import { CommandPalette } from '@/components/CommandPalette';
import { SyncConflictDialog } from '@/components/dialogs/SyncConflictDialog';
import { ReconcilePreviewDialog } from '@/components/dialogs/ReconcilePreviewDialog';
import { WorkspaceSwitcher } from '@/components/Header/WorkspaceSwitcher';
import { StreamSwitcher } from '@/components/Header/StreamSwitcher';
import { DepotBrowser } from '@/components/DepotBrowser/DepotBrowser';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useSync } from '@/hooks/useSync';
import { useFileOperations } from '@/hooks/useFileOperations';
import { useDiff } from '@/hooks/useDiff';
import { Settings, RefreshCw, Download, FolderSync, Plus, FileEdit, Undo2, GitCompare, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndContext } from '@/contexts/DndContext';
import { SHORTCUTS } from '@/lib/shortcuts';
import { getColumnWidths, saveColumnWidths } from '@/lib/settings';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

/**
 * Main application layout
 *
 * Layout structure:
 * - Unified header with workspace info, action buttons, and utilities
 * - Three-column layout:
 *   - Left: File tree (resizable)
 *   - Center: Detail pane (flexible)
 *   - Right: Changelist panel (resizable)
 */
export function MainLayout() {
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(320);
  const [resizingColumn, setResizingColumn] = useState<'left' | 'right' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const selectedFile = useFileTreeStore(s => s.selectedFile);
  const queryClient = useQueryClient();

  // Accordion state with localStorage persistence
  const [workspaceOpen, setWorkspaceOpen] = useState(() => {
    const saved = localStorage.getItem('accordion-workspace');
    return saved !== null ? saved === 'true' : true;
  });
  const [depotOpen, setDepotOpen] = useState(() => {
    const saved = localStorage.getItem('accordion-depot');
    return saved !== null ? saved === 'true' : true;
  });

  // Load saved column widths on mount
  useEffect(() => {
    getColumnWidths().then(({ left, right }) => {
      setLeftWidth(left);
      setRightWidth(right);
    });
  }, []);

  // Persist accordion state
  useEffect(() => {
    localStorage.setItem('accordion-workspace', String(workspaceOpen));
  }, [workspaceOpen]);

  useEffect(() => {
    localStorage.setItem('accordion-depot', String(depotOpen));
  }, [depotOpen]);

  // Sync and file operations
  const { sync, skipConflict, forceSync, conflict, isRunning, isCancelling } = useSync();
  const { checkout, revert } = useFileOperations();
  const { diffAgainstWorkspace } = useDiff();

  // Expose queryClient globally for command palette
  useEffect(() => {
    (window as any).__queryClient = queryClient;
  }, [queryClient]);

  // Toolbar action handlers
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['p4', 'opened'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['p4', 'changes'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['p4', 'shelved'], refetchType: 'all' }),
      ]);
      toast.success('Workspace refreshed');
    } finally {
      setIsRefreshing(false);
    }
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

  // Search shortcuts
  useHotkeys(SHORTCUTS.SEARCH.keys, () => {
    window.dispatchEvent(new CustomEvent('p4now:focus-search'));
  }, { enableOnFormTags: true, preventDefault: true });

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

  const handleLeftResize = () => {
    setResizingColumn('left');
  };

  const handleRightResize = () => {
    setResizingColumn('right');
  };

  // Add/remove mouse event listeners for resize
  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizingColumn === 'left') {
        // Left resize: set width based on mouse X position
        const newWidth = e.clientX;
        const constrainedWidth = Math.max(150, Math.min(500, newWidth));
        setLeftWidth(constrainedWidth);
      } else if (resizingColumn === 'right') {
        // Right resize: calculate width from right edge
        const newWidth = window.innerWidth - e.clientX;
        const constrainedWidth = Math.max(200, Math.min(500, newWidth));
        setRightWidth(constrainedWidth);
      }
    };

    const handleMouseUp = () => {
      // Save column widths when resize completes
      // Use setState callbacks to read latest values (avoid stale closure)
      setLeftWidth(l => {
        setRightWidth(r => {
          saveColumnWidths(l, r);
          return r;
        });
        return l;
      });
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, leftWidth, rightWidth])

  return (
    <DndProvider backend={HTML5Backend}>
    <DndContext>
    <div className="flex flex-col h-full" data-testid="app-ready">
      {/* Unified Header Toolbar */}
      <header className="bg-background border-b border-border">
        <div className="flex items-center justify-between px-3 py-1.5">

          {/* LEFT: Workspace and Stream info */}
          <div className="flex items-center gap-6">
            <WorkspaceSwitcher />
            <StreamSwitcher />
          </div>

          {/* CENTER: Action buttons - GitKraken style (icon above text, no borders) */}
          <div className="flex items-center gap-1">
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              title={`Refresh (${SHORTCUTS.REFRESH.label})`}
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="text-[10px]">Refresh</span>
            </button>

            {/* Sync */}
            <button
              onClick={handleSync}
              disabled={isRunning || isCancelling}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              title={`Sync Workspace (${SHORTCUTS.SYNC.label})`}
              data-testid="sync-button"
            >
              <Download className={`w-5 h-5 ${isRunning ? 'animate-spin' : ''}`} />
              <span className="text-[10px]">Sync</span>
            </button>

            {/* Reconcile */}
            <button
              onClick={handleReconcile}
              disabled={isRunning || isCancelling}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              title="Reconcile Workspace"
            >
              <FolderSync className="w-5 h-5" />
              <span className="text-[10px]">Reconcile</span>
            </button>

            {/* New Changelist */}
            <button
              onClick={handleNewChangelist}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              title={`New Changelist (${SHORTCUTS.NEW_CHANGELIST.label})`}
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px]">New CL</span>
            </button>

            {/* Checkout */}
            <button
              onClick={handleCheckout}
              disabled={!selectedFile}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              title="Checkout for Edit"
            >
              <FileEdit className="w-5 h-5" />
              <span className="text-[10px]">Checkout</span>
            </button>

            {/* Revert */}
            <button
              onClick={handleRevert}
              disabled={!selectedFile}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              title={`Revert (${SHORTCUTS.REVERT.label})`}
            >
              <Undo2 className="w-5 h-5" />
              <span className="text-[10px]">Revert</span>
            </button>

            {/* Diff */}
            <button
              onClick={handleDiff}
              disabled={!selectedFile}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
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
              className="text-muted-foreground hover:text-foreground"
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

      {/* Main content area - Three-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column: Workspace Files and Depot sections */}
        <div style={{ width: `${leftWidth}px`, minWidth: '200px', flexShrink: 0 }} className="flex flex-col overflow-hidden">
          {/* Workspace Files Section */}
          <Collapsible open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50 cursor-pointer select-none">
              Workspace Files
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", workspaceOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="flex-1 min-h-0 overflow-hidden">
              <FileTree />
            </CollapsibleContent>
          </Collapsible>

          {/* Depot Section */}
          <Collapsible open={depotOpen} onOpenChange={setDepotOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50 cursor-pointer border-t border-border select-none">
              Depot
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", depotOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="flex-1 min-h-0 overflow-hidden">
              <DepotBrowser />
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Left resize handle */}
        <div
          onMouseDown={handleLeftResize}
          className="w-1 bg-border hover:bg-primary cursor-col-resize"
        />

        {/* Center column: Detail pane */}
        <div className="flex-1 overflow-hidden">
          <DetailPane />
        </div>

        {/* Right resize handle */}
        <div
          onMouseDown={handleRightResize}
          className="w-1 bg-border hover:bg-primary cursor-col-resize"
        />

        {/* Right column: Changelists */}
        <div style={{ width: `${rightWidth}px`, minWidth: '200px', flexShrink: 0 }} className="overflow-hidden">
          <ChangelistPanel className="h-full" />
        </div>
      </div>
    </div>
    </DndContext>
    </DndProvider>
  );
}
