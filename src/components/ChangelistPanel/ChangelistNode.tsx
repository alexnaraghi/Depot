import { NodeRendererProps } from 'react-arborist';
import { List, Send, Pencil, Trash2 } from 'lucide-react';
import { P4Changelist, P4File } from '@/types/p4';
import { FileStatusIcon } from '@/components/FileTree/FileStatusIcon';
import { ChangelistTreeNode } from '@/utils/treeBuilder';
import { ShelvedFilesSection } from './ShelvedFilesSection';
import { cn } from '@/lib/utils';

interface ChangelistNodeProps extends NodeRendererProps<ChangelistTreeNode> {
  onSubmit?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onContextMenu?: (e: React.MouseEvent, file: P4File) => void;
}

/**
 * Tree node renderer for changelist display in react-arborist
 * Handles both changelist headers and file entries
 */
export function ChangelistNode({ node, style, dragHandle, onSubmit, onEdit, onDelete, onContextMenu }: ChangelistNodeProps) {
  const isSelected = node.isSelected;
  const nodeData = node.data;

  // Render shelved files section
  if (nodeData.type === 'shelved-section') {
    const sectionData = nodeData.data as { changelistId: number };
    return (
      <div style={style}>
        <ShelvedFilesSection changelistId={sectionData.changelistId} />
      </div>
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
          'hover:bg-slate-800 transition-colors',
          isSelected && 'bg-blue-900/50'
        )}
        onClick={() => node.isInternal && node.toggle()}
      >
        {/* List icon */}
        <List className="w-4 h-4 text-slate-400 flex-shrink-0" />

        {/* Changelist number and description */}
        <span className={cn(
          "flex-1 truncate",
          isDefault ? "text-slate-400" : "text-slate-200"
        )}>
          {!isDefault && `#${changelist.id} — `}
          {changelist.description || '(no description)'}
        </span>

        {/* Default label */}
        {isDefault && (
          <span className="px-2 py-0.5 text-xs bg-slate-700 rounded-full text-slate-300 flex-shrink-0">
            default
          </span>
        )}

        {/* File count badge */}
        <span className="px-2 py-0.5 text-xs bg-slate-700 rounded-full text-slate-300 flex-shrink-0">
          {changelist.fileCount}
        </span>

        {/* Submit button - appears on hover */}
        {changelist.fileCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSubmit?.();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-600 rounded transition-opacity"
            title="Submit"
          >
            <Send className="w-4 h-4 text-slate-300" />
          </button>
        )}

        {/* Edit button - appears on hover for all CLs */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-600 rounded transition-opacity"
          title="Edit"
        >
          <Pencil className="w-4 h-4 text-slate-300" />
        </button>

        {/* Delete button - appears on hover only for empty, non-default CLs */}
        {changelist.id !== 0 && changelist.fileCount === 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-600 rounded transition-opacity"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-slate-300" />
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
      ref={(el) => {
        console.log('[DnD Debug] dragHandle ref called', { el: !!el, dragHandle: typeof dragHandle, isDraggable: node.isDraggable });
        if (dragHandle) dragHandle(el);
        if (el) {
          console.log('[DnD Debug] element draggable attr:', el.getAttribute('draggable'));
          // Check again after a tick (after react-dnd connects)
          setTimeout(() => {
            console.log('[DnD Debug] element draggable attr (after tick):', el.getAttribute('draggable'));
          }, 100);
        }
      }}
      style={style}
      className={cn(
        'flex items-center gap-2 px-2 py-1 pl-6 cursor-pointer text-sm',
        'hover:bg-slate-800 transition-colors',
        isSelected && 'bg-blue-900/50'
      )}
      onDragStart={(e) => {
        console.log('[DnD Debug] native onDragStart fired!', e);
      }}
      onMouseDown={(e) => {
        console.log('[DnD Debug] mouseDown on file row', { button: e.button, target: (e.target as HTMLElement).tagName });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, file);
      }}
    >
      {/* Status icon */}
      <FileStatusIcon status={file.status} className="flex-shrink-0" />

      {/* File name */}
      <span className="flex-1 truncate text-slate-200">{fileName}</span>
    </div>
  );
}
