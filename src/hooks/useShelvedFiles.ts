import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  invokeP4DescribeShelved,
  invokeP4Shelve,
  invokeP4Unshelve,
  invokeP4DeleteShelf,
  invokeP4Opened,
  invokeP4ResolvePreview,
  type P4ShelvedFile,
} from '@/lib/tauri';
import { useConnectionStore } from '@/stores/connectionStore';
import { useOperationStore } from '@/store/operation';
import { getVerboseLogging } from '@/lib/settings';
import toast from 'react-hot-toast';

/**
 * Hook for querying shelved files in a changelist.
 *
 * Only enabled for numbered changelists (id > 0) as default CL cannot have shelves.
 */
export function useShelvedFilesQuery(changelistId: number) {
  const { p4port, p4user, p4client } = useConnectionStore();

  return useQuery<P4ShelvedFile[]>({
    queryKey: ['p4', 'shelved', changelistId],
    queryFn: async () => {
      const { addOutputLine } = useOperationStore.getState();
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine(`p4 describe -S ${changelistId}`, false);
      try {
        const result = await invokeP4DescribeShelved(changelistId);
        if (verbose) addOutputLine(`... returned ${result.length} shelved items`, false);
        return result;
      } catch (error) {
        // CL may not have shelved files - return empty array instead of throwing
        if (verbose) addOutputLine(`... no shelved files (${error})`, false);
        return [];
      }
    },
    enabled: changelistId > 0 && !!p4port && !!p4user && !!p4client,
    retry: 1,
  });
}

/**
 * Hook for shelving files to a changelist.
 *
 * Invalidates shelved, opened, and changes queries on success.
 */
export function useShelve() {
  const queryClient = useQueryClient();
  const { addOutputLine } = useOperationStore();

  return useMutation({
    mutationFn: async ({
      changelistId,
      filePaths,
    }: {
      changelistId: number;
      filePaths: string[];
    }) => {
      addOutputLine(`p4 shelve -c ${changelistId} ${filePaths.join(' ')}`, false);
      return invokeP4Shelve(changelistId, filePaths);
    },
    onSuccess: async (data, variables) => {
      addOutputLine(String(data), false);
      toast.success(`Shelved ${variables.filePaths.length} file(s)`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['p4', 'shelved-batch'] }),
        queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] }),
        queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] }),
      ]);
    },
    onError: (error) => {
      addOutputLine(`Error: ${error}`, true);
      toast.error(`Failed to shelve files: ${error}`);
    },
  });
}

/**
 * Hook for unshelving files from a changelist.
 *
 * Checks for conflicts with currently opened files before unshelving.
 * Shows confirmation dialog if conflicts detected.
 * Invalidates shelved, opened, and changes queries on success.
 *
 * @param filePaths - Optional array of depot file paths to unshelve specific files.
 *                    If omitted, unshelves all files from the changelist.
 */
export function useUnshelve() {
  const queryClient = useQueryClient();
  const { addOutputLine } = useOperationStore();

  return useMutation({
    mutationFn: async ({
      changelistId,
      filePaths,
    }: {
      changelistId: number;
      filePaths?: string[];
    }) => {
      // Get shelved files to check for conflicts
      const shelvedFiles = await invokeP4DescribeShelved(changelistId);

      // Filter to only the files we're unshelving (if specific files requested)
      const filesToUnshelve = filePaths
        ? shelvedFiles.filter(f => filePaths.includes(f.depotPath))
        : shelvedFiles;

      // Get currently opened files
      const openedFiles = await invokeP4Opened();

      // Check for overlaps
      const openedPaths = new Set(openedFiles.map((f) => f.depot_path));
      const conflicts = filesToUnshelve.filter((f) => openedPaths.has(f.depotPath));

      if (conflicts.length > 0) {
        const confirmed = window.confirm(
          `${conflicts.length} file(s) are already opened. Unshelving may create conflicts that need resolution. Continue?`
        );
        if (!confirmed) {
          throw new Error('User cancelled unshelve operation');
        }
      }

      // Proceed with unshelve
      addOutputLine(`p4 unshelve -s ${changelistId} -c ${changelistId}${filePaths ? ' ' + filePaths.join(' ') : ''}`, false);
      return invokeP4Unshelve(
        changelistId,
        changelistId,  // target = source (same CL)
        filePaths
      );
    },
    onSuccess: async (data, variables) => {
      addOutputLine(String(data), false);
      const message = variables.filePaths
        ? `Unshelved ${variables.filePaths.length} file(s) successfully`
        : 'Unshelved files successfully';
      toast.success(message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['p4', 'shelved-batch'] }),
        queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] }),
        queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] }),
      ]);

      // Check for files needing resolution
      try {
        const unresolvedFiles = await invokeP4ResolvePreview();
        if (unresolvedFiles.length > 0) {
          addOutputLine(`${unresolvedFiles.length} file(s) need resolution`, false);
          toast(`${unresolvedFiles.length} file(s) need resolution after unshelve`, {
            icon: '⚠️',
            duration: 5000,
          });
        }
      } catch {
        // Non-blocking: if resolve check fails, don't block the unshelve success
      }
    },
    onError: (error: Error) => {
      // Don't show error toast if user cancelled
      if (!error.message.includes('User cancelled')) {
        addOutputLine(`Error: ${error}`, true);
        toast.error(`Failed to unshelve files: ${error}`);
      }
    },
  });
}

/**
 * Hook for deleting all shelved files from a changelist.
 *
 * Invalidates shelved queries on success.
 */
export function useDeleteShelf() {
  const queryClient = useQueryClient();
  const { addOutputLine } = useOperationStore();

  return useMutation({
    mutationFn: async ({ changelistId }: { changelistId: number }) => {
      addOutputLine(`p4 shelve -d -c ${changelistId}`, false);
      return invokeP4DeleteShelf(changelistId);
    },
    onSuccess: async (data) => {
      addOutputLine(String(data), false);
      toast.success('Deleted shelf successfully');
      await queryClient.invalidateQueries({ queryKey: ['p4', 'shelved-batch'] });
    },
    onError: (error) => {
      addOutputLine(`Error: ${error}`, true);
      toast.error(`Failed to delete shelf: ${error}`);
    },
  });
}
