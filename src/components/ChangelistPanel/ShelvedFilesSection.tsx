import { useState } from 'react';
import { ArrowDownToLine, Trash2, ChevronRight, Archive } from 'lucide-react';
import { useShelvedFilesQuery, useUnshelve, useDeleteShelf } from '@/hooks/useShelvedFiles';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface ShelvedFilesSectionProps {
  changelistId: number;
}

/**
 * Collapsible section showing shelved files for a changelist.
 *
 * Displays below pending files in the changelist tree.
 * Shows shelved files with purple/violet accent for distinction.
 * Provides unshelve and delete shelf actions.
 *
 * Only renders if shelved files exist (returns null otherwise).
 */
export function ShelvedFilesSection({ changelistId }: ShelvedFilesSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: shelvedFiles } = useShelvedFilesQuery(changelistId);
  const unshelve = useUnshelve();
  const deleteShelf = useDeleteShelf();

  // Don't render if no shelved files
  if (!shelvedFiles || shelvedFiles.length === 0) {
    return null;
  }

  const handleUnshelve = async () => {
    try {
      await unshelve.mutateAsync({ changelistId });
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  const handleDeleteShelf = async () => {
    const confirmed = window.confirm(
      `Delete all shelved files from CL ${changelistId}? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteShelf.mutateAsync({ changelistId });
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            'group flex items-center gap-2 px-2 py-1 cursor-pointer text-sm',
            'hover:bg-slate-800/50 transition-colors'
          )}
        >
          {/* Chevron icon */}
          <ChevronRight
            className={cn(
              'w-4 h-4 text-violet-400 flex-shrink-0 transition-transform',
              isOpen && 'rotate-90'
            )}
          />

          {/* Shelved files label */}
          <span className="flex-1 text-violet-400 font-medium">
            Shelved Files ({shelvedFiles.length})
          </span>

          {/* Action buttons - visible on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleUnshelve();
            }}
            disabled={unshelve.isPending}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-600 rounded transition-opacity disabled:opacity-50"
            title="Unshelve all files"
          >
            <ArrowDownToLine className="w-4 h-4 text-violet-300" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteShelf();
            }}
            disabled={deleteShelf.isPending}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-600 rounded transition-opacity disabled:opacity-50"
            title="Delete shelf"
          >
            <Trash2 className="w-4 h-4 text-violet-300" />
          </button>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-6">
          {shelvedFiles.map((file) => {
            // Extract filename from depot path
            const fileName = file.depotPath.split('/').pop() || file.depotPath;

            return (
              <div
                key={file.depotPath}
                className={cn(
                  'flex items-center gap-2 px-2 py-1 text-sm',
                  'hover:bg-slate-800/30 transition-colors'
                )}
              >
                {/* File icon */}
                <Archive className="w-4 h-4 text-violet-400 flex-shrink-0" />

                {/* File name */}
                <span className="flex-1 truncate text-violet-200">{fileName}</span>

                {/* Action badge */}
                <span className="px-2 py-0.5 text-xs bg-violet-900/30 text-violet-300 rounded">
                  {file.action}
                </span>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
