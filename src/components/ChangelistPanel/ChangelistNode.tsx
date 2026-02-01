import { NodeRendererProps } from 'react-arborist';
import { List, Send, Pencil, Trash2, ChevronRight, Archive, ArrowDownToLine } from 'lucide-react';
import { P4Changelist, P4File } from '@/types/p4';
import { P4ShelvedFile } from '@/lib/tauri';
import { FileStatusIcon } from '@/components/FileTree/FileStatusIcon';
import { ChangelistTreeNode } from '@/utils/treeBuilder';
import { useUnshelve, useDeleteShelf } from '@/hooks/useShelvedFiles';
import { cn } from '@/lib/utils';

interface ChangelistNodeProps extends NodeRendererProps<ChangelistTreeNode> {
  onSubmit?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onContextMenu?: (e: React.MouseEvent, file: P4File) => void;
  onHeaderContextMenu?: (e: React.MouseEvent, changelist: P4Changelist) => void;
}

/**
 * Tree node renderer for changelist display in react-arborist
 * Handles both changelist headers and file entries
 */
export function ChangelistNode({ node, style, dragHandle, onSubmit, onEdit, onDelete, onContextMenu, onHeaderContextMenu }: ChangelistNodeProps) {
  const isSelected = node.isSelected;
  const nodeData = node.data;

  // Render shelved files section header (toggle expands children via react-arborist)
  if (nodeData.type === 'shelved-section') {
    const sectionData = nodeData.data as { changelistId: number };
    return (
      <ShelvedSectionHeader
        style={style}
        changelistId={sectionData.changelistId}
        name={nodeData.name}
        isOpen={node.isOpen}
        onToggle={() => node.toggle()}
      />
    );
  }

  // Render individual shelved file row
  if (nodeData.type === 'shelved-file') {
    const shelvedFile = nodeData.data as P4ShelvedFile;
    const fileName = shelvedFile.depotPath.split('/').pop() || shelvedFile.depotPath;

    // Extract changelist ID from node ID (format: "{changelistId}-shelved-{depotPath}")
    const changelistId = parseInt(node.id.split('-')[0], 10);

    return (
      <ShelvedFileRow
        style={style}
        shelvedFile={shelvedFile}
        fileName={fileName}
        changelistId={changelistId}
      />
    );
  }

  // Render changelist header
  if (nodeData.type === 'changelist') {
    const changelist = nodeData.data as P4Changelist;
    const isDefault = changelist.id === 0;

    return (
      <div
        ref={dragHandle}
        style={style}
        className={cn(
          'group flex items-center gap-2 px-2 py-1 cursor-pointer text-sm',
          'hover:bg-accent',
          isSelected && 'bg-blue-900/50'
        )}
        onClick={() => node.isInternal && node.toggle()}
        onContextMenu={(e) => {
          e.preventDefault();
          onHeaderContextMenu?.(e, changelist);
        }}
        data-testid={isDefault ? 'changelist-default' : `changelist-${changelist.id}`}
      >
        {/* List icon */}
        <List className="w-4 h-4 text-muted-foreground flex-shrink-0" />

        {/* Changelist number and description */}
        <span className={cn(
          "flex-1 truncate",
          isDefault ? "text-muted-foreground" : "text-foreground"
        )}>
          {!isDefault && `#${changelist.id} — `}
          {changelist.description || '(no description)'}
        </span>

        {/* Default label */}
        {isDefault && (
          <span className="px-2 py-0.5 text-xs bg-muted rounded-full text-foreground flex-shrink-0">
            default
          </span>
        )}

        {/* File count badge */}
        <span className="px-2 py-0.5 text-xs bg-muted rounded-full text-foreground flex-shrink-0">
          {changelist.fileCount}
        </span>

        {/* Submit button - appears on hover */}
        {changelist.fileCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSubmit?.();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded "
            title="Submit"
            data-testid="context-menu-submit"
          >
            <Send className="w-4 h-4 text-foreground" />
          </button>
        )}

        {/* Edit button - appears on hover for all CLs */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded "
          title="Edit"
        >
          <Pencil className="w-4 h-4 text-foreground" />
        </button>

        {/* Delete button - appears on hover only for empty, non-default CLs */}
        {changelist.id !== 0 && changelist.fileCount === 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded "
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-foreground" />
          </button>
        )}
      </div>
    );
  }

  // Render file row
  const file = nodeData.data as P4File;
  // Extract just the filename from the depot path
  const fileName = file.depotPath.split('/').pop() || file.depotPath;

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        'flex items-center gap-2 px-2 py-1 pl-6 cursor-pointer text-sm',
        'hover:bg-accent',
        isSelected && 'bg-blue-900/50'
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, file);
      }}
      data-testid={`cl-file-${fileName.replace(/[^a-zA-Z0-9]/g, '-')}`}
    >
      {/* Status icon */}
      <FileStatusIcon status={file.status} className="flex-shrink-0" />

      {/* File name */}
      <span className="flex-1 truncate text-foreground">{fileName}</span>
    </div>
  );
}

