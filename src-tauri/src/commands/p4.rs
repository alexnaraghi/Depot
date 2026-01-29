use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use serde::Serialize;
use tauri::{AppHandle, Emitter, ipc::Channel, State};

use crate::state::ProcessManager;

/// Apply optional connection args to a p4 Command.
/// When explicit args are provided, overrides P4 environment variables
/// and clears P4CONFIG to ensure complete isolation from DVCS/local config.
fn apply_connection_args(cmd: &mut Command, server: &Option<String>, user: &Option<String>, client: &Option<String>) {
    let has_explicit = server.as_ref().is_some_and(|s| !s.is_empty())
        || user.as_ref().is_some_and(|s| !s.is_empty())
        || client.as_ref().is_some_and(|s| !s.is_empty());

    if has_explicit {
        // Clear P4CONFIG and P4ROOT to prevent DVCS/local config from interfering
        cmd.env("P4CONFIG", "");
        cmd.env("P4ROOT", "");
    }

    if let Some(s) = server.as_ref().filter(|s| !s.is_empty()) {
        cmd.args(["-p", s]);
        // Also set env var to ensure override even if P4PORT is set in environment
        cmd.env("P4PORT", s);
    }
    if let Some(u) = user.as_ref().filter(|s| !s.is_empty()) {
        cmd.args(["-u", u]);
        cmd.env("P4USER", u);
    }
    if let Some(c) = client.as_ref().filter(|s| !s.is_empty()) {
        cmd.args(["-c", c]);
        cmd.env("P4CLIENT", c);
    }
}

/// File information from p4 fstat
#[derive(Debug, Clone, Serialize)]
pub struct P4FileInfo {
    pub depot_path: String,
    pub local_path: String,
    pub status: String,        // synced, checkedOut, added, deleted, modified, outOfDate
    pub action: Option<String>, // edit, add, delete, etc. (if opened)
    pub revision: i32,
    pub head_revision: i32,
    pub changelist: Option<i32>,
    pub file_type: String,
}

/// Changelist information from p4 changes
#[derive(Debug, Clone, Serialize)]
pub struct P4Changelist {
    pub id: i32,
    pub description: String,
    pub user: String,
    pub client: String,
    pub status: String,
    pub file_count: i32,
}

/// P4 client/workspace info
#[derive(Debug, Clone, Serialize)]
pub struct P4ClientInfo {
    pub client_name: String,
    pub client_root: String,
    pub client_stream: Option<String>,
    pub user_name: String,
    pub server_address: String,
}

/// Workspace information from p4 clients
#[derive(Debug, Clone, Serialize)]
pub struct P4Workspace {
    pub name: String,
    pub root: String,
    pub stream: Option<String>,
    pub description: String,
}

/// Parse p4 -ztag info output into P4ClientInfo
fn parse_ztag_info(output: &str) -> Result<P4ClientInfo, String> {
    let mut client_name = String::new();
    let mut client_root = String::new();
    let mut client_stream: Option<String> = None;
    let mut user_name = String::new();
    let mut server_address = String::new();

    for line in output.lines() {
        if let Some(stripped) = line.strip_prefix("... ") {
            if let Some((key, value)) = stripped.split_once(' ') {
                match key {
                    "clientName" => client_name = value.to_string(),
                    "clientRoot" => client_root = value.to_string(),
                    "clientStream" => client_stream = Some(value.to_string()),
                    "userName" => user_name = value.to_string(),
                    "serverAddress" => server_address = value.to_string(),
                    _ => {}
                }
            }
        }
    }

    if client_root.is_empty() {
        return Err("Could not determine P4 client root. Is P4CLIENT set?".to_string());
    }

    Ok(P4ClientInfo {
        client_name,
        client_root,
        client_stream,
        user_name,
        server_address,
    })
}

