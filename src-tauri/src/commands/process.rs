use tokio::process::Command;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tauri::ipc::Channel;
use tauri::State;

use crate::state::ProcessManager;

// Windows-specific import for hiding console windows
#[cfg(target_os = "windows")]
#[allow(unused_imports)] // Trait is used via creation_flags() method
use std::os::windows::process::CommandExt;

/// Payload sent to frontend for each stdout/stderr line.
#[derive(Clone, serde::Serialize)]
pub struct OutputLine {
    pub line: String,
    pub is_stderr: bool,
}

/// Spawn p4.exe with given arguments, streaming output via Channel.
/// Returns process ID for cancellation.
#[tauri::command]
pub async fn spawn_p4_command(
    args: Vec<String>,
    on_output: Channel<OutputLine>,
    state: State<'_, ProcessManager>,
) -> Result<String, String> {
    // Spawn p4.exe with piped stdout/stderr
    let mut cmd = Command::new("p4");
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // On Windows, hide the console window (CREATE_NO_WINDOW flag)
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn p4: {}", e))?;

    // Take stdout/stderr before moving child
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Register process for tracking
    let process_id = state.register(child).await;
    let process_id_clone = process_id.clone();

    // Stream stdout in background task
    let on_output_clone = on_output.clone();
    if let Some(stdout) = stdout {
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = on_output_clone.send(OutputLine {
                    line,
                    is_stderr: false,
                });
            }
        });
    }

    // Stream stderr in background task
    if let Some(stderr) = stderr {
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = on_output.send(OutputLine {
                    line,
                    is_stderr: true,
                });
            }
        });
    }

    Ok(process_id_clone)
}

/// Execute p4 command and wait for completion (for short commands like 'p4 info').
/// Returns stdout on success, error message on failure.
#[tauri::command]
pub async fn p4_command(args: Vec<String>) -> Result<String, String> {
    let mut cmd = Command::new("p4");
    cmd.args(&args);

    // On Windows, hide the console window (CREATE_NO_WINDOW flag)
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd.output()
        .await
        .map_err(|e| format!("Failed to execute p4: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if stderr.is_empty() {
            Err(format!("p4 exited with code: {:?}", output.status.code()))
        } else {
            Err(stderr)
        }
    }
}

/// Kill a tracked process by ID.
#[tauri::command]
pub async fn kill_process(
    process_id: String,
    state: State<'_, ProcessManager>,
) -> Result<bool, String> {
    state.kill(&process_id).await
}

/// Kill all tracked processes. Called on app close.
#[tauri::command]
pub async fn kill_all_processes(state: State<'_, ProcessManager>) -> Result<(), String> {
    state.kill_all().await;
    Ok(())
}
