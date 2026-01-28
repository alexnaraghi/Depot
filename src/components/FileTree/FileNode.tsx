import { NodeRendererProps } from 'react-arborist';
import { FolderOpen, Folder, File } from 'lucide-react';
import { P4File } from '@/types/p4';
import { FileStatusIcon } from './FileStatusIcon';
import { cn } from '@/lib/utils';

export interface FileNodeData {
  id: string;
  name: string;
  isFolder: boolean;
  file?: P4File;
  children?: FileNodeData[];
}

/**
 * Tree node renderer for file/folder display in react-arborist
 * Handles both folders and files with status icons
 */
export function FileNode({ node, style, dragHandle }: NodeRendererProps<FileNodeData>) {
  const { name, isFolder, file } = node.data;
  const isSelected = node.isSelected;
  const isOpen = node.isOpen;

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
      {/* Folder or file icon */}
      {isFolder ? (
        isOpen ? (
          <FolderOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )
      ) : (
        <File className="w-4 h-4 text-slate-400 flex-shrink-0" />
      )}

      {/* Status icon for files */}
      {!isFolder && file && (
        <FileStatusIcon status={file.status} className="flex-shrink-0" />
      )}

      {/* File/folder name */}
      <span className="flex-1 truncate text-slate-200">{name}</span>

      {/* Revision number for files */}
      {!isFolder && file && (
        <span className="text-slate-500 text-xs flex-shrink-0">
          #{file.revision}
        </span>
      )}
    </div>
  );
}
