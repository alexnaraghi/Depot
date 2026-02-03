import { useVirtualizer } from '@tanstack/react-virtual';
import { P4AnnotationLine } from '@/lib/tauri';
import { calculateAgeColor } from '@/lib/annotationColors';
import { AnnotationTooltip } from './AnnotationTooltip';
import { TooltipProvider } from '@/components/ui/tooltip';

interface AnnotationGutterProps {
  annotations: P4AnnotationLine[];
  minTimestamp: number;
  maxTimestamp: number;
  onAnnotationClick?: (changelistId: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  highlightedLines?: Set<number>;
}

/**
 * Virtualized annotation gutter for file blame view.
 * Displays per-line changelist, user, and date with heatmap coloring.
 *
 * Uses TanStack Virtual for performant rendering of large files.
 */
export function AnnotationGutter({
  annotations,
  minTimestamp,
  maxTimestamp,
  onAnnotationClick,
  containerRef,
  highlightedLines,
}: AnnotationGutterProps) {
  // Setup virtualizer for efficient rendering
  const virtualizer = useVirtualizer({
    count: annotations.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 20, // 20px line height
    overscan: 10, // Render 10 extra lines above/below viewport
  });

  return (
    <TooltipProvider>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '256px', // w-64 equivalent
          position: 'relative',
        }}
        className="flex-shrink-0"
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const annotation = annotations[virtualRow.index];

          // Parse date to timestamp for heatmap color
          const [year, month, day] = annotation.date.split('/').map(Number);
          const timestamp = new Date(year, month - 1, day).getTime();
          const bgColor = calculateAgeColor(timestamp, minTimestamp, maxTimestamp);

          // Line number (1-indexed) for highlighting
          const lineNumber = virtualRow.index + 1;
          const isHighlighted = highlightedLines?.has(lineNumber) ?? false;

          return (
            <AnnotationTooltip
              key={virtualRow.key}
              changelistId={annotation.changelistId}
              user={annotation.user}
              date={annotation.date}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  backgroundColor: bgColor,
                }}
                className={`
                  flex items-center px-2 text-xs font-mono cursor-pointer
                  hover:bg-accent/50 transition-colors
                  ${isHighlighted ? 'ring-2 ring-primary/50' : ''}
                `}
                onClick={() => onAnnotationClick?.(annotation.changelistId)}
              >
                <span className="text-foreground/90 truncate">
                  CL#{annotation.changelistId} | {annotation.user} | {annotation.date}
                </span>
              </div>
            </AnnotationTooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
