use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use serde::Serialize;
use tauri::{AppHandle, ipc::Channel, State};

use crate::state::ProcessManager;

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

/// Get file status information for given paths
#[tauri::command]
pub async fn p4_fstat(paths: Vec<String>) -> Result<Vec<P4FileInfo>, String> {
    // Build command: p4 -ztag fstat <paths>
    let mut args = vec!["-ztag".to_string(), "fstat".to_string()];

    if paths.is_empty() {
        // Default to all files in workspace
        args.push("...".to_string());
    } else {
        args.extend(paths);
    }

    // Execute command
    let output = Command::new("p4")
        .args(&args)
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
pub async fn p4_opened() -> Result<Vec<P4FileInfo>, String> {
    // Execute: p4 -ztag opened
    let output = Command::new("p4")
        .args(&["-ztag", "opened"])
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
pub async fn p4_changes(status: Option<String>) -> Result<Vec<P4Changelist>, String> {
    // Build command: p4 -ztag changes -s <status> -u <user> -c <client>
    let mut args = vec!["-ztag".to_string(), "changes".to_string()];

    // Add status filter (default to pending)
    let status_filter = status.unwrap_or_else(|| "pending".to_string());
    args.push("-s".to_string());
    args.push(status_filter);

    // Filter by current user and client
    args.push("-u".to_string());
    args.push("$P4USER".to_string());  // p4 will expand this
    args.push("-c".to_string());
    args.push("$P4CLIENT".to_string());  // p4 will expand this

    // Execute command
    let output = Command::new("p4")
        .args(&args)
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
    app: AppHandle,
) -> Result<Vec<P4FileInfo>, String> {
    if paths.is_empty() {
        return Err("No paths provided".to_string());
    }

    // Build command: p4 edit -c <changelist> <paths>
    let mut args = vec!["edit".to_string()];

    if let Some(cl) = changelist {
        args.push("-c".to_string());
        args.push(cl.to_string());
    }

    args.extend(paths.clone());

    // Execute command
    let output = Command::new("p4")
        .args(&args)
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
    let file_info = if !opened_files.is_empty() {
        p4_fstat(opened_files.clone()).await?
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
    app: AppHandle,
) -> Result<Vec<String>, String> {
    if paths.is_empty() {
        return Err("No paths provided".to_string());
    }

    // Execute: p4 revert <paths>
    let mut args = vec!["revert".to_string()];
    args.extend(paths);

    let output = Command::new("p4")
        .args(&args)
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
#[tauri::command]
pub async fn p4_submit(
    changelist: i32,
    description: Option<String>,
    app: AppHandle,
) -> Result<i32, String> {
    // If description provided, update the changelist first
    if let Some(desc) = description {
        update_changelist_description(changelist, &desc)?;
    }

    // Execute: p4 submit -c <changelist>
    let output = Command::new("p4")
        .args(&["submit", "-c", &changelist.to_string()])
        .output()
        .map_err(|e| format!("Failed to execute p4 submit: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

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

    // Check for errors
    if !output.status.success() {
        return Err(stderr.to_string());
    }

    // Emit changelist-submitted event
    let _ = app.emit("changelist-submitted", serde_json::json!({
        "changelist": submitted_cl
    }));

    Ok(submitted_cl)
}

/// Update changelist description
fn update_changelist_description(changelist: i32, description: &str) -> Result<(), String> {
    // Get current changelist form
    let output = Command::new("p4")
        .args(&["change", "-o", &changelist.to_string()])
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
    let mut child = Command::new("p4")
        .args(&["change", "-i"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
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
#[tauri::command]
pub async fn p4_sync(
    paths: Vec<String>,
    on_progress: Channel<SyncProgress>,
    state: State<'_, ProcessManager>,
    app: AppHandle,
) -> Result<String, String> {
    // Build command: p4 sync <paths>
    let mut args = vec!["sync".to_string()];

    if paths.is_empty() {
        args.push("...".to_string());
    } else {
        args.extend(paths);
    }

    // Spawn process
    let mut child = Command::new("p4")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
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
                // Emit errors as conflict progress
                let _ = on_progress.send(SyncProgress {
                    depot_path: line.clone(),
                    action: "error".to_string(),
                    revision: 0,
                    is_conflict: true,
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
