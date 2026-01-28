import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { invokeP4Fstat, P4FileInfo } from '@/lib/tauri';
import { buildFileTree } from '@/utils/treeBuilder';
import { P4File, FileStatus, FileAction } from '@/types/p4';

/**
 * Maps P4FileInfo from backend to P4File type for frontend
 */
function mapP4FileInfo(info: P4FileInfo): P4File {
  // Determine status from backend fields
  let status: FileStatus;
  if (info.action) {
    // File is opened
    switch (info.action) {
      case 'add':
        status = FileStatus.Added;
        break;
      case 'delete':
        status = FileStatus.Deleted;
        break;
      case 'edit':
        status = FileStatus.CheckedOut;
        break;
      default:
        status = FileStatus.CheckedOut;
    }
  } else if (info.revision < info.head_revision) {
    status = FileStatus.OutOfDate;
  } else if (info.status === 'conflict') {
    status = FileStatus.Conflict;
  } else if (info.status === 'modified') {
    status = FileStatus.Modified;
  } else {
    status = FileStatus.Synced;
  }

  return {
    depotPath: info.depot_path,
    localPath: info.local_path,
    status,
    action: info.action as FileAction | undefined,
    revision: info.revision,
    headRevision: info.head_revision,
    changelist: info.changelist,
    fileType: info.file_type,
    isDirectory: false,
  };
}

/**
 * Hook for loading and managing file tree data
 *
 * Fetches workspace files from P4, maps to frontend types,
 * updates store, and builds hierarchical tree structure.
 *
 * Uses TanStack Query for caching and automatic refetch.
 */
export function useFileTree() {
  const { rootPath, setFiles, setLoading } = useFileTreeStore();

  // Query for workspace files
  const { data: files = [], isLoading, error, refetch } = useQuery({
    queryKey: ['fileTree', rootPath],
    queryFn: async () => {
      setLoading(true);
      try {
        const fileInfos = await invokeP4Fstat([]);
        const mappedFiles = fileInfos.map(mapP4FileInfo);
        setFiles(mappedFiles);
        return mappedFiles;
      } finally {
        setLoading(false);
      }
    },
    enabled: rootPath !== null,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true,
  });

  // Build tree structure from flat file list
  const tree = useMemo(() => {
    if (!rootPath || files.length === 0) {
      return [];
    }
    return buildFileTree(files, rootPath);
  }, [files, rootPath]);

  return {
    tree,
    files,
    isLoading,
    error,
    refetch,
  };
}
