import { useCallback, useState, useRef, useEffect, useDeferredValue, useMemo } from 'react';
import { Tree, MoveHandler, TreeApi } from 'react-arborist';
import { useChangelists } from './useChangelists';
import { ChangelistNode } from './ChangelistNode';
import { ChangelistContextMenu } from './ChangelistContextMenu';
import { SubmitDialog } from './SubmitDialog';
import { CreateChangelistDialog } from './CreateChangelistDialog';
import { EditDescriptionDialog } from './EditDescriptionDialog';
import { ChangelistTreeNode } from '@/utils/treeBuilder';
import { P4Changelist, P4File } from '@/types/p4';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { useSearchFilterStore } from '@/stores/searchFilterStore';
import { invokeP4Reopen, invokeP4DeleteChange } from '@/lib/tauri';
import { useQueryClient } from '@tanstack/react-query';
import { useOperationStore } from '@/store/operation';
import { useDiff } from '@/hooks/useDiff';
import { useFileOperations } from '@/hooks/useFileOperations';
import { useShelve, useUnshelve, useDeleteShelf } from '@/hooks/useShelvedFiles';
import { P4ShelvedFile } from '@/lib/tauri';
import { useUnresolvedFiles } from '@/hooks/useResolve';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Send, Archive, ArrowDownToLine, Pencil, Trash2, Undo2, Copy, History } from 'lucide-react';
import { useDndManager } from '@/contexts/DndContext';
import createFuzzySearch from '@nozbe/microfuzz';
import { useCommand } from '@/hooks/useCommand';

interface ChangelistPanelProps {
  className?: string;
}

/**
 * Changelist sidebar panel
 *
 * Shows all pending changelists with file counts.
 * Expand changelist to see files.
 * Drag files between changelists to move them.
 * Submit button appears on hover for changelists with files.
 */