/// Get P4 client info (client root, user, server)
#[tauri::command]
pub async fn p4_info(server: Option<String>, user: Option<String>, client: Option<String>) -> Result<P4ClientInfo, String> {
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
pub async fn p4_fstat(paths: Vec<String>, depot_path: Option<String>, server: Option<String>, user: Option<String>, client: Option<String>) -> Result<Vec<P4FileInfo>, String> {
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

/// Parse p4 -ztag fstat output into P4FileInfo structs
fn parse_ztag_fstat(output: &str) -> Result<Vec<P4FileInfo>, String> {
    let mut files = Vec::new();
    let mut current_file: HashMap<String, String> = HashMap::new();

    for line in output.lines() {
        let line = line.trim();

        // Empty line or end of record
        if line.is_empty() {
            if !current_file.is_empty() {
                if let Some(file_info) = build_file_info(&current_file) {
                    files.push(file_info);
                }
                current_file.clear();
            }
            continue;
        }

        // Parse "... fieldName value" format
        if let Some(stripped) = line.strip_prefix("... ") {
            if let Some((key, value)) = stripped.split_once(' ') {
                current_file.insert(key.to_string(), value.to_string());
            }
        }
    }

    // Handle last record if no trailing empty line
    if !current_file.is_empty() {
        if let Some(file_info) = build_file_info(&current_file) {
            files.push(file_info);
        }
    }

    Ok(files)
}

/// Build P4FileInfo from parsed ztag fields
fn build_file_info(fields: &HashMap<String, String>) -> Option<P4FileInfo> {
    // Required fields
    let depot_path = fields.get("depotFile")?.clone();
    let local_path = fields.get("clientFile")?.clone();

    // Parse revisions (default to 0 if not present)
    let head_revision = fields.get("headRev")
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(0);

    let revision = fields.get("haveRev")
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(0);

    // Optional fields
    let action = fields.get("action").cloned();
    let file_type = fields.get("headType")
        .or_else(|| fields.get("type"))
        .cloned()
        .unwrap_or_else(|| "text".to_string());

    let changelist = fields.get("change")
        .and_then(|s| s.parse::<i32>().ok());

    // Derive status from fields
    let status = derive_file_status(&action, revision, head_revision);

    Some(P4FileInfo {
        depot_path,
        local_path,
        status,
        action,
        revision,
        head_revision,
        changelist,
        file_type,
    })
}

/// Derive file status from p4 fields
fn derive_file_status(action: &Option<String>, have_rev: i32, head_rev: i32) -> String {
    if let Some(act) = action {
        // File is opened - determine status from action
        match act.as_str() {
            "add" => "added".to_string(),
            "delete" => "deleted".to_string(),
            "edit" | "integrate" | "branch" => "checkedOut".to_string(),
            _ => "modified".to_string(),
        }
    } else if have_rev == 0 {
        // Not synced
        "notSynced".to_string()
    } else if have_rev < head_rev {
        // Out of date
        "outOfDate".to_string()
    } else {
        // Up to date and not opened
        "synced".to_string()
    }
}

/// Get all files opened by current user
#[tauri::command]
pub async fn p4_opened(server: Option<String>, user: Option<String>, client: Option<String>) -> Result<Vec<P4FileInfo>, String> {
    // Execute: p4 -ztag opened
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["-ztag", "opened"]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 opened: {}", e))?;

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
pub async fn p4_changes(status: Option<String>, server: Option<String>, user: Option<String>, client: Option<String>) -> Result<Vec<P4Changelist>, String> {
    // Build command: p4 -ztag changes -s <status> -u <user> -c <client>
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    cmd.arg("-ztag");
    cmd.arg("changes");

    // Add status filter (default to pending)
    let status_filter = status.unwrap_or_else(|| "pending".to_string());
    cmd.arg("-s");
    cmd.arg(status_filter);

    // Filter by current user and client
    cmd.arg("-u");
    cmd.arg("$P4USER");  // p4 will expand this
    cmd.arg("-c");
    cmd.arg("$P4CLIENT");  // p4 will expand this

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

/// Parse p4 -ztag changes output into P4Changelist structs
fn parse_ztag_changes(output: &str) -> Result<Vec<P4Changelist>, String> {
    let mut changelists = Vec::new();
    let mut current: HashMap<String, String> = HashMap::new();

    for line in output.lines() {
        let line = line.trim();

        if line.is_empty() {
            if !current.is_empty() {
                if let Some(cl) = build_changelist(&current) {
                    changelists.push(cl);
                }
                current.clear();
            }
            continue;
        }

        if let Some(stripped) = line.strip_prefix("... ") {
            if let Some((key, value)) = stripped.split_once(' ') {
                current.insert(key.to_string(), value.to_string());
            }
        }
    }

    // Handle last record
    if !current.is_empty() {
        if let Some(cl) = build_changelist(&current) {
            changelists.push(cl);
        }
    }

    Ok(changelists)
}

/// Build P4Changelist from parsed ztag fields
fn build_changelist(fields: &HashMap<String, String>) -> Option<P4Changelist> {
    let id = fields.get("change")?.parse::<i32>().ok()?;
    let user = fields.get("user")?.clone();
    let client = fields.get("client")?.clone();
    let status = fields.get("status")?.clone();
    let description = fields.get("desc").cloned().unwrap_or_else(|| "".to_string());

    // File count is not provided by p4 changes, will need separate query
    // For now, default to 0 and let frontend query if needed
    let file_count = 0;

    Some(P4Changelist {
        id,
        description,
        user,
        client,
        status,
        file_count,
    })
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
        let _ = app.emit("file-status-changed", serde_json::json!({
            "depot_path": depot_path,
            "status": "synced"
        }));
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
        if let Some(s) = &server { cmd.args(["-p", s]); }
        if let Some(u) = &user { cmd.args(["-u", u]); }
        if let Some(c) = &client { cmd.args(["-c", c]); }
        cmd.args(["submit", "-d", &desc]);
        cmd.output()
            .map_err(|e| format!("Failed to execute p4 submit: {}", e))?
    } else {
        // Named changelist: update description if provided, then submit with -c
        if let Some(ref desc) = description {
            update_changelist_description(changelist, desc, server.clone(), user.clone(), client.clone())?;
        }
        let mut cmd = Command::new("p4");
        if let Some(s) = &server { cmd.args(["-p", s]); }
        if let Some(u) = &user { cmd.args(["-u", u]); }
        if let Some(c) = &client { cmd.args(["-c", c]); }
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
    let _ = app.emit("changelist-submitted", serde_json::json!({
        "changelist": submitted_cl
    }));

    Ok(submitted_cl)
}

/// Update changelist description
fn update_changelist_description(changelist: i32, description: &str, server: Option<String>, user: Option<String>, client: Option<String>) -> Result<(), String> {
    // Get current changelist form
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["change", "-o", &changelist.to_string()]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to get changelist: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let form = String::from_utf8_lossy(&output.stdout);

    // Update description in form
    let mut new_form = String::new();
    let mut in_description = false;

    for line in form.lines() {
        if line.starts_with("Description:") {
            new_form.push_str("Description:\n");
            new_form.push_str(&format!("\t{}\n", description));
            in_description = true;
        } else if in_description && line.starts_with('\t') {
            // Skip old description lines
            continue;
        } else if in_description && !line.starts_with('\t') {
            in_description = false;
            new_form.push_str(line);
            new_form.push('\n');
        } else {
            new_form.push_str(line);
            new_form.push('\n');
        }
    }

    // Submit updated form
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);
    cmd.args(["change", "-i"]);
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn p4 change: {}", e))?;

    use std::io::Write;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(new_form.as_bytes())
            .map_err(|e| format!("Failed to write changelist form: {}", e))?;
    }

    let result = child
        .wait_with_output()
        .map_err(|e| format!("Failed to update changelist: {}", e))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(stderr.to_string());
    }

    Ok(())
}

/// Progress information for sync operation
#[derive(Clone, Serialize)]
pub struct SyncProgress {
    pub depot_path: String,
    pub action: String,  // updating, adding, deleting, can't clobber
    pub revision: i32,
    pub is_conflict: bool,
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
                let is_conflict = line.contains("can't clobber") || line.contains("can't overwrite");
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

/// Parse p4 sync output line into SyncProgress
fn parse_sync_line(line: &str) -> Option<SyncProgress> {
    // p4 sync output formats:
    // "//depot/path#rev - updating local/path"
    // "//depot/path#rev - adding local/path"
    // "//depot/path#rev - deleting local/path"
    // "//depot/path#rev - can't clobber writable file local/path"

    let is_conflict = line.contains("can't clobber");

    // Extract depot path and revision
    if let Some(hash_pos) = line.find('#') {
        let depot_path = line[..hash_pos].to_string();

        // Extract revision
        let after_hash = &line[hash_pos + 1..];
        let revision = after_hash
            .split_whitespace()
            .next()
            .and_then(|s| s.parse::<i32>().ok())
            .unwrap_or(0);

        // Extract action
        let action = if line.contains(" - updating ") {
            "updating"
        } else if line.contains(" - adding ") {
            "adding"
        } else if line.contains(" - deleting ") {
            "deleting"
        } else if is_conflict {
            "can't clobber"
        } else {
            "unknown"
        };

        return Some(SyncProgress {
            depot_path,
            action: action.to_string(),
            revision,
            is_conflict,
        });
    }

    None
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

/// Parse p4 -ztag clients output into P4Workspace structs
fn parse_ztag_clients(output: &str) -> Result<Vec<P4Workspace>, String> {
    let mut workspaces = Vec::new();
    let mut current: HashMap<String, String> = HashMap::new();

    for line in output.lines() {
        let line = line.trim();

        if line.is_empty() {
            if !current.is_empty() {
                if let Some(ws) = build_workspace(&current) {
                    workspaces.push(ws);
                }
                current.clear();
            }
            continue;
        }

        if let Some(stripped) = line.strip_prefix("... ") {
            if let Some((key, value)) = stripped.split_once(' ') {
                current.insert(key.to_string(), value.to_string());
            }
        }
    }

    // Handle last record if no trailing empty line
    if !current.is_empty() {
        if let Some(ws) = build_workspace(&current) {
            workspaces.push(ws);
        }
    }

    Ok(workspaces)
}

/// Build P4Workspace from parsed ztag fields
fn build_workspace(fields: &HashMap<String, String>) -> Option<P4Workspace> {
    let name = fields.get("client")?.clone();
    let root = fields.get("Root")?.clone();
    let stream = fields.get("Stream").cloned();
    let description = fields.get("Description").cloned().unwrap_or_else(|| "".to_string());

    Some(P4Workspace {
        name,
        root,
        stream,
        description,
    })
}

/// Test connection to P4 server with given credentials
#[tauri::command]
pub async fn p4_test_connection(server: String, user: String, client: String) -> Result<P4ClientInfo, String> {
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
