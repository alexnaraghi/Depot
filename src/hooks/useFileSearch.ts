import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { useSearchFilterStore } from '@/stores/searchFilterStore';
import { useDebounce } from './useDebounce';

export interface SearchResult {
  depotPath: string;
  score: number;
  modTime: number;
}

/**
 * Hook for searching workspace files via Rust backend
 *
 * Uses the persistent FileIndex for instant fuzzy search across large workspaces.
 * Debounces queries by 150ms to prevent excessive backend calls during typing.
 */
export function useFileSearch(query: string) {
  const searchMode = useSearchFilterStore(s => s.searchMode);
  const debouncedQuery = useDebounce(query, 150);

  return useQuery({
    queryKey: ['file-search', debouncedQuery, searchMode],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!debouncedQuery.trim()) {
        return [];
      }

      const results = await invoke<SearchResult[]>('search_workspace_files', {
        query: debouncedQuery,
        mode: searchMode,
        maxResults: 500, // Get more results for hierarchical filtering
      });

      return results;
    },
    enabled: debouncedQuery.length > 0,
    staleTime: 5000, // Cache results for 5s
    gcTime: 30000,   // Keep in cache for 30s
  });
}

/**
 * Add files to the index (called from streaming fstat)
 */
export async function addFilesToIndex(files: Array<{ depotPath: string; modTime: number }>) {
  await invoke('add_files_to_index', { files });
}

/**
 * Clear the index (called on workspace change)
 */
export async function clearFileIndex() {
  await invoke('clear_file_index');
}

/**
 * Get current index count
 */
export async function getFileIndexCount(): Promise<number> {
  return await invoke<number>('get_file_index_count');
}
