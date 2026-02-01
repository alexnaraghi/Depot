import { P4Revision } from '@/lib/tauri';
import { useDiff } from '@/hooks/useDiff';
import { Button } from '@/components/ui/button';

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

  // TODO: Add p4_print command to backend to open specific revision
  const handleOpenRevision = () => {
    // Placeholder for opening this revision in editor
    // Will need invokeP4Print backend command
    alert('Open This Revision - Not yet implemented (needs p4_print backend)');
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
          onClick={handleOpenRevision}
        >
          Open This Revision
        </Button>
      </div>

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
