mod backup;
mod commands;
mod db;
mod integrations;
mod jira_sync;
mod models;
mod redaction;
mod repositories;
mod services;
mod sync_audit;

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
            commands::trays::create_tray,
            commands::trays::list_trays,
            commands::trays::rename_tray,
            commands::trays::archive_tray,
            commands::trays::restore_tray,
            commands::trays::delete_tray,
            commands::settings::get_app_settings,
            commands::settings::update_app_settings,
            commands::categories::list_categories,
            commands::categories::create_category,
            commands::categories::update_category,
            commands::categories::delete_category,
            commands::jql::list_jql_favorites,
            commands::jql::create_jql_favorite,
            commands::jql::update_jql_favorite,
            commands::jql::delete_jql_favorite,
            commands::credentials::has_jira_api_token,
            commands::credentials::save_jira_api_token,
            commands::credentials::delete_jira_api_token,
            commands::credentials::has_openai_api_key,
            commands::credentials::has_ai_provider_api_key,
            commands::credentials::save_openai_api_key,
            commands::credentials::save_ai_provider_api_key,
            commands::credentials::delete_openai_api_key,
            commands::credentials::delete_ai_provider_api_key,
            commands::ai::test_openai_connection,
            commands::ai::test_ai_provider_connection,
            commands::ai::test_openai_api_key,
            commands::ai::test_ai_provider_api_key,
            commands::jira::test_jira_connection,
            commands::jira::test_jira_api_token,
            commands::jql::run_jql_query,
            commands::jql::draft_jql_with_ai,
            commands::ai::generate_task_description,
            commands::jira::create_jira_parent_issues,
            commands::tasks::create_task,
            commands::tasks::create_subtask,
            commands::tasks::list_tasks,
            commands::tasks::delete_task,
            commands::tasks::update_task_details,
            commands::tasks::update_task_description,
            commands::tasks::mark_tasks_csv_exported,
            commands::tasks::create_recovery_tray_from_tasks,
            commands::tasks::list_task_sync_audit_events,
            commands::backup::export_backup,
            commands::backup::import_backup,
            commands::backup::save_csv_file,
            commands::external_links::open_atlassian_api_tokens_page,
            commands::external_links::open_ai_provider_api_keys_page,
            commands::external_links::open_jira_issue_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running Jira Task Forge");
}

fn main() {
    run();
}
