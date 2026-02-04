use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use tauri::{ipc::Channel, AppHandle, Emitter, State};
use tempfile::Builder;

use crate::state::ProcessManager;
use super::parsing::*;
use super::types::*;

/// Maximum file size for in-app content viewing (10MB)
const MAX_CONTENT_SIZE: u64 = 10 * 1024 * 1024;

/// Get P4 client info (client root, user, server)
#[tauri::command]
pub async fn p4_info(
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<P4ClientInfo, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["-ztag", "info"]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 info: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("p4 info failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_info(&stdout)
}

/// Get file status information for given paths
///
/// When paths is empty, uses depot_path if provided (e.g., "//stream/main/...")
/// to query all files in the workspace. This avoids issues with -d flag in DVCS setups.
#[tauri::command]
pub async fn p4_fstat(
    paths: Vec<String>,
    depot_path: Option<String>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4FileInfo>, String> {
    // Build command: p4 -ztag fstat <paths>
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("-ztag");
    cmd.arg("fstat");

    if paths.is_empty() {
        // Use depot_path if provided (e.g., "//stream/main/..."), otherwise fall back to "//..."
        let query_path = depot_path.unwrap_or_else(|| "//...".to_string());
        cmd.arg(query_path);
    } else {
        cmd.args(&paths);
    }

    // Execute command
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 fstat: {}", e))?;

    // Parse output even if exit code is non-zero (p4 fstat can return errors for individual files)
    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse -ztag format
    let files = parse_ztag_fstat(&stdout)?;

    Ok(files)
}

/// Get all files opened by current user
#[tauri::command]
pub async fn p4_opened(
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4FileInfo>, String> {
    // Execute: p4 -ztag fstat -Ro //...
    // Uses fstat instead of opened to get the "path" field (local filesystem path).
    // p4 opened only returns "clientFile" which is the client-spec path (//client/...),
    // not usable for local file operations like Open or Reveal in Explorer.
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["-ztag", "fstat", "-Ro", "//..."]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 fstat -Ro: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse -ztag format (similar to fstat)
    let files = parse_ztag_fstat(&stdout)?;

    Ok(files)
}

/// Get changelists for current user
#[tauri::command]
pub async fn p4_changes(
    status: Option<String>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4Changelist>, String> {
    // Build command: p4 -ztag changes -s <status> -u <user> -c <client>
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("-ztag");
    cmd.arg("changes");

    // Add status filter (default to pending)
    let status_filter = status.unwrap_or_else(|| "pending".to_string());
    cmd.arg("-s");
    cmd.arg(status_filter);

    // Filter by current user and client (use actual values, not shell vars)
    if let Some(u) = user.as_ref().filter(|s| !s.is_empty()) {
        cmd.args(["-u", u]);
    }
    if let Some(c) = client.as_ref().filter(|s| !s.is_empty()) {
        cmd.args(["-c", c]);
    }

    // Execute command
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 changes: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse -ztag output
    let changelists = parse_ztag_changes(&stdout)?;

    Ok(changelists)
}

/// Open files for edit (or move to different changelist if already opened)
#[tauri::command]
pub async fn p4_edit(
    paths: Vec<String>,
    changelist: Option<i32>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
    app: AppHandle,
) -> Result<Vec<P4FileInfo>, String> {
    if paths.is_empty() {
        return Err("No paths provided".to_string());
    }

    // Build command: p4 edit -c <changelist> <paths>
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("edit");

    if let Some(cl) = changelist {
        cmd.arg("-c");
        cmd.arg(cl.to_string());
    }

    cmd.args(&paths);

    // Execute command
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 edit: {}", e))?;

    // Check for errors (but note p4 edit can have partial success)
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Parse output to determine which files were successfully opened
    let mut opened_files = Vec::new();

    for line in stdout.lines() {
        // p4 edit output: "//depot/path#rev - opened for edit"
        // or for reopen: "//depot/path#rev - reopened; change X"
        if line.contains(" - opened for edit") || line.contains(" - reopened") {
            if let Some(depot_path) = line.split('#').next() {
                opened_files.push(depot_path.to_string());
            }
        }
    }

    // Get updated file info for opened files
    // Use None for client_root since we're querying specific depot paths
    let file_info = if !opened_files.is_empty() {
        p4_fstat(opened_files.clone(), None, server, user, client).await?
    } else {
        Vec::new()
    };

    // Emit file-status-changed event for each file
    for file in &file_info {
        let _ = app.emit("file-status-changed", file.clone());
    }

    // If there were errors, include them in result
    if !stderr.is_empty() && file_info.is_empty() {
        return Err(stderr.to_string());
    }

    Ok(file_info)
}

/// Revert files (discard local changes)
#[tauri::command]
pub async fn p4_revert(
    paths: Vec<String>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
    app: AppHandle,
) -> Result<Vec<String>, String> {
    if paths.is_empty() {
        return Err("No paths provided".to_string());
    }

    // Execute: p4 revert <paths>
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("revert");
    cmd.args(&paths);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 revert: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Parse output to get reverted files
    let mut reverted_files = Vec::new();

    for line in stdout.lines() {
        // p4 revert output: "//depot/path#rev - was edit, reverted"
        if line.contains(" - was ") && line.contains(", reverted") {
            if let Some(depot_path) = line.split('#').next() {
                reverted_files.push(depot_path.to_string());
            }
        }
    }

    // Emit file-status-changed event for each reverted file
    // Note: Files are now back to "synced" status
    for depot_path in &reverted_files {
        let _ = app.emit(
            "file-status-changed",
            serde_json::json!({
                "depot_path": depot_path,
                "status": "synced"
            }),
        );
    }

    // Check for errors
    if !stderr.is_empty() && reverted_files.is_empty() {
        return Err(stderr.to_string());
    }

    Ok(reverted_files)
}

/// Submit a changelist
///
/// For the default changelist (id=0), uses `p4 submit -d "description"`.
/// For numbered changelists, uses `p4 submit -c <changelist>`.
#[tauri::command]
pub async fn p4_submit(
    changelist: i32,
    description: Option<String>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
    app: AppHandle,
) -> Result<i32, String> {
    let output = if changelist == 0 {
        // Default changelist: must use -d flag with description
        let desc = description.unwrap_or_else(|| "Submitted from P4Now".to_string());
        let mut cmd = Command::new("p4");
        apply_connection_args(&mut cmd, &server, &user, &client);
        cmd.args(["submit", "-d", &desc]);
        cmd.output()
            .map_err(|e| format!("Failed to execute p4 submit: {}", e))?
    } else {
        // Named changelist: update description if provided, then submit with -c
        if let Some(ref desc) = description {
            update_changelist_description(
                changelist,
                desc,
                server.clone(),
                user.clone(),
                client.clone(),
            )?;
        }
        let mut cmd = Command::new("p4");
        apply_connection_args(&mut cmd, &server, &user, &client);
        cmd.args(["submit", "-c", &changelist.to_string()]);
        cmd.output()
            .map_err(|e| format!("Failed to execute p4 submit: {}", e))?
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Check for errors first
    if !output.status.success() {
        return Err(stderr.to_string());
    }

    // Parse output to get submitted changelist number
    // p4 submit output: "Change 12345 submitted."
    let submitted_cl = stdout
        .lines()
        .find(|line| line.contains("Change") && line.contains("submitted"))
        .and_then(|line| {
            line.split_whitespace()
                .nth(1)
                .and_then(|s| s.parse::<i32>().ok())
        })
        .unwrap_or(changelist);

    // Emit changelist-submitted event
    let _ = app.emit(
        "changelist-submitted",
        serde_json::json!({
            "changelist": submitted_cl
        }),
    );

    Ok(submitted_cl)
}

/// Create a new changelist
#[tauri::command]
pub async fn p4_create_change(
    description: String,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<i32, String> {
    // Get template: p4 change -o
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["change", "-o"]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to get changelist template: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let form = String::from_utf8_lossy(&output.stdout);

    // Update description and remove Files section
    let mut new_form = String::new();
    let mut in_description = false;
    let mut in_files = false;

    for line in form.lines() {
        if line.starts_with("Description:") {
            new_form.push_str("Description:\n");
            new_form.push_str(&format!("\t{}\n", description));
            in_description = true;
        } else if in_description && line.starts_with('\t') {
            // Skip old description lines
            continue;
        } else if line.starts_with("Files:") {
            // Remove Files section for new changelist
            in_files = true;
            continue;
        } else if in_files && line.starts_with('\t') {
            // Skip file lines
            continue;
        } else if in_files && !line.starts_with('\t') {
            in_files = false;
        } else if in_description && !line.starts_with('\t') {
            in_description = false;
            new_form.push_str(line);
            new_form.push('\n');
        } else if !in_files {
            new_form.push_str(line);
            new_form.push('\n');
        }
    }

    // Submit form: p4 change -i
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["change", "-i"]);
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn p4 change: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(new_form.as_bytes())
            .map_err(|e| format!("Failed to write changelist form: {}", e))?;
    }

    let result = child
        .wait_with_output()
        .map_err(|e| format!("Failed to create changelist: {}", e))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(stderr.to_string());
    }

    // Parse output: "Change NNNNN created."
    let stdout = String::from_utf8_lossy(&result.stdout);
    let changelist_id = stdout
        .lines()
        .find(|line| line.contains("Change") && line.contains("created"))
        .and_then(|line| {
            line.split_whitespace()
                .nth(1)
                .and_then(|s| s.parse::<i32>().ok())
        })
        .ok_or_else(|| format!("Failed to parse changelist ID from: {}", stdout))?;

    Ok(changelist_id)
}

/// Delete a changelist
#[tauri::command]
pub async fn p4_delete_change(
    changelist: i32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<(), String> {
    // Execute: p4 change -d <changelist>
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["change", "-d", &changelist.to_string()]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 change -d: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

/// Reopen files to a different changelist
#[tauri::command]
pub async fn p4_reopen(
    paths: Vec<String>,
    changelist: i32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<String>, String> {
    if paths.is_empty() {
        return Err("No paths provided".to_string());
    }

    // Execute: p4 reopen -c <changelist> <paths>
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    let cl_str = if changelist == 0 {
        "default".to_string()
    } else {
        changelist.to_string()
    };
    cmd.args(["reopen", "-c", &cl_str]);
    cmd.args(&paths);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 reopen: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Parse output: "//depot/path#rev - reopened; change NNN"
    let mut reopened_paths = Vec::new();

    for line in stdout.lines() {
        if line.contains(" - reopened") {
            if let Some(depot_path) = line.split('#').next() {
                reopened_paths.push(depot_path.to_string());
            }
        }
    }

    // Check for errors
    if !output.status.success() || (!stderr.is_empty() && reopened_paths.is_empty()) {
        return Err(stderr.to_string());
    }

    Ok(reopened_paths)
}

/// Edit changelist description
#[tauri::command]
pub async fn p4_edit_change_description(
    changelist: i32,
    description: String,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<(), String> {
    update_changelist_description(changelist, &description, server, user, client)
}

/// Sync files from depot (get latest)
///
/// When paths is empty, uses depot_path if provided (e.g., "//stream/main/...")
/// to sync all files in the workspace.
#[tauri::command]
pub async fn p4_sync(
    paths: Vec<String>,
    depot_path: Option<String>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
    on_progress: Channel<SyncProgress>,
    state: State<'_, ProcessManager>,
    _app: AppHandle,
) -> Result<String, String> {
    // Build command: p4 sync <paths>
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("sync");

    if paths.is_empty() {
        // Use depot_path if provided (e.g., "//stream/main/..."), otherwise fall back to "//..."
        let query_path = depot_path.unwrap_or_else(|| "//...".to_string());
        cmd.arg(query_path);
    } else {
        cmd.args(&paths);
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Spawn process
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn p4 sync: {}", e))?;

    // Take stdout/stderr
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Register process
    let process_id = state.register(child).await;
    let process_id_clone = process_id.clone();

    // Stream stdout in background thread
    let on_progress_clone = on_progress.clone();
    if let Some(stdout) = stdout {
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                if let Some(progress) = parse_sync_line(&line) {
                    let _ = on_progress_clone.send(progress);
                }
            }
        });
    }

    // Stream stderr in background thread (for errors/conflicts)
    if let Some(stderr) = stderr {
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                // Skip informational messages that P4 sends to stderr
                if line.contains("file(s) up-to-date") {
                    // This is not an error - workspace is already synced
                    continue;
                }

                // Only emit actual errors/conflicts
                let is_conflict =
                    line.contains("can't clobber") || line.contains("can't overwrite");
                let _ = on_progress.send(SyncProgress {
                    depot_path: line.clone(),
                    action: if is_conflict { "conflict" } else { "error" }.to_string(),
                    revision: 0,
                    is_conflict,
                });
            }
        });
    }

    Ok(process_id_clone)
}

/// List available workspaces for a given server and user
#[tauri::command]
pub async fn p4_list_workspaces(server: String, user: String) -> Result<Vec<P4Workspace>, String> {
    let mut cmd = Command::new("p4");
    // Override all P4 env vars to ensure complete isolation from DVCS/local config
    cmd.env("P4CONFIG", "");
    cmd.env("P4ROOT", "");
    cmd.env("P4PORT", &server);
    cmd.env("P4USER", &user);
    cmd.args(["-p", &server, "-u", &user, "-ztag", "clients", "-u", &user]);
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 clients: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("p4 clients failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_clients(&stdout)
}

/// Test connection to P4 server with given credentials
#[tauri::command]
pub async fn p4_test_connection(
    server: String,
    user: String,
    client: String,
) -> Result<P4ClientInfo, String> {
    let mut cmd = Command::new("p4");
    // Override all P4 env vars to ensure complete isolation from DVCS/local config
    cmd.env("P4CONFIG", "");
    cmd.env("P4ROOT", "");
    cmd.env("P4PORT", &server);
    cmd.env("P4USER", &user);
    cmd.env("P4CLIENT", &client);
    cmd.args(["-p", &server, "-u", &user, "-c", &client, "-ztag", "info"]);
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 info: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Connection test failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_info(&stdout)
}

/// Get file history (revisions) for a depot path
#[tauri::command]
pub async fn p4_filelog(
    depot_path: String,
    max_revisions: Option<i32>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4Revision>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("-ztag");
    cmd.arg("filelog");

    if let Some(max) = max_revisions {
        cmd.arg("-m");
        cmd.arg(max.to_string());
    }

    cmd.arg(depot_path);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 filelog: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_filelog(&stdout)
}

/// Print a specific revision of a file to a temp file
#[tauri::command]
pub async fn p4_print_to_file(
    depot_path: String,
    revision: i32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<String, String> {
    // Extract file extension from depot path
    let extension = depot_path
        .rsplit('.')
        .next()
        .filter(|ext| !ext.contains('/'))
        .map(|ext| format!(".{}", ext))
        .unwrap_or_else(|| ".txt".to_string());

    // Create temp file with matching extension
    let temp_file = Builder::new()
        .suffix(&extension)
        .tempfile()
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let temp_path = temp_file.path().to_string_lossy().to_string();

    // Print file to temp location
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.args(["print", "-q", "-o", &temp_path]);
    cmd.arg(format!("{}#{}", depot_path, revision));

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 print: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    // Persist the temp file so it doesn't get deleted
    let (_, persistent_path) = temp_file
        .keep()
        .map_err(|e| format!("Failed to persist temp file: {}", e))?;

    Ok(persistent_path.to_string_lossy().to_string())
}

/// Print a specific revision of a file and return its content as a string
#[tauri::command]
pub async fn p4_print_content(
    depot_path: String,
    revision: i32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<String, String> {
    // First, check file size using p4 fstat to prevent memory exhaustion
    let mut fstat_cmd = Command::new("p4");
    apply_connection_args(&mut fstat_cmd, &server, &user, &client);
    fstat_cmd.args(["-ztag", "fstat"]);
    fstat_cmd.arg(format!("{}#{}", depot_path, revision));

    let fstat_output = fstat_cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 fstat: {}", e))?;

    if !fstat_output.status.success() {
        let stderr = String::from_utf8_lossy(&fstat_output.stderr);
        return Err(format!("Failed to get file info: {}", stderr));
    }

    let fstat_stdout = String::from_utf8_lossy(&fstat_output.stdout);
    let records = parse_ztag_records(&fstat_stdout);

    if records.is_empty() {
        return Err("File not found".to_string());
    }

    let file_info = &records[0];

    // Check if file is binary
    if let Some(file_type) = file_info.get("headType") {
        if file_type.contains("binary") {
            return Err(format!("Cannot view binary file (type: {})", file_type));
        }
    }

    // Check file size
    if let Some(file_size_str) = file_info.get("fileSize") {
        if let Ok(file_size) = file_size_str.parse::<u64>() {
            if file_size > MAX_CONTENT_SIZE {
                return Err(format!(
                    "File too large to view: {:.1}MB (maximum: {}MB)",
                    file_size as f64 / 1024.0 / 1024.0,
                    MAX_CONTENT_SIZE / 1024 / 1024
                ));
            }
        }
    }

    // Create temp file with matching extension
    let extension = depot_path
        .rsplit('.')
        .next()
        .filter(|ext| !ext.contains('/'))
        .map(|ext| format!(".{}", ext))
        .unwrap_or_else(|| ".txt".to_string());

    let temp_file = Builder::new()
        .suffix(&extension)
        .tempfile()
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let temp_path = temp_file.path().to_string_lossy().to_string();

    // Print file to temp location
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.args(["print", "-q", "-o", &temp_path]);
    cmd.arg(format!("{}#{}", depot_path, revision));

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 print: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    // Read the temp file content using tokio (async I/O)
    let content = tokio::fs::read_to_string(temp_file.path())
        .await
        .map_err(|e| format!("Failed to read file content: {}", e))?;

    // Note: temp_file is automatically cleaned up when it goes out of scope

    Ok(content)
}

/// Get file annotations (blame) showing who last modified each line
#[tauri::command]
pub async fn p4_annotate(
    depot_path: String,
    revision: i32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4AnnotationLine>, String> {
    // First, check file size using p4 fstat to prevent memory exhaustion
    let mut fstat_cmd = Command::new("p4");
    apply_connection_args(&mut fstat_cmd, &server, &user, &client);
    fstat_cmd.args(["-ztag", "fstat"]);
    fstat_cmd.arg(format!("{}#{}", depot_path, revision));

    let fstat_output = fstat_cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 fstat: {}", e))?;

    if !fstat_output.status.success() {
        let stderr = String::from_utf8_lossy(&fstat_output.stderr);
        return Err(format!("Failed to get file info: {}", stderr));
    }

    let fstat_stdout = String::from_utf8_lossy(&fstat_output.stdout);
    let records = parse_ztag_records(&fstat_stdout);

    if records.is_empty() {
        return Err("File not found".to_string());
    }

    let file_info = &records[0];

    // Check if file is binary
    if let Some(file_type) = file_info.get("headType") {
        if file_type.contains("binary") {
            return Err(format!("Cannot annotate binary file (type: {})", file_type));
        }
    }

    // Check file size
    if let Some(file_size_str) = file_info.get("fileSize") {
        if let Ok(file_size) = file_size_str.parse::<u64>() {
            if file_size > MAX_CONTENT_SIZE {
                return Err(format!(
                    "File too large to annotate: {:.1}MB (maximum: {}MB)",
                    file_size as f64 / 1024.0 / 1024.0,
                    MAX_CONTENT_SIZE / 1024 / 1024
                ));
            }
        }
    }

    // Execute p4 annotate -u -c
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["annotate", "-u", "-c"]);
    cmd.arg(format!("{}#{}", depot_path, revision));

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 annotate: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_annotate_output(&stdout)
}

/// Launch external diff tool
#[tauri::command]
pub async fn launch_diff_tool(
    left_path: String,
    right_path: String,
    diff_tool_path: String,
    diff_tool_args: Option<String>,
    _app: AppHandle,
) -> Result<(), String> {
    let mut cmd = Command::new(&diff_tool_path);

    // Parse and apply arguments
    if let Some(args_str) = diff_tool_args.filter(|s| !s.is_empty()) {
        // Check for placeholders
        if args_str.contains("{left}")
            || args_str.contains("{right}")
            || args_str.contains("$LOCAL")
            || args_str.contains("$REMOTE")
        {
            // Parse args and substitute placeholders
            // Supports {left}/{right} and P4-style $LOCAL/$REMOTE
            let args: Vec<String> = args_str
                .split_whitespace()
                .map(|arg| {
                    arg.replace("{left}", &left_path)
                        .replace("{right}", &right_path)
                        .replace("$LOCAL", &left_path)
                        .replace("$REMOTE", &right_path)
                })
                .collect();
            cmd.args(args);
        } else {
            // No placeholders - append args first, then paths
            cmd.args(args_str.split_whitespace());
            cmd.arg(&left_path);
            cmd.arg(&right_path);
        }
    } else {
        // No args - just pass paths
        cmd.arg(&left_path);
        cmd.arg(&right_path);
    }

    // Spawn without blocking
    cmd.spawn()
        .map_err(|e| format!("Failed to launch diff tool: {}", e))?;

    Ok(())
}

/// Get submitted changelists
#[tauri::command]
pub async fn p4_changes_submitted(
    max_changes: Option<i32>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4Changelist>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("-ztag");
    cmd.arg("changes");
    cmd.arg("-l"); // Long output to get full descriptions
    cmd.arg("-s");
    cmd.arg("submitted");
    cmd.arg("-m");
    cmd.arg(max_changes.unwrap_or(500).to_string());

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 changes: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_changes(&stdout)
}

/// Shelve files to a changelist
#[tauri::command]
pub async fn p4_shelve(
    changelist_id: i32,
    file_paths: Vec<String>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<String, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("shelve");
    cmd.arg("-c");
    cmd.arg(changelist_id.to_string());

    if !file_paths.is_empty() {
        cmd.args(&file_paths);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 shelve: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(stderr.to_string());
    }

    Ok(stdout.to_string())
}

/// Describe shelved files in a changelist
#[tauri::command]
pub async fn p4_describe_shelved(
    changelist_id: i32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4ShelvedFile>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("-ztag");
    cmd.arg("describe");
    cmd.arg("-s");  // suppress diffs
    cmd.arg("-S");  // show shelved files
    cmd.arg(changelist_id.to_string());

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 describe: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);


    // CLs without shelved files may return non-zero exit with "no shelved files" message
    // Treat this as empty result, not error
    if !output.status.success() {
        let stderr_lower = stderr.to_lowercase();
        if stderr_lower.contains("no shelved files")
            || stderr_lower.contains("not shelved")
            || stderr_lower.contains("no shelf")
            || (stdout.trim().is_empty() && stderr.trim().is_empty())
        {
            return Ok(vec![]);
        }
        return Err(stderr.to_string());
    }

    parse_ztag_describe_shelved(&stdout)
}

/// Describe a submitted changelist (metadata and file list, no diffs)
/// Uses -s flag to suppress diff output for performance with large changelists
#[tauri::command]
pub async fn p4_describe(
    changelist_id: i32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<P4ChangelistDescription, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    // -ztag for structured output, -s to suppress diffs (critical for large CLs)
    cmd.args(["-ztag", "describe", "-s", &changelist_id.to_string()]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 describe: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_describe_output(&stdout, changelist_id)
}

/// Unshelve files from a changelist
#[tauri::command]
pub async fn p4_unshelve(
    source_changelist_id: i32,
    target_changelist_id: i32,
    file_paths: Option<Vec<String>>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<String, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("unshelve");
    cmd.arg("-s");
    cmd.arg(source_changelist_id.to_string());
    cmd.arg("-c");
    cmd.arg(target_changelist_id.to_string());

    // Add file paths if specified (for per-file unshelving)
    if let Some(paths) = file_paths {
        for path in paths {
            cmd.arg(path);
        }
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 unshelve: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Include stderr in result as it may contain conflict info
    let result = if stderr.is_empty() {
        stdout.to_string()
    } else {
        format!("{}\n{}", stdout, stderr)
    };

    if !output.status.success() {
        return Err(result);
    }

    Ok(result)
}

/// Delete shelved files from a changelist
#[tauri::command]
pub async fn p4_delete_shelf(
    changelist_id: i32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<String, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("shelve");
    cmd.arg("-d");
    cmd.arg("-c");
    cmd.arg(changelist_id.to_string());

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 shelve -d: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(stderr.to_string());
    }

    Ok(stdout.to_string())
}

/// Preview reconcile (detect adds, edits, deletes)
///
/// When depot_path is provided (e.g., "//stream/main/..."), scans that path.
/// Otherwise defaults to "//..." to scan entire workspace.
#[tauri::command]
pub async fn p4_reconcile_preview(
    depot_path: Option<String>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<ReconcilePreview>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("reconcile");
    cmd.arg("-n"); // Dry run

    // Add path argument (defaults to "//..." if not provided)
    let path = depot_path.unwrap_or_else(|| "//...".to_string());
    cmd.arg(path);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 reconcile -n: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Stderr may contain "no file(s) to reconcile" - treat as empty result, not error
    if stderr.contains("no file(s) to reconcile") {
        return Ok(Vec::new());
    }

    // Parse output line by line
    let previews = parse_reconcile_output(&stdout)?;

    Ok(previews)
}

/// Apply reconcile to specific files
#[tauri::command]
pub async fn p4_reconcile_apply(
    file_paths: Vec<String>,
    changelist_id: Option<i32>,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<String, String> {
    if file_paths.is_empty() {
        return Err("No file paths provided".to_string());
    }

    // Clean paths: strip revision specifiers (#rev) that p4 reconcile -n may include
    let cleaned_paths: Vec<String> = file_paths
        .iter()
        .map(|p| {
            if let Some(hash_pos) = p.rfind('#') {
                p[..hash_pos].to_string()
            } else {
                p.clone()
            }
        })
        .collect();

    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("reconcile");

    if let Some(cl) = changelist_id {
        cmd.arg("-c");
        cmd.arg(cl.to_string());
    }

    cmd.args(&cleaned_paths);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 reconcile: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        let err = if stderr.is_empty() {
            stdout.to_string()
        } else {
            stderr.to_string()
        };
        return Err(err);
    }

    // Check if p4 actually reconciled anything
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return Err(
            "No files were reconciled. The files may already be open or unchanged.".to_string(),
        );
    }

    Ok(stdout.to_string())
}

/// Preview files needing resolution (without actually resolving)
#[tauri::command]
pub async fn p4_resolve_preview(
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<String>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["resolve", "-n"]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 resolve -n: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse output: lines like "//depot/path - merging ..." or "//depot/path - must resolve ..."
    let files: Vec<String> = stdout
        .lines()
        .filter(|line| !line.is_empty())
        .map(|line| {
            // Extract depot path (everything before " - ")
            line.split(" - ").next().unwrap_or(line).trim().to_string()
        })
        .collect();

    Ok(files)
}

/// Search depot for files matching a pattern
/// Example: p4 files //depot/.../*.cpp
#[tauri::command]
pub async fn p4_files(
    pattern: String,
    max_results: u32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4FileResult>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.arg("files");
    cmd.arg(&pattern);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 files: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);

    // Check for errors (but allow "no such file(s)" as valid empty result)
    if !output.status.success() && !stderr.contains("no such file(s)") {
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse output lines: format is "//depot/path#rev - action change N (type)"
    // Example: "//depot/main/src/foo.cpp#5 - edit change 12345 (text)"
    let mut results = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Parse: //depot/path#rev - action change N (type)
        if let Some((path_rev, rest)) = line.split_once(" - ") {
            // Extract depot path and revision
            if let Some((depot_path, rev_str)) = path_rev.rsplit_once('#') {
                let revision = rev_str.parse::<i32>().unwrap_or(0);

                // Parse action, change, and file type
                let parts: Vec<&str> = rest.split_whitespace().collect();
                let action = parts.first().unwrap_or(&"").to_string();

                // Find "change" keyword and parse the number after it
                let change = parts
                    .iter()
                    .position(|&s| s == "change")
                    .and_then(|idx| parts.get(idx + 1))
                    .and_then(|s| s.parse::<i32>().ok())
                    .unwrap_or(0);

                // File type is in parentheses at the end
                let file_type = rest
                    .rsplit_once('(')
                    .and_then(|(_, typ)| typ.strip_suffix(')'))
                    .unwrap_or("text")
                    .to_string();

                results.push(P4FileResult {
                    depot_path: depot_path.to_string(),
                    revision,
                    action,
                    change,
                    file_type,
                });

                // Limit results
                if results.len() >= max_results as usize {
                    break;
                }
            }
        }
    }

    Ok(results)
}

/// List available streams for the depot
#[tauri::command]
pub async fn p4_list_streams(
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4Stream>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["-ztag", "streams"]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 streams: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_streams(&stdout)
}

/// Get client spec for a specific workspace
#[tauri::command]
pub async fn p4_get_client_spec(
    workspace: String,
    server: Option<String>,
    user: Option<String>,
) -> Result<P4ClientSpec, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &None);
    cmd.args(["-ztag", "client", "-o", &workspace]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 client -o: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_client_spec(&stdout)
}

/// Update client spec's Stream field (for stream switching)
#[tauri::command]
pub async fn p4_update_client_stream(
    workspace: String,
    new_stream: String,
    server: Option<String>,
    user: Option<String>,
) -> Result<String, String> {
    // 1. Get current client spec (without -ztag - need raw form format)
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &Some(workspace.clone()));
    cmd.args(["client", "-o", &workspace]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to get client spec: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let form = String::from_utf8_lossy(&output.stdout);

    // 2. Modify Stream field in form
    let mut new_form = String::new();
    for line in form.lines() {
        if line.starts_with("Stream:") {
            new_form.push_str(&format!("Stream:\t{}\n", new_stream));
        } else {
            new_form.push_str(line);
            new_form.push('\n');
        }
    }

    // 3. Submit modified form via p4 client -i
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &Some(workspace));
    cmd.args(["client", "-i"]);
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn p4 client -i: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(new_form.as_bytes())
            .map_err(|e| format!("Failed to write form: {}", e))?;
        // Drop stdin to signal EOF
        drop(stdin);
    }

    let result = child
        .wait_with_output()
        .map_err(|e| format!("Failed to update client: {}", e))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&result.stdout);
    Ok(stdout.to_string())
}

