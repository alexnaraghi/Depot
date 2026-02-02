import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { loadSettings, saveSettings } from '@/lib/settings';
import { invokeListWorkspaces, invokeTestConnection } from '@/lib/tauri';
import { useConnectionStore } from '@/stores/connectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { useChangelistStore } from '@/stores/changelistStore';
import { useSearchFilterStore } from '@/stores/searchFilterStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import toast from 'react-hot-toast';
import type { P4Workspace } from '@/lib/tauri';

const connectionSchema = z.object({
  p4port: z.string().min(1, 'Server address is required'),
  p4user: z.string().min(1, 'Username is required'),
  p4client: z.string().min(1, 'Workspace is required'),
});

type ConnectionFields = z.infer<typeof connectionSchema>;

interface ConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionDialog({ open, onOpenChange }: ConnectionDialogProps) {
  const [workspaces, setWorkspaces] = useState<P4Workspace[]>([]);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { status, setConnected, setDisconnected } = useConnectionStore();
  const queryClient = useQueryClient();

  const form = useForm<ConnectionFields>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      p4port: '',
      p4user: '',
      p4client: '',
    },
    mode: 'onSubmit',
  });

  const watchedPort = form.watch('p4port');
  const watchedUser = form.watch('p4user');

  useEffect(() => {
    if (open) {
      const load = async () => {
        try {
          const settings = await loadSettings();
          if (settings.p4port || settings.p4user || settings.p4client) {
            form.reset({
              p4port: settings.p4port,
              p4user: settings.p4user,
              p4client: settings.p4client,
            });
          }
        } catch (error) {
          console.error('Failed to load settings:', error);
        }
      };
      load();
    }
  }, [open, form]);

  const handleBrowseWorkspaces = async () => {
    if (!watchedPort || !watchedUser) {
      toast.error('Enter server and user first');
      return;
    }

    setIsBrowsing(true);
    try {
      const result = await invokeListWorkspaces(watchedPort, watchedUser);
      setWorkspaces(result);
      if (result.length === 0) {
        toast('No workspaces found for this user');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      setWorkspaces([]);
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnected();

    // Cancel in-flight queries then reset all query data to undefined
    await queryClient.cancelQueries();
    queryClient.removeQueries();

    // Reset all stores to empty state
    useFileTreeStore.setState({ files: new Map(), rootPath: null, selectedFile: null, isLoading: false });
    useChangelistStore.setState({ changelists: new Map(), isLoading: false });
    useDetailPaneStore.getState().clear();
    useSearchFilterStore.getState().clearFilter();

    // Clear connection fields in saved settings
    try {
      const settings = await loadSettings();
      await saveSettings({ ...settings, p4port: '', p4user: '', p4client: '' });
    } catch {
      // ignore
    }
    form.reset({ p4port: '', p4user: '', p4client: '' });
    setWorkspaces([]);
    toast.success('Disconnected');
  };

  const onSubmit = async (data: ConnectionFields) => {
    setIsSubmitting(true);
    try {
      const info = await invokeTestConnection(data.p4port, data.p4user, data.p4client);

      // Merge connection fields into existing settings
      const existing = await loadSettings();
      await saveSettings({ ...existing, ...data });

      setConnected({
        workspace: info.client_name,
        stream: info.client_stream || undefined,
        server: info.server_address,
        user: info.user_name,
        p4port: data.p4port,
        p4user: data.p4user,
        p4client: data.p4client,
      });

      // Force all queries to refetch now that we're connected
      await queryClient.invalidateQueries();

      toast.success('Connected to Perforce');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[475px]">
        <DialogHeader>
          <DialogTitle>Connect to Perforce</DialogTitle>
          <DialogDescription>
            Enter your Perforce server connection details
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="p4port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server</FormLabel>
                  <FormControl>
                    <Input placeholder="ssl:perforce.example.com:1666" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="p4user"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User</FormLabel>
                  <FormControl>
                    <Input placeholder="username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="p4client"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input placeholder="workspace-name" {...field} className="flex-1" />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBrowseWorkspaces}
                      disabled={isBrowsing}
                    >
                      {isBrowsing ? 'Browsing...' : 'Browse'}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {workspaces.length > 0 && (
              <FormField
                control={form.control}
                name="p4client"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select from available workspaces</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a workspace" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {workspaces.map((ws) => (
                          <SelectItem key={ws.name} value={ws.name}>
                            <div className="flex flex-col">
                              <span className="font-medium">{ws.name}</span>
                              {ws.stream && (
                                <span className="text-xs text-muted-foreground">{ws.stream}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              {status === 'connected' && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={isSubmitting}
                  className="mr-auto"
                >
                  Disconnect
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Connecting...' : 'Connect'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
