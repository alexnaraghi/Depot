use std::collections::HashMap;
use std::process::Command;
use serde::Serialize;
use tauri::AppHandle;

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
