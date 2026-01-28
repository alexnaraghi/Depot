import { create } from 'zustand';
import { P4Changelist, P4File } from '@/types/p4';

interface ChangelistState {
  // State: Map for O(1) lookups by changelist ID
  changelists: Map<number, P4Changelist>;
  isLoading: boolean;

  // Actions
  setChangelists: (changelists: P4Changelist[]) => void;
  updateChangelist: (id: number, updates: Partial<P4Changelist>) => void;
  addFileToChangelist: (changelistId: number, file: P4File) => void;
  removeFileFromChangelist: (changelistId: number, depotPath: string) => void;
  setLoading: (loading: boolean) => void;
  getChangelist: (id: number) => P4Changelist | undefined;
  getPendingChangelists: () => P4Changelist[];
}

export const useChangelistStore = create<ChangelistState>((set, get) => ({
  changelists: new Map([
    // Default changelist (id=0) always exists
    [
      0,
      {
        id: 0,
        description: 'Default Changelist',
        user: '',
        client: '',
        status: 'pending',
        files: [],
        fileCount: 0,
      },
    ],
  ]),
  isLoading: false,

  setChangelists: (changelists) => {
    const changelistMap = new Map<number, P4Changelist>();

    // Always include default changelist
    const defaultCL = get().changelists.get(0);
    if (defaultCL) {
      changelistMap.set(0, defaultCL);
    }

    changelists.forEach((cl) => {
      changelistMap.set(cl.id, cl);
    });

    set({ changelists: changelistMap });
  },

  updateChangelist: (id, updates) => {
    const currentChangelists = get().changelists;
    const existingCL = currentChangelists.get(id);

    if (existingCL) {
      const updatedCL = { ...existingCL, ...updates };
      const newChangelists = new Map(currentChangelists);
      newChangelists.set(id, updatedCL);
      set({ changelists: newChangelists });
    }
  },

  addFileToChangelist: (changelistId, file) => {
    const currentChangelists = get().changelists;
    const changelist = currentChangelists.get(changelistId);

    if (changelist) {
      // Check if file already exists in changelist
      const fileExists = changelist.files.some((f) => f.depotPath === file.depotPath);

      if (!fileExists) {
        const updatedFiles = [...changelist.files, file];
        const updatedCL = {
          ...changelist,
          files: updatedFiles,
          fileCount: updatedFiles.length,
        };

        const newChangelists = new Map(currentChangelists);
        newChangelists.set(changelistId, updatedCL);
        set({ changelists: newChangelists });
      }
    }
  },

  removeFileFromChangelist: (changelistId, depotPath) => {
    const currentChangelists = get().changelists;
    const changelist = currentChangelists.get(changelistId);

    if (changelist) {
      const updatedFiles = changelist.files.filter((f) => f.depotPath !== depotPath);
      const updatedCL = {
        ...changelist,
        files: updatedFiles,
        fileCount: updatedFiles.length,
      };

      const newChangelists = new Map(currentChangelists);
      newChangelists.set(changelistId, updatedCL);
      set({ changelists: newChangelists });
    }
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  getChangelist: (id) => {
    return get().changelists.get(id);
  },

  getPendingChangelists: () => {
    const changelists = get().changelists;
    const pending: P4Changelist[] = [];

    changelists.forEach((cl) => {
      if (cl.status === 'pending') {
        pending.push(cl);
      }
    });

    return pending;
  },
}));
