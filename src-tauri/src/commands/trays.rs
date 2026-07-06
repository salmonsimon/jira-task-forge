use tauri::State;

use crate::models::{NewTray, Tray};
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
pub fn update_tray_epic_scopes(
    services: State<'_, AppServices>,
    tray_id: String,
    epic_scope: Option<String>,
    transversal_epic_scope: Option<String>,
) -> Result<Option<Tray>, String> {
    services
        .update_tray_epic_scopes(
            &tray_id,
            epic_scope.as_deref(),
            transversal_epic_scope.as_deref(),
        )
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
