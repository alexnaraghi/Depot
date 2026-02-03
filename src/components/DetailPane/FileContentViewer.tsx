import { useState, useEffect } from 'react';
import { useFileContent } from '@/hooks/useFileContent';
import { useFileInfo } from '@/hooks/useFileInfo';
import { SyntaxHighlightedContent } from './SyntaxHighlightedContent';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Size thresholds
const MAX_AUTO_LOAD_SIZE = 1 * 1024 * 1024; // 1MB auto-load threshold
const MAX_VIEWABLE_SIZE = 10 * 1024 * 1024; // 10MB absolute limit

interface FileContentViewerProps {
  depotPath: string;
  revision: number;
}

/**
 * Format bytes to human-readable file size.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * File content viewer with syntax highlighting and size validation.
 * Validates file size and type before loading, shows warnings for large files,
 * and provides error handling for binary files and files too large to view.
 *
 * @param depotPath - Depot path of the file
 * @param revision - Revision number to display
 */
export function FileContentViewer({ depotPath, revision }: FileContentViewerProps) {
  const [userConfirmedLargeFile, setUserConfirmedLargeFile] = useState(false);

  // Step 1: Get file metadata first
  const { data: fileInfo, isLoading: isLoadingInfo, error: infoError } = useFileInfo(depotPath, revision);

  // Reset confirmation when file changes
  useEffect(() => {
    setUserConfirmedLargeFile(false);
  }, [depotPath, revision]);

  // Determine if we should load content
  const shouldLoadContent = fileInfo &&
    !fileInfo.isBinary &&
    fileInfo.fileSize <= MAX_VIEWABLE_SIZE &&
    (fileInfo.fileSize <= MAX_AUTO_LOAD_SIZE || userConfirmedLargeFile);

  // Step 2: Load content only if validation passes
  const { data: content, isLoading: isLoadingContent, error: contentError, refetch } = useFileContent(
    depotPath,
    revision,
    { enabled: shouldLoadContent }
  );

  // Show file info loading state
  if (isLoadingInfo) {
    return (
      <div className="flex items-center justify-center p-8 border rounded-md bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Checking file info...</span>
      </div>
    );
  }

  // Handle file info errors
  if (infoError) {
    return (
      <div className="border rounded-md bg-card p-4">
        <div className="text-sm text-destructive mb-2">
          Failed to load file info: {infoError instanceof Error ? infoError.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  // Binary file error
  if (fileInfo?.isBinary) {
    return (
      <div className="border rounded-md bg-card p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-sm mb-1">Cannot view binary files</div>
            <div className="text-sm text-muted-foreground mb-3">
              This file is a binary file ({fileInfo.fileType}). Use an external editor to view it.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                // For binary files, we'd need to print to temp file first
                // This is a TODO - for now just show the error
                console.warn('Open in external editor not yet implemented for binary files');
              }}
            >
              Open in External Editor
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // File too large error
  if (fileInfo && fileInfo.fileSize > MAX_VIEWABLE_SIZE) {
    return (
      <div className="border rounded-md bg-card p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-sm mb-1">File too large to view</div>
            <div className="text-sm text-muted-foreground mb-3">
              This file is {formatFileSize(fileInfo.fileSize)}. Maximum is 10MB. Use an external editor to view it.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                // For large files, we'd need to print to temp file first
                // This is a TODO - for now just show the error
                console.warn('Open in external editor not yet implemented for large files');
              }}
            >
              Open in External Editor
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show warning dialog for medium files (1-10MB)
  if (fileInfo && fileInfo.fileSize > MAX_AUTO_LOAD_SIZE && !userConfirmedLargeFile) {
    return (
      <>
        <div className="border rounded-md bg-card p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-sm mb-1">Large file warning</div>
              <div className="text-sm text-muted-foreground mb-3">
                This file is {formatFileSize(fileInfo.fileSize)}. Loading may be slow.
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setUserConfirmedLargeFile(true)}
                >
                  Load Anyway
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    console.warn('Open in external editor not yet implemented');
                  }}
                >
                  Open in External Editor
                </Button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Show content loading state
  if (isLoadingContent) {
    return (
      <div className="flex items-center justify-center p-8 border rounded-md bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading file content...</span>
      </div>
    );
  }

  // Handle content errors
  if (contentError) {
    return (
      <div className="border rounded-md bg-card p-4">
        <div className="text-sm text-destructive mb-2">
          Failed to load file content: {contentError instanceof Error ? contentError.message : 'Unknown error'}
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
