use tauri::State;

use crate::area_catalog::CatalogSyncResult;
use crate::models::Category;
use crate::services::AppServices;

#[tauri::command]
pub fn list_categories(
    services: State<'_, AppServices>,
    category_type: Option<String>,
) -> Result<Vec<Category>, String> {
    services
        .list_categories(category_type.as_deref())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_category(
    services: State<'_, AppServices>,
    category_type: String,
    name: String,
) -> Result<Category, String> {
    services
        .create_category(&category_type, &name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_category(
    services: State<'_, AppServices>,
    id: String,
    name: Option<String>,
    hidden: Option<bool>,
) -> Result<Option<Category>, String> {
    services
        .update_category(&id, name.as_deref(), hidden)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_category(services: State<'_, AppServices>, id: String) -> Result<bool, String> {
    services
        .delete_category(&id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn sync_area_catalog(services: State<'_, AppServices>) -> Result<Vec<Category>, String> {
    services
        .sync_area_catalog()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn sync_area_catalog_from_source(
    services: State<'_, AppServices>,
    source_url: String,
) -> Result<CatalogSyncResult, String> {
    services.sync_area_catalog_from_source(&source_url)
}
