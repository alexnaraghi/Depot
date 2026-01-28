import { NodeRendererProps } from 'react-arborist';
import { List } from 'lucide-react';
import { P4Changelist, P4File } from '@/types/p4';
import { FileStatusIcon } from '@/components/FileTree/FileStatusIcon';
import { cn } from '@/lib/utils';

export type ChangelistNodeData =
  | { type: 'changelist'; data: P4Changelist }
  | { type: 'file'; data: P4File };

/**
 * Tree node renderer for changelist display in react-arborist
 * Handles both changelist headers and file entries
 */
export function ChangelistNode({ node, style, dragHandle }: NodeRendererProps<ChangelistNodeData>) {
  const isSelected = node.isSelected;
  const nodeData = node.data;

  // Render changelist header
  if (nodeData.type === 'changelist') {
    const changelist = nodeData.data;
    const isDefault = changelist.id === 0;

    return (
      <div
        ref={dragHandle}
        style={style}
        className={cn(
          'flex items-center gap-2 px-2 py-1 cursor-pointer text-sm',
          'hover:bg-slate-800 transition-colors',
          isSelected && 'bg-blue-900/50'
        )}
        onClick={() => node.isInternal && node.toggle()}
      >
        {/* List icon */}
        <List className="w-4 h-4 text-slate-400 flex-shrink-0" />

        {/* Changelist description */}
        <span className="flex-1 truncate text-slate-200">
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
      </div>
    );
  }

  // Render file row
  const file = nodeData.data;
  // Extract just the filename from the depot path
  const fileName = file.depotPath.split('/').pop() || file.depotPath;

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        'flex items-center gap-2 px-2 py-1 pl-6 cursor-pointer text-sm',
        'hover:bg-slate-800 transition-colors',
        isSelected && 'bg-blue-900/50'
      )}
    >
      {/* Status icon */}
      <FileStatusIcon status={file.status} className="flex-shrink-0" />

      {/* File name */}
      <span className="flex-1 truncate text-slate-200">{fileName}</span>
    </div>
  );
}
