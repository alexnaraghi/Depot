import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useConnectionStore } from '@/stores/connectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { useOperationStore } from '@/store/operation';
import {
  invokeP4ListStreams,
  invokeP4Opened,
  invokeP4UpdateClientStream,
  invokeP4Info,
  invokeP4Shelve,
  invokeP4CreateChange,
  invokeP4Reopen,
  P4Stream,
  P4FileInfo,
} from '@/lib/tauri';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShelveConfirmDialog } from '@/components/dialogs/ShelveConfirmDialog';

/**
 * Stream dropdown switcher for the header.
 * Displays current stream and allows switching to another stream.
 * Before switching, checks for open files and prompts to shelve them.
 */
export function StreamSwitcher() {
  const { status, p4port, p4user, p4client, workspace, stream, setConnected } = useConnectionStore();
  const clear = useDetailPaneStore(s => s.clear);
  const queryClient = useQueryClient();

  const [streams, setStreams] = useState<P4Stream[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);
  const [shelveDialogOpen, setShelveDialogOpen] = useState(false);
  const [openFiles, setOpenFiles] = useState<P4FileInfo[]>([]);
  const [pendingStream, setPendingStream] = useState<string | null>(null);
  const [isShelving, setIsShelving] = useState(false);

  // Fetch streams when connection params are available
  useEffect(() => {
    if (status === 'connected' && p4port && p4user && p4client) {
      invokeP4ListStreams()
        .then(setStreams)
        .catch(err => {
          console.error('Failed to list streams:', err);
          setStreams([]);
        });
    } else {
      setStreams([]);
    }
  }, [status, p4port, p4user, p4client]);

  // Get short name from stream path (e.g., "main" from "//depot/main")
  const getStreamShortName = (streamPath: string): string => {
    const parts = streamPath.split('/');
    return parts[parts.length - 1] || streamPath;
  };

  // Shelve files and switch stream
  const shelveAndSwitch = async () => {
    if (!pendingStream || !p4port || !p4user || !p4client || !workspace) return;

    setIsShelving(true);
    const { startOperation, completeOperation } = useOperationStore.getState();
    startOperation('stream-switch', `switch stream to ${getStreamShortName(pendingStream)}`);
    try {
      // Group files by changelist
      const filesByChangelist = openFiles.reduce((acc, file) => {
        const clId = file.changelist || 0;
        if (!acc[clId]) {
          acc[clId] = [];
        }
        acc[clId].push(file);
        return acc;
      }, {} as Record<number, P4FileInfo[]>);

      // Shelve each changelist
      for (const [clIdStr, files] of Object.entries(filesByChangelist)) {
        const clId = parseInt(clIdStr);

        if (clId === 0) {
          // Default changelist: create new CL, reopen files to it, then shelve
          const newClId = await invokeP4CreateChange(
            `Auto-shelve before stream switch to ${getStreamShortName(pendingStream)}`
          );

          // Reopen files to new changelist
          const depotPaths = files.map(f => f.depot_path);
          await invokeP4Reopen(depotPaths, newClId);

          // Shelve the new changelist
          await invokeP4Shelve(newClId, []);
        } else {
          // Numbered changelist: shelve all files in it
          await invokeP4Shelve(clId, []);
        }
      }

      // All files shelved, now switch stream
      await invokeP4UpdateClientStream(workspace, pendingStream);

      // Get fresh info and update connection store
      const info = await invokeP4Info();
      setConnected({
        workspace: info.client_name,
        stream: info.client_stream || undefined,
        server: info.server_address,
        user: info.user_name,
        p4port,
        p4user,
        p4client,
      });

      // Clear file tree (workspace-specific) and invalidate queries to refresh all data
      useFileTreeStore.setState({ files: new Map(), selectedFile: null });
      await queryClient.invalidateQueries();

      // Reset detail pane
      clear();

      completeOperation(true);
      toast.success(`Switched to stream ${getStreamShortName(pendingStream)}`);

      // Close dialog and reset state
      setShelveDialogOpen(false);
      setPendingStream(null);
      setOpenFiles([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      completeOperation(false, message);
      toast.error(`Failed to switch stream: ${message}`);
    } finally {
      setIsShelving(false);
      setIsSwitching(false);
    }
  };

  // Handle stream switch
  const handleSwitch = async (newStream: string) => {
    if (!p4port || !p4user || !p4client || !workspace || newStream === stream) return;

    setIsSwitching(true);
    setPendingStream(newStream);

    try {
      // Check for open files
      const files = await invokeP4Opened();

      if (files.length > 0) {
        // Have open files - show confirmation dialog
        setOpenFiles(files);
        setShelveDialogOpen(true);
        // Don't set isSwitching to false - keeps dropdown disabled until shelve completes or cancels
      } else {
        // No open files - switch directly
        const { startOperation, completeOperation } = useOperationStore.getState();
        startOperation('stream-switch', `switch stream to ${getStreamShortName(newStream)}`);

        await invokeP4UpdateClientStream(workspace, newStream);

        // Get fresh info and update connection store
        const info = await invokeP4Info();
        setConnected({
          workspace: info.client_name,
          stream: info.client_stream || undefined,
          server: info.server_address,
          user: info.user_name,
          p4port,
          p4user,
          p4client,
        });

        // Clear file tree (workspace-specific) and invalidate queries to refresh all data
        useFileTreeStore.setState({ files: new Map(), selectedFile: null });
        await queryClient.invalidateQueries();

        // Reset detail pane
        clear();

        completeOperation(true);
        toast.success(`Switched to stream ${getStreamShortName(newStream)}`);
        setIsSwitching(false);
        setPendingStream(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to switch stream: ${message}`);
      setIsSwitching(false);
      setPendingStream(null);
    }
  };

  // Handle dialog cancel
  const handleCancel = () => {
    setShelveDialogOpen(false);
    setPendingStream(null);
    setOpenFiles([]);
    setIsSwitching(false);
  };

  // Don't render if not connected or no stream (classic depot workspace)
  if (status !== 'connected' || !stream) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Stream
        </span>
        <Select
          value={stream || ''}
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
                  {getStreamShortName(stream)}
                </span>
              </SelectValue>
            )}
          </SelectTrigger>
          <SelectContent>
            {streams.map((s) => (
              <SelectItem key={s.stream} value={s.stream}>
                <div className="flex flex-col">
                  <span>{getStreamShortName(s.stream)}</span>
                  <span className="text-xs text-muted-foreground">{s.stream}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ShelveConfirmDialog
        open={shelveDialogOpen}
        onOpenChange={setShelveDialogOpen}
        files={openFiles}
        onConfirm={shelveAndSwitch}
        onCancel={handleCancel}
        isShelving={isShelving}
      />
    </>
  );
}
