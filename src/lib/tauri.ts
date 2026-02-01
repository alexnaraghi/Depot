import { invoke, Channel } from '@tauri-apps/api/core';

// Types matching Rust structs
export interface OutputLine {
  line: string;
  is_stderr: boolean;
}

export interface ProcessResult {
  exit_code: number | null;
  success: boolean;
}

// P4 command result types
export interface P4FileInfo {
  depot_path: string;
  local_path: string;
  status: string;
  action?: string;
  revision: number;
  head_revision: number;
  changelist?: number;
  file_type: string;
}

export interface P4ChangelistInfo {
  id: number;
  description: string;
  user: string;
  client: string;
  status: string;
  file_count: number;
  time: number;
}

export interface SyncProgress {
  depot_path: string;
  action: string;
  revision: number;
  is_conflict: boolean;
}

export interface P4ClientInfo {
  client_name: string;
  client_root: string;
  client_stream: string | null;
  user_name: string;
  server_address: string;
}

export interface P4Workspace {
  name: string;
  root: string;
  stream: string | null;
  description: string;
}

/**
 * Execute a short p4 command and wait for result.
 * Use for quick commands like 'p4 info', 'p4 client'.
 */
export async function invokeP4Command(args: string[]): Promise<string> {
  return invoke<string>('p4_command', { args });
}

/**
 * Spawn a long-running p4 command with streaming output.
 * Use for commands like 'p4 sync' that produce lots of output.
 * Returns process ID for cancellation.
 */
export async function invokeSpawnP4(
  args: string[],
  onOutput: (line: OutputLine) => void
): Promise<string> {
  const channel = new Channel<OutputLine>();
  channel.onmessage = onOutput;

  return invoke<string>('spawn_p4_command', {
    args,
    onOutput: channel,
  });
}

/**
 * Kill a tracked process by ID.
 * Returns true if process was found and killed.
 */
export async function invokeKillProcess(processId: string): Promise<boolean> {
  return invoke<boolean>('kill_process', { processId });
}

/**
 * Kill all tracked processes.
 * Called automatically on app close, but can be called manually.
 */
export async function invokeKillAllProcesses(): Promise<void> {
  return invoke<void>('kill_all_processes');
}

/**
 * Get P4 client/workspace info (client root, user, server).
 * Use to determine workspace root path on startup.
 */
export async function invokeP4Info(server?: string, user?: string, client?: string): Promise<P4ClientInfo> {
  return invoke<P4ClientInfo>('p4_info', { server, user, client });
}

/**
 * Get file status for paths (or all workspace files if empty).
 * Use for refreshing file tree or checking specific file status.
 * @param paths - Specific paths to check, or empty for all workspace files
 * @param depotPath - Depot path to query (e.g., "//stream/main/...") when paths is empty
 */
export async function invokeP4Fstat(paths: string[] = [], depotPath?: string, server?: string, user?: string, client?: string): Promise<P4FileInfo[]> {
  return invoke<P4FileInfo[]>('p4_fstat', { paths, depotPath, server, user, client });
}

/**
 * Get all opened files in the workspace.
 * Use for displaying pending changelist files.
 */
export async function invokeP4Opened(server?: string, user?: string, client?: string): Promise<P4FileInfo[]> {
  return invoke<P4FileInfo[]>('p4_opened', { server, user, client });
}

/**
 * Get changelists (pending, submitted, or all).
 * Use for displaying changelist panel.
 */
export async function invokeP4Changes(status?: string, server?: string, user?: string, client?: string): Promise<P4ChangelistInfo[]> {
  return invoke<P4ChangelistInfo[]>('p4_changes', { status, server, user, client });
}

/**
 * Edit (checkout) files for modification.
 * Use when user wants to edit files.
 */
export async function invokeP4Edit(paths: string[], changelist?: number, server?: string, user?: string, client?: string): Promise<P4FileInfo[]> {
  return invoke<P4FileInfo[]>('p4_edit', { paths, changelist, server, user, client });
}

