use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use tauri::{ipc::Channel, AppHandle, Emitter, State};
use tempfile::Builder;

use crate::state::ProcessManager;

/// Apply optional connection args to a p4 Command.
/// When explicit args are provided, overrides P4 environment variables
/// and clears P4CONFIG to ensure complete isolation from DVCS/local config.
fn apply_connection_args(
    cmd: &mut Command,
    server: &Option<String>,
    user: &Option<String>,
    client: &Option<String>,
) {
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

/// Parse p4 -ztag output into a vector of records (key-value HashMaps).
/// Each record is separated by a blank line. Fields are in "... key value" format.
fn parse_ztag_records(output: &str) -> Vec<HashMap<String, String>> {
    let mut records = Vec::new();
    let mut current: HashMap<String, String> = HashMap::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            if !current.is_empty() {
                records.push(std::mem::take(&mut current));
            }
            continue;
        }
        if let Some(stripped) = line.strip_prefix("... ") {
            if let Some((key, value)) = stripped.split_once(' ') {
                current.insert(key.to_string(), value.to_string());
            } else {
                current.insert(stripped.to_string(), String::new());
            }
        }
    }
    if !current.is_empty() {
        records.push(current);
    }
    records
}

/// File information from p4 fstat
#[derive(Debug, Clone, Serialize)]
pub struct P4FileInfo {
    pub depot_path: String,
    pub local_path: String,
    pub status: String, // synced, checkedOut, added, deleted, modified, outOfDate
    pub action: Option<String>, // edit, add, delete, etc. (if opened)
    pub revision: i32,
    pub head_revision: i32,
    pub changelist: Option<i32>,
    pub file_type: String,
    pub head_action: Option<String>,
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
    pub time: i64,
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

/// Revision information from p4 filelog
#[derive(Debug, Clone, Serialize)]
pub struct P4Revision {
    pub rev: i32,
    pub change: i32,
    pub action: String,
    pub file_type: String,
    pub time: i64,
    pub user: String,
    pub client: String,
    pub desc: String,
}

/// Parse p4 -ztag info output into P4ClientInfo
fn parse_ztag_info(output: &str) -> Result<P4ClientInfo, String> {
    let records = parse_ztag_records(output);
    let fields = records.into_iter().next().unwrap_or_default();

    let client_root = fields.get("clientRoot").cloned().unwrap_or_default();
    if client_root.is_empty() {
        return Err("Could not determine P4 client root. Is P4CLIENT set?".to_string());
    }

    Ok(P4ClientInfo {
        client_name: fields.get("clientName").cloned().unwrap_or_default(),
        client_root,
        client_stream: fields.get("clientStream").cloned(),
        user_name: fields.get("userName").cloned().unwrap_or_default(),
        server_address: fields.get("serverAddress").cloned().unwrap_or_default(),
    })
}

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

/// Parse p4 -ztag fstat output into P4FileInfo structs
fn parse_ztag_fstat(output: &str) -> Result<Vec<P4FileInfo>, String> {
    let files = parse_ztag_records(output)
        .into_iter()
        .filter_map(|record| build_file_info(&record))
        .collect();
    Ok(files)
}

/// Build P4FileInfo from parsed ztag fields
fn build_file_info(fields: &HashMap<String, String>) -> Option<P4FileInfo> {
    // Required fields
    let depot_path = fields.get("depotFile")?.clone();
    // Prefer "path" (local filesystem path from fstat) over "clientFile" (client-spec path).
    // p4 opened only provides "clientFile" as local path, while p4 fstat provides both
    // "clientFile" (//client/...) and "path" (C:\workspace\...).
    let local_path = fields
        .get("path")
        .or_else(|| fields.get("clientFile"))?
        .clone();

    // Parse revisions (default to 0 if not present)
    let head_revision = fields
        .get("headRev")
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(0);

    let revision = fields
        .get("haveRev")
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(0);

    // Optional fields
    let action = fields.get("action").cloned();
    let file_type = fields
        .get("headType")
        .or_else(|| fields.get("type"))
        .cloned()
        .unwrap_or_else(|| "text".to_string());

    let changelist = fields.get("change").and_then(|s| s.parse::<i32>().ok());
    let head_action = fields.get("headAction").cloned();

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
        head_action,
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

/// Parse p4 -ztag changes output into P4Changelist structs
fn parse_ztag_changes(output: &str) -> Result<Vec<P4Changelist>, String> {
    let changelists = parse_ztag_records(output)
        .into_iter()
        .filter_map(|record| build_changelist(&record))
        .collect();
    Ok(changelists)
}

/// Build P4Changelist from parsed ztag fields
fn build_changelist(fields: &HashMap<String, String>) -> Option<P4Changelist> {
    let id = fields.get("change")?.parse::<i32>().ok()?;
    let user = fields.get("user")?.clone();
    let client = fields.get("client")?.clone();
    let status = fields.get("status")?.clone();
    let description = fields
        .get("desc")
        .cloned()
        .unwrap_or_else(|| "".to_string());
    let time = fields.get("time")?.parse::<i64>().ok()?;

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
        time,
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

/// Update changelist description
fn update_changelist_description(
    changelist: i32,
    description: &str,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<(), String> {
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

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(new_form.as_bytes())
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

/// Progress information for sync operation
#[derive(Clone, Serialize)]
pub struct SyncProgress {
    pub depot_path: String,
    pub action: String, // updating, adding, deleting, can't clobber
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
    let workspaces = parse_ztag_records(output)
        .into_iter()
        .filter_map(|record| build_workspace(&record))
        .collect();
    Ok(workspaces)
}

/// Build P4Workspace from parsed ztag fields
fn build_workspace(fields: &HashMap<String, String>) -> Option<P4Workspace> {
    let name = fields.get("client")?.clone();
    let root = fields.get("Root")?.clone();
    let stream = fields.get("Stream").cloned();
    let description = fields
        .get("Description")
        .cloned()
        .unwrap_or_else(|| "".to_string());

    Some(P4Workspace {
        name,
        root,
        stream,
        description,
    })
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

/// Parse p4 -ztag filelog output into P4Revision structs
/// Note: p4 filelog -ztag produces indexed fields like rev0, change0, action0, etc.
/// all in a single record
fn parse_ztag_filelog(output: &str) -> Result<Vec<P4Revision>, String> {
    let records = parse_ztag_records(output);
    let fields = records.into_iter().next().unwrap_or_default();

    // Extract revisions by index
    let mut revisions = Vec::new();
    let mut index = 0;

    loop {
        let rev_key = format!("rev{}", index);
        let change_key = format!("change{}", index);
        let action_key = format!("action{}", index);
        let type_key = format!("type{}", index);
        let time_key = format!("time{}", index);
        let user_key = format!("user{}", index);
        let client_key = format!("client{}", index);
        let desc_key = format!("desc{}", index);

        // Check if this index exists
        if let Some(rev_str) = fields.get(&rev_key) {
            let rev = rev_str.parse::<i32>().unwrap_or(0);
            let change = fields
                .get(&change_key)
                .and_then(|s| s.parse::<i32>().ok())
                .unwrap_or(0);
            let action = fields.get(&action_key).cloned().unwrap_or_default();
            let file_type = fields
                .get(&type_key)
                .cloned()
                .unwrap_or_else(|| "text".to_string());
            let time = fields
                .get(&time_key)
                .and_then(|s| s.parse::<i64>().ok())
                .unwrap_or(0);
            let user = fields.get(&user_key).cloned().unwrap_or_default();
            let client = fields.get(&client_key).cloned().unwrap_or_default();
            let desc = fields.get(&desc_key).cloned().unwrap_or_default();

            revisions.push(P4Revision {
                rev,
                change,
                action,
                file_type,
                time,
                user,
                client,
                desc,
            });

            index += 1;
        } else {
            break;
        }
    }

    Ok(revisions)
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

/// Shelved file information from p4 describe -S
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct P4ShelvedFile {
    pub depot_path: String,
    pub action: String,
    pub file_type: String,
    pub revision: i32,
}

/// Reconcile preview information from p4 reconcile -n
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconcilePreview {
    pub depot_path: String,
    pub local_path: String,
    pub action: String,
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
    cmd.arg("-S");
    cmd.arg(changelist_id.to_string());

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 describe: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ztag_describe_shelved(&stdout)
}

/// Parse p4 -ztag describe -S output into P4ShelvedFile structs
/// Similar to filelog parsing - uses indexed fields (depotFile0, action0, type0, rev0, etc.)
fn parse_ztag_describe_shelved(output: &str) -> Result<Vec<P4ShelvedFile>, String> {
    let records = parse_ztag_records(output);
    let fields = records.into_iter().next().unwrap_or_default();

    // Extract shelved files by index
    let mut files = Vec::new();
    let mut index = 0;

    loop {
        let depot_file_key = format!("depotFile{}", index);
        let action_key = format!("action{}", index);
        let type_key = format!("type{}", index);
        let rev_key = format!("rev{}", index);

        // Check if this index exists
        if let Some(depot_path) = fields.get(&depot_file_key) {
            let action = fields.get(&action_key).cloned().unwrap_or_default();
            let file_type = fields
                .get(&type_key)
                .cloned()
                .unwrap_or_else(|| "text".to_string());
            let revision = fields
                .get(&rev_key)
                .and_then(|s| s.parse::<i32>().ok())
                .unwrap_or(0);

            files.push(P4ShelvedFile {
                depot_path: depot_path.clone(),
                action,
                file_type,
                revision,
            });

            index += 1;
        } else {
            break;
        }
    }

    Ok(files)
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

/// Parse p4 reconcile -n output into ReconcilePreview structs
/// Output format: "<path> - opened for <action>"
fn parse_reconcile_output(output: &str) -> Result<Vec<ReconcilePreview>, String> {
    let mut previews = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Expected format: "C:\path\file.txt - opened for edit"
        // or "//depot/path#1 - opened for add"
        if let Some(dash_pos) = line.find(" - opened for ") {
            let raw_path = line[..dash_pos].trim();
            // Strip revision specifier (#rev) if present
            let path = if let Some(hash_pos) = raw_path.rfind('#') {
                raw_path[..hash_pos].to_string()
            } else {
                raw_path.to_string()
            };
            let after_dash = &line[dash_pos + 14..]; // Skip " - opened for "
            let action = after_dash.trim().to_string();

            previews.push(ReconcilePreview {
                depot_path: path,
                local_path: String::new(), // UI will handle display
                action,
            });
        }
    }

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

/// Stream information from p4 streams
#[derive(Debug, Clone, Serialize)]
pub struct P4Stream {
    pub stream: String,            // Full path: //depot/main
    pub name: String,               // Display name
    pub parent: Option<String>,     // Parent stream path
    pub stream_type: String,        // mainline, development, release
    pub description: String,
}

/// Client spec information from p4 client -o
#[derive(Debug, Clone, Serialize)]
pub struct P4ClientSpec {
    pub client: String,
    pub root: String,
    pub stream: Option<String>,
    pub owner: String,
    pub description: String,
    pub view: Vec<String>,
    pub options: String,
    pub host: String,
    pub submit_options: String,
}

/// File result from p4 files command
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct P4FileResult {
    pub depot_path: String,
    pub revision: i32,
    pub action: String,
    pub change: i32,
    pub file_type: String,
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

/// Parse p4 -ztag streams output into P4Stream structs
fn parse_ztag_streams(output: &str) -> Result<Vec<P4Stream>, String> {
    let streams = parse_ztag_records(output)
        .into_iter()
        .filter_map(|record| build_stream(&record))
        .collect();
    Ok(streams)
}

/// Build P4Stream from parsed ztag fields
fn build_stream(fields: &HashMap<String, String>) -> Option<P4Stream> {
    let stream = fields.get("Stream")?.clone();
    let name = fields.get("Name").cloned().unwrap_or_else(|| stream.clone());
    let parent = fields.get("Parent").cloned();
    let stream_type = fields.get("Type")?.clone();
    let description = fields
        .get("desc")
        .cloned()
        .unwrap_or_else(|| "".to_string());

    Some(P4Stream {
        stream,
        name,
        parent,
        stream_type,
        description,
    })
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

/// Parse p4 -ztag client -o output into P4ClientSpec
fn parse_ztag_client_spec(output: &str) -> Result<P4ClientSpec, String> {
    let records = parse_ztag_records(output);
    let fields = records.into_iter().next().unwrap_or_default();

    // Extract View mapping lines (View0, View1, View2, ...) from the flat record
    let mut view_lines: Vec<String> = Vec::new();
    let mut view_idx = 0;
    loop {
        let key = format!("View{}", view_idx);
        if let Some(value) = fields.get(&key) {
            view_lines.push(value.clone());
            view_idx += 1;
        } else {
            break;
        }
    }

    let client = fields
        .get("Client")
        .ok_or("Missing Client field")?
        .clone();
    let root = fields.get("Root").ok_or("Missing Root field")?.clone();
    let stream = fields.get("Stream").cloned();
    let owner = fields.get("Owner").ok_or("Missing Owner field")?.clone();
    let description = fields
        .get("Description")
        .cloned()
        .unwrap_or_else(|| "".to_string());
    let options = fields
        .get("Options")
        .cloned()
        .unwrap_or_else(|| "".to_string());
    let host = fields
        .get("Host")
        .cloned()
        .unwrap_or_else(|| "".to_string());
    let submit_options = fields
        .get("SubmitOptions")
        .cloned()
        .unwrap_or_else(|| "submitunchanged".to_string());

    Ok(P4ClientSpec {
        client,
        root,
        stream,
        owner,
        description,
        view: view_lines,
        options,
        host,
        submit_options,
    })
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

/// Depot information from p4 depots
#[derive(Debug, Clone, Serialize)]
pub struct P4Depot {
    pub name: String,
    pub depot_type: String,
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

/// Parse p4 -ztag depots output into P4Depot structs
fn parse_ztag_depots(output: &str) -> Result<Vec<P4Depot>, String> {
    let depots = parse_ztag_records(output)
        .into_iter()
        .filter_map(|record| build_depot(&record))
        .collect();
    Ok(depots)
}

/// Build P4Depot from parsed ztag fields
fn build_depot(fields: &HashMap<String, String>) -> Option<P4Depot> {
    let name = fields.get("name")?.clone();
    let depot_type = fields.get("type").or_else(|| fields.get("Type"))?.clone();

    Some(P4Depot { name, depot_type })
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

/// Parse p4 -ztag dirs output into directory paths
fn parse_ztag_dirs(output: &str) -> Result<Vec<String>, String> {
    let dirs = parse_ztag_records(output)
        .into_iter()
        .filter_map(|record| record.get("dir").cloned())
        .collect();
    Ok(dirs)
}

/// Unresolved file information from p4 fstat -Ru -Or
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct P4UnresolvedFile {
    pub depot_path: String,
    pub local_path: String,
    pub head_rev: i32,
    pub have_rev: i32,
    pub resolve_action: String,
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

/// Parse p4 -ztag fstat -Ru -Or output into P4UnresolvedFile structs
fn parse_ztag_fstat_unresolved(output: &str) -> Result<Vec<P4UnresolvedFile>, String> {
    let files = parse_ztag_records(output)
        .into_iter()
        .filter_map(|record| build_unresolved_file_info(&record))
        .collect();
    Ok(files)
}

/// Build P4UnresolvedFile from parsed ztag fields
fn build_unresolved_file_info(fields: &HashMap<String, String>) -> Option<P4UnresolvedFile> {
    let depot_path = fields.get("depotFile")?.clone();
    let local_path = fields
        .get("path")
        .or_else(|| fields.get("clientFile"))?
        .clone();

    let head_rev = fields
        .get("headRev")
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(0);

    let have_rev = fields
        .get("haveRev")
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(0);

    // Extract resolve action from resolveAction0 field
    let resolve_action = fields
        .get("resolveAction0")
        .cloned()
        .unwrap_or_else(|| "merge".to_string());

    Some(P4UnresolvedFile {
        depot_path,
        local_path,
        head_rev,
        have_rev,
        resolve_action,
    })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ztag_records_single_record() {
        let input = r#"... key1 value1
... key2 value2
... key3 value3
"#;
        let records = parse_ztag_records(input);
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].get("key1"), Some(&"value1".to_string()));
        assert_eq!(records[0].get("key2"), Some(&"value2".to_string()));
        assert_eq!(records[0].get("key3"), Some(&"value3".to_string()));
    }

    #[test]
    fn test_parse_ztag_records_multiple_records() {
        let input = r#"... key1 value1
... key2 value2

... key1 value3
... key2 value4
"#;
        let records = parse_ztag_records(input);
        assert_eq!(records.len(), 2);
        assert_eq!(records[0].get("key1"), Some(&"value1".to_string()));
        assert_eq!(records[0].get("key2"), Some(&"value2".to_string()));
        assert_eq!(records[1].get("key1"), Some(&"value3".to_string()));
        assert_eq!(records[1].get("key2"), Some(&"value4".to_string()));
    }

    #[test]
    fn test_parse_ztag_records_empty_value() {
        let input = r#"... key1
... key2 value2
"#;
        let records = parse_ztag_records(input);
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].get("key1"), Some(&"".to_string()));
        assert_eq!(records[0].get("key2"), Some(&"value2".to_string()));
    }

    #[test]
    fn test_parse_ztag_records_value_with_spaces() {
        let input = r#"... desc This is a description with spaces
... user john_doe
"#;
        let records = parse_ztag_records(input);
        assert_eq!(records.len(), 1);
        assert_eq!(
            records[0].get("desc"),
            Some(&"This is a description with spaces".to_string())
        );
        assert_eq!(records[0].get("user"), Some(&"john_doe".to_string()));
    }

    #[test]
    fn test_parse_ztag_records_empty_input() {
        let input = "";
        let records = parse_ztag_records(input);
        assert_eq!(records.len(), 0);
    }

    #[test]
    fn test_parse_ztag_info() {
        let input = r#"... clientName my_workspace
... clientRoot C:\workspace
... clientStream //depot/main
... userName john_doe
... serverAddress perforce:1666
"#;
        let result = parse_ztag_info(input);
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.client_name, "my_workspace");
        assert_eq!(info.client_root, "C:\\workspace");
        assert_eq!(info.client_stream, Some("//depot/main".to_string()));
        assert_eq!(info.user_name, "john_doe");
        assert_eq!(info.server_address, "perforce:1666");
    }

    #[test]
    fn test_parse_ztag_info_missing_client_root() {
        let input = r#"... clientName my_workspace
... userName john_doe
"#;
        let result = parse_ztag_info(input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("client root"));
    }

    #[test]
    fn test_parse_ztag_fstat_synced_file() {
        let input = r#"... depotFile //depot/main/file.cpp
... path C:\workspace\file.cpp
... headRev 5
... haveRev 5
... headType text
... headAction edit
"#;
        let result = parse_ztag_fstat(input);
        assert!(result.is_ok());
        let files = result.unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].depot_path, "//depot/main/file.cpp");
        assert_eq!(files[0].local_path, "C:\\workspace\\file.cpp");
        assert_eq!(files[0].status, "synced");
        assert_eq!(files[0].revision, 5);
        assert_eq!(files[0].head_revision, 5);
        assert_eq!(files[0].action, None);
    }

    #[test]
    fn test_parse_ztag_fstat_checked_out_file() {
        let input = r#"... depotFile //depot/main/file.cpp
... path C:\workspace\file.cpp
... headRev 5
... haveRev 5
... headType text
... action edit
... change 12345
"#;
        let result = parse_ztag_fstat(input);
        assert!(result.is_ok());
        let files = result.unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].depot_path, "//depot/main/file.cpp");
        assert_eq!(files[0].status, "checkedOut");
        assert_eq!(files[0].action, Some("edit".to_string()));
        assert_eq!(files[0].changelist, Some(12345));
    }

    #[test]
    fn test_parse_ztag_fstat_added_file() {
        let input = r#"... depotFile //depot/main/newfile.cpp
... clientFile //my_workspace/newfile.cpp
... headRev 0
... haveRev 0
... action add
... change default
"#;
        let result = parse_ztag_fstat(input);
        assert!(result.is_ok());
        let files = result.unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].status, "added");
        assert_eq!(files[0].action, Some("add".to_string()));
    }

    #[test]
    fn test_parse_ztag_fstat_out_of_date_file() {
        let input = r#"... depotFile //depot/main/file.cpp
... path C:\workspace\file.cpp
... headRev 10
... haveRev 5
... headType text
"#;
        let result = parse_ztag_fstat(input);
        assert!(result.is_ok());
        let files = result.unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].status, "outOfDate");
        assert_eq!(files[0].revision, 5);
        assert_eq!(files[0].head_revision, 10);
    }

    #[test]
    fn test_parse_ztag_fstat_deleted_file() {
        let input = r#"... depotFile //depot/main/file.cpp
... path C:\workspace\file.cpp
... headRev 5
... haveRev 5
... action delete
... change 12345
"#;
        let result = parse_ztag_fstat(input);
        assert!(result.is_ok());
        let files = result.unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].status, "deleted");
        assert_eq!(files[0].action, Some("delete".to_string()));
    }

    #[test]
    fn test_parse_ztag_fstat_multiple_files() {
        let input = r#"... depotFile //depot/main/file1.cpp
... path C:\workspace\file1.cpp
... headRev 5
... haveRev 5
... headType text

... depotFile //depot/main/file2.cpp
... path C:\workspace\file2.cpp
... headRev 3
... haveRev 3
... headType text
... action edit
... change 12345
"#;
        let result = parse_ztag_fstat(input);
        assert!(result.is_ok());
        let files = result.unwrap();
        assert_eq!(files.len(), 2);
        assert_eq!(files[0].depot_path, "//depot/main/file1.cpp");
        assert_eq!(files[0].status, "synced");
        assert_eq!(files[1].depot_path, "//depot/main/file2.cpp");
        assert_eq!(files[1].status, "checkedOut");
    }

    #[test]
    fn test_parse_ztag_changes() {
        let input = r#"... change 12345
... user john_doe
... client my_workspace
... status pending
... desc WIP: feature implementation
... time 1704067200

... change 12344
... user jane_smith
... client her_workspace
... status submitted
... desc Fixed bug in parser
... time 1704063600
"#;
        let result = parse_ztag_changes(input);
        assert!(result.is_ok());
        let changelists = result.unwrap();
        assert_eq!(changelists.len(), 2);

        assert_eq!(changelists[0].id, 12345);
        assert_eq!(changelists[0].user, "john_doe");
        assert_eq!(changelists[0].client, "my_workspace");
        assert_eq!(changelists[0].status, "pending");
        assert_eq!(changelists[0].description, "WIP: feature implementation");
        assert_eq!(changelists[0].time, 1704067200);
        assert_eq!(changelists[0].file_count, 0); // Default value

        assert_eq!(changelists[1].id, 12344);
        assert_eq!(changelists[1].user, "jane_smith");
        assert_eq!(changelists[1].status, "submitted");
    }

    #[test]
    fn test_parse_ztag_changes_empty_description() {
        let input = r#"... change 12345
... user john_doe
... client my_workspace
... status pending
... time 1704067200
"#;
        let result = parse_ztag_changes(input);
        assert!(result.is_ok());
        let changelists = result.unwrap();
        assert_eq!(changelists.len(), 1);
        assert_eq!(changelists[0].description, "");
    }

    #[test]
    fn test_parse_ztag_filelog_single_revision() {
        let input = r#"... rev0 5
... change0 12345
... action0 edit
... type0 text
... time0 1704067200
... user0 john_doe
... client0 my_workspace
... desc0 Fixed bug in parser
"#;
        let result = parse_ztag_filelog(input);
        assert!(result.is_ok());
        let revisions = result.unwrap();
        assert_eq!(revisions.len(), 1);

        assert_eq!(revisions[0].rev, 5);
        assert_eq!(revisions[0].change, 12345);
        assert_eq!(revisions[0].action, "edit");
        assert_eq!(revisions[0].file_type, "text");
        assert_eq!(revisions[0].time, 1704067200);
        assert_eq!(revisions[0].user, "john_doe");
        assert_eq!(revisions[0].client, "my_workspace");
        assert_eq!(revisions[0].desc, "Fixed bug in parser");
    }

    #[test]
    fn test_parse_ztag_filelog_multiple_revisions() {
        let input = r#"... rev0 5
... change0 12345
... action0 edit
... type0 text
... time0 1704067200
... user0 john_doe
... client0 my_workspace
... desc0 Recent change
... rev1 4
... change1 12340
... action1 edit
... type1 text
... time1 1704063600
... user1 jane_smith
... client1 her_workspace
... desc1 Previous change
... rev2 3
... change2 12330
... action2 add
... type2 text
... time2 1704060000
... user2 john_doe
... client2 my_workspace
... desc2 Initial version
"#;
        let result = parse_ztag_filelog(input);
        assert!(result.is_ok());
        let revisions = result.unwrap();
        assert_eq!(revisions.len(), 3);

        assert_eq!(revisions[0].rev, 5);
        assert_eq!(revisions[0].change, 12345);
        assert_eq!(revisions[0].desc, "Recent change");

        assert_eq!(revisions[1].rev, 4);
        assert_eq!(revisions[1].change, 12340);
        assert_eq!(revisions[1].user, "jane_smith");

        assert_eq!(revisions[2].rev, 3);
        assert_eq!(revisions[2].change, 12330);
        assert_eq!(revisions[2].action, "add");
    }

    #[test]
    fn test_parse_ztag_filelog_empty() {
        let input = "";
        let result = parse_ztag_filelog(input);
        assert!(result.is_ok());
        let revisions = result.unwrap();
        assert_eq!(revisions.len(), 0);
    }

    #[test]
    fn test_parse_ztag_dirs() {
        let input = r#"... dir //depot/main/src

... dir //depot/main/include

... dir //depot/main/tests
"#;
        let result = parse_ztag_dirs(input);
        assert!(result.is_ok());
        let dirs = result.unwrap();
        assert_eq!(dirs.len(), 3);
        assert_eq!(dirs[0], "//depot/main/src");
        assert_eq!(dirs[1], "//depot/main/include");
        assert_eq!(dirs[2], "//depot/main/tests");
    }

    #[test]
    fn test_parse_ztag_dirs_empty() {
        let input = "";
        let result = parse_ztag_dirs(input);
        assert!(result.is_ok());
        let dirs = result.unwrap();
        assert_eq!(dirs.len(), 0);
    }

    #[test]
    fn test_build_file_info_missing_required_fields() {
        let mut fields = HashMap::new();
        fields.insert("depotFile".to_string(), "//depot/main/file.cpp".to_string());
        // Missing path/clientFile - should return None

        let result = build_file_info(&fields);
        assert!(result.is_none());
    }

    #[test]
    fn test_build_changelist_missing_required_fields() {
        let mut fields = HashMap::new();
        fields.insert("change".to_string(), "12345".to_string());
        // Missing user - should return None

        let result = build_changelist(&fields);
        assert!(result.is_none());
    }

    #[test]
    fn test_derive_file_status() {
        // Test checkedOut status for edit action
        assert_eq!(
            derive_file_status(&Some("edit".to_string()), 5, 5),
            "checkedOut"
        );

        // Test added status
        assert_eq!(
            derive_file_status(&Some("add".to_string()), 0, 0),
            "added"
        );

        // Test deleted status
        assert_eq!(
            derive_file_status(&Some("delete".to_string()), 5, 5),
            "deleted"
        );

        // Test notSynced status (have_rev = 0)
        assert_eq!(
            derive_file_status(&None, 0, 5),
            "notSynced"
        );

        // Test outOfDate status (have_rev < head_rev)
        assert_eq!(
            derive_file_status(&None, 3, 5),
            "outOfDate"
        );

        // Test synced status (up to date, not opened)
        assert_eq!(
            derive_file_status(&None, 5, 5),
            "synced"
        );

        // Test integrate action
        assert_eq!(
            derive_file_status(&Some("integrate".to_string()), 5, 5),
            "checkedOut"
        );

        // Test branch action
        assert_eq!(
            derive_file_status(&Some("branch".to_string()), 5, 5),
            "checkedOut"
        );
    }

    #[test]
    fn test_parse_ztag_clients() {
        let input = r#"... client workspace1
... Root C:\workspace1
... Stream //depot/main
... Description My workspace

... client workspace2
... Root C:\workspace2
... Description Another workspace
"#;
        let result = parse_ztag_clients(input);
        assert!(result.is_ok());
        let workspaces = result.unwrap();
        assert_eq!(workspaces.len(), 2);

        assert_eq!(workspaces[0].name, "workspace1");
        assert_eq!(workspaces[0].root, "C:\\workspace1");
        assert_eq!(workspaces[0].stream, Some("//depot/main".to_string()));
        assert_eq!(workspaces[0].description, "My workspace");

        assert_eq!(workspaces[1].name, "workspace2");
        assert_eq!(workspaces[1].root, "C:\\workspace2");
        assert_eq!(workspaces[1].stream, None);
        assert_eq!(workspaces[1].description, "Another workspace");
    }

    #[test]
    fn test_parse_ztag_describe_shelved() {
        let input = r#"... depotFile0 //depot/main/file1.cpp
... action0 edit
... type0 text
... rev0 5
... depotFile1 //depot/main/file2.cpp
... action1 add
... type1 text
... rev1 1
... depotFile2 //depot/main/file3.cpp
... action2 delete
... type2 text
... rev2 3
"#;
        let result = parse_ztag_describe_shelved(input);
        assert!(result.is_ok());
        let files = result.unwrap();
        assert_eq!(files.len(), 3);

        assert_eq!(files[0].depot_path, "//depot/main/file1.cpp");
        assert_eq!(files[0].action, "edit");
        assert_eq!(files[0].file_type, "text");
        assert_eq!(files[0].revision, 5);

        assert_eq!(files[1].depot_path, "//depot/main/file2.cpp");
        assert_eq!(files[1].action, "add");
        assert_eq!(files[1].revision, 1);

        assert_eq!(files[2].depot_path, "//depot/main/file3.cpp");
        assert_eq!(files[2].action, "delete");
        assert_eq!(files[2].revision, 3);
    }

    #[test]
    fn test_parse_ztag_streams() {
        let input = r#"... Stream //depot/main
... Name main
... Type mainline
... desc Main development stream

... Stream //depot/release
... Name release
... Parent //depot/main
... Type release
... desc Release stream
"#;
        let result = parse_ztag_streams(input);
        assert!(result.is_ok());
        let streams = result.unwrap();
        assert_eq!(streams.len(), 2);

        assert_eq!(streams[0].stream, "//depot/main");
        assert_eq!(streams[0].name, "main");
        assert_eq!(streams[0].stream_type, "mainline");
        assert_eq!(streams[0].parent, None);
        assert_eq!(streams[0].description, "Main development stream");

        assert_eq!(streams[1].stream, "//depot/release");
        assert_eq!(streams[1].name, "release");
        assert_eq!(streams[1].stream_type, "release");
        assert_eq!(streams[1].parent, Some("//depot/main".to_string()));
        assert_eq!(streams[1].description, "Release stream");
    }

    #[test]
    fn test_parse_ztag_client_spec() {
        let input = r#"... Client my_workspace
... Root C:\workspace
... Stream //depot/main
... Owner john_doe
... Description My workspace for development
... Options noallwrite noclobber nocompress unlocked nomodtime normdir
... Host
... SubmitOptions submitunchanged
... View0 //depot/main/... //my_workspace/...
... View1 -//depot/main/exclude/... //my_workspace/exclude/...
"#;
        let result = parse_ztag_client_spec(input);
        assert!(result.is_ok());
        let spec = result.unwrap();

        assert_eq!(spec.client, "my_workspace");
        assert_eq!(spec.root, "C:\\workspace");
        assert_eq!(spec.stream, Some("//depot/main".to_string()));
        assert_eq!(spec.owner, "john_doe");
        assert_eq!(spec.description, "My workspace for development");
        assert_eq!(spec.options, "noallwrite noclobber nocompress unlocked nomodtime normdir");
        assert_eq!(spec.host, "");
        assert_eq!(spec.submit_options, "submitunchanged");
        assert_eq!(spec.view.len(), 2);
        assert_eq!(spec.view[0], "//depot/main/... //my_workspace/...");
        assert_eq!(spec.view[1], "-//depot/main/exclude/... //my_workspace/exclude/...");
    }

    #[test]
    fn test_parse_ztag_depots() {
        let input = r#"... name depot
... type local

... name stream_depot
... Type stream

... name remote_depot
... type remote
"#;
        let result = parse_ztag_depots(input);
        assert!(result.is_ok());
        let depots = result.unwrap();
        assert_eq!(depots.len(), 3);

        assert_eq!(depots[0].name, "depot");
        assert_eq!(depots[0].depot_type, "local");

        assert_eq!(depots[1].name, "stream_depot");
        assert_eq!(depots[1].depot_type, "stream");

        assert_eq!(depots[2].name, "remote_depot");
        assert_eq!(depots[2].depot_type, "remote");
    }

    #[test]
    fn test_parse_sync_line_updating() {
        let line = "//depot/main/file.cpp#5 - updating C:\\workspace\\file.cpp";
        let result = parse_sync_line(line);
        assert!(result.is_some());
        let progress = result.unwrap();
        assert_eq!(progress.depot_path, "//depot/main/file.cpp");
        assert_eq!(progress.revision, 5);
        assert_eq!(progress.action, "updating");
        assert!(!progress.is_conflict);
    }

    #[test]
    fn test_parse_sync_line_adding() {
        let line = "//depot/main/newfile.cpp#1 - adding C:\\workspace\\newfile.cpp";
        let result = parse_sync_line(line);
        assert!(result.is_some());
        let progress = result.unwrap();
        assert_eq!(progress.depot_path, "//depot/main/newfile.cpp");
        assert_eq!(progress.revision, 1);
        assert_eq!(progress.action, "adding");
        assert!(!progress.is_conflict);
    }

    #[test]
    fn test_parse_sync_line_deleting() {
        let line = "//depot/main/oldfile.cpp#3 - deleting C:\\workspace\\oldfile.cpp";
        let result = parse_sync_line(line);
        assert!(result.is_some());
        let progress = result.unwrap();
        assert_eq!(progress.depot_path, "//depot/main/oldfile.cpp");
        assert_eq!(progress.revision, 3);
        assert_eq!(progress.action, "deleting");
        assert!(!progress.is_conflict);
    }

    #[test]
    fn test_parse_sync_line_conflict() {
        let line = "//depot/main/file.cpp#5 - can't clobber writable file C:\\workspace\\file.cpp";
        let result = parse_sync_line(line);
        assert!(result.is_some());
        let progress = result.unwrap();
        assert_eq!(progress.depot_path, "//depot/main/file.cpp");
        assert_eq!(progress.revision, 5);
        assert_eq!(progress.action, "can't clobber");
        assert!(progress.is_conflict);
    }

    #[test]
    fn test_parse_sync_line_invalid() {
        let line = "invalid line without hash";
        let result = parse_sync_line(line);
        assert!(result.is_none());
    }

    #[test]
    fn test_parse_reconcile_output() {
        let input = r#"C:\workspace\file1.cpp - opened for edit
//depot/main/file2.cpp#5 - opened for add
C:\workspace\file3.cpp - opened for delete
"#;
        let result = parse_reconcile_output(input);
        assert!(result.is_ok());
        let previews = result.unwrap();
        assert_eq!(previews.len(), 3);

        assert_eq!(previews[0].depot_path, "C:\\workspace\\file1.cpp");
        assert_eq!(previews[0].action, "edit");

        // Should strip revision specifier
        assert_eq!(previews[1].depot_path, "//depot/main/file2.cpp");
        assert_eq!(previews[1].action, "add");

        assert_eq!(previews[2].depot_path, "C:\\workspace\\file3.cpp");
        assert_eq!(previews[2].action, "delete");
    }
}

