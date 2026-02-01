import { useState, useEffect } from 'react';
import { Loader2, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { invokeP4GetClientSpec, P4ClientSpec } from '@/lib/tauri';
import { useConnectionStore } from '@/stores/connectionStore';
import { cn } from '@/lib/utils';

interface ClientSpecDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: string;
}

/**
 * ClientSpecDialog displays the full client spec for a workspace in a read-only format.
 * Allows users to view workspace configuration including root, stream, view mappings, and options.
 */
export function ClientSpecDialog({
  open,
  onOpenChange,
  workspace,
}: ClientSpecDialogProps) {
  const { p4port, p4user } = useConnectionStore();
  const [spec, setSpec] = useState<P4ClientSpec | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch spec when dialog opens
  useEffect(() => {
    if (open && workspace && p4port && p4user) {
      const fetchSpec = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const result = await invokeP4GetClientSpec(workspace, p4port, p4user);
          setSpec(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
        } finally {
          setIsLoading(false);
        }
      };

      fetchSpec();
    }
  }, [open, workspace, p4port, p4user]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Client Spec: {workspace}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
            <p className="text-sm text-muted-foreground">Loading client spec...</p>
          </div>
        ) : error ? (
          <div className="py-6">
            <p className="text-sm text-red-400">Failed to load client spec: {error}</p>
          </div>
        ) : spec ? (
          <div className="space-y-3">
            <SpecField label="Client" value={spec.client} />
            <SpecField label="Root" value={spec.root} copyable />
            {spec.stream && <SpecField label="Stream" value={spec.stream} copyable />}
            {!spec.stream && <SpecField label="Stream" value="None" />}
            <SpecField label="Owner" value={spec.owner} />
            <SpecField label="Description" value={spec.description} multiline />
            <SpecField label="Options" value={spec.options} />
            <SpecField label="Host" value={spec.host} />
            <SpecField label="Submit Options" value={spec.submit_options} />

            {/* View mappings */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">View</label>
              <div className="bg-muted/50 rounded border border-border p-3 max-h-48 overflow-y-auto">
                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                  {spec.view.join('\n')}
                </pre>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface SpecFieldProps {
  label: string;
  value: string;
  copyable?: boolean;
  multiline?: boolean;
}

function SpecField({ label, value, copyable = false, multiline = false }: SpecFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <div className="flex items-start gap-2">
        <div className={cn(
          'flex-1 px-3 py-2 bg-muted/50 rounded border border-border',
          multiline ? 'min-h-[80px]' : ''
        )}>
          {multiline ? (
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">{value}</p>
          ) : (
            <p className="text-sm text-foreground break-all">{value}</p>
          )}
        </div>
        {copyable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 w-8 p-0"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