/**
 * Revert files to depot state (discard local changes).
 * Use when user wants to discard changes.
 */
export async function invokeP4Revert(paths: string[], server?: string, user?: string, client?: string): Promise<string[]> {
  return invoke<string[]>('p4_revert', { paths, server, user, client });
}

/**
 * Submit changelist to depot.
 * Use when user wants to commit their changes.
 */
export async function invokeP4Submit(changelist: number, description?: string, server?: string, user?: string, client?: string): Promise<number> {
  return invoke<number>('p4_submit', { changelist, description, server, user, client });
}

/**
 * Sync files with streaming progress.
 * Use for syncing workspace to latest revision.
 * @param paths - Specific paths to sync, or empty for all workspace files
 * @param depotPath - Depot path to sync (e.g., "//stream/main/...") when paths is empty
 * @param onProgress - Callback for streaming progress updates
 */
export async function invokeP4Sync(
  paths: string[],
  depotPath: string | undefined,
  server: string | undefined,
  user: string | undefined,
  client: string | undefined,
  onProgress: (progress: SyncProgress) => void
): Promise<string> {
  const channel = new Channel<SyncProgress>();
  channel.onmessage = onProgress;
  return invoke<string>('p4_sync', { paths, depotPath, server, user, client, onProgress: channel });
}

/**
 * List available workspaces for a given server and user.
 * Use for browsing workspaces during settings configuration.
 */
export async function invokeListWorkspaces(server: string, user: string): Promise<P4Workspace[]> {
  return invoke<P4Workspace[]>('p4_list_workspaces', { server, user });
}

/**
 * Test connection to P4 server with given credentials.
 * Use to validate settings before saving.
 */
export async function invokeTestConnection(server: string, user: string, client: string): Promise<P4ClientInfo> {
  return invoke<P4ClientInfo>('p4_test_connection', { server, user, client });
}

/**
 * Create a new changelist with the given description.
 */
export async function invokeP4CreateChange(description: string, server?: string, user?: string, client?: string): Promise<number> {
  return invoke<number>('p4_create_change', { description, server, user, client });
}

/**
 * Delete a changelist.
 */
export async function invokeP4DeleteChange(changelist: number, server?: string, user?: string, client?: string): Promise<void> {
  return invoke<void>('p4_delete_change', { changelist, server, user, client });
}

/**
 * Reopen files to a different changelist.
 */
export async function invokeP4Reopen(paths: string[], changelist: number, server?: string, user?: string, client?: string): Promise<string[]> {
  return invoke<string[]>('p4_reopen', { paths, changelist, server, user, client });
}

/**
 * Edit changelist description.
 */
export async function invokeP4EditChangeDescription(changelist: number, description: string, server?: string, user?: string, client?: string): Promise<void> {
  return invoke<void>('p4_edit_change_description', { changelist, description, server, user, client });
}

/**
 * Revision information from p4 filelog.
 */
export interface P4Revision {
  rev: number;
  change: number;
  action: string;
  file_type: string;
  time: number;
  user: string;
  client: string;
  desc: string;
}

/**
 * Get file revision history.
 */
export async function invokeP4Filelog(
  depotPath: string,
  maxRevisions?: number,
  server?: string,
  user?: string,
  client?: string
): Promise<P4Revision[]> {
  return invoke<P4Revision[]>('p4_filelog', { depotPath, maxRevisions, server, user, client });
}

/**
 * Print a specific revision of a file to a temp file.
 * Returns the path to the temp file.
 */
export async function invokeP4PrintToFile(
  depotPath: string,
  revision: number,
  server?: string,
  user?: string,
  client?: string
): Promise<string> {
  return invoke<string>('p4_print_to_file', { depotPath, revision, server, user, client });
}

/**
 * Launch external diff tool with two file paths.
 */
