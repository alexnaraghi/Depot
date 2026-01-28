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
