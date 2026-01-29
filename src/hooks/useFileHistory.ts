import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { invokeP4Filelog, type P4Revision } from '@/lib/tauri';
import { useConnectionStore } from '@/stores/connectionStore';

/**
 * Hook for fetching file revision history with pagination.
 *
 * Uses TanStack Query to fetch p4 filelog data with incremental loading.
 * Starts with 50 revisions and allows loading more in 50-revision chunks.
 */
export function useFileHistory(depotPath: string, enabled: boolean = true) {
  const [maxRevisions, setMaxRevisions] = useState(50);
  const { p4port, p4user, p4client } = useConnectionStore();

  const query = useQuery<P4Revision[]>({
    queryKey: ['p4', 'filelog', depotPath, maxRevisions],
    queryFn: () => invokeP4Filelog(
      depotPath,
      maxRevisions,
      p4port ?? undefined,
      p4user ?? undefined,
      p4client ?? undefined
    ),
    enabled: enabled && !!p4port && !!p4user && !!p4client,
  });

  const loadMore = () => {
    setMaxRevisions((prev) => prev + 50);
  };

  // hasMore is true if we received exactly maxRevisions results
  const hasMore = query.data?.length === maxRevisions;

  return {
    revisions: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    loadMore,
    hasMore,
  };
}
