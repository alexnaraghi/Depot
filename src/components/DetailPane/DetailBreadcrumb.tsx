import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useDetailPaneStore, DetailSelection } from '@/stores/detailPaneStore';
import { cn } from '@/lib/utils';

/**
 * Breadcrumb navigation bar for the detail pane
 * Shows navigation path with clickable segments and back button
 */
export function DetailBreadcrumb() {
  const selection = useDetailPaneStore(s => s.selection);
  const history = useDetailPaneStore(s => s.history);
  const goBack = useDetailPaneStore(s => s.goBack);

  // Don't render breadcrumb for workspace summary (no navigation)
  if (selection.type === 'none') {
    return null;
  }

  // Build breadcrumb segments: history + current selection
  const segments = [...history, selection];

  // Handler for clicking a breadcrumb segment
  const handleSegmentClick = (index: number) => {
    if (index === segments.length - 1) {
      // Current segment - not clickable
      return;
    }

    // Navigate to clicked segment and truncate history
    const targetSelection = segments[index];
    const newHistory = segments.slice(0, index);

    useDetailPaneStore.setState({
      selection: targetSelection,
      history: newHistory,
    });
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background">
      {/* Back button */}
      <button
        onClick={goBack}
        disabled={history.length === 0}
        className={cn(
          'p-1 rounded hover:bg-accent transition-colors',
          history.length === 0 && 'opacity-50 cursor-not-allowed'
        )}
        title="Go back (Esc)"
        data-testid="breadcrumb-back"
      >
        <ArrowLeft className="w-4 h-4 text-foreground" />
      </button>

      {/* Breadcrumb segments */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto">
        {segments.map((seg, index) => {
          const isLast = index === segments.length - 1;
          const label = getSegmentLabel(seg);

          return (
            <div key={index} className="flex items-center gap-1 flex-shrink-0">
              {/* Segment label */}
              {isLast ? (
                <span className="text-sm font-semibold text-foreground">
                  {label}
                </span>
              ) : (
                <button
                  onClick={() => handleSegmentClick(index)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid={`breadcrumb-segment-${index}`}
                >
                  {label}
                </button>
              )}

              {/* Separator */}
              {!isLast && (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Get display label for a selection segment
 */
function getSegmentLabel(selection: DetailSelection): string {
  switch (selection.type) {
    case 'none':
      return 'Workspace';
    case 'file': {
      const parts = selection.depotPath.split('/');
      return parts[parts.length - 1] || selection.depotPath;
    }
    case 'changelist':
      return `CL ${selection.changelist.id === 0 ? 'default' : selection.changelist.id}`;
    case 'revision':
      return `#${selection.revision.rev}`;
    case 'search':
      return selection.searchType === 'submitted' ? 'Search CLs' : 'Search Depot';
  }
}
