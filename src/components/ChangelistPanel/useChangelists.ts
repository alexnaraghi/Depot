import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChangelistStore } from '@/stores/changelistStore';
import { invokeP4Changes, invokeP4Opened } from '@/lib/tauri';
import { buildChangelistTree } from '@/utils/treeBuilder';
import { P4Changelist, P4File, FileStatus } from '@/types/p4';

/**
 * Hook for loading and managing changelist data
 *
 * Queries both changelists (p4 changes) and opened files (p4 opened),
 * then merges them to associate files with their changelists.
 *
 * Default changelist (id=0) always exists.
 */
export function useChangelists() {
  const { changelists, setChangelists } = useChangelistStore();

  // Load pending changelists
  const { data: clData, isLoading: clLoading } = useQuery({
    queryKey: ['p4', 'changes', 'pending'],
    queryFn: () => invokeP4Changes('pending'),
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  // Load opened files (to associate with changelists)
  const { data: openedData, isLoading: openedLoading } = useQuery({
    queryKey: ['p4', 'opened'],
    queryFn: () => invokeP4Opened(),
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  // Merge changelist data with opened files
  useEffect(() => {
    if (!clData || !openedData) return;

    const clMap = new Map<number, P4Changelist>();

    // Initialize default changelist
    clMap.set(0, {
      id: 0,
      description: 'Default changelist',
      user: '',
      client: '',
      status: 'pending',
      files: [],
      fileCount: 0,
    });

    // Add named changelists
    for (const cl of clData) {
      clMap.set(cl.id, {
        id: cl.id,
        description: cl.description,
        user: cl.user,
        client: cl.client,
        status: cl.status as 'pending' | 'submitted' | 'shelved',
        files: [],
        fileCount: 0,
      });
    }

    // Associate files with changelists
    for (const file of openedData) {
      const clId = file.changelist ?? 0;
      const cl = clMap.get(clId);
      if (cl) {
        const p4File: P4File = {
          depotPath: file.depot_path,
          localPath: file.local_path,
          status: mapStatus(file.action),
          action: file.action as any,
          revision: file.revision,
          headRevision: file.head_revision,
          changelist: file.changelist,
          fileType: file.file_type,
          isDirectory: false,
        };
        cl.files.push(p4File);
        cl.fileCount++;
      }
    }

    setChangelists(Array.from(clMap.values()));
  }, [clData, openedData, setChangelists]);

  // Build tree from store
  const treeData = useMemo(() => {
    const clArray = Array.from(changelists.values());
    // Only show changelists with files or non-empty description
    const nonEmpty = clArray.filter(cl => cl.fileCount > 0 || cl.id !== 0);
    return buildChangelistTree(nonEmpty);
  }, [changelists]);

  const isLoading = clLoading || openedLoading;

  return {
    treeData,
    isLoading,
    changelists: Array.from(changelists.values()),
  };
}

/**
 * Map P4 action to FileStatus enum
 */
function mapStatus(action?: string): FileStatus {
  if (!action) return FileStatus.Synced;

  switch (action) {
    case 'edit':
      return FileStatus.CheckedOut;
    case 'add':
      return FileStatus.Added;
    case 'delete':
      return FileStatus.Deleted;
    default:
      return FileStatus.CheckedOut;
  }
}
