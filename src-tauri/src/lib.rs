mod commands;
mod state;

use state::ProcessManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(ProcessManager::new())
        .invoke_handler(tauri::generate_handler![
            commands::spawn_p4_command,
            commands::p4_command,
            commands::kill_process,
            commands::kill_all_processes,
            commands::p4_info,
            commands::p4_fstat,
            commands::p4_opened,
            commands::p4_changes,
            commands::p4_edit,
            commands::p4_revert,
            commands::p4_submit,
            commands::p4_sync,
        ])
        .setup(|app| {
            // Get process manager for cleanup
            let process_manager = app.state::<ProcessManager>();
            let pm = process_manager.inner().clone();

            // Listen for window close to cleanup processes
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        // Kill all tracked processes synchronously
                        // Use block_on since this is a sync callback
                        let pm_clone = pm.clone();
                        tauri::async_runtime::block_on(async move {
                            pm_clone.kill_all().await;
                        });
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
