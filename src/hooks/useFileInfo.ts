import { useQuery } from '@tanstack/react-query';
import { invokeP4Command } from '../lib/tauri';

export interface FileInfo {
  fileSize: number;
  fileType: string;
  isBinary: boolean;
}

/**
 * Parse p4 -ztag output into key-value pairs.
 * Each line is in format "... key value"
 */
function parseZtagOutput(output: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('... ')) {
      const content = trimmed.substring(4); // Remove "... " prefix
      const spaceIndex = content.indexOf(' ');

      if (spaceIndex > 0) {
        const key = content.substring(0, spaceIndex);
        const value = content.substring(spaceIndex + 1);
        fields[key] = value;
      } else {
        // Key with no value
        fields[content] = '';
      }
    }
  }

  return fields;
}

/**
 * Get file metadata (size, type, binary status) from p4 fstat.
 * @param depotPath - Depot path of the file
 * @param revision - Revision number
 * @returns FileInfo object with size, type, and binary detection
 */
export function useFileInfo(depotPath: string | null, revision: number | null) {
  return useQuery({
    queryKey: ['file-info', depotPath, revision],
    queryFn: async (): Promise<FileInfo> => {
      if (!depotPath || revision === null) {
        throw new Error('Depot path and revision are required');
      }

      // Query p4 fstat with -ztag to get structured output
      const revisionSpec = `${depotPath}#${revision}`;
      const output = await invokeP4Command(['-ztag', 'fstat', revisionSpec]);

      // Parse ztag output
      const fields = parseZtagOutput(output);

      if (Object.keys(fields).length === 0) {
        throw new Error('File not found');
      }

      // Extract fileSize (in bytes)
      const fileSizeStr = fields['fileSize'] || fields['headFileSize'] || '0';
      const fileSize = parseInt(fileSizeStr, 10) || 0;

      // Extract fileType
      const fileType = fields['headType'] || fields['type'] || 'text';

      // Detect binary files
      const isBinary =
        fileType.includes('binary') ||
        fileType.includes('ubinary') ||
        fileType.includes('apple') ||
        fileType.includes('resource');

      return {
        fileSize,
        fileType,
        isBinary,
      };
    },
    enabled: depotPath !== null && revision !== null,
    staleTime: 5 * 60 * 1000, // 5 minutes - file info rarely changes
  });
}
