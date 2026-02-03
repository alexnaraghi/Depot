import { useQuery } from '@tanstack/react-query';
import { invokeP4PrintContent } from '@/lib/tauri';

/**
 * Hook to fetch file content at a specific revision using TanStack Query.
 * Content is cached for 1 hour since file content at a specific revision is immutable.
 *
 * @param depotPath - Depot path of the file (e.g., "//depot/path/to/file.ts")
 * @param revision - Revision number to fetch
 * @param options - Query options including enabled flag for conditional fetching
 * @returns Query result with file content string
 */
export function useFileContent(
  depotPath: string,
  revision: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['file-content', depotPath, revision],
    queryFn: async () => {
      // Backend command handles size validation and binary file rejection
      const content = await invokeP4PrintContent(depotPath, revision);
      return content;
    },
    staleTime: 60 * 60 * 1000, // 1 hour - file content at specific revision never changes
    enabled: options?.enabled ?? true,
  });
}
