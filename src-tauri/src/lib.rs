mod commands;
mod state;

use state::ProcessManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            commands::p4_list_workspaces,
            commands::p4_test_connection,
            commands::p4_create_change,
            commands::p4_delete_change,
            commands::p4_reopen,
            commands::p4_edit_change_description,
            commands::p4_filelog,
            commands::p4_print_to_file,
            commands::launch_diff_tool,
            commands::p4_changes_submitted,
            commands::p4_shelve,
            commands::p4_describe_shelved,
            commands::p4_unshelve,
            commands::p4_delete_shelf,
            commands::p4_reconcile_preview,
            commands::p4_reconcile_apply,
            commands::p4_resolve_preview,
            commands::p4_fstat_unresolved,
            commands::p4_resolve_accept,
            commands::launch_merge_tool,
            commands::p4_files,
            commands::p4_list_streams,
            commands::p4_get_client_spec,
            commands::p4_update_client_stream,
            commands::p4_dirs,
            commands::p4_depots,
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
