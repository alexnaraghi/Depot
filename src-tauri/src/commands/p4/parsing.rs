use std::collections::HashMap;

use super::types::*;

/// Apply optional connection args to a p4 Command.
/// When explicit args are provided, overrides P4 environment variables
/// and clears P4CONFIG to ensure complete isolation from DVCS/local config.
pub(super) fn apply_connection_args(
    cmd: &mut std::process::Command,
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
pub(super) fn parse_ztag_records(output: &str) -> Vec<HashMap<String, String>> {
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

/// Parse p4 -ztag info output into P4ClientInfo
pub(super) fn parse_ztag_info(output: &str) -> Result<P4ClientInfo, String> {
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

/// Parse p4 -ztag fstat output into P4FileInfo structs
pub(super) fn parse_ztag_fstat(output: &str) -> Result<Vec<P4FileInfo>, String> {
    let files = parse_ztag_records(output)
        .into_iter()
        .filter_map(|record| build_file_info(&record))
        .collect();
    Ok(files)
}

/// Build P4FileInfo from parsed ztag fields
pub(super) fn build_file_info(fields: &HashMap<String, String>) -> Option<P4FileInfo> {
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
pub(super) fn derive_file_status(action: &Option<String>, have_rev: i32, head_rev: i32) -> String {
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

/// Parse p4 -ztag changes output into P4Changelist structs
pub(super) fn parse_ztag_changes(output: &str) -> Result<Vec<P4Changelist>, String> {
    let changelists = parse_ztag_records(output)
        .into_iter()
        .filter_map(|record| build_changelist(&record))
        .collect();
    Ok(changelists)
}

/// Build P4Changelist from parsed ztag fields
pub(super) fn build_changelist(fields: &HashMap<String, String>) -> Option<P4Changelist> {
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

/// Parse p4 sync output line into SyncProgress
pub(super) fn parse_sync_line(line: &str) -> Option<SyncProgress> {
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

/// Parse p4 -ztag clients output into P4Workspace structs
pub(super) fn parse_ztag_clients(output: &str) -> Result<Vec<P4Workspace>, String> {
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

/// Parse p4 -ztag filelog output into P4Revision structs
/// Note: p4 filelog -ztag produces indexed fields like rev0, change0, action0, etc.
/// all in a single record
pub(super) fn parse_ztag_filelog(output: &str) -> Result<Vec<P4Revision>, String> {
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

/// Parse p4 annotate -u -c output into P4AnnotationLine structs
/// Output format: "CL#: USER DATE CONTENT"
/// Example: "320: mjones 2017/05/06 sr->w.digest.Clear();"
pub(super) fn parse_annotate_output(output: &str) -> Result<Vec<P4AnnotationLine>, String> {
    use regex::Regex;

    let re = Regex::new(r"^(\d+):\s+(\S+)\s+(\d{4}/\d{2}/\d{2})\s+(.*)$")
        .map_err(|e| format!("Failed to compile regex: {}", e))?;

    let mut annotations = Vec::new();
    let mut line_number = 1;

    for line in output.lines() {
        if let Some(captures) = re.captures(line) {
            let changelist_id = captures[1]
                .parse::<i32>()
                .map_err(|e| format!("Failed to parse changelist ID: {}", e))?;
            let user = captures[2].to_string();
            let date = captures[3].to_string();
            let line_content = captures[4].to_string();

            annotations.push(P4AnnotationLine {
                line_number,
                changelist_id,
                user,
                date,
                line_content,
            });

            line_number += 1;
        } else if !line.trim().is_empty() {
            // Handle lines that don't match the pattern (possibly errors or empty lines)
            // Skip silently to handle edge cases gracefully
            continue;
        }
    }

    Ok(annotations)
}

/// Parse p4 -ztag describe -S output into P4ShelvedFile structs
/// Similar to filelog parsing - uses indexed fields (depotFile0, action0, type0, rev0, etc.)
pub(super) fn parse_ztag_describe_shelved(output: &str) -> Result<Vec<P4ShelvedFile>, String> {
    let records = parse_ztag_records(output);
    // p4 describe output can split into multiple records due to blank lines in description fields.
    // Merge all records into one since they all describe the same changelist.
    let mut fields = HashMap::new();
    for record in records {
        fields.extend(record);
    }

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

/// Parse p4 describe -ztag output into P4ChangelistDescription
/// The output contains numbered fields for each file:
/// depotFile0, rev0, action0, type0, depotFile1, rev1, action1, type1, ...
pub(super) fn parse_describe_output(output: &str, changelist_id: i32) -> Result<P4ChangelistDescription, String> {
    let records = parse_ztag_records(output);

    if records.is_empty() {
        return Err(format!("No data returned for changelist {}", changelist_id));
    }

    // p4 describe output can split into multiple records due to blank lines in description fields.
    // Merge all records into one since they all describe the same changelist.
    let mut record = HashMap::new();
    for r in &records {
        record.extend(r.iter().map(|(k, v)| (k.clone(), v.clone())));
    }

    // Extract basic metadata
    let user = record.get("user").cloned().unwrap_or_default();
    let client = record.get("client").cloned().unwrap_or_default();
    let time_str = record.get("time").cloned().unwrap_or_default();
    let time = time_str.parse::<i64>().unwrap_or(0);
    let description = record.get("desc").cloned().unwrap_or_default();
    let status = record.get("status").cloned().unwrap_or_else(|| "submitted".to_string());

    // Extract files from numbered fields
    let mut files = Vec::new();
    let mut index = 0;

    loop {
        let depot_file_key = format!("depotFile{}", index);
        let rev_key = format!("rev{}", index);
        let action_key = format!("action{}", index);
        let type_key = format!("type{}", index);

        if let Some(depot_path) = record.get(&depot_file_key) {
            let revision = record
                .get(&rev_key)
                .and_then(|r| r.parse::<i32>().ok())
                .unwrap_or(0);
            let action = record.get(&action_key).cloned().unwrap_or_default();
            let file_type = record.get(&type_key).cloned().unwrap_or_default();

            files.push(P4DescribeFile {
                depot_path: depot_path.clone(),
                revision,
                action,
                file_type,
            });
            index += 1;
        } else {
            break;
        }
    }

    Ok(P4ChangelistDescription {
        id: changelist_id,
        user,
        client,
        time,
        description,
        status,
        files,
    })
}

/// Parse p4 reconcile -n output into ReconcilePreview structs
/// Output format: "<path> - opened for <action>"
pub(super) fn parse_reconcile_output(output: &str) -> Result<Vec<ReconcilePreview>, String> {
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

/// Parse p4 -ztag streams output into P4Stream structs
pub(super) fn parse_ztag_streams(output: &str) -> Result<Vec<P4Stream>, String> {
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

/// Parse p4 -ztag client -o output into P4ClientSpec
pub(super) fn parse_ztag_client_spec(output: &str) -> Result<P4ClientSpec, String> {
    let records = parse_ztag_records(output);
    let fields = records.into_iter().next().unwrap_or_default();

    // Case-insensitive field lookup helper
    let get_field = |name: &str| -> Option<String> {
        fields.get(name).cloned().or_else(|| {
            let lower = name.to_lowercase();
            fields.iter()
                .find(|(k, _)| k.to_lowercase() == lower)
                .map(|(_, v)| v.clone())
        })
    };

    // Extract View mapping lines (View0, View1, View2, ...) from the flat record
    let mut view_lines: Vec<String> = Vec::new();
    let mut view_idx = 0;
    loop {
        let key = format!("View{}", view_idx);
        if let Some(value) = get_field(&key) {
            view_lines.push(value);
            view_idx += 1;
        } else {
            break;
        }
    }

    let client = get_field("Client").ok_or("Missing Client field")?;
    let root = get_field("Root").unwrap_or_default();  // Optional for virtual-root workspaces
    let stream = get_field("Stream");
    let owner = get_field("Owner").ok_or("Missing Owner field")?;
    let description = get_field("Description").unwrap_or_default();
    let options = get_field("Options").unwrap_or_default();
    let host = get_field("Host").unwrap_or_default();
    let submit_options = get_field("SubmitOptions")
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

/// Parse p4 -ztag depots output into P4Depot structs
pub(super) fn parse_ztag_depots(output: &str) -> Result<Vec<P4Depot>, String> {
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

/// Parse p4 -ztag dirs output into directory paths
pub(super) fn parse_ztag_dirs(output: &str) -> Result<Vec<String>, String> {
    let dirs = parse_ztag_records(output)
        .into_iter()
        .filter_map(|record| record.get("dir").cloned())
        .collect();
    Ok(dirs)
}

/// Parse p4 -ztag fstat -Ru -Or output into P4UnresolvedFile structs
pub(super) fn parse_ztag_fstat_unresolved(output: &str) -> Result<Vec<P4UnresolvedFile>, String> {
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

/// Update changelist description (used by submit and edit_change_description)
pub(super) fn update_changelist_description(
    changelist: i32,
    description: &str,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<(), String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

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
