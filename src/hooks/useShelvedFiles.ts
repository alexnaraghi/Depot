import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  invokeP4DescribeShelved,
  invokeP4Shelve,
  invokeP4Unshelve,
  invokeP4DeleteShelf,
  invokeP4Opened,
  type P4ShelvedFile,
} from '@/lib/tauri';
import { useConnectionStore } from '@/stores/connectionStore';
import { useOperationStore } from '@/store/operation';
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
    queryFn: () =>
      invokeP4DescribeShelved(
        changelistId,
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      ),
    enabled: changelistId > 0 && !!p4port && !!p4user && !!p4client,
  });
}

/**
 * Hook for shelving files to a changelist.
 *
 * Invalidates shelved, opened, and changes queries on success.
 */
export function useShelve() {
  const { p4port, p4user, p4client } = useConnectionStore();
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
      return invokeP4Shelve(
        changelistId,
        filePaths,
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );
    },
    onSuccess: (data, variables) => {
      addOutputLine(String(data), false);
      toast.success(`Shelved ${variables.filePaths.length} file(s)`);
      queryClient.invalidateQueries({ queryKey: ['p4', 'shelved'] });
      queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });
      queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
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
  const { p4port, p4user, p4client } = useConnectionStore();
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
      const shelvedFiles = await invokeP4DescribeShelved(
        changelistId,
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );

      // Filter to only the files we're unshelving (if specific files requested)
      const filesToUnshelve = filePaths
        ? shelvedFiles.filter(f => filePaths.includes(f.depotPath))
        : shelvedFiles;

      // Get currently opened files
      const openedFiles = await invokeP4Opened(
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );

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
      addOutputLine(`p4 unshelve -s ${changelistId}${filePaths ? ' ' + filePaths.join(' ') : ''}`, false);
      return invokeP4Unshelve(
        changelistId,
        filePaths,
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );
    },
    onSuccess: (data, variables) => {
      addOutputLine(String(data), false);
      const message = variables.filePaths
        ? `Unshelved ${variables.filePaths.length} file(s) successfully`
        : 'Unshelved files successfully';
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ['p4', 'shelved'] });
      queryClient.invalidateQueries({ queryKey: ['p4', 'opened'] });
      queryClient.invalidateQueries({ queryKey: ['p4', 'changes'] });
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
  const { p4port, p4user, p4client } = useConnectionStore();
  const queryClient = useQueryClient();
  const { addOutputLine } = useOperationStore();

  return useMutation({
    mutationFn: async ({ changelistId }: { changelistId: number }) => {
      addOutputLine(`p4 shelve -d -c ${changelistId}`, false);
      return invokeP4DeleteShelf(
        changelistId,
        p4port ?? undefined,
        p4user ?? undefined,
        p4client ?? undefined
      );
    },
    onSuccess: (data) => {
      addOutputLine(String(data), false);
      toast.success('Deleted shelf successfully');
      queryClient.invalidateQueries({ queryKey: ['p4', 'shelved'] });
    },
    onError: (error) => {
      addOutputLine(`Error: ${error}`, true);
      toast.error(`Failed to delete shelf: ${error}`);
    },
  });
}
