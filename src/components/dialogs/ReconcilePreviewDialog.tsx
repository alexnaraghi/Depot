import { useEffect, useState } from 'react';
import { FolderSync, Loader2, Plus, Edit3, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useReconcile } from '@/hooks/useReconcile';
import { ReconcilePreview } from '@/lib/tauri';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { invokeP4Changes } from '@/lib/tauri';
import { useConnectionStore } from '@/stores/connectionStore';

interface ReconcilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Reconcile Preview Dialog
 *
 * Scans workspace for offline changes and shows preview with file selection:
 * - Groups files by action type (add, edit, delete)
 * - Checkboxes for individual file selection
 * - Select all/none controls
 * - Target changelist picker
 * - Apply button to reconcile selected files
 */
export function ReconcilePreviewDialog({
  open,
  onOpenChange,
}: ReconcilePreviewDialogProps) {
  const [previewFiles, setPreviewFiles] = useState<ReconcilePreview[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [targetChangelistId, setTargetChangelistId] = useState<string>('default');
  const { reconcilePreview, reconcileApply } = useReconcile();
  const { p4port, p4user, p4client } = useConnectionStore();

  // Fetch pending changelists for the picker
  const { data: changelists } = useQuery({
    queryKey: ['p4', 'changes', 'pending', p4port, p4user, p4client],
    queryFn: () => invokeP4Changes('pending', p4port ?? undefined, p4user ?? undefined, p4client ?? undefined),
    enabled: open,
  });

  // Trigger scan when dialog opens
  useEffect(() => {
    if (open) {
      const runScan = async () => {
        setIsScanning(true);
        setPreviewFiles([]);
        setSelectedPaths(new Set());
        setTargetChangelistId('default');

        try {
          const results = await reconcilePreview.mutateAsync();
          setPreviewFiles(results);
          // Select all files by default
          setSelectedPaths(new Set(results.map(f => f.depotPath)));
        } catch (error) {
          console.error('Reconcile preview failed:', error);
        } finally {
          setIsScanning(false);
        }
      };

      runScan();
    }
  }, [open]);

  // Group files by action
  const filesByAction = {
    add: previewFiles.filter(f => f.action === 'add'),
    edit: previewFiles.filter(f => f.action === 'edit'),
    delete: previewFiles.filter(f => f.action === 'delete'),
  };

  const handleToggleFile = (depotPath: string) => {
    const newSelected = new Set(selectedPaths);
    if (newSelected.has(depotPath)) {
      newSelected.delete(depotPath);
    } else {
      newSelected.add(depotPath);
    }
    setSelectedPaths(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedPaths(new Set(previewFiles.map(f => f.depotPath)));
  };

  const handleSelectNone = () => {
    setSelectedPaths(new Set());
  };

  const handleApply = async () => {
    if (selectedPaths.size === 0) return;

    try {
      const filePaths = Array.from(selectedPaths);
      const changelistId = targetChangelistId === 'default' ? undefined : parseInt(targetChangelistId, 10);

      await reconcileApply.mutateAsync({ filePaths, changelistId });
      onOpenChange(false);
    } catch (error) {
      console.error('Reconcile apply failed:', error);
    }
  };

  const truncatePath = (depotPath: string) => {
    const parts = depotPath.split('/');
    if (parts.length <= 3) return depotPath;
    return '.../' + parts.slice(-3).join('/');
  };

  const selectedCount = selectedPaths.size;
  const totalCount = previewFiles.length;
  const isApplying = reconcileApply.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FolderSync className="w-5 h-5" />
            <DialogTitle>Reconcile Workspace</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isScanning ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
              <p className="text-sm text-muted-foreground">Scanning workspace for offline changes...</p>
            </div>
          ) : previewFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No offline changes detected</p>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="h-8"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectNone}
                    className="h-8"
                  >
                    Select None
                  </Button>
                </div>
                <span className="text-sm text-muted-foreground">
                  {selectedCount} of {totalCount} file{totalCount !== 1 ? 's' : ''} selected
                </span>
              </div>

              {/* File groups */}
              <div className="space-y-4">
                {filesByAction.add.length > 0 && (
                  <FileGroup
                    title={`Files to Add (${filesByAction.add.length})`}
                    files={filesByAction.add}
                    selectedPaths={selectedPaths}
                    onToggle={handleToggleFile}
                    actionIcon={<Plus className="w-4 h-4" />}
                    actionColor="text-green-400"
                    badgeColor="bg-green-500/20 text-green-400"
                    truncatePath={truncatePath}
                  />
                )}
                {filesByAction.edit.length > 0 && (
                  <FileGroup
                    title={`Files to Edit (${filesByAction.edit.length})`}
                    files={filesByAction.edit}
                    selectedPaths={selectedPaths}
                    onToggle={handleToggleFile}
                    actionIcon={<Edit3 className="w-4 h-4" />}
                    actionColor="text-yellow-400"
                    badgeColor="bg-yellow-500/20 text-yellow-400"
                    truncatePath={truncatePath}
                  />
                )}
                {filesByAction.delete.length > 0 && (
                  <FileGroup
                    title={`Files to Delete (${filesByAction.delete.length})`}
                    files={filesByAction.delete}
                    selectedPaths={selectedPaths}
                    onToggle={handleToggleFile}
                    actionIcon={<Trash2 className="w-4 h-4" />}
                    actionColor="text-red-400"
                    badgeColor="bg-red-500/20 text-red-400"
                    truncatePath={truncatePath}
                  />
                )}
              </div>

              {/* Changelist picker */}
              <div className="mt-6 pt-4 border-t border-border">
                <label className="block text-sm font-medium text-foreground mb-2">Target Changelist</label>
                <Select value={targetChangelistId} onValueChange={setTargetChangelistId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Changelist</SelectItem>
                    {changelists?.map((cl) => (
                      <SelectItem key={cl.id} value={cl.id.toString()}>
                        Changelist {cl.id} - {cl.description.split('\n')[0].substring(0, 50)}
                        {cl.description.split('\n')[0].length > 50 ? '...' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={selectedCount === 0 || isApplying || isScanning}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              'Apply Reconcile'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FileGroupProps {
  title: string;
  files: ReconcilePreview[];
  selectedPaths: Set<string>;
  onToggle: (depotPath: string) => void;
  actionIcon: React.ReactNode;
  actionColor: string;
  badgeColor: string;
  truncatePath: (path: string) => string;
}

function FileGroup({
  title,
  files,
  selectedPaths,
  onToggle,
  actionIcon,
  actionColor,
  badgeColor,
  truncatePath,
}: FileGroupProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <span className={actionColor}>{actionIcon}</span>
        {title}
      </h3>
      <div className="space-y-1">
        {files.map((file) => {
          const isSelected = selectedPaths.has(file.depotPath);
          return (
            <label
              key={file.depotPath}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded cursor-pointer',
                'hover:bg-muted/50',
                isSelected && 'bg-muted/30'
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(file.depotPath)}
                className="w-4 h-4 rounded border-border bg-background text-blue-600 focus:ring-2 focus:ring-ring focus:ring-offset-0 cursor-pointer"
              />
              <span className="flex-1 text-sm font-mono text-foreground" title={file.depotPath}>
                {truncatePath(file.depotPath)}
              </span>
              <span className={cn('px-2 py-0.5 rounded text-xs font-medium', badgeColor)}>
                {file.action}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
