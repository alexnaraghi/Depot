import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { invokeP4Annotate, P4AnnotationLine } from '../lib/tauri';
import { groupAnnotationBlocks, AnnotationBlock } from '../lib/annotationParser';

/**
 * Fetch file annotations (blame) for a specific depot path and revision.
 *
 * @param depotPath - Depot path to annotate
 * @param revision - Revision number
 * @param options - Query options (e.g., enabled)
 * @returns Query result with annotation data
 */
export function useFileAnnotations(
  depotPath: string,
  revision: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['file-annotations', depotPath, revision],
    queryFn: () => invokeP4Annotate(depotPath, revision),
    staleTime: 60 * 60 * 1000, // 1 hour - annotations at specific revision are immutable
    enabled: options?.enabled ?? true,
  });
}

/**
 * Groups annotations into consecutive blocks for keyboard navigation.
 *
 * @param annotations - Annotation lines from useFileAnnotations
 * @returns Array of annotation blocks (empty if annotations undefined)
 */
export function useAnnotationBlocks(
  annotations: P4AnnotationLine[] | undefined
): AnnotationBlock[] {
  return useMemo(() => {
    if (!annotations) {
      return [];
    }
    return groupAnnotationBlocks(annotations);
  }, [annotations]);
}