/// List all depot roots
#[tauri::command]
pub async fn p4_depots(
    server: Option<String>,
    user: Option<String>,
) -> Result<Vec<P4Depot>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &None);
    cmd.args(["-ztag", "depots"]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 depots: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_depots(&stdout)
}

/// List immediate subdirectories of a depot path
#[tauri::command]
pub async fn p4_dirs(
    depot_path: String,
    include_deleted: bool,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<String>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.arg("-ztag");

    if include_deleted {
        cmd.arg("dirs");
        cmd.arg("-D");
        cmd.arg(&depot_path);
    } else {
        cmd.args(["dirs", &depot_path]);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 dirs: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);

    // Handle "no such file(s)" as empty result, not error
    if stderr.contains("no such file(s)") || stderr.contains("must refer to client") {
        return Ok(Vec::new());
    }

    if !output.status.success() {
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_dirs(&stdout)
}

/// Detect files needing resolution
#[tauri::command]
pub async fn p4_fstat_unresolved(
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4UnresolvedFile>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["-ztag", "fstat", "-Ru", "-Or", "//..."]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 fstat -Ru -Or: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);

    // Handle "no such file(s)" as empty result, not error
    if stderr.contains("no such file(s)") {
        return Ok(Vec::new());
    }

    // If stderr has error text but stdout has data, still parse stdout
    // (p4 fstat may emit warnings alongside results)
    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse -ztag format
    let files = parse_ztag_fstat_unresolved(&stdout)?;

    Ok(files)
}

