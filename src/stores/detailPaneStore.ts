import { create } from 'zustand';
import { P4Changelist } from '@/types/p4';
import { P4Revision } from '@/lib/tauri';

/**
 * Selection types for the detail pane (discriminated union)
 */
export type DetailSelection =
  | { type: 'none' }                                           // Workspace summary
  | { type: 'file'; depotPath: string; localPath: string; fromCl?: number }  // File detail
  | { type: 'changelist'; changelist: P4Changelist }           // CL detail
  | { type: 'revision'; depotPath: string; localPath: string; revision: P4Revision };  // Revision detail

interface DetailPaneState {
  // State
  selection: DetailSelection;
  history: DetailSelection[];  // Back stack (max 3 items, NOT including current)

  // Actions
  navigate: (selection: DetailSelection) => void;
  goBack: () => void;
  selectFile: (depotPath: string, localPath: string, fromCl?: number) => void;
  selectChangelist: (changelist: P4Changelist) => void;
  drillToFile: (depotPath: string, localPath: string, fromCl?: number) => void;
  drillToRevision: (depotPath: string, localPath: string, revision: P4Revision) => void;
  clear: () => void;
}

export const useDetailPaneStore = create<DetailPaneState>((set, get) => ({
  selection: { type: 'none' },
  history: [],

  navigate: (selection) => {
    const current = get().selection;
    let newHistory = get().history;

    // Push current to history if not 'none'
    if (current.type !== 'none') {
      newHistory = [...newHistory, current];
      // Keep max 3 items in history
      if (newHistory.length > 3) {
        newHistory = newHistory.slice(1);
      }
    }

    set({ selection, history: newHistory });
  },

  goBack: () => {
    const history = get().history;
    if (history.length === 0) {
      set({ selection: { type: 'none' } });
      return;
    }

    // Pop last item from history into current selection
    const newSelection = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    set({ selection: newSelection, history: newHistory });
  },

  selectFile: (depotPath, localPath, fromCl) => {
    // Direct selection from side column - reset history to depth 1
    set({
      selection: { type: 'file', depotPath, localPath, fromCl },
      history: [],
    });
  },

  selectChangelist: (changelist) => {
    // Direct selection from side column - reset history to depth 1
    set({
      selection: { type: 'changelist', changelist },
      history: [],
    });
  },

  drillToFile: (depotPath, localPath, fromCl) => {
    // Navigate deeper - preserve full history
    const current = get().selection;
    let newHistory = get().history;

    if (current.type !== 'none') {
      newHistory = [...newHistory, current];
      if (newHistory.length > 3) {
        newHistory = newHistory.slice(1);
      }
    }

    set({
      selection: { type: 'file', depotPath, localPath, fromCl },
      history: newHistory,
    });
  },

  drillToRevision: (depotPath, localPath, revision) => {
    // Navigate deeper - preserve full history
    const current = get().selection;
    let newHistory = get().history;

    if (current.type !== 'none') {
      newHistory = [...newHistory, current];
      if (newHistory.length > 3) {
        newHistory = newHistory.slice(1);
      }
    }

    set({
      selection: { type: 'revision', depotPath, localPath, revision },
      history: newHistory,
    });
  },

  clear: () => {
    set({ selection: { type: 'none' }, history: [] });
  },
}));
