import { useRef, useState, useEffect, useMemo } from 'react';
import { useFileAnnotations, useAnnotationBlocks } from '@/hooks/useFileAnnotations';
import { useFileInfo } from '@/hooks/useFileInfo';
import { useAnnotationNavigation } from '@/hooks/useAnnotationNavigation';
import { AnnotationGutter } from './AnnotationGutter';
import { Highlight, themes } from 'prism-react-renderer';
import { getLanguageFromPath } from '@/lib/languageMap';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Size thresholds (match FileContentViewer)
const MAX_AUTO_LOAD_SIZE = 1 * 1024 * 1024; // 1MB auto-load threshold
const MAX_VIEWABLE_SIZE = 10 * 1024 * 1024; // 10MB absolute limit

interface FileAnnotationViewerProps {
  depotPath: string;
  revision: number;
  onChangelistClick?: (changelistId: number) => void;
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
 * File annotation viewer with virtualized rendering and heatmap coloring.
 * Displays per-line blame information (changelist, author, date) alongside
 * syntax-highlighted code with synchronized scrolling.
 *
 * Includes size validation to prevent loading oversized files.
 */
export function FileAnnotationViewer({
  depotPath,
  revision,
  onChangelistClick,
}: FileAnnotationViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [userConfirmedLargeFile, setUserConfirmedLargeFile] = useState(false);

  // Step 1: Get file metadata first
  const { data: fileInfo, isLoading: isLoadingInfo, error: infoError } = useFileInfo(depotPath, revision);

  // Reset confirmation when file changes
  useEffect(() => {
    setUserConfirmedLargeFile(false);
  }, [depotPath, revision]);

  // Determine if we should load annotations
  const shouldLoadAnnotations = fileInfo &&
    !fileInfo.isBinary &&
    fileInfo.fileSize <= MAX_VIEWABLE_SIZE &&
    (fileInfo.fileSize <= MAX_AUTO_LOAD_SIZE || userConfirmedLargeFile);

  // Step 2: Load annotations only if validation passes
  const {
    data: annotations,
    isLoading: isLoadingAnnotations,
    error: annotationsError,
    refetch,
  } = useFileAnnotations(depotPath, revision, { enabled: shouldLoadAnnotations });

  // Calculate timestamp range for heatmap
  const { minTimestamp, maxTimestamp } = (() => {
    if (!annotations || annotations.length === 0) {
      return { minTimestamp: 0, maxTimestamp: 0 };
    }

    const timestamps = annotations.map((line) => {
      const [year, month, day] = line.date.split('/').map(Number);
      return new Date(year, month - 1, day).getTime();
    });

    return {
      minTimestamp: Math.min(...timestamps),
      maxTimestamp: Math.max(...timestamps),
    };
  })();

  // Get annotation blocks for keyboard navigation
  const blocks = useAnnotationBlocks(annotations);

  // Scroll to line callback for keyboard navigation
  const scrollToLine = (lineNumber: number) => {
    if (!containerRef.current) return;

    // Calculate position (20px per line, 1-indexed)
    const position = (lineNumber - 1) * 20;
    // Offset by 100px for better visibility
    containerRef.current.scrollTop = position - 100;
  };

  // Setup keyboard navigation
  const {
    currentBlockIndex,
    currentBlock,
    totalBlocks,
  } = useAnnotationNavigation(blocks, scrollToLine);

  // Calculate highlighted lines from current block
  const highlightedLines = useMemo(() => {
    if (!currentBlock) return new Set<number>();

    const lines = new Set<number>();
    for (let i = currentBlock.startLine; i <= currentBlock.endLine; i++) {
      lines.add(i);
    }
    return lines;
  }, [currentBlock]);

  // Get language for syntax highlighting
  const language = getLanguageFromPath(depotPath);

  // Prepare code content from annotations
  const codeContent = annotations?.map((line) => line.lineContent).join('\n') || '';

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
            <div className="font-semibold text-sm mb-1">Cannot view annotations for binary files</div>
            <div className="text-sm text-muted-foreground">
              This file is a binary file ({fileInfo.fileType}). Annotations are only available for text files.
            </div>
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
            <div className="font-semibold text-sm mb-1">File too large for annotations</div>
            <div className="text-sm text-muted-foreground">
              This file is {formatFileSize(fileInfo.fileSize)}. Maximum is 10MB for annotation view.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show warning dialog for medium files (1-10MB)
  if (fileInfo && fileInfo.fileSize > MAX_AUTO_LOAD_SIZE && !userConfirmedLargeFile) {
    return (
      <div className="border rounded-md bg-card p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-sm mb-1">Large file warning</div>
            <div className="text-sm text-muted-foreground mb-3">
              This file is {formatFileSize(fileInfo.fileSize)}. Loading annotations may be slow.
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setUserConfirmedLargeFile(true)}
            >
              Load Anyway
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show annotations loading state
  if (isLoadingAnnotations) {
    return (
      <div className="flex items-center justify-center p-8 border rounded-md bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading annotations...</span>
      </div>
    );
  }

  // Handle annotations errors
  if (annotationsError) {
    return (
      <div className="border rounded-md bg-card p-4">
        <div className="text-sm text-destructive mb-2">
          Failed to load annotations: {annotationsError instanceof Error ? annotationsError.message : 'Unknown error'}
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

  // Handle empty annotations
  if (!annotations || annotations.length === 0) {
    return (
      <div className="border rounded-md bg-card p-4 text-sm text-muted-foreground">
        No annotations available for this file
      </div>
    );
  }

  // Main annotation view: side-by-side gutter + code
  return (
    <div className="space-y-2">
      {/* Navigation indicator (only show when there are multiple blocks) */}
      {totalBlocks > 1 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
          <span>
            Block {currentBlockIndex + 1} of {totalBlocks}
          </span>
          <span className="text-muted-foreground/60">
            (Alt+↑/↓ to navigate)
          </span>
        </div>
      )}

      <div
        ref={containerRef}
        className="h-[600px] overflow-auto border rounded-md bg-card"
      >
        <div className="flex">
          {/* Annotation gutter */}
          <AnnotationGutter
            annotations={annotations}
            minTimestamp={minTimestamp}
            maxTimestamp={maxTimestamp}
            onAnnotationClick={onChangelistClick}
            containerRef={containerRef}
            highlightedLines={highlightedLines}
          />

        {/* Code content with syntax highlighting */}
        <div className="flex-1 min-w-0">
          <Highlight
            theme={themes.vsDark}
            code={codeContent}
            language={language}
          >
            {({ style, tokens, getLineProps, getTokenProps }) => (
              <pre
                style={{
                  ...style,
                  margin: 0,
                  padding: '0 16px',
                  background: 'transparent',
                }}
                className="text-sm font-mono"
              >
                {tokens.map((line, i) => (
                  <div
                    key={i}
                    {...getLineProps({ line })}
                    style={{ height: '20px', lineHeight: '20px' }} // Match gutter line height
                  >
                    <span className="inline-block w-12 text-right text-muted-foreground select-none mr-4">
                      {i + 1}
                    </span>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </div>
        </div>
      </div>
    </div>
  );
}
