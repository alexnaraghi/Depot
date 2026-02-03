import { useQuery } from '@tanstack/react-query';
import { invokeP4Describe, P4ChangelistDescription } from '@/lib/tauri';

/**
 * Hook for fetching submitted changelist file list
 *
 * Uses p4 describe -s to get file list without diffs.
 * Only fetches for submitted changelists (pending CLs have files in P4Changelist already).
 *
 * @param changelistId - The changelist ID to fetch files for
 * @param enabled - Whether to fetch (false for pending CLs)
 * @returns Query result with changelist description including files
 */
export function useChangelistFiles(
  changelistId: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['p4', 'describe', changelistId],
    queryFn: async (): Promise<P4ChangelistDescription> => {
      return invokeP4Describe(changelistId);
    },
    enabled: enabled && changelistId > 0,
    staleTime: 60000, // Submitted CLs don't change, cache for 1 minute
    refetchOnWindowFocus: false,
  });
}
