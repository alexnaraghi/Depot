import { useFileContent } from '@/hooks/useFileContent';
import { SyntaxHighlightedContent } from './SyntaxHighlightedContent';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileContentViewerProps {
  depotPath: string;
  revision: number;
}

/**
 * File content viewer with syntax highlighting.
 * Fetches file content at a specific revision and displays with appropriate syntax highlighting.
 * Handles loading and error states with retry functionality.
 *
 * @param depotPath - Depot path of the file
 * @param revision - Revision number to display
 */
export function FileContentViewer({ depotPath, revision }: FileContentViewerProps) {
  const { data: content, isLoading, error, refetch } = useFileContent(depotPath, revision);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 border rounded-md bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading file content...</span>
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <div className="border rounded-md bg-card p-4">
        <div className="text-sm text-destructive mb-2">
          Failed to load file content: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  // Content display
  if (!content) {
    return (
      <div className="border rounded-md bg-card p-4 text-sm text-muted-foreground">
        No content available
      </div>
    );
  }

  return (
    <div className="max-h-[600px] overflow-auto">
      <SyntaxHighlightedContent content={content} fileName={depotPath} />
    </div>
  );
}
