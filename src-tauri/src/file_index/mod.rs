pub mod search;

use std::sync::Arc;
use tokio::sync::Mutex;
pub use search::{SearchMode, SearchResult};

/// Entry in the file index: depot path + modification timestamp (unix seconds)
#[derive(Clone)]
pub struct FileEntry {
    pub depot_path: String,
    pub mod_time: u64,
}

/// Persistent file index for workspace search
pub struct FileIndex {
    files: Vec<FileEntry>,
}

impl FileIndex {
    pub fn new() -> Self {
        Self { files: Vec::new() }
    }

    /// Add a batch of files to the index
    pub fn add_batch(&mut self, entries: Vec<FileEntry>) {
        self.files.extend(entries);
    }

    /// Clear all entries (before workspace reload)
    pub fn clear(&mut self) {
        self.files.clear();
    }

    /// Get current file count
    pub fn len(&self) -> usize {
        self.files.len()
    }

    pub fn is_empty(&self) -> bool {
        self.files.is_empty()
    }

    /// Get reference to files for searching
    pub fn files(&self) -> &[FileEntry] {
        &self.files
    }
}

impl Default for FileIndex {
    fn default() -> Self {
        Self::new()
    }
}

/// Thread-safe state wrapper for Tauri
pub type FileIndexState = Arc<Mutex<FileIndex>>;

pub fn create_file_index_state() -> FileIndexState {
    Arc::new(Mutex::new(FileIndex::new()))
}