/**
 * Individual shelved file row with unshelve button on hover.
 */
function ShelvedFileRow({
  style,
  shelvedFile,
  fileName,
  changelistId,
}: {
  style: React.CSSProperties;
  shelvedFile: P4ShelvedFile;
  fileName: string;
  changelistId: number;
}) {
  const unshelve = useUnshelve();

  const handleUnshelve = async () => {
    try {
      await unshelve.mutateAsync({
        changelistId,
        filePaths: [shelvedFile.depotPath],
      });
    } catch {
      // Error handling in mutation hook
    }
  };

  return (
    <div
      style={style}
      className={cn(
        'group flex items-center gap-2 px-2 py-1 pl-8 text-sm',
        'hover:bg-accent/30'
      )}
    >
      <Archive className="w-4 h-4 text-violet-400 flex-shrink-0" />
      <span className="flex-1 truncate text-violet-200">{fileName}</span>
      <span className="px-2 py-0.5 text-xs bg-violet-900/30 text-violet-300 rounded">
        {shelvedFile.action}
      </span>

      <button
        onClick={(e) => { e.stopPropagation(); handleUnshelve(); }}
        disabled={unshelve.isPending}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded  disabled:opacity-50"
        title="Unshelve this file"
      >
        <ArrowDownToLine className="w-4 h-4 text-violet-300" />
      </button>
    </div>
  );
}

/**
 * Header row for the shelved files section within a changelist.
 * Clicking toggles react-arborist's native expand/collapse for child nodes.
 * Provides unshelve and delete shelf action buttons on hover.
 */
function ShelvedSectionHeader({
  style,
  changelistId,
  name,
  isOpen,
  onToggle,
}: {
  style: React.CSSProperties;
  changelistId: number;
  name: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const unshelve = useUnshelve();
  const deleteShelf = useDeleteShelf();

  const handleUnshelve = async () => {
    try {
      await unshelve.mutateAsync({ changelistId });
    } catch {
      // Error handling in mutation hook
    }
  };

  const handleDeleteShelf = async () => {
    const confirmed = window.confirm(
      `Delete all shelved files from CL ${changelistId}? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await deleteShelf.mutateAsync({ changelistId });
    } catch {
      // Error handling in mutation hook
    }
  };

  return (
    <div
      style={style}
      className={cn(
        'group flex items-center gap-2 px-2 py-1 cursor-pointer text-sm',
        'hover:bg-accent/50'
      )}
      onClick={onToggle}
    >
      <ChevronRight
        className={cn(
          'w-4 h-4 text-violet-400 flex-shrink-0 transition-transform',
          isOpen && 'rotate-90'
        )}
      />
      <span className="flex-1 text-violet-400 font-medium">{name}</span>

      <button
        onClick={(e) => { e.stopPropagation(); handleUnshelve(); }}
        disabled={unshelve.isPending}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded  disabled:opacity-50"
        title="Unshelve all files"
      >
        <ArrowDownToLine className="w-4 h-4 text-violet-300" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); handleDeleteShelf(); }}
        disabled={deleteShelf.isPending}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded  disabled:opacity-50"
        title="Delete shelf"
      >
        <Trash2 className="w-4 h-4 text-violet-300" />
      </button>
    </div>
  );
}
