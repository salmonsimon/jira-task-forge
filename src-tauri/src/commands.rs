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
