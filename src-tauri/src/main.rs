mod commands;
mod db;
mod models;
mod repositories;
mod services;

use services::AppServices;
use tauri::Manager;

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| format!("failed to resolve app data directory: {error}"))?;
            let connection = db::open_app_database(&app_data_dir)
                .map_err(|error| format!("failed to open app database: {error}"))?;

            app.manage(AppServices::new(connection));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_version,
            commands::create_tray,
            commands::list_trays,
            commands::rename_tray,
            commands::archive_tray,
            commands::restore_tray,
            commands::delete_tray,
            commands::get_app_settings,
            commands::update_app_settings,
            commands::has_jira_api_token,
            commands::save_jira_api_token,
            commands::delete_jira_api_token,
            commands::test_jira_connection,
            commands::create_task,
            commands::list_tasks,
            commands::delete_task,
            commands::update_task_details,
            commands::mark_tasks_csv_exported,
            commands::save_csv_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Jira Task Forge");
}

fn main() {
    run();
}
