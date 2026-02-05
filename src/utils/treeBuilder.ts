import { P4File, P4Changelist, FileStatus } from '@/types/p4';
import { P4ShelvedFile } from '@/lib/tauri';
import { produce } from 'immer';

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
  // Sync status for folder aggregation
  hasOutOfDateDescendants?: boolean;  // True if any descendant file is out-of-date
  outOfDateCount?: number;            // Count of out-of-date files in subtree
}

/**
 * Changelist tree node for react-arborist
 * Represents a changelist, file, shelved files section, or individual shelved file
 */
export interface ChangelistTreeNode {
  id: string;
  name: string;
  type: 'changelist' | 'file' | 'shelved-section' | 'shelved-file';
  data: P4Changelist | P4File | { changelistId: number } | P4ShelvedFile;
  children?: ChangelistTreeNode[];
  dimmed?: boolean;
  highlightRanges?: [number, number][];
}

/**
 * Build hierarchical file tree from flat file list
 *
 * @param files - Flat list of P4 files
 * @param rootPath - Local workspace root path (e.g., "C:\\workspace" or "/home/user/workspace")
 * @returns Array of top-level tree nodes
 */
export function buildFileTree(files: P4File[], rootPath: string): FileTreeNode[] {
  if (files.length === 0) return [];

  // Normalize root path - handle both Windows and Unix paths
  // Replace backslashes with forward slashes for consistent comparison
  let normalizedRoot = rootPath.replace(/\\/g, '/');
  if (!normalizedRoot.endsWith('/')) {
    normalizedRoot += '/';
  }

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

  // Sort files by local path for consistent ordering
  const sortedFiles = [...files].sort((a, b) =>
    a.localPath.localeCompare(b.localPath)
  );

  // Process each file
  for (const file of sortedFiles) {
    // Normalize local path for comparison
    const normalizedLocalPath = file.localPath.replace(/\\/g, '/');

    // Get relative path from root
    if (!normalizedLocalPath.startsWith(normalizedRoot)) {
      continue; // Skip files outside root
    }

    const relativePath = normalizedLocalPath.slice(normalizedRoot.length);
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

    // Add file node as leaf (use depotPath as id for uniqueness)
    const fileName = segments[segments.length - 1];
    const fileNode: FileTreeNode = {
      id: file.depotPath,
      name: fileName,
      isFolder: false,
      file,
    };
    parentNode.children!.push(fileNode);
  }

  const result = rootNode.children || [];
  result.forEach(aggregateSyncStatus);
  return result;
}

/**
 * Recursively aggregate sync status from files up to folders
 * Folders are marked as having out-of-date descendants if any child file or folder has out-of-date files
 */
export function aggregateSyncStatus(node: FileTreeNode): void {
  if (!node.isFolder || !node.children || node.children.length === 0) {
    return;
  }

  // Process children first (bottom-up traversal)
  node.children.forEach(aggregateSyncStatus);

  // Aggregate: folder has out-of-date descendants if any child does
  let outOfDateCount = 0;
  let hasOutOfDate = false;

  for (const child of node.children) {
    if (child.isFolder) {
      if (child.hasOutOfDateDescendants) {
        hasOutOfDate = true;
      }
      outOfDateCount += child.outOfDateCount || 0;
    } else if (child.file?.status === FileStatus.OutOfDate) {
      hasOutOfDate = true;
      outOfDateCount += 1;
    }
  }

  node.hasOutOfDateDescendants = hasOutOfDate;
  node.outOfDateCount = outOfDateCount;
}

/**
 * Determine if incremental update should be used based on change volume.
 * If more than 10% of existing files changed, full rebuild is more efficient.
 *
 * @param existingFileCount - Current number of files in tree
 * @param changedFileCount - Number of files that changed
 * @returns true if incremental update should be used
 */
export function shouldUseIncrementalUpdate(
  existingFileCount: number,
  changedFileCount: number
): boolean {
  if (existingFileCount === 0) return false; // No existing tree, need full build
  return changedFileCount < existingFileCount * 0.1;
}

/**
 * Re-aggregate sync status for folders that had file updates.
 * More efficient than full tree walk when only a few branches changed.
 */
function reAggregateSyncStatus(
  tree: FileTreeNode[],
  _modifiedFolders: Set<string>
): void {
  // For simplicity and correctness, re-aggregate from root when there are changes
  // The cost is O(n) but only runs when there are actual modifications
  // Future optimization: walk only modified branches using _modifiedFolders
  tree.forEach(aggregateSyncStatus);
}

