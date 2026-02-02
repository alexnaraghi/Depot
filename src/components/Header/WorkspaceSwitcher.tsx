import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useConnectionStore } from '@/stores/connectionStore';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { invokeListWorkspaces, invokeP4Info, P4Workspace } from '@/lib/tauri';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ClientSpecDialog } from './ClientSpecDialog';

/**
 * Workspace dropdown switcher for the header.
 * Displays current workspace and allows switching to another workspace.
 */
export function WorkspaceSwitcher() {
  const { status, p4port, p4user, p4client, workspace, setConnected } = useConnectionStore();
  const clear = useDetailPaneStore(s => s.clear);
  const queryClient = useQueryClient();

  const [workspaces, setWorkspaces] = useState<P4Workspace[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);
  const [clientSpecOpen, setClientSpecOpen] = useState(false);

  // Fetch workspaces when connection params are available
  useEffect(() => {
    if (p4port && p4user) {
      invokeListWorkspaces(p4port, p4user)
        .then(setWorkspaces)
        .catch(err => {
          console.error('Failed to list workspaces:', err);
          setWorkspaces([]);
        });
    } else {
      setWorkspaces([]);
    }
  }, [p4port, p4user]);

  // Handle workspace switch
  const handleSwitch = async (newClient: string) => {
    if (!p4port || !p4user || newClient === p4client) return;

    setIsSwitching(true);
    try {
      // Validate new workspace and get updated info
      const info = await invokeP4Info();

      // Update connection store atomically
      setConnected({
        workspace: info.client_name,
        stream: info.client_stream || undefined,
        server: info.server_address,
        user: info.user_name,
        p4port,
        p4user,
        p4client: newClient,
      });

      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();

      // Reset detail pane to workspace summary
      clear();

      toast.success(`Switched to workspace ${newClient}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to switch workspace: ${message}`);
    } finally {
      setIsSwitching(false);
    }
  };

  // Show disconnected state
  if (status !== 'connected') {
    return (
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Workspace
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          No workspace
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Workspace
          </span>
          <Select
            value={workspace || ''}
            onValueChange={handleSwitch}
            disabled={isSwitching}
          >
            <SelectTrigger className="h-auto min-w-[180px] w-auto border-0 px-0 py-0 shadow-none focus:ring-0 hover:bg-transparent">
              {isSwitching ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-sm font-medium">Switching...</span>
                </div>
              ) : (
                <SelectValue>
                  <span className="text-sm font-medium text-foreground">
                    {workspace || 'No workspace'}
                  </span>
                </SelectValue>
              )}
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((ws) => (
                <SelectItem key={ws.name} value={ws.name}>
                  <div className="flex flex-col">
                    <span>{ws.name}</span>
                    {ws.root && (
                      <span className="text-xs text-muted-foreground">{ws.root}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {workspace && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setClientSpecOpen(true)}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            title="View Client Spec"
          >
            <FileText className="w-4 h-4" />
          </Button>
        )}
      </div>

      <ClientSpecDialog
        open={clientSpecOpen}
        onOpenChange={setClientSpecOpen}
        workspace={workspace || ''}
      />
    </>
  );
}
