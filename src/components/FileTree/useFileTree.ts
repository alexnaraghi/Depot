import { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { invokeP4Fstat, invokeP4Info, P4FileInfo } from '@/lib/tauri';
import { useOperationStore } from '@/store/operation';
import { getVerboseLogging } from '@/lib/settings';
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
  const { rootPath, setFiles, setLoading, setRootPath } = useFileTreeStore();
  const { status, p4port, p4user, p4client } = useConnectionStore();
  const isConnected = status === 'connected';

  // Clear store when disconnected
  useEffect(() => {
    if (!isConnected) {
      useFileTreeStore.setState({ files: new Map(), rootPath: null, selectedFile: null, isLoading: false });
    }
  }, [isConnected]);

  // First, query for P4 client info to get the workspace root and stream
  // Only runs when connected (settings configured and connection verified)
  const { data: clientInfo, isLoading: clientInfoLoading, error: clientInfoError } = useQuery({
    queryKey: ['p4Info', p4port, p4user, p4client],
    queryFn: async () => {
      const { addOutputLine } = useOperationStore.getState();
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine('p4 info', false);
      const result = await invokeP4Info(p4port ?? undefined, p4user ?? undefined, p4client ?? undefined);
      if (verbose) addOutputLine('... ok', false);
      return result;
    },
    staleTime: Infinity, // Client info doesn't change during session
    refetchOnWindowFocus: false,
    enabled: isConnected,
  });

  // Set the root path from client info
  useEffect(() => {
    if (isConnected && clientInfo?.client_root && rootPath !== clientInfo.client_root) {
      setRootPath(clientInfo.client_root);
    }
  }, [isConnected, clientInfo, rootPath, setRootPath]);

  // Build depot path for querying (e.g., "//stream/main/...")
  const depotPath = clientInfo?.client_stream
    ? `${clientInfo.client_stream}/...`
    : undefined;

  // Query for workspace files (only after we have rootPath)
  const { data: files = [], isLoading: filesLoading, error: filesError, refetch } = useQuery({
    queryKey: ['fileTree', rootPath, depotPath],
    queryFn: async () => {
      const { addOutputLine } = useOperationStore.getState();
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine(`p4 fstat ${depotPath}`, false);
      setLoading(true);
      try {
        // Pass depot path to query files (avoids -d flag issues with DVCS)
        const fileInfos = await invokeP4Fstat([], depotPath, p4port ?? undefined, p4user ?? undefined, p4client ?? undefined);
        if (verbose) addOutputLine(`... returned ${fileInfos.length} items`, false);
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

  const isLoading = clientInfoLoading || filesLoading;
  const error = clientInfoError || filesError;

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
