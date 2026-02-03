import { useState } from 'react';
import { P4Revision } from '@/lib/tauri';
import { useDiff } from '@/hooks/useDiff';
import { Button } from '@/components/ui/button';
import { FileContentViewer } from './FileContentViewer';
import { FileAnnotationViewer } from './FileAnnotationViewer';

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
  const [showContent, setShowContent] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);

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

  const handleAnnotationClick = (changelistId: number) => {
    // TODO: Navigate to changelist detail in Plan 03
    console.log('Clicked changelist:', changelistId);
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

      {/* Sibling files section - placeholder */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
          FILES IN THIS SUBMIT
        </h3>
        {/* TODO: Add p4_describe command to backend to fetch files in a submitted changelist */}
        <p className="text-sm text-muted-foreground italic">
          Sibling files not yet available (needs p4 describe backend)
        </p>
      </div>
    </div>
  );
}
