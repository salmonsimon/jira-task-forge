use tauri::State;

use crate::models::AppSettings;
use crate::services::AppServices;

#[tauri::command]
pub fn get_app_settings(services: State<'_, AppServices>) -> Result<AppSettings, String> {
    services
        .get_app_settings()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_app_settings(
    services: State<'_, AppServices>,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    services
        .update_app_settings(settings)
        .map_err(|error| error.to_string())
}