/**
 * Update tree incrementally using Immer structural sharing.
 * Only modified branches get new references; unchanged subtrees preserve identity.
 *
 * @param tree - Existing tree structure
 * @param changedFiles - Map of depot path to updated P4File
 * @returns Updated tree with structural sharing
 */
export function incrementalTreeUpdate(
  tree: FileTreeNode[],
  changedFiles: Map<string, P4File>
): FileTreeNode[] {
  if (changedFiles.size === 0) return tree;

  const modifiedFolders = new Set<string>();

  const updatedTree = produce(tree, draft => {
    function updateSubtree(nodes: FileTreeNode[], parentPath: string) {
      for (const node of nodes) {
        if (!node.isFolder && node.file) {
          const update = changedFiles.get(node.file.depotPath);
          if (update) {
            // Immer tracks this mutation and creates new references up the tree
            Object.assign(node.file, update);
            // Track which folders need sync status re-aggregation
            modifiedFolders.add(parentPath);
          }
        }
        if (node.children) {
          updateSubtree(node.children, node.id);
        }
      }
    }
    updateSubtree(draft, '');
  });

  // Re-aggregate sync status only for modified subtrees
  // Must use produce() again since updatedTree is now frozen/immutable
  if (modifiedFolders.size > 0) {
    return produce(updatedTree, draft => {
      reAggregateSyncStatus(draft, modifiedFolders);
    });
  }

  return updatedTree;
}

/**
 * Merge delta (changed) files with existing file map.
 * Returns new Map with updates applied.
 *
 * @param existingFiles - Current file map
 * @param deltaFiles - Array of updated P4File objects
 * @returns New Map with delta files merged in
 */
export function mergeDeltaFiles(
  existingFiles: Map<string, P4File>,
  deltaFiles: P4File[]
): Map<string, P4File> {
  if (deltaFiles.length === 0) return existingFiles;

  const merged = new Map(existingFiles);
  for (const file of deltaFiles) {
    merged.set(file.depotPath, file);
  }
  return merged;
}

/**
 * Create a change map from delta files for incremental tree update.
 * Compares with existing files to identify actual changes.
 *
 * @param existingFiles - Current file map
 * @param deltaFiles - Array of P4File from delta query
 * @returns Map of depot path to P4File for files that actually changed
 */
export function createChangeMap(
  existingFiles: Map<string, P4File>,
  deltaFiles: P4File[]
): Map<string, P4File> {
  const changes = new Map<string, P4File>();

  for (const file of deltaFiles) {
    const existing = existingFiles.get(file.depotPath);
    if (!existing) {
      // New file
      changes.set(file.depotPath, file);
    } else if (
      existing.revision !== file.revision ||
      existing.headRevision !== file.headRevision ||
      existing.status !== file.status ||
      existing.action !== file.action ||
      existing.changelist !== file.changelist
    ) {
      // File changed
      changes.set(file.depotPath, file);
    }
    // If no changes detected, skip (preserves reference)
  }

  return changes;
}

/**
 * Build changelist tree from list of changelists
 * Each changelist becomes a parent node, files are children, followed by shelved-section
 *
 * @param changelists - List of changelists with files
 * @param shelvedFilesMap - Map of changelist ID to shelved files (optional)
 * @returns Array of changelist tree nodes
 */
export function buildChangelistTree(
  changelists: P4Changelist[],
  shelvedFilesMap?: Map<number, P4ShelvedFile[]>
): ChangelistTreeNode[] {
  return changelists.map(changelist => {
    const children: ChangelistTreeNode[] = [];

    // Add file nodes
    const fileChildren: ChangelistTreeNode[] = changelist.files.map(file => ({
      id: `${changelist.id}-${file.depotPath}`,
      name: getFileName(file.depotPath),
      type: 'file',
      data: file,
    }));
    children.push(...fileChildren);

    // Add shelved files section for numbered changelists that have shelved files
    if (changelist.id > 0) {
      const shelvedFiles = shelvedFilesMap?.get(changelist.id);
      if (shelvedFiles && shelvedFiles.length > 0) {
        // Build shelved file children nodes
        const shelvedChildren: ChangelistTreeNode[] = shelvedFiles.map(file => ({
          id: `${changelist.id}-shelved-${file.depotPath}`,
          name: getFileName(file.depotPath),
          type: 'shelved-file' as const,
          data: file,
        }));

        children.push({
          id: `${changelist.id}-shelved-section`,
          name: `Shelved Files (${shelvedFiles.length})`,
          type: 'shelved-section',
          data: { changelistId: changelist.id },
          children: shelvedChildren,
        });
      }
    }

    return {
      id: String(changelist.id),
      name: changelist.description || `Changelist ${changelist.id}`,
      type: 'changelist',
      data: changelist,
      children,
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
