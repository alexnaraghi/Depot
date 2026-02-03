import { useQuery } from '@tanstack/react-query';
import { invokeP4Command } from '@/lib/tauri';

/**
 * Parse description from p4 describe -s output.
 *
 * @param output - Raw p4 describe output
 * @returns Parsed description or fallback message
 */
export function parseChangelistDescription(output: string): string {
  try {
    // Find description block between "Description:" and "Affected files:"
    const descStart = output.indexOf('Description:');
    if (descStart === -1) {
      return 'No description available';
    }

    const descEnd = output.indexOf('Affected files:', descStart);
    if (descEnd === -1) {
      return 'No description available';
    }

    // Extract description content (skip "Description:" line)
    const descBlock = output.substring(descStart, descEnd).trim();
    const lines = descBlock.split('\n').slice(1); // Skip "Description:" header

    // Remove leading tab from each line
    const cleanedLines = lines.map(line => line.replace(/^\t/, ''));

    return cleanedLines.join('\n').trim() || 'No description available';
  } catch (error) {
    console.error('Failed to parse changelist description:', error);
    return 'Failed to parse description';
  }
}

/**
 * Fetch changelist description on demand (lazy loading).
 *
 * @param changelistId - Changelist number
 * @param options - Query options (e.g., enabled for lazy loading)
 * @returns Query result with description data
 */
export function useChangelistDescription(
  changelistId: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['changelist-description', changelistId],
    queryFn: async () => {
      const output = await invokeP4Command(['describe', '-s', String(changelistId)]);
      return parseChangelistDescription(output);
    },
    staleTime: 60 * 60 * 1000, // 1 hour - descriptions are immutable
    enabled: options?.enabled ?? false, // Disabled by default for lazy loading
  });
}
