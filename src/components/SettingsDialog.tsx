import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loadSettings, saveSettings } from '@/lib/settings';
import { invokeListWorkspaces, invokeTestConnection } from '@/lib/tauri';
import { settingsSchema, type P4Settings } from '@/types/settings';
import { useConnectionStore } from '@/stores/connectionStore';
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

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [workspaces, setWorkspaces] = useState<P4Workspace[]>([]);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setConnected } = useConnectionStore();

  const form = useForm<P4Settings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      p4port: '',
      p4user: '',
      p4client: '',
    },
    mode: 'onSubmit',
  });

  // Load settings when dialog opens
  useEffect(() => {
    if (open) {
      const load = async () => {
        try {
          const settings = await loadSettings();
          form.reset(settings);
        } catch (error) {
          console.error('Failed to load settings:', error);
        }
      };
      load();
    }
  }, [open, form]);

  const handleBrowseWorkspaces = async () => {
    const server = form.getValues('p4port');
    const user = form.getValues('p4user');

    if (!server || !user) {
      toast.error('Enter server and user first');
      return;
    }

    setIsBrowsing(true);
    try {
      const result = await invokeListWorkspaces(server, user);
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

  const onSubmit = async (data: P4Settings) => {
    setIsSubmitting(true);
    try {
      // Test connection first
      const info = await invokeTestConnection(data.p4port, data.p4user, data.p4client);

      // Save settings if test passes
      await saveSettings(data);

      // Update connection store
      setConnected({
        workspace: info.client_name,
        stream: info.client_stream || undefined,
        server: info.server_address,
        user: info.user_name,
        p4port: data.p4port,
        p4user: data.p4user,
        p4client: data.p4client,
      });

      toast.success('Settings saved - connection successful');

      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Perforce Settings</DialogTitle>
          <DialogDescription>
            Configure your Perforce server connection
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
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Testing...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
