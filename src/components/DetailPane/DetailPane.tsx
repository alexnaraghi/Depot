import { useDetailPaneStore } from '@/stores/detailPaneStore';

/**
 * DetailPane - Center column that switches views based on selection
 *
 * Displays placeholder content based on selection type:
 * - 'none': Workspace Summary
 * - 'file': File detail with depot path
 * - 'changelist': Changelist detail with ID
 * - 'revision': Revision detail with revision number
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
      <div className="flex-1 overflow-auto p-4">
        {selection.type === 'none' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <h2 className="text-2xl font-semibold mb-2">Workspace Summary</h2>
              <p className="text-sm">Select a file or changelist to view details</p>
            </div>
          </div>
        )}

        {selection.type === 'file' && (
          <div>
            <h2 className="text-xl font-semibold mb-2">File</h2>
            <p className="text-sm text-muted-foreground font-mono">{selection.depotPath}</p>
            {selection.fromCl !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">From changelist: {selection.fromCl}</p>
            )}
          </div>
        )}

        {selection.type === 'changelist' && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Changelist</h2>
            <p className="text-sm text-muted-foreground">#{selection.changelist.id}</p>
            <p className="text-sm mt-2">{selection.changelist.description}</p>
          </div>
        )}

        {selection.type === 'revision' && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Revision</h2>
            <p className="text-sm text-muted-foreground">#{selection.revision.rev}</p>
            <p className="text-sm text-muted-foreground font-mono">{selection.depotPath}</p>
          </div>
        )}
      </div>
    </div>
  );
}
