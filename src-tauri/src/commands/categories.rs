use tauri::State;

use super::worker::run_blocking_result;
use crate::area_catalog::{
    CatalogSyncResult, DeliveryFormatGateResult, NotionCatalogConnectionTestResult,
};
use crate::models::Category;
use crate::project_sync::{ProjectSyncApplyRequest, ProjectSyncReview};
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

#[tauri::command]
pub async fn test_notion_catalog_connection(
    services: State<'_, AppServices>,
    page_url_or_id: String,
) -> Result<NotionCatalogConnectionTestResult, String> {
    let services = services.inner().clone();
    run_blocking_result("Catalog sync worker", move || {
        services.test_notion_catalog_connection(&page_url_or_id)
    })
    .await
}

#[tauri::command]
pub async fn test_notion_catalog_connection_with_token(
    services: State<'_, AppServices>,
    page_url_or_id: String,
    token: String,
) -> Result<NotionCatalogConnectionTestResult, String> {
    let token = token.trim().to_string();
    if token.is_empty() {
        return Err("Notion integration token cannot be empty".to_string());
    }

    let services = services.inner().clone();
    run_blocking_result("Catalog sync worker", move || {
        services.test_notion_catalog_connection_with_token(&page_url_or_id, &token)
    })
    .await
}

#[tauri::command]
pub async fn sync_area_catalog_from_notion(
    services: State<'_, AppServices>,
    page_url_or_id: String,
) -> Result<CatalogSyncResult, String> {
    let services = services.inner().clone();
    run_blocking_result("Catalog sync worker", move || {
        services.sync_area_catalog_from_notion(&page_url_or_id)
    })
    .await
}

#[tauri::command]
pub fn resolve_delivery_format_gate(
    services: State<'_, AppServices>,
    area: String,
    description_or_deliverable: String,
) -> Result<DeliveryFormatGateResult, String> {
    services.resolve_delivery_format_gate(&area, &description_or_deliverable)
}

#[tauri::command]
pub async fn discover_project_sync_candidates(
    services: State<'_, AppServices>,
) -> Result<ProjectSyncReview, String> {
    let services = services.inner().clone();
    run_blocking_result("Project sync discovery worker", move || {
        services.discover_project_sync_candidates()
    })
    .await
}

#[tauri::command]
pub fn apply_project_sync_decisions(
    services: State<'_, AppServices>,
    request: ProjectSyncApplyRequest,
) -> Result<Vec<Category>, String> {
    services
        .apply_project_sync_decisions(request)
        .map_err(|error| error.to_string())
}
