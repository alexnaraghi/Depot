import { create } from 'zustand';
import { P4File } from '@/types/p4';

interface FileTreeState {
  // State: Map for O(1) lookups by depot path
  files: Map<string, P4File>;
  rootPath: string | null;
  isLoading: boolean;
  selectedFile: P4File | null;

  // Actions
  setFiles: (files: P4File[]) => void;
  updateFile: (depotPath: string, updates: Partial<P4File>) => void;
  setRootPath: (path: string) => void;
  setLoading: (loading: boolean) => void;
  setSelectedFile: (file: P4File | null) => void;
  getFileByPath: (depotPath: string) => P4File | undefined;
  getFilesInFolder: (folderPath: string) => P4File[];
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  files: new Map(),
  rootPath: null,
  isLoading: false,
  selectedFile: null,

  setFiles: (files) => {
    const fileMap = new Map<string, P4File>();
    files.forEach((file) => {
      fileMap.set(file.depotPath, file);
    });
    set({ files: fileMap });
  },

  updateFile: (depotPath, updates) => {
    const currentFiles = get().files;
    const existingFile = currentFiles.get(depotPath);

    if (existingFile) {
      const updatedFile = { ...existingFile, ...updates };
      const newFiles = new Map(currentFiles);
      newFiles.set(depotPath, updatedFile);
      set({ files: newFiles });
    }
  },

  setRootPath: (path) => {
    set({ rootPath: path });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setSelectedFile: (file) => {
    set({ selectedFile: file });
  },

  getFileByPath: (depotPath) => {
    return get().files.get(depotPath);
  },

  getFilesInFolder: (folderPath) => {
    const files = get().files;
    const results: P4File[] = [];

    // Normalize folder path to ensure it ends with /
    const normalizedFolder = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;

    files.forEach((file) => {
      if (file.depotPath.startsWith(normalizedFolder)) {
        results.push(file);
      }
    });

    return results;
  },
}));
