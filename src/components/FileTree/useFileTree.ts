import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { invokeP4FstatStream, invokeP4Info, P4FileInfo, FstatStreamBatch } from '@/lib/tauri';
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
 * Fetches workspace files from P4 using streaming for progressive loading.
 * Updates store and builds hierarchical tree structure incrementally.
 *
 * Uses TanStack Query for caching with streaming accumulation.
 */
export function useFileTree() {
  const queryClient = useQueryClient();
  const { rootPath, setFiles, setLoading, setRootPath } = useFileTreeStore();
  const { status, p4port, p4user, p4client } = useConnectionStore();
  const {
    startOperation,
    updateProgress,
    setProcessId,
    completeOperation,
    addOutputLine,
  } = useOperationStore();
  const isConnected = status === 'connected';

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const accumulatedFilesRef = useRef<P4File[]>([]);
  const estimatedTotalRef = useRef(0);

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
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine('p4 info', false);
      const result = await invokeP4Info();
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

  // Build depot path for querying
  const depotPath = clientInfo?.client_stream
    ? `${clientInfo.client_stream}/...`
    : undefined;

  // Streaming fstat loader
  const loadFilesStreaming = useCallback(async () => {
    if (!rootPath || !depotPath) return [];
    if (isStreaming) return []; // Prevent concurrent streams

    const operationId = `fstat-${Date.now()}`;
    startOperation(operationId, 'fstat');
    setIsStreaming(true);
    setLoading(true);
    accumulatedFilesRef.current = [];
    estimatedTotalRef.current = 0;

    const verbose = await getVerboseLogging();
    if (verbose) addOutputLine(`p4 fstat ${depotPath} (streaming)`, false);

    return new Promise<P4File[]>((resolve, reject) => {
      invokeP4FstatStream([], depotPath, (batch: FstatStreamBatch) => {
        if (batch.type === 'data') {
          // Map backend types to frontend types
          const mappedBatch = batch.files.map(mapP4FileInfo);
          accumulatedFilesRef.current.push(...mappedBatch);

          // Update estimate: first batch sets baseline, subsequent batches refine
          if (estimatedTotalRef.current === 0) {
            // Conservative estimate: assume first batch is 10% of total
            estimatedTotalRef.current = batch.files.length * 10;
          } else if (batch.totalReceived > estimatedTotalRef.current * 0.9) {
            // Approaching estimate, increase it
            estimatedTotalRef.current = Math.floor(batch.totalReceived * 1.1);
          }

          // Update progress (capped at 99% until completion)
          const progress = Math.min(
            Math.round((batch.totalReceived / estimatedTotalRef.current) * 100),
            99
          );
          updateProgress(progress, `Loading files... (${batch.totalReceived})`);

          // Update query cache incrementally
          // Create new array reference to trigger React updates
          queryClient.setQueryData(
            ['fileTree', rootPath, depotPath],
            [...accumulatedFilesRef.current]
          );

          // Update store for components that use it directly
          setFiles(accumulatedFilesRef.current);

        } else if (batch.type === 'complete') {
          if (verbose) {
            addOutputLine(`... returned ${batch.totalFiles} items`, false);
          }

          if (batch.success) {
            completeOperation(true);
            resolve(accumulatedFilesRef.current);
          } else {
            completeOperation(false, batch.error ?? 'Unknown error');
            reject(new Error(batch.error ?? 'Streaming failed'));
          }

          setIsStreaming(false);
          setLoading(false);
        }
      })
        .then((processId) => {
          setProcessId(processId);
        })
        .catch((err) => {
          completeOperation(false, String(err));
          setIsStreaming(false);
          setLoading(false);
          reject(err);
        });
    });
  }, [
    rootPath,
    depotPath,
    isStreaming,
    startOperation,
    setLoading,
    addOutputLine,
    updateProgress,
    queryClient,
    setFiles,
    completeOperation,
    setProcessId,
  ]);

  // Query for workspace files using streaming
  const { data: files = [], isLoading: filesLoading, error: filesError, refetch } = useQuery({
    queryKey: ['fileTree', rootPath, depotPath],
    queryFn: loadFilesStreaming,
    enabled: rootPath !== null && !isStreaming, // Disable during active streaming
    staleTime: 30000,
    refetchOnWindowFocus: false, // Disable auto-refetch during potential streaming
    structuralSharing: false, // Prevent reference breaks from streaming updates
  });

  const isLoading = clientInfoLoading || filesLoading || isStreaming;
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
    isStreaming,
    error,
    refetch,
  };
}
