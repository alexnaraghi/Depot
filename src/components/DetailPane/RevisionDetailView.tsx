import { useState } from 'react';
import { P4Revision, invokeP4Changes } from '@/lib/tauri';
import { useDiff } from '@/hooks/useDiff';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { useChangelistFiles } from '@/hooks/useChangelistFiles';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileContentViewer } from './FileContentViewer';
import { FileAnnotationViewer } from './FileAnnotationViewer';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface RevisionDetailViewProps {
  depotPath: string;
  localPath: string;
  revision: P4Revision;
}

/**
 * Detail view for revision selection
 *
 * Shows revision metadata, diff actions, and placeholder for sibling files.
 * Displays user, date, description, and provides diff operations.
 */
export function RevisionDetailView({ depotPath, localPath, revision }: RevisionDetailViewProps) {
  const { diffRevisions, diffAgainstWorkspace } = useDiff();
  const { selectChangelist } = useDetailPaneStore();
  const [showContent, setShowContent] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);

  // Fetch sibling files for this revision's changelist
  const { data: changelistData, isLoading: siblingFilesLoading } = useChangelistFiles(
    revision.change || 0,
    !!revision.change
  );

  // Extract filename from depot path
  const fileName = depotPath.split('/').pop() || depotPath;

  // Format timestamp as readable date
  const formattedDate = new Date(revision.time * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Determine if we can diff vs previous
  const canDiffPrevious = revision.action !== 'add' && revision.action !== 'branch' && revision.rev > 1;

  const handleDiffPrevious = () => {
    if (canDiffPrevious) {
      diffRevisions(depotPath, revision.rev - 1, revision.rev);
    }
  };

  const handleDiffWorkspace = () => {
    diffAgainstWorkspace(depotPath, localPath, revision.rev);
  };

  const toggleContent = () => {
    setShowContent(!showContent);
    if (!showContent) {
      setShowAnnotations(false); // Hide annotations when showing content
    }
  };

  const toggleAnnotations = () => {
    setShowAnnotations(!showAnnotations);
    if (!showAnnotations) {
      setShowContent(false); // Hide content when showing annotations
    }
  };

  const handleAnnotationClick = async (changelistId: number) => {
    try {
      // Fetch submitted changelists to find the one clicked
      const changelists = await invokeP4Changes('submitted');
      const targetCl = changelists.find(cl => cl.id === changelistId);

      if (targetCl) {
        // Convert to P4Changelist format
        selectChangelist({
          id: targetCl.id,
          description: targetCl.description,
          user: targetCl.user,
          client: targetCl.client,
          status: targetCl.status as 'pending' | 'submitted' | 'shelved',
          files: [], // Files will be loaded lazily when needed
          fileCount: targetCl.file_count,
        });
      } else {
        toast.error(`Changelist ${changelistId} not found`);
      }
    } catch (error) {
      console.error('Failed to load changelist:', error);
      toast.error('Failed to load changelist');
    }
  };

  const handleSiblingClick = (siblingDepotPath: string, siblingRevision: number) => {
    // Navigate to the sibling file's revision view
    useDetailPaneStore.getState().drillToRevision(siblingDepotPath, '', {
      rev: siblingRevision,
      action: 'edit',
      file_type: '',
      change: revision.change,
      user: revision.user,
      client: revision.client,
      time: revision.time,
      desc: revision.desc,
    });
  };

  const getActionColor = (action: string): string => {
    switch (action.toLowerCase()) {
      case 'edit': return 'text-blue-400 border-blue-400/30';
      case 'add': return 'text-green-400 border-green-400/30';
      case 'delete': return 'text-red-400 border-red-400/30';
      case 'branch': return 'text-purple-400 border-purple-400/30';
      case 'integrate': return 'text-yellow-400 border-yellow-400/30';
      case 'move/add':
      case 'move/delete': return 'text-orange-400 border-orange-400/30';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold mb-1">
          {fileName} &gt; #{revision.rev}
        </h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{revision.user}</span>
          <span>·</span>
          <span>{formattedDate}</span>
        </div>
        <p className="text-sm mt-2">{revision.desc}</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDiffPrevious}
          disabled={!canDiffPrevious}
        >
          Diff vs Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDiffWorkspace}
        >
          Diff vs Workspace
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleContent}
        >
          {showContent ? 'Hide Content' : 'View File Content'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleAnnotations}
        >
          {showAnnotations ? 'Hide Annotations' : 'View Annotations'}
        </Button>
      </div>

      {/* File content viewer */}
      {showContent && (
        <FileContentViewer depotPath={depotPath} revision={revision.rev} />
      )}

      {/* File annotation viewer */}
      {showAnnotations && (
        <FileAnnotationViewer
          depotPath={depotPath}
          revision={revision.rev}
          onChangelistClick={handleAnnotationClick}
        />
      )}

      {/* Sibling files section */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
          FILES IN THIS SUBMIT
          {changelistData && ` (${changelistData.files.length})`}
        </h3>
        {siblingFilesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-6 bg-slate-700/50 rounded animate-pulse" />
            ))}
          </div>
        ) : changelistData?.files.length ? (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {changelistData.files.map((file) => {
              const fileName = file.depotPath.split('/').pop() || file.depotPath;
              const isCurrent = file.depotPath === depotPath;

              return (
                <div
                  key={file.depotPath}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1 rounded text-sm',
                    !isCurrent && 'cursor-pointer hover:bg-accent',
                    isCurrent && 'bg-accent/50'
                  )}
                  onClick={() => !isCurrent && handleSiblingClick(file.depotPath, file.revision)}
                >
                  <Badge
                    variant="outline"
                    className={cn('px-1 py-0 text-xs', getActionColor(file.action))}
                  >
                    {file.action}
                  </Badge>
                  <span className={cn('flex-1 truncate', isCurrent && 'font-medium')}>
                    {fileName}
                  </span>
                  <span className="text-xs text-muted-foreground">#{file.revision}</span>
                </div>
              );
            })}
          </div>
        ) : revision.change ? (
          <p className="text-sm text-muted-foreground italic">No files found</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Changelist unknown</p>
        )}
      </div>
    </div>
  );
}
