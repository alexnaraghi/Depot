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
  user_name: string;
  server_address: string;
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
  return invoke<P4ClientInfo>('p4_info');
}

/**
 * Get file status for paths (or all workspace files if empty).
 * Use for refreshing file tree or checking specific file status.
 * @param paths - Specific paths to check, or empty for all workspace files
 * @param clientRoot - P4 workspace root directory (from p4 info)
 */
export async function invokeP4Fstat(paths: string[] = [], clientRoot?: string): Promise<P4FileInfo[]> {
  return invoke<P4FileInfo[]>('p4_fstat', { paths, clientRoot });
}

/**
 * Get all opened files in the workspace.
 * Use for displaying pending changelist files.
 */
export async function invokeP4Opened(): Promise<P4FileInfo[]> {
  return invoke<P4FileInfo[]>('p4_opened');
}

/**
 * Get changelists (pending, submitted, or all).
 * Use for displaying changelist panel.
 */
export async function invokeP4Changes(status?: string): Promise<P4ChangelistInfo[]> {
  return invoke<P4ChangelistInfo[]>('p4_changes', { status });
}

/**
 * Edit (checkout) files for modification.
 * Use when user wants to edit files.
 */
export async function invokeP4Edit(paths: string[], changelist?: number): Promise<P4FileInfo[]> {
  return invoke<P4FileInfo[]>('p4_edit', { paths, changelist });
}

/**
 * Revert files to depot state (discard local changes).
 * Use when user wants to discard changes.
 */
export async function invokeP4Revert(paths: string[]): Promise<string[]> {
  return invoke<string[]>('p4_revert', { paths });
}

/**
 * Submit changelist to depot.
 * Use when user wants to commit their changes.
 */
export async function invokeP4Submit(changelist: number, description?: string): Promise<number> {
  return invoke<number>('p4_submit', { changelist, description });
}

/**
 * Sync files with streaming progress.
 * Use for syncing workspace to latest revision.
 * @param paths - Specific paths to sync, or empty for all workspace files
 * @param clientRoot - P4 workspace root directory (from p4 info)
 * @param onProgress - Callback for streaming progress updates
 */
export async function invokeP4Sync(
  paths: string[],
  clientRoot: string | undefined,
  onProgress: (progress: SyncProgress) => void
): Promise<string> {
  const channel = new Channel<SyncProgress>();
  channel.onmessage = onProgress;
  return invoke<string>('p4_sync', { paths, clientRoot, onProgress: channel });
}
