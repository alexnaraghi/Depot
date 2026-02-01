import { create } from 'zustand';

interface SearchFilterState {
  // State
  filterTerm: string;          // Current search/filter text
  isActive: boolean;           // Whether filter is active (term is non-empty)
  fileTreeMatchCount: number;  // Match count from file tree
  changelistMatchCount: number; // Match count from changelist panel

  // Actions
  setFilterTerm: (term: string) => void;
  clearFilter: () => void;
  setFileTreeMatchCount: (count: number) => void;
  setChangelistMatchCount: (count: number) => void;
}

export const useSearchFilterStore = create<SearchFilterState>((set) => ({
  filterTerm: '',
  isActive: false,
  fileTreeMatchCount: 0,
  changelistMatchCount: 0,

  setFilterTerm: (term) => set({
    filterTerm: term,
    isActive: term.trim().length > 0,
  }),

  clearFilter: () => set({
    filterTerm: '',
    isActive: false,
    fileTreeMatchCount: 0,
    changelistMatchCount: 0,
  }),

  setFileTreeMatchCount: (count) => set({ fileTreeMatchCount: count }),
  setChangelistMatchCount: (count) => set({ changelistMatchCount: count }),
}));
