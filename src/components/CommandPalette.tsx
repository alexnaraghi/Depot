import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { SHORTCUTS } from '@/lib/shortcuts';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useChangelistStore } from '@/stores/changelistStore';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import {
  RefreshCw,
  Download,
  FolderSync,
  Plus,
  Upload,
  GitCompare,
  Undo2,
  History,
  Edit3,
  Settings,
  Search,
  FolderSearch,
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Command palette for quick access to all operations
 *
 * Features:
 * - Fuzzy search via cmdk built-in filtering
 * - Grouped commands (Workspace, Changelist, File, Navigation)
 * - Keyboard shortcut hints for commands that have shortcuts
 * - Custom event dispatch for cross-component communication
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const selectedFile = useFileTreeStore(s => s.selectedFile);
  const hasFileSelected = selectedFile !== null;
  const changelists = useChangelistStore(s => s.changelists);
  const hasSubmittableChangelist = Array.from(changelists.values()).some(
    cl => cl.id !== 0 && cl.files.length > 0
  );

  function executeCommand(action: () => void) {
    action();
    onOpenChange(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command..." />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>

        {/* Workspace Commands */}
        <CommandGroup heading="Workspace">
          <CommandItem
            onSelect={() =>
              executeCommand(() => {
                const queryClient = (window as any).__queryClient;
                if (queryClient) {
                  queryClient.invalidateQueries();
                }
              })
            }
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
            <CommandShortcut>{SHORTCUTS.REFRESH.label}</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              executeCommand(() => {
                window.dispatchEvent(new CustomEvent('p4now:sync'));
              })
            }
          >
            <Download className="w-4 h-4" />
            <span>Sync Workspace</span>
            <CommandShortcut>{SHORTCUTS.SYNC.label}</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              executeCommand(() => {
                window.dispatchEvent(new CustomEvent('p4now:reconcile'));
              })
            }
          >
            <FolderSync className="w-4 h-4" />
            <span>Reconcile Workspace</span>
          </CommandItem>
        </CommandGroup>

        {/* Changelist Commands */}
        <CommandGroup heading="Changelist">
          <CommandItem
            onSelect={() =>
              executeCommand(() => {
                window.dispatchEvent(new CustomEvent('p4now:new-changelist'));
              })
            }
          >
            <Plus className="w-4 h-4" />
            <span>New Changelist</span>
            <CommandShortcut>{SHORTCUTS.NEW_CHANGELIST.label}</CommandShortcut>
          </CommandItem>

          <CommandItem
            disabled={!hasSubmittableChangelist}
            onSelect={() =>
              executeCommand(() => {
                window.dispatchEvent(new CustomEvent('p4now:submit'));
              })
            }
          >
            <Upload className="w-4 h-4" />
            <span>Submit</span>
            {!hasSubmittableChangelist && <span className="ml-1 text-xs text-muted-foreground">(no files to submit)</span>}
            <CommandShortcut>{SHORTCUTS.SUBMIT.label}</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {/* File Commands (context-sensitive) */}
        <CommandGroup heading="File">
          <CommandItem
            disabled={!hasFileSelected}
            onSelect={() =>
              executeCommand(() => {
                window.dispatchEvent(new CustomEvent('p4now:checkout-selected'));
              })
            }
          >
            <Edit3 className="w-4 h-4" />
            <span>Checkout</span>
            {!hasFileSelected && <span className="ml-1 text-xs text-muted-foreground">(select a file)</span>}
          </CommandItem>

          <CommandItem
            disabled={!hasFileSelected}
            onSelect={() =>
              executeCommand(() => {
                window.dispatchEvent(new CustomEvent('p4now:diff-selected'));
              })
            }
          >
            <GitCompare className="w-4 h-4" />
            <span>Diff</span>
            {!hasFileSelected && <span className="ml-1 text-xs text-muted-foreground">(select a file)</span>}
            <CommandShortcut>{SHORTCUTS.DIFF.label}</CommandShortcut>
          </CommandItem>

          <CommandItem
            disabled={!hasFileSelected}
            onSelect={() =>
              executeCommand(() => {
                window.dispatchEvent(new CustomEvent('p4now:revert-selected'));
              })
            }
          >
            <Undo2 className="w-4 h-4" />
            <span>Revert</span>
            {!hasFileSelected && <span className="ml-1 text-xs text-muted-foreground">(select a file)</span>}
            <CommandShortcut>{SHORTCUTS.REVERT.label}</CommandShortcut>
          </CommandItem>

          <CommandItem
            disabled={!hasFileSelected}
            onSelect={() =>
              executeCommand(() => {
                window.dispatchEvent(new CustomEvent('p4now:history-selected'));
              })
            }
          >
            <History className="w-4 h-4" />
            <span>File History</span>
            {!hasFileSelected && <span className="ml-1 text-xs text-muted-foreground">(select a file)</span>}
            <CommandShortcut>{SHORTCUTS.HISTORY.label}</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {/* Search Commands */}
        <CommandGroup heading="Search">
          <CommandItem
            onSelect={() =>
              executeCommand(() => {
                useDetailPaneStore.getState().navigateToSearch('submitted', '');
              })
            }
          >
            <Search className="w-4 h-4" />
            <span>Search Submitted Changelists</span>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              executeCommand(() => {
                useDetailPaneStore.getState().navigateToSearch('depot', '');
              })
            }
          >
            <FolderSearch className="w-4 h-4" />
            <span>Search Depot Paths</span>
          </CommandItem>
        </CommandGroup>

        {/* Navigation Commands */}
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() =>
              executeCommand(() => {
                window.dispatchEvent(new CustomEvent('p4now:open-settings'));
              })
            }
          >
            <Settings className="w-4 h-4" />
            <span>Open Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