export function ChangelistPanel({ className }: ChangelistPanelProps) {
  const { treeData, isLoading, changelists } = useChangelists();
  const dndManager = useDndManager();
  const queryClient = useQueryClient();
  const { data: unresolvedFiles = [] } = useUnresolvedFiles();
  const treeRef = useRef<TreeApi<ChangelistTreeNode>>(null);
  const [selectedChangelist, setSelectedChangelist] = useState<P4Changelist | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [contextMenuState, setContextMenuState] = useState<{
    files: P4File[];
    currentClId: number;
    x: number;
    y: number;
  } | null>(null);
  const [headerMenuState, setHeaderMenuState] = useState<{
    changelist: P4Changelist;
    x: number;
    y: number;
  } | null>(null);
  const [shelvedMenuState, setShelvedMenuState] = useState<{
    type: 'section' | 'file';
    changelistId: number;
    shelvedFile?: P4ShelvedFile;
    x: number;
    y: number;
  } | null>(null);
  const { addOutputLine } = useOperationStore();
  const { diffAgainstWorkspace } = useDiff();
  const { revert } = useFileOperations();
  const shelve = useShelve();
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);

  // Measure container height and update on resize
  useEffect(() => {
    const updateHeight = () => {
      if (treeContainerRef.current) {
        setContainerHeight(treeContainerRef.current.clientHeight);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Search filtering
  const filterTerm = useSearchFilterStore(s => s.filterTerm);
  const isActive = useSearchFilterStore(s => s.isActive);
  const setChangelistMatchCount = useSearchFilterStore(s => s.setChangelistMatchCount);
  const deferredFilterTerm = useDeferredValue(filterTerm);

  // Apply fuzzy filtering to changelist tree
  const { filteredTree, matchCount } = useMemo(() => {
    if (!deferredFilterTerm.trim()) {
      return { filteredTree: treeData, matchCount: 0 };
    }

    // Collect searchable items (CL descriptions and files)
    const searchableItems: Array<{
      type: 'changelist' | 'file';
      text: string;
      node: ChangelistTreeNode;
      changelistId?: number;
    }> = [];

    function collectSearchable(nodes: ChangelistTreeNode[], currentClId?: number) {
      for (const node of nodes) {
        if (node.type === 'changelist') {
          const cl = node.data as P4Changelist;
          searchableItems.push({
            type: 'changelist',
            text: cl.description,
            node,
            changelistId: cl.id,
          });
          if (node.children) {
            collectSearchable(node.children, cl.id);
          }
        } else if (node.type === 'file') {
          const file = node.data as P4File;
          const fileName = file.depotPath.split('/').pop() || file.depotPath;
          searchableItems.push({
            type: 'file',
            text: fileName,
            node,
            changelistId: currentClId,
          });
        }
        // Skip shelved sections for now
      }
    }

    collectSearchable(treeData);

    // Create fuzzy searcher
    const fuzzySearch = createFuzzySearch(searchableItems, {
      getText: (item) => [item.text],
    });
    const matchResults = fuzzySearch(deferredFilterTerm);

    // Build map of matching nodes with highlight ranges
    const matchMap = new Map<ChangelistTreeNode, [number, number][]>();
    const matchingChangelistIds = new Set<number>();

    for (const result of matchResults) {
      const item = result.item;
      const highlightRanges = result.matches[0];
      if (highlightRanges) {
        matchMap.set(item.node, highlightRanges);
        if (item.changelistId !== undefined) {
          matchingChangelistIds.add(item.changelistId);
        }
      }
    }

    // Apply filter to tree
    function applyFilter(nodes: ChangelistTreeNode[]): ChangelistTreeNode[] {
      return nodes.map((node) => {
        if (node.type === 'changelist') {
          const clMatches = matchMap.has(node);
          const childrenFiltered = node.children ? applyFilter(node.children) : undefined;
          const hasMatchingChildren = childrenFiltered?.some((child) => !child.dimmed);

          return {
            ...node,
            children: childrenFiltered,
            dimmed: !clMatches && !hasMatchingChildren,
            highlightRanges: matchMap.get(node),
          };
        } else if (node.type === 'file') {
          const fileMatches = matchMap.has(node);
          return {
            ...node,
            dimmed: !fileMatches,
            highlightRanges: matchMap.get(node),
          };
        } else {
          // Shelved sections and files - skip for now
          return node;
        }
      });
    }

    const filtered = applyFilter(treeData);
    const count = matchResults.length;

    return { filteredTree: filtered, matchCount: count };
  }, [treeData, deferredFilterTerm]);

  // Report match count to store
  useEffect(() => {
    setChangelistMatchCount(matchCount);
  }, [matchCount, setChangelistMatchCount]);

  // Handle drag-and-drop between changelists
  const handleMove: MoveHandler<ChangelistTreeNode> = useCallback(async ({ dragIds, parentId }) => {
    // parentId is the changelist ID we're dropping onto
    if (!parentId) return;

    // Extract changelist number from parentId (it's just the number as string)
    const targetClId = parseInt(parentId, 10);
    if (isNaN(targetClId)) return;

    // Get depot paths of dragged files
    const filePaths: string[] = [];
    for (const dragId of dragIds) {
      // dragId format: "{changelist.id}-{depot_path}"
      // Extract depot path by removing the "{changelist.id}-" prefix
      const parts = dragId.split('-');
      if (parts.length >= 2) {
        // Rejoin with '-' in case the depot path contains dashes
        const depotPath = parts.slice(1).join('-');
        filePaths.push(depotPath);
      }
    }

    if (filePaths.length === 0) return;

    // Optimistic update pattern: cancel outgoing refetches and snapshot data
    await queryClient.cancelQueries({ queryKey: ['p4', 'opened'] });
    await queryClient.cancelQueries({ queryKey: ['p4', 'changes'] });

    // Snapshot current data for rollback
    const previousOpened = queryClient.getQueryData(['p4', 'opened']);
    const previousChanges = queryClient.getQueryData(['p4', 'changes']);

    try {
      // Move files to new changelist via p4 reopen
      addOutputLine(`p4 reopen -c ${targetClId} ${filePaths.join(' ')}`, false);
      const result = await invokeP4Reopen(
        filePaths,
        targetClId
      );
      addOutputLine(result.join('\n'), false);
      toast.success(`Moved ${filePaths.length} file(s) to changelist ${targetClId}`);
      // On success, invalidate queries to refetch fresh data
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] }),
        queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] }),
      ]);
    } catch (error) {
      addOutputLine(`Error: ${error}`, true);
      toast.error(`Failed to move files: ${error}`);
      // On error, rollback to previous state
      queryClient.setQueryData(['p4', 'opened'], previousOpened);
      queryClient.setQueryData(['p4', 'changes'], previousChanges);
    }
  }, [queryClient, addOutputLine]);

  // Handle submit button click on changelist
  const handleSubmitClick = useCallback((cl: P4Changelist) => {
    // Check for unresolved files in this changelist
    const unresolvedInChangelist = cl.files.filter(file =>
      unresolvedFiles.some(unresolved => unresolved.depotPath === file.depotPath)
    );

    if (unresolvedInChangelist.length > 0) {
      toast.error(`Cannot submit: ${unresolvedInChangelist.length} file(s) have unresolved conflicts`);
      return;
    }

    setSelectedChangelist(cl);
    setSubmitDialogOpen(true);
  }, [unresolvedFiles]);

  // Handle edit button click on changelist
  const handleEditClick = useCallback((cl: P4Changelist) => {
    setSelectedChangelist(cl);
    setEditDialogOpen(true);
  }, []);

  // Handle delete button click on changelist
  const handleDeleteClick = useCallback(async (cl: P4Changelist) => {
    // Validation: cannot delete default or non-empty changelist
    if (cl.id === 0) {
      toast.error('Cannot delete default changelist');
      return;
    }
    if (cl.fileCount > 0) {
      toast.error('Cannot delete changelist with files');
      return;
    }

    try {
      addOutputLine(`p4 change -d ${cl.id}`, false);
      await invokeP4DeleteChange(cl.id);
      addOutputLine(`Change ${cl.id} deleted.`, false);
      toast.success(`Deleted changelist #${cl.id}`);
      queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
    } catch (error) {
      addOutputLine(`Error: ${error}`, true);
      toast.error(`Failed to delete changelist: ${error}`);
    }
  }, [queryClient, addOutputLine]);

  // Handle right-click on file
  const handleContextMenu = useCallback((e: React.MouseEvent, file: P4File) => {
    // Get all selected files if multi-select is active
    const selectedNodes = treeRef.current?.selectedNodes;
    let files: P4File[] = [file];

    if (selectedNodes && selectedNodes.length > 0) {
      // Check if right-clicked file is in selection
      const isInSelection = selectedNodes.some(node => {
        if (node.data.type === 'file') {
          const nodeFile = node.data.data as P4File;
          return nodeFile.depotPath === file.depotPath;
        }
        return false;
      });

      if (isInSelection) {
        // Use all selected files
        files = selectedNodes
          .filter(node => node.data.type === 'file')
          .map(node => node.data.data as P4File);
      }
    }

    // Find the changelist ID the file belongs to
    const currentClId = file.changelist ?? 0;

    setContextMenuState({
      files,
      currentClId,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  // Handle file history - navigate to file detail view
  const handleShowHistory = useCallback((depotPath: string, localPath: string) => {
    useDetailPaneStore.getState().selectFile(depotPath, localPath);
  }, []);

  // Handle resolve - navigate to file detail view to show conflict banner
  const handleResolve = useCallback((depotPath: string, localPath: string) => {
    useDetailPaneStore.getState().selectFile(depotPath, localPath);
  }, []);

  // Handle changelist header context menu
  const handleHeaderContextMenu = useCallback((e: React.MouseEvent, changelist: P4Changelist) => {
    setHeaderMenuState({
      changelist,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  // Handle shelved section context menu
  const handleShelvedSectionContextMenu = useCallback((e: React.MouseEvent, changelistId: number) => {
    setShelvedMenuState({ type: 'section', changelistId, x: e.clientX, y: e.clientY });
  }, []);

  // Handle shelved file context menu
  const handleShelvedFileContextMenu = useCallback((e: React.MouseEvent, shelvedFile: P4ShelvedFile, changelistId: number) => {
    setShelvedMenuState({ type: 'file', changelistId, shelvedFile, x: e.clientX, y: e.clientY });
  }, []);

  // Listen for new-changelist command
  useCommand('new-changelist', () => setCreateDialogOpen(true));

  // Listen for submit command
  useCommand('submit', () => {
    // Get the first changelist with files
    const changelistWithFiles = changelists.find(cl => cl.fileCount > 0);
    if (changelistWithFiles) {
      setSelectedChangelist(changelistWithFiles);
      setSubmitDialogOpen(true);
    }
  });

  // Handle diff against have
  const handleDiffAgainstHave = useCallback((depotPath: string, localPath: string) => {
    // Find the file in tree to get its revision
    const findFileInTree = (depotPath: string): P4File | null => {
      const search = (nodes: ChangelistTreeNode[]): P4File | null => {
        for (const node of nodes) {
          if (node.type === 'file') {
            const file = node.data as P4File;
            if (file.depotPath === depotPath) {
              return file;
            }
          }
          if (node.children) {
            const found = search(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      return search(treeData);
    };

    const file = findFileInTree(depotPath);
    if (file) {
      // Diff workspace file against the have revision (file.revision is the have rev)
      diffAgainstWorkspace(depotPath, localPath, file.revision);
    }
  }, [treeData, diffAgainstWorkspace]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex flex-col h-full bg-background', className)}>
        <div className="flex items-center justify-between px-4 py-2 bg-secondary/50">
          <h2 className="text-lg font-semibold">Pending Changes</h2>
        </div>
        <div className="p-3 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-border rounded animate-pulse w-32" />
              <div className="space-y-1 pl-4">
                <div className="h-3.5 bg-border/50 rounded animate-pulse w-3/4" />
                <div className="h-3.5 bg-border/50 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (treeData.length === 0) {
    return (
      <div className={cn('flex flex-col h-full bg-background', className)}>
        <div className="flex items-center justify-between px-4 py-2 bg-secondary/50">
          <h2 className="text-lg font-semibold">Pending Changes</h2>
        </div>
        <div className="flex items-center justify-center flex-1">
          <p className="text-sm text-muted-foreground">No pending changelists</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background',
        isActive && 'bg-blue-950/20',
        className
      )}
      data-testid="changelist-panel"
    >
      <div className="flex items-center justify-between px-4 py-2 bg-secondary/50">
        <h2 className="text-lg font-semibold">Pending Changes</h2>
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="p-1 hover:bg-accent rounded"
          title="New Changelist"
        >
          <Plus className="w-5 h-5 text-foreground" />
        </button>
      </div>

      <div ref={treeContainerRef} className="flex-1 overflow-hidden">
        <Tree<ChangelistTreeNode>
          ref={treeRef}
          data={filteredTree}
          width="100%"
          height={containerHeight}
          indent={16}
          rowHeight={32}
          openByDefault
          disableDrag={(node) => {
            const nodeType = (node.data as unknown as ChangelistTreeNode).type;
            return nodeType === 'changelist' || nodeType === 'shelved-section' || nodeType === 'shelved-file';
          }}
          disableDrop={({ parentNode }) => {
            const nodeType = parentNode.data.type;
            return nodeType === 'file' || nodeType === 'shelved-section' || nodeType === 'shelved-file';
          }}
          onMove={handleMove}
          dndManager={dndManager}
        >
          {({ node, style, dragHandle, tree }) => (
            <ChangelistNode
              node={node}
              style={style}
              dragHandle={dragHandle}
              tree={tree}
              onSubmit={() => {
                if (node.data.type === 'changelist') {
                  handleSubmitClick(node.data.data as P4Changelist);
                }
              }}
              onEdit={() => {
                if (node.data.type === 'changelist') {
                  handleEditClick(node.data.data as P4Changelist);
                }
              }}
              onDelete={() => {
                if (node.data.type === 'changelist') {
                  handleDeleteClick(node.data.data as P4Changelist);
                }
              }}
              onContextMenu={handleContextMenu}
              onHeaderContextMenu={handleHeaderContextMenu}
              onShelvedSectionContextMenu={handleShelvedSectionContextMenu}
              onShelvedFileContextMenu={handleShelvedFileContextMenu}
            />
          )}
        </Tree>
      </div>

      <SubmitDialog
        changelist={selectedChangelist}
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
      />
      <CreateChangelistDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      <EditDescriptionDialog
        changelist={selectedChangelist}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
      {contextMenuState && (
        <ChangelistContextMenu
          files={contextMenuState.files}
          changelists={changelists}
          currentChangelistId={contextMenuState.currentClId}
          x={contextMenuState.x}
          y={contextMenuState.y}
          onClose={() => setContextMenuState(null)}
          onShowHistory={handleShowHistory}
          onDiffAgainstHave={handleDiffAgainstHave}
          onResolve={handleResolve}
        />
      )}
      {headerMenuState && (
        <ChangelistHeaderMenu
          changelist={headerMenuState.changelist}
          x={headerMenuState.x}
          y={headerMenuState.y}
          onClose={() => setHeaderMenuState(null)}
          onSubmit={handleSubmitClick}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onRevertAll={async (cl) => {
            // Get all file depot paths from tree data
            const filesInChangelist: string[] = [];
            const findFiles = (nodes: ChangelistTreeNode[]) => {
              for (const node of nodes) {
                if (node.type === 'changelist' && (node.data as P4Changelist).id === cl.id) {
                  if (node.children) {
                    for (const child of node.children) {
                      if (child.type === 'file') {
                        filesInChangelist.push((child.data as P4File).depotPath);
                      }
                    }
                  }
                }
                if (node.children) {
                  findFiles(node.children);
                }
              }
            };
            findFiles(treeData);

            if (filesInChangelist.length > 0) {
              try {
                await revert(filesInChangelist);
              } catch {
                // Error already handled by useFileOperations
              }
            }
          }}
          onNewChangelist={() => setCreateDialogOpen(true)}
          onShelve={async (cl) => {
            // Get all file depot paths from tree data
            const filesInChangelist: string[] = [];
            const findFiles = (nodes: ChangelistTreeNode[]) => {
              for (const node of nodes) {
                if (node.type === 'changelist' && (node.data as P4Changelist).id === cl.id) {
                  if (node.children) {
                    for (const child of node.children) {
                      if (child.type === 'file') {
                        filesInChangelist.push((child.data as P4File).depotPath);
                      }
                    }
                  }
                }
                if (node.children) {
                  findFiles(node.children);
                }
              }
            };
            findFiles(treeData);

            if (filesInChangelist.length > 0) {
              try {
                await shelve.mutateAsync({ changelistId: cl.id, filePaths: filesInChangelist });
              } catch {
                // Error already handled by mutation hook
              }
            }
          }}
        />
      )}
      {shelvedMenuState && (
        <ShelvedContextMenu
          type={shelvedMenuState.type}
          changelistId={shelvedMenuState.changelistId}
          shelvedFile={shelvedMenuState.shelvedFile}
          x={shelvedMenuState.x}
          y={shelvedMenuState.y}
          onClose={() => setShelvedMenuState(null)}
          onShowHistory={handleShowHistory}
        />
      )}
    </div>
  );
}

// Changelist header context menu component
interface ChangelistHeaderMenuProps {
  changelist: P4Changelist;
  x: number;
  y: number;
  onClose: () => void;
  onSubmit: (cl: P4Changelist) => void;
  onEdit: (cl: P4Changelist) => void;
  onDelete: (cl: P4Changelist) => void;
  onRevertAll: (cl: P4Changelist) => void;
  onNewChangelist: () => void;
  onShelve: (cl: P4Changelist) => void;
}

function ChangelistHeaderMenu({
  changelist,
  x,
  y,
  onClose,
  onSubmit,
  onEdit,
  onDelete,
  onRevertAll,
  onNewChangelist,
  onShelve,
}: ChangelistHeaderMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const hasFiles = changelist.fileCount > 0;
  const isEmpty = changelist.fileCount === 0;
  const isDefault = changelist.id === 0;
  const isNumbered = changelist.id > 0;

  // Check if changelist has shelved files by checking if any child nodes are shelved
  // For now, always show Unshelve for numbered CLs and let backend handle it
  const hasShelvedFiles = isNumbered;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-56 bg-background border border-border rounded-md shadow-xl py-1"
      style={{ left: x, top: y }}
    >
      {/* Submit */}
      {hasFiles && (
        <button
          onClick={() => {
            onSubmit(changelist);
            onClose();
          }}
          className={cn(
            'w-full px-4 py-2 text-left text-sm text-foreground',
            'hover:bg-accent',
            'flex items-center gap-2'
          )}
        >
          <Send className="w-4 h-4" />
          Submit
        </button>
      )}

      {/* Shelve */}
      {hasFiles && isNumbered && (
        <button
          onClick={() => {
            onShelve(changelist);
            onClose();
          }}
          className={cn(
            'w-full px-4 py-2 text-left text-sm text-foreground',
            'hover:bg-accent',
            'flex items-center gap-2'
          )}
        >
          <Archive className="w-4 h-4" />
          Shelve
        </button>
      )}

      {/* Unshelve */}
      {hasShelvedFiles && (
        <button
          onClick={() => {
            // TODO: implement unshelve all for changelist
            toast.success('Unshelve all files - not yet implemented');
            onClose();
          }}
          className={cn(
            'w-full px-4 py-2 text-left text-sm text-foreground',
            'hover:bg-accent',
            'flex items-center gap-2'
          )}
        >
          <ArrowDownToLine className="w-4 h-4" />
          Unshelve
        </button>
      )}

      {/* Separator */}
      <div className="h-px bg-border my-1" />

      {/* New Changelist */}
      <button
        onClick={() => {
          onNewChangelist();
          onClose();
        }}
        className={cn(
          'w-full px-4 py-2 text-left text-sm text-foreground',
          'hover:bg-accent',
          'flex items-center gap-2'
        )}
      >
        <Plus className="w-4 h-4" />
        New Changelist
      </button>

      {/* Edit Description */}
      <button
        onClick={() => {
          onEdit(changelist);
          onClose();
        }}
        className={cn(
          'w-full px-4 py-2 text-left text-sm text-foreground',
          'hover:bg-accent',
          'flex items-center gap-2'
        )}
      >
        <Pencil className="w-4 h-4" />
        Edit Description
      </button>

      {/* Separator */}
      {(isEmpty || hasFiles) && <div className="h-px bg-border my-1" />}

      {/* Delete (only for empty numbered CLs) */}
      {isEmpty && !isDefault && (
        <button
          onClick={() => {
            onDelete(changelist);
            onClose();
          }}
          className={cn(
            'w-full px-4 py-2 text-left text-sm text-foreground',
            'hover:bg-accent',
            'flex items-center gap-2'
          )}
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      )}

      {/* Revert All Files (only for CLs with files) */}
      {hasFiles && (
        <button
          onClick={() => {
            onRevertAll(changelist);
            onClose();
          }}
          className={cn(
            'w-full px-4 py-2 text-left text-sm text-foreground',
            'hover:bg-accent',
            'flex items-center gap-2'
          )}
        >
          <Undo2 className="w-4 h-4" />
          Revert All Files
        </button>
      )}
    </div>
  );
}

// Shelved files context menu component
interface ShelvedContextMenuProps {
  type: 'section' | 'file';
  changelistId: number;
  shelvedFile?: P4ShelvedFile;
  x: number;
  y: number;
  onClose: () => void;
  onShowHistory?: (depotPath: string, localPath: string) => void;
}

function ShelvedContextMenu({
  type,
  changelistId,
  shelvedFile,
  x,
  y,
  onClose,
  onShowHistory,
}: ShelvedContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const unshelve = useUnshelve();
  const deleteShelf = useDeleteShelf();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  async function handleUnshelve() {
    try {
      await unshelve.mutateAsync({
        changelistId,
        filePaths: type === 'file' && shelvedFile ? [shelvedFile.depotPath] : undefined,
      });
    } catch {
      // Error handling in mutation hook
    }
    onClose();
  }

  async function handleDeleteShelf() {
    const confirmed = window.confirm(
      `Delete all shelved files from CL ${changelistId}? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await deleteShelf.mutateAsync({ changelistId });
    } catch {
      // Error handling in mutation hook
    }
    onClose();
  }

  function handleCopyDepotPath() {
    if (shelvedFile) {
      navigator.clipboard.writeText(shelvedFile.depotPath);
      toast.success('Depot path copied to clipboard');
    }
    onClose();
  }

  function handleShowHistory() {
    if (shelvedFile && onShowHistory) {
      onShowHistory(shelvedFile.depotPath, '');
    }
    onClose();
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-48 bg-background border border-border rounded-md shadow-xl py-1"
      style={{ left: x, top: y }}
    >
      {/* Unshelve */}
      <button
        onClick={handleUnshelve}
        disabled={unshelve.isPending}
        className={cn(
          'w-full px-4 py-2 text-left text-sm text-foreground',
          'hover:bg-accent',
          'flex items-center gap-2',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <ArrowDownToLine className="w-4 h-4" />
        {type === 'section' ? 'Unshelve All Files' : 'Unshelve'}
      </button>

      {/* Delete Shelf - section only */}
      {type === 'section' && (
        <button
          onClick={handleDeleteShelf}
          disabled={deleteShelf.isPending}
          className={cn(
            'w-full px-4 py-2 text-left text-sm text-foreground',
            'hover:bg-accent',
            'flex items-center gap-2',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Trash2 className="w-4 h-4" />
          Delete Shelf
        </button>
      )}

      {/* File-specific items */}
      {type === 'file' && shelvedFile && (
        <>
          <div className="h-px bg-border my-1" />

          {/* File History */}
          <button
            onClick={handleShowHistory}
            className={cn(
              'w-full px-4 py-2 text-left text-sm text-foreground',
              'hover:bg-accent',
              'flex items-center gap-2'
            )}
          >
            <History className="w-4 h-4" />
            File History
          </button>

          <div className="h-px bg-border my-1" />

          {/* Copy Depot Path */}
          <button
            onClick={handleCopyDepotPath}
            className={cn(
              'w-full px-4 py-2 text-left text-sm text-foreground',
              'hover:bg-accent',
              'flex items-center gap-2'
            )}
          >
            <Copy className="w-4 h-4" />
            Copy Depot Path
          </button>
        </>
      )}
    </div>
  );
}
