import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSearchFilterStore } from '@/stores/searchFilterStore';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { invokeP4ChangesSubmitted, invokeP4Files, P4FileResult } from '@/lib/tauri';
import { Search, ChevronDown, ChevronRight, Loader2, AlertCircle, Copy, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface SearchResultsViewProps {
  searchType: 'submitted' | 'depot';
  query: string;
  /** When true, the search is driven by the toolbar search bar (no local input shown) */
  toolbarDriven?: boolean;
}

/**
 * SearchResultsView - Display search results in the detail pane
 *
 * Two modes:
 * - toolbarDriven: query comes from the global search filter store (no local input)
 * - standalone: has its own search input (used by command palette depot search)
 *
 * Two search types:
 * - submitted: Client-side filter of prefetched submitted CLs
 * - depot: Backend p4 files command for depot path search
 */
export function SearchResultsView({ searchType, query, toolbarDriven }: SearchResultsViewProps) {
  const { p4port, p4user, p4client } = useConnectionStore();
  const drillToFile = useDetailPaneStore(s => s.drillToFile);
  const navigate = useDetailPaneStore(s => s.navigate);
  const clearFilter = useSearchFilterStore(s => s.clearFilter);

  // Local state for standalone search input (only used when not toolbar-driven)
  const [searchInput, setSearchInput] = useState(query);
  const [displayLimit, setDisplayLimit] = useState(50);
  const [expandedCL, setExpandedCL] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'cl' | 'file'; data: any } | null>(null);

  // The effective search term: toolbar filter or local input
  const effectiveQuery = toolbarDriven ? query : searchInput;

  // Submitted CL search
  const { data: submittedCLs, isLoading: submittedLoading } = useQuery({
    queryKey: ['p4', 'changes', 'submitted'],
    queryFn: () => invokeP4ChangesSubmitted(500, p4port ?? undefined, p4user ?? undefined, p4client ?? undefined),
    enabled: searchType === 'submitted',
  });

  // Filter submitted CLs client-side
  const filteredSubmittedCLs = useMemo(() => {
    if (!submittedCLs || !effectiveQuery) return submittedCLs || [];

    const lowerQuery = effectiveQuery.toLowerCase();
    return submittedCLs.filter(cl => {
      return (
        cl.id.toString().includes(lowerQuery) ||
        cl.description.toLowerCase().includes(lowerQuery) ||
        cl.user.toLowerCase().includes(lowerQuery)
      );
    });
  }, [submittedCLs, effectiveQuery]);

  // Depot path search
  const [depotPattern, setDepotPattern] = useState(query || '//...');
  const { data: depotFiles, isLoading: depotLoading, error: depotError, refetch: refetchDepot } = useQuery({
    queryKey: ['p4', 'files', depotPattern],
    queryFn: () => invokeP4Files(depotPattern, 100, p4port ?? undefined, p4user ?? undefined, p4client ?? undefined),
    enabled: searchType === 'depot' && depotPattern.length > 0,
  });

  function handleDepotSearch(e: React.FormEvent) {
    e.preventDefault();
    setDepotPattern(searchInput);
    refetchDepot();
  }

  function handleLoadMore() {
    setDisplayLimit(prev => prev + 50);
  }

  function handleCLClick(clId: number) {
    if (expandedCL === clId) {
      setExpandedCL(null);
    } else {
      setExpandedCL(clId);
    }
  }

  function handleAuthorClick(author: string) {
    if (toolbarDriven) {
      // Update the toolbar search bar
      useSearchFilterStore.getState().setFilterTerm(author);
    } else {
      setSearchInput(author);
    }
  }

  function handleContextMenu(e: React.MouseEvent, type: 'cl' | 'file', data: any) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, data });
  }

  function handleCopyCLNumber(clId: number) {
    navigator.clipboard.writeText(clId.toString());
    toast.success('CL number copied to clipboard');
    setContextMenu(null);
  }

  function handleCopyDepotPath(depotPath: string) {
    navigator.clipboard.writeText(depotPath);
    toast.success('Depot path copied to clipboard');
    setContextMenu(null);
  }

  function handleViewCLDetail(cl: any) {
    // Clear filter first if toolbar-driven, then navigate
    if (toolbarDriven) {
      clearFilter();
    }
    navigate({
      type: 'changelist',
      changelist: {
        id: cl.id,
        description: cl.description,
        user: cl.user,
        client: cl.client,
        status: 'submitted',
        files: [],
        fileCount: cl.file_count,
      },
    });
    setContextMenu(null);
  }

  function handleViewFileDetail(file: P4FileResult) {
    drillToFile(file.depot_path, '', file.change);
    setContextMenu(null);
  }

  // Close context menu on outside click
  if (contextMenu) {
    const handleClickOutside = () => setContextMenu(null);
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside, { once: true });
    }, 0);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search input - only shown for standalone (non-toolbar) mode */}
      {!toolbarDriven && (
        <div className="p-4 border-b border-border">
          <form onSubmit={handleDepotSearch} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={
                  searchType === 'submitted'
                    ? 'Search submitted CLs (number, description, author)...'
                    : 'Enter depot path pattern (e.g., //depot/.../*.cpp)'
                }
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>
            {searchType === 'depot' && (
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
              >
                Search
              </button>
            )}
          </form>
        </div>
      )}

      {/* Toolbar-driven header */}
      {toolbarDriven && (
        <div className="px-4 pt-4 pb-2 border-b border-border">
          <h3 className="text-sm font-medium text-muted-foreground">
            Submitted Changelists matching "{effectiveQuery}"
          </h3>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-auto p-4">
        {/* Submitted CL results */}
        {searchType === 'submitted' && (
          <div className="space-y-2">
            {submittedLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!submittedLoading && filteredSubmittedCLs && (
              <>
                <div className="text-sm text-muted-foreground mb-4">
                  {filteredSubmittedCLs.length} {filteredSubmittedCLs.length === 1 ? 'result' : 'results'}
                  {effectiveQuery && !toolbarDriven && ` matching "${effectiveQuery}"`}
                </div>

                {filteredSubmittedCLs.slice(0, displayLimit).map((cl) => (
                  <div
                    key={cl.id}
                    className="border border-border rounded-md overflow-hidden hover:border-accent-foreground transition-colors"
                  >
                    <button
                      onClick={() => handleCLClick(cl.id)}
                      onContextMenu={(e) => handleContextMenu(e, 'cl', cl)}
                      className="w-full p-3 text-left hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        {expandedCL === cl.id ? (
                          <ChevronDown className="w-4 h-4 mt-1 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 mt-1 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-semibold">CL {cl.id}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(cl.time * 1000).toLocaleDateString()}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAuthorClick(cl.user);
                              }}
                              className="text-xs text-blue-400 hover:underline"
                            >
                              {cl.user}
                            </button>
                          </div>
                          <div className="text-sm text-foreground line-clamp-2">
                            {cl.description.split('\n')[0]}
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Expanded CL details */}
                    {expandedCL === cl.id && (
                      <div className="p-3 bg-muted border-t border-border">
                        <div className="text-sm whitespace-pre-wrap mb-3">{cl.description}</div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{cl.file_count} {cl.file_count === 1 ? 'file' : 'files'}</span>
                          <span>Client: {cl.client}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Load more button */}
                {filteredSubmittedCLs.length > displayLimit && (
                  <button
                    onClick={handleLoadMore}
                    className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Load more ({filteredSubmittedCLs.length - displayLimit} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Depot path results */}
        {searchType === 'depot' && (
          <div className="space-y-2">
            {depotLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {depotError && (
              <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive rounded-md">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <div className="text-sm text-destructive">
                  {String(depotError)}
                </div>
              </div>
            )}

            {!depotLoading && !depotError && depotFiles && (
              <>
                <div className="text-sm text-muted-foreground mb-4">
                  {depotFiles.length} {depotFiles.length === 1 ? 'file' : 'files'} found
                  {depotFiles.length === 100 && ' (limited to 100 results)'}
                </div>

                <div className="space-y-1">
                  {depotFiles.map((file, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleViewFileDetail(file)}
                      onContextMenu={(e) => handleContextMenu(e, 'file', file)}
                      className="w-full p-2 text-left hover:bg-accent rounded-md transition-colors flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono truncate">{file.depot_path}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>#{file.revision}</span>
                          <span>{file.action}</span>
                          <span>CL {file.change}</span>
                          <span>{file.file_type}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-48 bg-background border border-border rounded-md shadow-xl py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'cl' && (
            <>
              <button
                onClick={() => handleCopyCLNumber(contextMenu.data.id)}
                className={cn(
                  'w-full px-4 py-2 text-left text-sm text-foreground',
                  'hover:bg-accent',
                  'flex items-center gap-2'
                )}
              >
                <Copy className="w-4 h-4" />
                Copy CL Number
              </button>
              <button
                onClick={() => handleViewCLDetail(contextMenu.data)}
                className={cn(
                  'w-full px-4 py-2 text-left text-sm text-foreground',
                  'hover:bg-accent',
                  'flex items-center gap-2'
                )}
              >
                <FileText className="w-4 h-4" />
                View in Detail Pane
              </button>
            </>
          )}

          {contextMenu.type === 'file' && (
            <>
              <button
                onClick={() => handleCopyDepotPath(contextMenu.data.depot_path)}
                className={cn(
                  'w-full px-4 py-2 text-left text-sm text-foreground',
                  'hover:bg-accent',
                  'flex items-center gap-2'
                )}
              >
                <Copy className="w-4 h-4" />
                Copy Depot Path
              </button>
              <button
                onClick={() => handleViewFileDetail(contextMenu.data)}
                className={cn(
                  'w-full px-4 py-2 text-left text-sm text-foreground',
                  'hover:bg-accent',
                  'flex items-center gap-2'
                )}
              >
                <FileText className="w-4 h-4" />
                View File Detail
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
