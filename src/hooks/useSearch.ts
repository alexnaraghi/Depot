import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { invokeP4ChangesSubmitted } from '@/lib/tauri';
import { useConnectionStore } from '@/stores/connectionStore';

export function useSearch(searchTerm: string) {
  const { p4port, p4user, p4client, status } = useConnectionStore();

  // Fetch submitted changelists — always enabled to prefetch for instant search
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['p4', 'changes', 'submitted'],
    queryFn: async () => {
      if (!p4port || !p4user || !p4client) {
        return [];
      }
      return invokeP4ChangesSubmitted(500, p4port, p4user, p4client);
    },
    enabled: status === 'connected', // Only fetch when connected
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Client-side filtering based on search term
  const results = useMemo(() => {
    const changelists = data || [];
    const term = searchTerm.trim();

    // Don't show all results when search is empty
    if (!term) {
      return [];
    }

    const lowerTerm = term.toLowerCase();

    // Auto-detect search type and filter
    // 1. If term is all digits, search by changelist number
    if (/^\d+$/.test(term)) {
      return changelists.filter((cl) => {
        const clNumber = String(cl.id);
        return clNumber.includes(term) || clNumber.startsWith(term);
      });
    }

    // 2. If term looks like a username AND matches a user in results, filter by user
    if (/^[a-zA-Z][\w.-]*$/.test(term)) {
      const matchingUsers = changelists.filter((cl) =>
        cl.user.toLowerCase().includes(lowerTerm)
      );
      if (matchingUsers.length > 0) {
        return matchingUsers;
      }
      // Fall through to description search if no user match
    }

    // 3. Search in description and file paths (if term contains path separator)
    return changelists.filter((cl) => {
      // Always search description
      if (cl.description.toLowerCase().includes(lowerTerm)) {
        return true;
      }

      // Also search file paths if term looks like a path
      // (This would require fetching files for each changelist, skip for now
      // as plan says to show description only)
      return false;
    });
  }, [data, searchTerm]);

  // Function to load more results (increase max_changes and refetch)
  const loadMore = async () => {
    // For now, just refetch with same limit
    // Could extend to increase maxChanges in future
    await refetch();
  };

  return {
    results,
    isLoading,
    isSearching: searchTerm.trim().length > 0,
    loadMore,
  };
}
