import { P4File, P4Changelist } from '@/types/p4';

/**
 * File tree node for react-arborist
 * Represents a file or folder in the workspace tree
 */
export interface FileTreeNode {
  id: string;
  name: string;
  isFolder: boolean;
  file?: P4File;
  children?: FileTreeNode[];
}

/**
 * Changelist tree node for react-arborist
 * Represents a changelist or file within a changelist
 */
export interface ChangelistTreeNode {
  id: string;
  name: string;
  type: 'changelist' | 'file';
  data: P4Changelist | P4File;
  children?: ChangelistTreeNode[];
}

/**
 * Build hierarchical file tree from flat file list
 *
 * @param files - Flat list of P4 files
 * @param rootPath - Workspace root path (e.g., "//depot/project")
 * @returns Array of top-level tree nodes
 */
export function buildFileTree(files: P4File[], rootPath: string): FileTreeNode[] {
  if (files.length === 0) return [];

  // Normalize root path
  const normalizedRoot = rootPath.endsWith('/') ? rootPath : `${rootPath}/`;

  // Map of path -> node for O(1) lookups
  const nodeMap = new Map<string, FileTreeNode>();

  // Create root node
  const rootNode: FileTreeNode = {
    id: normalizedRoot,
    name: '/',
    isFolder: true,
    children: [],
  };
  nodeMap.set(normalizedRoot, rootNode);

  // Sort files by depot path for consistent ordering
  const sortedFiles = [...files].sort((a, b) =>
    a.depotPath.localeCompare(b.depotPath)
  );

  // Process each file
  for (const file of sortedFiles) {
    // Get relative path from root
    if (!file.depotPath.startsWith(normalizedRoot)) {
      continue; // Skip files outside root
    }

    const relativePath = file.depotPath.slice(normalizedRoot.length);
    const segments = relativePath.split('/').filter(s => s.length > 0);

    if (segments.length === 0) continue;

    // Build folder structure
    let currentPath = normalizedRoot;
    let parentNode = rootNode;

    // Create folder nodes for all segments except the last (which is the file)
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      currentPath += segment + '/';

      let folderNode = nodeMap.get(currentPath);
      if (!folderNode) {
        folderNode = {
          id: currentPath,
          name: segment,
          isFolder: true,
          children: [],
        };
        nodeMap.set(currentPath, folderNode);
        parentNode.children!.push(folderNode);
      }

      parentNode = folderNode;
    }

    // Add file node as leaf
    const fileName = segments[segments.length - 1];
    const fileNode: FileTreeNode = {
      id: file.depotPath,
      name: fileName,
      isFolder: false,
      file,
    };
    parentNode.children!.push(fileNode);
  }

  return rootNode.children || [];
}

/**
 * Build changelist tree from list of changelists
 * Each changelist becomes a parent node, files are children
 *
 * @param changelists - List of changelists with files
 * @returns Array of changelist tree nodes
 */
export function buildChangelistTree(changelists: P4Changelist[]): ChangelistTreeNode[] {
  return changelists.map(changelist => {
    const fileChildren: ChangelistTreeNode[] = changelist.files.map(file => ({
      id: `${changelist.id}-${file.depotPath}`,
      name: getFileName(file.depotPath),
      type: 'file',
      data: file,
    }));

    return {
      id: String(changelist.id),
      name: changelist.description || `Changelist ${changelist.id}`,
      type: 'changelist',
      data: changelist,
      children: fileChildren,
    };
  });
}

/**
 * Get file name from depot path
 *
 * @param depotPath - Full depot path (e.g., "//depot/path/to/file.txt")
 * @returns File name (e.g., "file.txt")
 */
export function getFileName(depotPath: string): string {
  const parts = depotPath.split('/');
  return parts[parts.length - 1] || depotPath;
}

/**
 * Get folder path from depot path
 *
 * @param depotPath - Full depot path (e.g., "//depot/path/to/file.txt")
 * @returns Folder path (e.g., "//depot/path/to")
 */
export function getFolderPath(depotPath: string): string {
  const parts = depotPath.split('/');
  parts.pop();
  return parts.join('/');
}
