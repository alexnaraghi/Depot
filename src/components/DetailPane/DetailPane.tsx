import { useEffect } from 'react';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { WorkspaceSummaryView } from './WorkspaceSummaryView';
import { FileDetailView } from './FileDetailView';
import { ChangelistDetailView } from './ChangelistDetailView';
import { RevisionDetailView } from './RevisionDetailView';
import { DetailBreadcrumb } from './DetailBreadcrumb';

/**
 * DetailPane - Center column that switches views based on selection
 *
 * Routes selection to appropriate detail view:
 * - 'none': WorkspaceSummaryView
 * - 'file': FileDetailView with depot path and local path
 * - 'changelist': ChangelistDetailView with changelist object
 * - 'revision': RevisionDetailView with depot path, local path, and revision
 */
export function DetailPane() {
  const selection = useDetailPaneStore(s => s.selection);
  const history = useDetailPaneStore(s => s.history);
  const goBack = useDetailPaneStore(s => s.goBack);
  const clear = useDetailPaneStore(s => s.clear);

  // Handle Escape key for back navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (history.length > 0) {
          goBack();
        } else {
          clear();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history.length, goBack, clear]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Breadcrumb navigation */}
      <DetailBreadcrumb />

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {selection.type === 'none' && <WorkspaceSummaryView />}

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
      </div>
    </div>
  );
}
