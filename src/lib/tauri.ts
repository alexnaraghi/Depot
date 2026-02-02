import { invoke, Channel } from '@tauri-apps/api/core';
import { useConnectionStore } from '../stores/connectionStore';

/**
 * Get current connection args from the store.
 * Auto-injected into all P4 commands.
 */
function getConnectionArgs() {
  const { p4port, p4user, p4client } = useConnectionStore.getState();
  return {
    server: p4port ?? undefined,
    user: p4user ?? undefined,
    client: p4client ?? undefined,
  };
}

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
  head_action?: string;
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
export async function invokeP4Info(): Promise<P4ClientInfo> {
  return invoke<P4ClientInfo>('p4_info', getConnectionArgs());
}

/**
 * Get file status for paths (or all workspace files if empty).
 * Use for refreshing file tree or checking specific file status.
 * @param paths - Specific paths to check, or empty for all workspace files
 * @param depotPath - Depot path to query (e.g., "//stream/main/...") when paths is empty
 */
export async function invokeP4Fstat(paths: string[] = [], depotPath?: string): Promise<P4FileInfo[]> {
  return invoke<P4FileInfo[]>('p4_fstat', { paths, depotPath, ...getConnectionArgs() });
}

/**
 * Get all opened files in the workspace.
 * Use for displaying pending changelist files.
 */
export async function invokeP4Opened(): Promise<P4FileInfo[]> {
  return invoke<P4FileInfo[]>('p4_opened', getConnectionArgs());
}

/**
 * Get changelists (pending, submitted, or all).
 * Use for displaying changelist panel.
 */
export async function invokeP4Changes(status?: string): Promise<P4ChangelistInfo[]> {
  return invoke<P4ChangelistInfo[]>('p4_changes', { status, ...getConnectionArgs() });
}

/**
 * Edit (checkout) files for modification.
 * Use when user wants to edit files.
 */
export async function invokeP4Edit(paths: string[], changelist?: number): Promise<P4FileInfo[]> {
  return invoke<P4FileInfo[]>('p4_edit', { paths, changelist, ...getConnectionArgs() });
}

/**
 * Revert files to depot state (discard local changes).
 * Use when user wants to discard changes.
 */
export async function invokeP4Revert(paths: string[]): Promise<string[]> {
  return invoke<string[]>('p4_revert', { paths, ...getConnectionArgs() });
}

/**
 * Submit changelist to depot.
 * Use when user wants to commit their changes.
 */