/// Execute quick resolve with theirs/yours/merge modes
#[tauri::command]
pub async fn p4_resolve_accept(
    file_path: String,
    mode: String,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<String, String> {
    // Map mode to p4 flag
    let flag = match mode.as_str() {
        "theirs" => "-at",
        "yours" => "-ay",
        "merge" => "-am",
        _ => return Err(format!("Invalid mode: {}. Must be 'theirs', 'yours', or 'merge'", mode)),
    };

    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["resolve", flag, &file_path]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 resolve: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

/// Launch external merge tool with blocking wait
#[tauri::command]
pub async fn launch_merge_tool(
    depot_path: String,
    local_path: String,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<i32, String> {
    // Step 1: Check P4MERGE env var, fallback to MERGE
    let merge_tool = std::env::var("P4MERGE")
        .or_else(|_| std::env::var("MERGE"))
        .map_err(|_| {
            "P4MERGE environment variable not set. Set P4MERGE to your merge tool path (e.g., C:\\Program Files\\Perforce\\p4merge.exe).".to_string()
        })?;

    // Step 2: Get base and theirs file info via p4 fstat
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["-ztag", "fstat", &depot_path]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 fstat: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to get file info: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse ztag output to extract resolve file info
    let fields = parse_ztag_records(&stdout).into_iter().next().unwrap_or_default();

    // Extract base file and revision
    let base_file = fields
        .get("resolveBaseFile")
        .ok_or("No resolveBaseFile found - file may not need resolution")?;
    let base_rev = fields
        .get("resolveBaseRev")
        .ok_or("No resolveBaseRev found")?;

    // Extract theirs file and revision
    let theirs_file = fields
        .get("resolveFromFile0")
        .ok_or("No resolveFromFile0 found")?;
    let theirs_rev = fields
        .get("resolveEndFromRev0")
        .ok_or("No resolveEndFromRev0 found")?;

    // Step 3: Extract base and theirs to temp files
    let temp_dir = std::env::temp_dir();

    // Create unique temp file names with timestamp
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let extension = depot_path
        .rsplit('.')
        .next()
        .filter(|ext| !ext.contains('/'))
        .map(|ext| format!(".{}", ext))
        .unwrap_or_else(|| ".txt".to_string());

    let base_temp_path = temp_dir.join(format!("p4merge_base_{}_{}", timestamp, base_file.replace('/', "_").replace('\\', "_") + &extension));
    let theirs_temp_path = temp_dir.join(format!("p4merge_theirs_{}_{}", timestamp, theirs_file.replace('/', "_").replace('\\', "_") + &extension));

    // Print base file to temp
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args([
        "print",
        "-q",
        "-o",
        &base_temp_path.to_string_lossy(),
        &format!("{}#{}", base_file, base_rev),
    ]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to print base file: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to print base file: {}", stderr));
    }

    // Print theirs file to temp
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args([
        "print",
        "-q",
        "-o",
        &theirs_temp_path.to_string_lossy(),
        &format!("{}#{}", theirs_file, theirs_rev),
    ]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to print theirs file: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to print theirs file: {}", stderr));
    }

    // Step 4: Spawn merge tool with blocking wait
    let base_temp_str = base_temp_path.to_string_lossy().to_string();
    let theirs_temp_str = theirs_temp_path.to_string_lossy().to_string();
    let local_path_clone = local_path.clone();
    let merge_tool_clone = merge_tool.clone();

    let exit_code = tokio::task::spawn_blocking(move || {
        let status = Command::new(&merge_tool_clone)
            .args([&base_temp_str, &theirs_temp_str, &local_path_clone, &local_path_clone])
            .status()
            .map_err(|e| format!("Failed to launch merge tool: {}", e))?;
        Ok::<i32, String>(status.code().unwrap_or(-1))
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))??;

    // Step 5: Clean up temp files (best effort, ignore cleanup errors)
    let _ = std::fs::remove_file(&base_temp_path);
    let _ = std::fs::remove_file(&theirs_temp_path);

    Ok(exit_code)
}
