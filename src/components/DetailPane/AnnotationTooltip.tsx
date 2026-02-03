import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useChangelistDescription } from '@/hooks/useChangelistDescription';
import { Loader2 } from 'lucide-react';

interface AnnotationTooltipProps {
  changelistId: number;
  user: string;
  date: string;
  children: React.ReactNode;
}

/**
 * Tooltip wrapper for annotation gutter lines.
 * Shows full changelist description on hover with lazy loading.
 *
 * Delays 500ms to prevent accidental triggers during scrolling.
 */
export function AnnotationTooltip({
  changelistId,
  user,
  date,
  children,
}: AnnotationTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Lazy load description only when tooltip opens
  const { data: description, isLoading } = useChangelistDescription(
    changelistId,
    { enabled: isOpen }
  );

  return (
    <Tooltip delayDuration={500} onOpenChange={setIsOpen}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-md">
        <div className="space-y-2">
          {/* Header */}
          <div className="font-semibold">
            Changelist {changelistId}
          </div>

          {/* Author and date */}
          <div className="text-xs text-muted-foreground">
            {user} on {date}
          </div>

          {/* Separator */}
          <hr className="my-2 border-border" />

          {/* Description content */}
          <div className="whitespace-pre-wrap text-sm">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              description || 'No description available'
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
