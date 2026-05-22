use tauri::State;

use crate::models::{LocalTask, NewTask, NewTray, Tray};
use crate::services::AppServices;

#[tauri::command]
pub fn create_tray(services: State<'_, AppServices>, name: String) -> Result<Tray, String> {
    services
        .create_tray(NewTray { name })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_trays(services: State<'_, AppServices>) -> Result<Vec<Tray>, String> {
    services.list_trays().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn rename_tray(
    services: State<'_, AppServices>,
    tray_id: String,
    name: String,
) -> Result<Option<Tray>, String> {
    services
        .rename_tray(&tray_id, &name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn archive_tray(
    services: State<'_, AppServices>,
    tray_id: String,
) -> Result<Option<Tray>, String> {
    services
        .archive_tray(&tray_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn restore_tray(
    services: State<'_, AppServices>,
    tray_id: String,
) -> Result<Option<Tray>, String> {
    services
        .restore_tray(&tray_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_tray(services: State<'_, AppServices>, tray_id: String) -> Result<bool, String> {
    services
        .delete_tray(&tray_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_task(
    services: State<'_, AppServices>,
    tray_id: String,
    project: String,
    area: String,
    title: String,
    priority: String,
    issue_type: String,
    content_language: String,
) -> Result<LocalTask, String> {
    services
        .create_task(NewTask {
            tray_id,
            project,
            area,
            title,
            priority,
            issue_type,
            content_language,
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_tasks(services: State<'_, AppServices>) -> Result<Vec<LocalTask>, String> {
    services.list_tasks().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_task(services: State<'_, AppServices>, task_id: String) -> Result<bool, String> {
    services
        .delete_task(&task_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn mark_tasks_csv_exported(
    services: State<'_, AppServices>,
    task_ids: Vec<String>,
) -> Result<Vec<LocalTask>, String> {
    services
        .mark_tasks_csv_exported(&task_ids)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_csv_file(path: String, contents: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("CSV path cannot be empty".to_string());
    }

    std::fs::write(path, contents).map_err(|error| error.to_string())
}
