import { create } from 'zustand';
import { useDetailPaneStore } from '@/stores/detailPaneStore';

interface SearchFilterState {
  // State
  filterTerm: string;          // Current search/filter text
  isActive: boolean;           // Whether filter is active (term is non-empty)
  fileTreeMatchCount: number;  // Match count from file tree
  changelistMatchCount: number; // Match count from changelist panel
  searchMode: 'fuzzy' | 'exact'; // Search mode for backend queries

  // Actions
  setFilterTerm: (term: string) => void;
  clearFilter: () => void;
  setFileTreeMatchCount: (count: number) => void;
  setChangelistMatchCount: (count: number) => void;
  toggleSearchMode: () => void;
}

export const useSearchFilterStore = create<SearchFilterState>((set) => ({
  filterTerm: '',
  isActive: false,
  fileTreeMatchCount: 0,
  changelistMatchCount: 0,
  searchMode: 'fuzzy',

  setFilterTerm: (term) => set({
    filterTerm: term,
    isActive: term.trim().length > 0,
  }),

  clearFilter: () => {
    set({
      filterTerm: '',
      isActive: false,
      fileTreeMatchCount: 0,
      changelistMatchCount: 0,
      // Note: searchMode intentionally NOT reset - preserve user preference
    });
    // Reset detail pane to workspace summary when clearing filter
    useDetailPaneStore.getState().clear();
  },

  setFileTreeMatchCount: (count) => set({ fileTreeMatchCount: count }),
  setChangelistMatchCount: (count) => set({ changelistMatchCount: count }),
  toggleSearchMode: () => set((state) => ({
    searchMode: state.searchMode === 'fuzzy' ? 'exact' : 'fuzzy',
  })),
}));
