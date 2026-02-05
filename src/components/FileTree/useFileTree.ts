import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useWindowFocus } from '@/hooks/useWindowFocus';
import {
  invokeP4FstatStream,
  invokeP4Info,
  invokeP4FstatOpened,
  P4FileInfo,
  FstatStreamBatch,
  addFilesToIndex,
  clearFileIndex,
} from '@/lib/tauri';
import { useOperationStore } from '@/store/operation';
import { getVerboseLogging, getDeltaRefreshInterval, getFullRefreshInterval } from '@/lib/settings';
import {
  buildFileTree,
  incrementalTreeUpdate,
  shouldUseIncrementalUpdate,
  createChangeMap,
  mergeDeltaFiles,
  FileTreeNode,
} from '@/utils/treeBuilder';
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
  const isWindowFocused = useWindowFocus();

  // Load refresh intervals from settings
  const [deltaInterval, setDeltaInterval] = useState<number>(30000);
  const [fullInterval, setFullInterval] = useState<number>(300000);

  useEffect(() => {
    getDeltaRefreshInterval().then(setDeltaInterval);
    getFullRefreshInterval().then(setFullInterval);
  }, []);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const accumulatedFilesRef = useRef<P4File[]>([]);
  const estimatedTotalRef = useRef(0);

  // References for incremental updates
  const prevTreeRef = useRef<FileTreeNode[]>([]);
  const prevFilesRef = useRef<Map<string, P4File>>(new Map());

  // Track last refresh timestamps for focus-return logic
  const lastDeltaRefreshRef = useRef<number>(Date.now());
  const lastFullRefreshRef = useRef<number>(Date.now());

  // Auto-refresh is active when connected, not streaming, window focused, and interval > 0
  const isDeltaRefreshActive =
    isConnected && !isStreaming && isWindowFocused && deltaInterval > 0;
  const isFullRefreshActive =
    isConnected && !isStreaming && isWindowFocused && fullInterval > 0;

  // Clear store and index when disconnected
  useEffect(() => {
    if (!isConnected) {
      useFileTreeStore.setState({ files: new Map(), rootPath: null, selectedFile: null, isLoading: false });
      // Clear FileIndex when workspace changes/disconnects
      clearFileIndex().catch(err => {
        console.warn('Failed to clear file index on disconnect:', err);
      });
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

    // Clear FileIndex before starting new stream
    clearFileIndex().catch(err => {
      console.warn('Failed to clear file index:', err);
    });

    const verbose = await getVerboseLogging();
    if (verbose) addOutputLine(`p4 fstat ${depotPath} (streaming)`, false);

    return new Promise<P4File[]>((resolve, reject) => {
      invokeP4FstatStream([], depotPath, (batch: FstatStreamBatch) => {
        if (batch.type === 'data') {
          // Map backend types to frontend types
          const mappedBatch = batch.files.map(mapP4FileInfo);
          accumulatedFilesRef.current.push(...mappedBatch);

          // Populate FileIndex incrementally (fire-and-forget for performance)
          const indexEntries = batch.files.map(file => ({
            depotPath: file.depot_path,
            modTime: file.head_mod_time ?? 0,  // Use headModTime for recency bias
          }));
          addFilesToIndex(indexEntries).catch(err => {
            console.warn('Failed to add files to index:', err);
          });

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
            // Update refs for incremental updates
            prevFilesRef.current = new Map(
              accumulatedFilesRef.current.map(f => [f.depotPath, f])
            );
            lastFullRefreshRef.current = Date.now();
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

  // Query for workspace files using streaming (slow refresh: 5min default)
  const { data: files = [], isLoading: filesLoading, error: filesError, refetch } = useQuery({
    queryKey: ['fileTree', rootPath, depotPath],
    queryFn: loadFilesStreaming,
    enabled: rootPath !== null && !isStreaming, // Disable during active streaming
    staleTime: fullInterval / 2, // Allow refetch after half the interval
    refetchOnWindowFocus: false, // We handle focus ourselves
    refetchInterval: isFullRefreshActive ? fullInterval : false,
    structuralSharing: false, // Prevent reference breaks from streaming updates
  });

  // Fast refresh: query only opened files every 30s (delta refresh)
  const { data: openedFilesData } = useQuery({
    queryKey: ['p4', 'fstat', 'opened', p4port, p4user, p4client],
    queryFn: async () => {
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine('p4 fstat (opened files for delta refresh)', false);
      const result = await invokeP4FstatOpened();
      if (verbose) addOutputLine(`... returned ${result.length} opened items`, false);
      lastDeltaRefreshRef.current = Date.now();
      return result.map(mapP4FileInfo);
    },
    enabled: isDeltaRefreshActive && rootPath !== null,
    staleTime: deltaInterval / 2, // Allow refetch after half the interval
    refetchInterval: isDeltaRefreshActive ? deltaInterval : false,
    refetchOnWindowFocus: false, // We handle focus ourselves
  });

  const isLoading = clientInfoLoading || filesLoading || isStreaming;
  const error = clientInfoError || filesError;

  // Immediate refresh on focus return if interval elapsed while unfocused
  useEffect(() => {
    if (!isWindowFocused) return;
    if (!isConnected || isStreaming) return;

    const now = Date.now();

    // Check if delta interval elapsed
    if (deltaInterval > 0 && now - lastDeltaRefreshRef.current > deltaInterval) {
      queryClient.invalidateQueries({
        queryKey: ['p4', 'fstat', 'opened', p4port, p4user, p4client],
      });
    }

    // Check if full interval elapsed
    if (fullInterval > 0 && now - lastFullRefreshRef.current > fullInterval) {
      queryClient.invalidateQueries({
        queryKey: ['fileTree', rootPath, depotPath],
      });
    }
  }, [
    isWindowFocused,
    isConnected,
    isStreaming,
    deltaInterval,
    fullInterval,
    p4port,
    p4user,
    p4client,
    rootPath,
    depotPath,
    queryClient,
  ]);

  // Process delta refresh results - merge incrementally when they arrive
  useEffect(() => {
    if (!openedFilesData || openedFilesData.length === 0) return;
    if (prevFilesRef.current.size === 0) return; // No existing data to merge with

    const currentFiles = useFileTreeStore.getState().files;

    // Create change map to identify actual changes
    const changeMap = createChangeMap(currentFiles, openedFilesData);

    if (changeMap.size === 0) {
      // No actual changes detected
      return;
    }

    // Decide: incremental update or merge and let full refresh rebuild
    if (shouldUseIncrementalUpdate(currentFiles.size, changeMap.size)) {
      // Incremental: update tree in place with structural sharing
      const currentTree = prevTreeRef.current;
      if (currentTree.length > 0) {
        const updatedTree = incrementalTreeUpdate(currentTree, changeMap);
        prevTreeRef.current = updatedTree;

        // Merge files into store
        const mergedFiles = mergeDeltaFiles(currentFiles, openedFilesData);
        prevFilesRef.current = mergedFiles;
        setFiles(Array.from(mergedFiles.values()));
      }
    } else {
      // Too many changes - merge files and let full rebuild happen naturally
      const mergedFiles = mergeDeltaFiles(currentFiles, openedFilesData);
      prevFilesRef.current = mergedFiles;
      setFiles(Array.from(mergedFiles.values()));
      // Tree will rebuild in useMemo below
    }
  }, [openedFilesData, setFiles]);

  // Build tree structure from flat file list with incremental update support
  const tree = useMemo(() => {
    if (!rootPath || files.length === 0) {
      prevTreeRef.current = [];
      prevFilesRef.current = new Map();
      return [];
    }

    // Check if we can use incremental update
    const currentFiles = new Map(files.map(f => [f.depotPath, f]));
    const changeMap = createChangeMap(prevFilesRef.current, files);

    let newTree: FileTreeNode[];

    if (
      prevTreeRef.current.length > 0 &&
      shouldUseIncrementalUpdate(prevFilesRef.current.size, changeMap.size)
    ) {
      // Incremental update preserving object identity
      newTree = incrementalTreeUpdate(prevTreeRef.current, changeMap);
    } else {
      // Full rebuild
      newTree = buildFileTree(files, rootPath);
    }

    // Update refs for next comparison
    prevTreeRef.current = newTree;
    prevFilesRef.current = currentFiles;

    return newTree;
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
