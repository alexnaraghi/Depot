use serde::Serialize;

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

/// Streaming batch for p4_fstat_stream
/// Data variant contains file batches, Complete signals end of stream
#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum FstatStreamBatch {
    Data { files: Vec<P4FileInfo>, total_received: u32 },
    Complete { total_files: u32, success: bool, error: Option<String> },
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

/// Progress information for sync operation
#[derive(Clone, Serialize)]
pub struct SyncProgress {
    pub depot_path: String,
    pub action: String, // updating, adding, deleting, can't clobber
    pub revision: i32,
    pub is_conflict: bool,
}

/// Annotation line information from p4 annotate -u -c
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct P4AnnotationLine {
    pub line_number: i32,
    pub changelist_id: i32,
    pub user: String,
    pub date: String,
    pub line_content: String,
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

/// File info from p4 describe output
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct P4DescribeFile {
    pub depot_path: String,
    pub revision: i32,
    pub action: String,
    pub file_type: String,
}

/// Result of p4 describe for a submitted changelist
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct P4ChangelistDescription {
    pub id: i32,
    pub user: String,
    pub client: String,
    pub time: i64,
    pub description: String,
    pub status: String,
    pub files: Vec<P4DescribeFile>,
}

/// Reconcile preview information from p4 reconcile -n
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconcilePreview {
    pub depot_path: String,
    pub local_path: String,
    pub action: String,
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

/// Depot information from p4 depots
#[derive(Debug, Clone, Serialize)]
pub struct P4Depot {
    pub name: String,
    pub depot_type: String,
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
