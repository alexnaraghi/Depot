import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { WorkspaceSummaryView } from './WorkspaceSummaryView';
import { FileDetailView } from './FileDetailView';
import { ChangelistDetailView } from './ChangelistDetailView';
import { RevisionDetailView } from './RevisionDetailView';

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

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header area for future breadcrumb */}
      <div className="border-b border-border p-3">
        <div className="text-sm text-muted-foreground">
          {/* Breadcrumb will go here */}
        </div>
      </div>

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