export async function invokeLaunchDiffTool(
  leftPath: string,
  rightPath: string,
  diffToolPath: string,
  diffToolArgs?: string
): Promise<void> {
  return invoke<void>('launch_diff_tool', { leftPath, rightPath, diffToolPath, diffToolArgs });
}

/**
 * Get submitted changelists with full descriptions.
 */
export async function invokeP4ChangesSubmitted(
  maxChanges?: number,
  server?: string,
  user?: string,
  client?: string
): Promise<P4ChangelistInfo[]> {
  return invoke<P4ChangelistInfo[]>('p4_changes_submitted', { maxChanges, server, user, client });
}

/**
 * Shelved file information from p4 describe -S.
 */
export interface P4ShelvedFile {
  depotPath: string;
  action: string;
  fileType: string;
  revision: number;
}

/**
 * Reconcile preview information from p4 reconcile -n.
 */
export interface ReconcilePreview {
  depotPath: string;
  localPath: string;
  action: string;
}

/**
 * Shelve files to a changelist.
 * @param changelistId - Target changelist ID
 * @param filePaths - Specific files to shelve, or empty array to shelve all files in changelist
 */
export async function invokeP4Shelve(
  changelistId: number,
  filePaths: string[],
  server?: string,
  user?: string,
  client?: string
): Promise<string> {
  return invoke<string>('p4_shelve', { changelistId, filePaths, server, user, client });
}

/**
 * Describe shelved files in a changelist.
 * Returns structured data about each shelved file.
 */
export async function invokeP4DescribeShelved(
  changelistId: number,
  server?: string,
  user?: string,
  client?: string
): Promise<P4ShelvedFile[]> {
  return invoke<P4ShelvedFile[]>('p4_describe_shelved', { changelistId, server, user, client });
}

/**
 * Unshelve files from a changelist to a target changelist.
 * Returns success message or error (including conflict info).
 * @param changelistId - Source changelist ID to unshelve from
 * @param targetChangelistId - Target changelist ID to unshelve into
 */
export async function invokeP4Unshelve(
  changelistId: number,
  targetChangelistId: number,
  filePaths?: string[],
  server?: string,
  user?: string,
  client?: string
): Promise<string> {
  return invoke<string>('p4_unshelve', {
    sourceChangelistId: changelistId,
    targetChangelistId,
    filePaths,
    server,
    user,
    client
  });
}

/**
 * Delete all shelved files from a changelist.
 */
export async function invokeP4DeleteShelf(
  changelistId: number,
  server?: string,
  user?: string,
  client?: string
): Promise<string> {
  return invoke<string>('p4_delete_shelf', { changelistId, server, user, client });
}

/**
 * Preview reconcile operation (dry run).
 * Detects files that should be added, edited, or deleted.
 * Returns empty array if no changes detected.
 * @param depotPath - Depot path to reconcile (e.g., "//stream/main/...") or undefined for "//..."
 */
export async function invokeP4ReconcilePreview(
  depotPath: string | undefined,
  server?: string,
  user?: string,
  client?: string
): Promise<ReconcilePreview[]> {
  return invoke<ReconcilePreview[]>('p4_reconcile_preview', { depotPath, server, user, client });
}

/**
 * Apply reconcile to specific selected files.
 * Opens files for add/edit/delete based on local filesystem state.
 * @param filePaths - Specific files to reconcile
 * @param changelistId - Optional changelist to open files in (uses default if not specified)
 */
export async function invokeP4ReconcileApply(
  filePaths: string[],
  changelistId?: number,
  server?: string,
  user?: string,
  client?: string
): Promise<string> {
  return invoke<string>('p4_reconcile_apply', { filePaths, changelistId, server, user, client });
}

/**
 * Preview files needing resolution after merge/unshelve operations.
 * Returns list of depot paths that require conflict resolution.
 */
export async function invokeP4ResolvePreview(
  server?: string,
  user?: string,
  client?: string
): Promise<string[]> {
  return invoke<string[]>('p4_resolve_preview', { server, user, client });
}
