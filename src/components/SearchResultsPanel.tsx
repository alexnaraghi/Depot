import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { P4ChangelistInfo } from '@/lib/tauri';

interface SearchResultsPanelProps {
  results: P4ChangelistInfo[];
  isLoading: boolean;
}

/**
 * Search results panel showing filtered changelists.
 *
 * Displays changelist number, date, user, and description.
 * Cards are clickable to expand and show full description.
 */
export function SearchResultsPanel({ results, isLoading }: SearchResultsPanelProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpanded = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const truncateDescription = (desc: string, maxLength: number = 100) => {
    const firstLine = desc.split('\n')[0];
    if (firstLine.length <= maxLength) return firstLine;
    return firstLine.slice(0, maxLength) + '...';
  };

  return (
    <div className="absolute top-full mt-2 w-96 max-h-96 overflow-auto bg-slate-800 border border-slate-600 rounded-md shadow-lg z-50">
      {isLoading ? (
        <div className="p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-4 bg-slate-700 rounded animate-pulse w-24" />
              <div className="h-3 bg-slate-700/50 rounded animate-pulse w-full" />
              <div className="h-3 bg-slate-700/50 rounded animate-pulse w-2/3" />
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground">No results found</p>
        </div>
      ) : (
        <>
          <div className="p-2 border-b border-slate-700 text-xs text-slate-400">
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </div>
          <div className="divide-y divide-slate-700">
            {results.map((changelist) => {
              const isExpanded = expandedId === changelist.id;
              return (
                <div
                  key={changelist.id}
                  className="p-3 hover:bg-slate-750 cursor-pointer transition-colors"
                  onClick={() => toggleExpanded(changelist.id)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Changelist header */}
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-semibold text-slate-100">
                          #{changelist.id}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(changelist.time)}
                        </span>
                        <span className="text-xs text-slate-400">
                          by {changelist.user}
                        </span>
                      </div>

                      {/* Description */}
                      <div className="text-sm text-slate-300">
                        {isExpanded ? (
                          <div className="whitespace-pre-wrap">
                            {changelist.description}
                          </div>
                        ) : (
                          <div className="truncate">
                            {truncateDescription(changelist.description)}
                          </div>
                        )}
                      </div>

                      {/* File count */}
                      {isExpanded && (
                        <div className="mt-2 text-xs text-slate-400">
                          {changelist.file_count} {changelist.file_count === 1 ? 'file' : 'files'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
