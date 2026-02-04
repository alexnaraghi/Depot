import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { loadSettings, saveSettings } from '@/lib/settings';
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

interface Preferences {
  diffToolPath: string;
  diffToolArgs: string;
  editorPath: string;
  verboseLogging: boolean;
  autoRefreshInterval: number;
  showDeletedDepotFiles: boolean;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const form = useForm<Preferences>({
    defaultValues: {
      diffToolPath: '',
      diffToolArgs: '',
      editorPath: '',
      verboseLogging: false,
      autoRefreshInterval: 300000,
      showDeletedDepotFiles: false,
    },
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (open) {
      const load = async () => {
        try {
          const settings = await loadSettings();
          form.reset({
            diffToolPath: settings.diffToolPath || '',
            diffToolArgs: settings.diffToolArgs || '',
            editorPath: settings.editorPath || '',
            verboseLogging: settings.verboseLogging ?? false,
            autoRefreshInterval: settings.autoRefreshInterval ?? 300000,
            showDeletedDepotFiles: settings.showDeletedDepotFiles ?? false,
          });
        } catch (error) {
          console.error('Failed to load settings:', error);
        }
      };
      load();
    }
  }, [open, form]);

  const onSubmit = async (data: Preferences) => {
    try {
      // Merge preferences into existing settings (preserving connection fields)
      const existing = await loadSettings();
      await saveSettings({ ...existing, ...data });
      toast.success('Settings saved');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure application preferences
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div>
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

            <div className="border-t border-border pt-4 mt-2">
              <h3 className="text-sm font-medium text-foreground mb-3">Depot Browser</h3>
              <FormField
                control={form.control}
                name="showDeletedDepotFiles"
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
                      <FormLabel className="text-sm">Show Deleted Files</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Show deleted files and folders in the depot browser
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </div>
            </div>

            <DialogFooter className="mt-4 flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
