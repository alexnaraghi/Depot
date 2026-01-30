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
    <div className="absolute top-full mt-2 w-96 max-h-96 overflow-auto bg-accent border border-border rounded-md shadow-lg z-50">
      {isLoading ? (
        <div className="p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-4 bg-border rounded animate-pulse w-24" />
              <div className="h-3 bg-border/50 rounded animate-pulse w-full" />
              <div className="h-3 bg-border/50 rounded animate-pulse w-2/3" />
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground">No results found</p>
        </div>
      ) : (
        <>
          <div className="p-2 border-b border-border text-xs text-muted-foreground">
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </div>
          <div className="divide-y divide-border">
            {results.map((changelist) => {
              const isExpanded = expandedId === changelist.id;
              return (
                <div
                  key={changelist.id}
                  className="p-3 hover:bg-accent/50 cursor-pointer"
                  onClick={() => toggleExpanded(changelist.id)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Changelist header */}
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-semibold text-foreground">
                          #{changelist.id}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(changelist.time)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          by {changelist.user}
                        </span>
                      </div>

                      {/* Description */}
                      <div className="text-sm text-foreground">
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
                        <div className="mt-2 text-xs text-muted-foreground">
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
