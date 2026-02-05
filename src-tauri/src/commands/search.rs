use crate::file_index::{FileEntry, FileIndexState, SearchMode, SearchResult};
use tauri::State;

/// Search workspace files using the persistent index
#[tauri::command]
pub async fn search_workspace_files(
    query: String,
    mode: String,
    max_results: usize,
    state: State<'_, FileIndexState>,
) -> Result<Vec<SearchResult>, String> {
    let index = state.lock().await;

    let search_mode = match mode.as_str() {
        "exact" => SearchMode::Exact,
        _ => SearchMode::Fuzzy,
    };

    Ok(index.search(&query, search_mode, max_results))
}

/// Add files to the index (called from streaming fstat)
#[tauri::command]
pub async fn add_files_to_index(
    files: Vec<FileIndexEntry>,
    state: State<'_, FileIndexState>,
) -> Result<usize, String> {
    let mut index = state.lock().await;

    let entries: Vec<FileEntry> = files
        .into_iter()
        .map(|f| FileEntry {
            depot_path: f.depot_path,
            mod_time: f.mod_time,
        })
        .collect();

    index.add_batch(entries);

    Ok(index.len())
}

/// Clear the file index (called when workspace changes)
#[tauri::command]
pub async fn clear_file_index(state: State<'_, FileIndexState>) -> Result<(), String> {
    let mut index = state.lock().await;
    index.clear();
    Ok(())
}

/// Get current index size
#[tauri::command]
pub async fn get_file_index_count(state: State<'_, FileIndexState>) -> Result<usize, String> {
    let index = state.lock().await;
    Ok(index.len())
}

/// Input type for add_files_to_index command
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileIndexEntry {
    pub depot_path: String,
    pub mod_time: u64,
}
