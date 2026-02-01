import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
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
      diffToolPath: '',
      diffToolArgs: '',
      editorPath: '',
      verboseLogging: false,
      autoRefreshInterval: 300000,
    },
    mode: 'onSubmit',
  });

  // Watch form values so Browse always has current input values
  const watchedPort = form.watch('p4port');
  const watchedUser = form.watch('p4user');

  // Load settings when dialog opens (only reset form if saved settings exist)
  useEffect(() => {
    if (open) {
      const load = async () => {
        try {
          const settings = await loadSettings();
          // Only reset form if there are actual saved settings
          // Prevents wiping user-typed values with empty defaults
          if (settings.p4port || settings.p4user || settings.p4client || settings.diffToolPath || settings.editorPath || settings.autoRefreshInterval) {
            form.reset(settings);
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

            <div className="border-t border-border pt-4 mt-2">
              <h3 className="text-sm font-medium text-foreground mb-3">Diff Tool</h3>

              <FormField
                control={form.control}
                name="diffToolPath"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Diff Tool Path</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="code, p4merge, /path/to/difftool"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Path to your external diff tool (e.g., code, p4merge, or full path)
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="diffToolArgs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Diff Tool Arguments (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="--diff {left} {right}"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Optional: Use {'{left}'} and {'{right}'} as placeholders, or leave empty to append files as final arguments
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t border-border pt-4 mt-2">
              <h3 className="text-sm font-medium text-foreground mb-3">Logging</h3>
              <FormField
                control={form.control}
                name="verboseLogging"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="text-sm">Verbose Logging</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Log read-only P4 commands to the output panel
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t border-border pt-4 mt-2">
              <h3 className="text-sm font-medium text-foreground mb-3">External Editor</h3>
              <FormField
                control={form.control}
                name="editorPath"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Editor Path</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          placeholder="code, notepad++, /path/to/editor"
                          {...field}
                          className="flex-1"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          const selected = await openDialog({
                            multiple: false,
                            directory: false,
                            filters: [{ name: 'Executable', extensions: ['exe'] }]
                          });
                          if (selected) field.onChange(selected as string);
                        }}
                      >
                        Browse
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Path to external text editor (e.g., code, notepad++, or full path)
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t border-border pt-4 mt-2">
              <h3 className="text-sm font-medium text-foreground mb-3">Auto-Refresh</h3>
              <FormField
                control={form.control}
                name="autoRefreshInterval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Refresh Interval</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value, 10))}
                      value={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select refresh interval" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">Disabled</SelectItem>
                        <SelectItem value="30000">30 seconds</SelectItem>
                        <SelectItem value="60000">1 minute</SelectItem>
                        <SelectItem value="120000">2 minutes</SelectItem>
                        <SelectItem value="300000">5 minutes</SelectItem>
                        <SelectItem value="600000">10 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Automatically refresh workspace state. Pauses during operations and when window is minimized.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
