import { useCallback } from 'react';
import { invokeP4PrintToFile, invokeLaunchDiffTool } from '@/lib/tauri';
import { useConnectionStore } from '@/stores/connectionStore';
import { loadSettings } from '@/lib/settings';
import toast from 'react-hot-toast';

/**
 * Hook for launching external diff tool with revision comparisons.
 *
 * Provides two operations:
 * - diffRevisions: Compare two specific revisions
 * - diffAgainstWorkspace: Compare a revision against the local workspace file
 */
export function useDiff() {
  const { p4port, p4user, p4client } = useConnectionStore();

  /**
   * Diff two revisions of a file.
   */
  const diffRevisions = useCallback(
    async (depotPath: string, rev1: number, rev2: number) => {
      try {
        // Load diff tool settings
        const settings = await loadSettings();
        if (!settings.diffToolPath) {
          toast.error('Diff tool not configured. Please set diff tool path in Settings.');
          return;
        }

        // Print both revisions to temp files
        const [leftPath, rightPath] = await Promise.all([
          invokeP4PrintToFile(depotPath, rev1, p4port ?? undefined, p4user ?? undefined, p4client ?? undefined),
          invokeP4PrintToFile(depotPath, rev2, p4port ?? undefined, p4user ?? undefined, p4client ?? undefined),
        ]);

        // Launch diff tool
        await invokeLaunchDiffTool(leftPath, rightPath, settings.diffToolPath, settings.diffToolArgs);
      } catch (error) {
        toast.error(`Failed to launch diff: ${error}`);
      }
    },
    [p4port, p4user, p4client]
  );

  /**
   * Diff a revision against the local workspace file.
   * If no revision specified, diffs against the head revision.
   */
  const diffAgainstWorkspace = useCallback(
    async (depotPath: string, localPath: string, revision?: number) => {
      try {
        // Load diff tool settings
        const settings = await loadSettings();
        if (!settings.diffToolPath) {
          toast.error('Diff tool not configured. Please set diff tool path in Settings.');
          return;
        }

        // If revision not specified, we need to determine the head revision
        // For now, use the specified revision (caller should provide it)
        if (revision === undefined) {
          toast.error('Revision must be specified for diff against workspace');
          return;
        }

        // Print revision to temp file
        const revisionPath = await invokeP4PrintToFile(
          depotPath,
          revision,
          p4port ?? undefined,
          p4user ?? undefined,
          p4client ?? undefined
        );

        // Launch diff tool with revision on left, workspace on right
        await invokeLaunchDiffTool(revisionPath, localPath, settings.diffToolPath, settings.diffToolArgs);
      } catch (error) {
        toast.error(`Failed to launch diff: ${error}`);
      }
    },
    [p4port, p4user, p4client]
  );

  return {
    diffRevisions,
    diffAgainstWorkspace,
  };
}