export async function invokeP4Submit(changelist: number, description?: string): Promise<number> {
  return invoke<number>('p4_submit', { changelist, description, ...getConnectionArgs() });
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
  onProgress: (progress: SyncProgress) => void
): Promise<string> {
  const channel = new Channel<SyncProgress>();
  channel.onmessage = onProgress;
  return invoke<string>('p4_sync', { paths, depotPath, ...getConnectionArgs(), onProgress: channel });
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
export async function invokeP4CreateChange(description: string): Promise<number> {
  return invoke<number>('p4_create_change', { description, ...getConnectionArgs() });
}

/**
 * Delete a changelist.
 */
export async function invokeP4DeleteChange(changelist: number): Promise<void> {
  return invoke<void>('p4_delete_change', { changelist, ...getConnectionArgs() });
}

/**
 * Reopen files to a different changelist.
 */
export async function invokeP4Reopen(paths: string[], changelist: number): Promise<string[]> {
  return invoke<string[]>('p4_reopen', { paths, changelist, ...getConnectionArgs() });
}

/**
 * Edit changelist description.
 */
export async function invokeP4EditChangeDescription(changelist: number, description: string): Promise<void> {
  return invoke<void>('p4_edit_change_description', { changelist, description, ...getConnectionArgs() });
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
  maxRevisions?: number
): Promise<P4Revision[]> {
  return invoke<P4Revision[]>('p4_filelog', { depotPath, maxRevisions, ...getConnectionArgs() });
}

/**
 * Print a specific revision of a file to a temp file.
 * Returns the path to the temp file.
 */
export async function invokeP4PrintToFile(
  depotPath: string,
  revision: number
): Promise<string> {
  return invoke<string>('p4_print_to_file', { depotPath, revision, ...getConnectionArgs() });
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
  maxChanges?: number
): Promise<P4ChangelistInfo[]> {
  return invoke<P4ChangelistInfo[]>('p4_changes_submitted', { maxChanges, ...getConnectionArgs() });
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
  filePaths: string[]
): Promise<string> {
  return invoke<string>('p4_shelve', { changelistId, filePaths, ...getConnectionArgs() });
}

/**
 * Describe shelved files in a changelist.
 * Returns structured data about each shelved file.
 */
export async function invokeP4DescribeShelved(
  changelistId: number
): Promise<P4ShelvedFile[]> {
  return invoke<P4ShelvedFile[]>('p4_describe_shelved', { changelistId, ...getConnectionArgs() });
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
  filePaths?: string[]
): Promise<string> {
  return invoke<string>('p4_unshelve', {
    sourceChangelistId: changelistId,
    targetChangelistId,
    filePaths,
    ...getConnectionArgs()
  });
}

/**
 * Delete all shelved files from a changelist.
 */
export async function invokeP4DeleteShelf(
  changelistId: number
): Promise<string> {
  return invoke<string>('p4_delete_shelf', { changelistId, ...getConnectionArgs() });
}

/**
 * Preview reconcile operation (dry run).
 * Detects files that should be added, edited, or deleted.
 * Returns empty array if no changes detected.
 * @param depotPath - Depot path to reconcile (e.g., "//stream/main/...") or undefined for "//..."
 */
export async function invokeP4ReconcilePreview(
  depotPath: string | undefined
): Promise<ReconcilePreview[]> {
  return invoke<ReconcilePreview[]>('p4_reconcile_preview', { depotPath, ...getConnectionArgs() });
}

/**
 * Apply reconcile to specific selected files.
 * Opens files for add/edit/delete based on local filesystem state.
 * @param filePaths - Specific files to reconcile
 * @param changelistId - Optional changelist to open files in (uses default if not specified)
 */
export async function invokeP4ReconcileApply(
  filePaths: string[],
  changelistId?: number
): Promise<string> {
  return invoke<string>('p4_reconcile_apply', { filePaths, changelistId, ...getConnectionArgs() });
}

/**
 * Preview files needing resolution after merge/unshelve operations.
 * Returns list of depot paths that require conflict resolution.
 */
export async function invokeP4ResolvePreview(): Promise<string[]> {
  return invoke<string[]>('p4_resolve_preview', getConnectionArgs());
}

/**
 * File result from p4 files command
 */
export interface P4FileResult {
  depot_path: string;
  revision: number;
  action: string;
  change: number;
  file_type: string;
}

/**
 * Search depot for files matching a pattern.
 * Example: p4 files //depot/.../*.cpp
 */
export async function invokeP4Files(
  pattern: string,
  maxResults: number = 50
): Promise<P4FileResult[]> {
  return invoke<P4FileResult[]>('p4_files', { pattern, maxResults, ...getConnectionArgs() });
}

/**
 * Stream information from p4 streams
 */
export interface P4Stream {
  stream: string;       // Full path: //depot/main
  name: string;         // Display name
  parent: string | null;
  stream_type: string;  // mainline, development, release
  description: string;
}

/**
 * Client spec information from p4 client -o
 */
export interface P4ClientSpec {
  client: string;
  root: string;
  stream: string | null;
  owner: string;
  description: string;
  view: string[];
  options: string;
  host: string;
  submit_options: string;
}

/**
 * List available streams for the depot.
 */
export async function invokeP4ListStreams(): Promise<P4Stream[]> {
  return invoke<P4Stream[]>('p4_list_streams', getConnectionArgs());
}

/**
 * Get client spec for a specific workspace.
 */
export async function invokeP4GetClientSpec(
  workspace: string
): Promise<P4ClientSpec> {
  const { server, user } = getConnectionArgs();
  return invoke<P4ClientSpec>('p4_get_client_spec', { workspace, server, user });
}

/**
 * Update client spec's Stream field (for stream switching).
 * Returns success message from P4.
 */
export async function invokeP4UpdateClientStream(
  workspace: string,
  newStream: string
): Promise<string> {
  const { server, user } = getConnectionArgs();
  return invoke<string>('p4_update_client_stream', { workspace, newStream, server, user });
}

/**
 * Depot information from p4 depots
 */
export interface P4Depot {
  name: string;
  depot_type: string;
}

/**
 * List all depot roots with name and type.
 */
export async function invokeP4Depots(): Promise<P4Depot[]> {
  const { server, user } = getConnectionArgs();
  return invoke<P4Depot[]>('p4_depots', { server, user });
}

/**
 * List immediate subdirectories of a depot path.
 * @param depotPath - Depot path to query (e.g., "//depot/*")
 * @param includeDeleted - Whether to include deleted directories (-D flag)
 * @returns Array of depot directory paths
 */
export async function invokeP4Dirs(
  depotPath: string,
  includeDeleted: boolean = false
): Promise<string[]> {
  return invoke<string[]>('p4_dirs', { depotPath, includeDeleted, ...getConnectionArgs() });
}
