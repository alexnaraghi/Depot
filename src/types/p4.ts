/**
 * Perforce file status enum
 * Represents all possible states a file can be in
 */
export enum FileStatus {
  /** File is synced to head revision with no local changes */
  Synced = 'synced',
  /** File is opened for edit */
  CheckedOut = 'checkedOut',
  /** File is opened for add */
  Added = 'added',
  /** File is opened for delete */
  Deleted = 'deleted',
  /** File has local changes (detected outside of p4) */
  Modified = 'modified',
  /** File is out of date (newer version in depot) */
  OutOfDate = 'outOfDate',
  /** Local edit conflicts with depot change */
  Conflict = 'conflict',
}

/**
 * Perforce file action enum
 * Matches p4 action field values
 */
export enum FileAction {
  Edit = 'edit',
  Add = 'add',
  Delete = 'delete',
  Branch = 'branch',
  Integrate = 'integrate',
  MoveAdd = 'move/add',
  MoveDelete = 'move/delete',
}

/**
 * Perforce file representation
 * Contains all metadata needed for file tree display and operations
 */
export interface P4File {
  /** Depot path (e.g., //depot/path/to/file.txt) */
  depotPath: string;
  /** Absolute local filesystem path */
  localPath: string;
  /** Current file status */
  status: FileStatus;
  /** Action if file is opened in a changelist */
  action?: FileAction;
  /** Revision number the user has synced (have revision) */
  revision: number;
  /** Latest revision in the depot (head revision) */
  headRevision: number;
  /** Changelist number if file is opened (0 for default) */
  changelist?: number;
  /** File type (text, binary, etc.) */
  fileType: string;
  /** True if this represents a directory */
  isDirectory: boolean;
}

/**
 * Perforce changelist representation
 * Contains changelist metadata and associated files
 */
export interface P4Changelist {
  /** Changelist number (0 for default changelist) */
  id: number;
  /** Changelist description */
  description: string;
  /** User who owns this changelist */
  user: string;
  /** Client/workspace name */
  client: string;
  /** Changelist status */
  status: 'pending' | 'submitted' | 'shelved';
  /** Files in this changelist */
  files: P4File[];
  /** Number of files in changelist (for performance when files not loaded) */
  fileCount: number;
}

/**
 * Tree node for react-arborist
 * Wraps P4File or P4Changelist for tree display
 */
export interface TreeNode {
  /** Unique identifier for this node */
  id: string;
  /** Display name */
  name: string;
  /** Underlying data (either a file or changelist) */
  data: P4File | P4Changelist;
  /** Child nodes (for directories and changelists) */
  children?: TreeNode[];
}
