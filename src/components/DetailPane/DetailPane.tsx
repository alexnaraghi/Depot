import { useEffect, useDeferredValue } from 'react';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { useSearchFilterStore } from '@/stores/searchFilterStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { FileDetailView } from './FileDetailView';
import { ChangelistDetailView } from './ChangelistDetailView';
import { RevisionDetailView } from './RevisionDetailView';
import { SearchResultsView } from './SearchResultsView';
import { DetailBreadcrumb } from './DetailBreadcrumb';

/**
 * DetailPane - Center column that switches views based on selection
 *
 * When the toolbar search filter is active, shows submitted CL search results
 * overlaid on top of the normal selection view. Otherwise routes to:
 * - 'none': WorkspaceSummaryView
 * - 'file': FileDetailView
 * - 'changelist': ChangelistDetailView
 * - 'revision': RevisionDetailView
 * - 'search': SearchResultsView (for depot search via command palette)
 */
export function DetailPane() {
  const selection = useDetailPaneStore(s => s.selection);
  const history = useDetailPaneStore(s => s.history);
  const goBack = useDetailPaneStore(s => s.goBack);
  const clear = useDetailPaneStore(s => s.clear);
  const filterTerm = useSearchFilterStore(s => s.filterTerm);
  const isFilterActive = useSearchFilterStore(s => s.isActive);
  const isConnected = useConnectionStore(s => s.status) === 'connected';
  const deferredFilterTerm = useDeferredValue(filterTerm);

  // Handle Escape key for back navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Don't handle Escape when filter is active (SearchBar handles it)
        if (isFilterActive) return;
        if (history.length > 0) {
          goBack();
        } else {
          clear();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history.length, goBack, clear, isFilterActive]);

  // Clear selection when disconnected
  useEffect(() => {
    if (!isConnected) {
      clear();
    }
  }, [isConnected, clear]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Breadcrumb navigation - hide during toolbar search */}
      {!isFilterActive && <DetailBreadcrumb />}

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {/* Toolbar search active: show submitted CL results */}
        {isFilterActive && (
          <SearchResultsView searchType="submitted" query={deferredFilterTerm} toolbarDriven />
        )}

        {/* Normal selection routing (hidden when filter active) */}
        {!isFilterActive && (
          <>
            {selection.type === 'none' && !isConnected && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <p className="text-lg font-medium">Not connected</p>
                <p className="text-sm">Click the connection status badge to connect to a Perforce server.</p>
              </div>
            )}

            {selection.type === 'none' && isConnected && <SearchResultsView searchType="submitted" query="" minimal />}

            {selection.type === 'file' && (
              <FileDetailView depotPath={selection.depotPath} localPath={selection.localPath} />
            )}

            {selection.type === 'changelist' && (
              <div className="p-4">
                <ChangelistDetailView changelist={selection.changelist} />
              </div>
            )}

            {selection.type === 'revision' && (
              <div className="p-4">
                <RevisionDetailView
                  depotPath={selection.depotPath}
                  localPath={selection.localPath}
                  revision={selection.revision}
                />
              </div>
            )}

            {selection.type === 'search' && (
              <SearchResultsView searchType={selection.searchType} query={selection.query} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
