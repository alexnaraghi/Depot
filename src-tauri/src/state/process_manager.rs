use std::collections::HashMap;
use std::process::Child;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

/// Tracks active p4.exe processes for cancellation and cleanup.
/// Uses tokio::sync::Mutex because we hold across await points.
/// Wrapped in Arc for cloning into event handlers.
#[derive(Clone)]
pub struct ProcessManager {
    processes: Arc<Mutex<HashMap<String, Child>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Register a process and return its tracking ID.
    pub async fn register(&self, child: Child) -> String {
        let id = Uuid::new_v4().to_string();
        let mut processes = self.processes.lock().await;
        processes.insert(id.clone(), child);
        id
    }

    /// Kill and remove a process by ID. Returns true if found and killed.
    pub async fn kill(&self, id: &str) -> Result<bool, String> {
        let mut processes = self.processes.lock().await;
        if let Some(mut child) = processes.remove(id) {
            // On Windows, child.kill() may not kill child processes.
            // Use taskkill for reliable tree killing.
            #[cfg(target_os = "windows")]
            {
                if let Some(pid) = child.id() {
                    let _ = std::process::Command::new("taskkill")
                        .args(["/F", "/T", "/PID", &pid.to_string()])
                        .output();
                }
            }
            child.kill().map_err(|e| e.to_string())?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Kill all tracked processes. Called on app close.
    pub async fn kill_all(&self) {
        let mut processes = self.processes.lock().await;
        for (_, mut child) in processes.drain() {
            #[cfg(target_os = "windows")]
            {
                if let Some(pid) = child.id() {
                    let _ = std::process::Command::new("taskkill")
                        .args(["/F", "/T", "/PID", &pid.to_string()])
                        .output();
                }
            }
            let _ = child.kill();
        }
    }

    /// Remove a process from tracking (when it completes naturally).
    pub async fn unregister(&self, id: &str) {
        let mut processes = self.processes.lock().await;
        processes.remove(id);
    }
}

impl Default for ProcessManager {
    fn default() -> Self {
        Self::new()
    }
}
