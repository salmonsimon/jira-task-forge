use tauri::State;

use super::worker::run_blocking_result;
use crate::models::{JqlAiDraft, JqlFavorite, JqlSearchResponse};
use crate::services::AppServices;

#[tauri::command]
pub fn list_jql_favorites(services: State<'_, AppServices>) -> Result<Vec<JqlFavorite>, String> {
    services
        .list_jql_favorites()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_jql_favorite(
    services: State<'_, AppServices>,
    name: String,
    jql: String,
) -> Result<JqlFavorite, String> {
    services
        .create_jql_favorite(&name, &jql)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_jql_favorite(
    services: State<'_, AppServices>,
    id: String,
    name: Option<String>,
    jql: Option<String>,
) -> Result<Option<JqlFavorite>, String> {
    services
        .update_jql_favorite(&id, name.as_deref(), jql.as_deref())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_jql_favorite(services: State<'_, AppServices>, id: String) -> Result<bool, String> {
    services
        .delete_jql_favorite(&id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn run_jql_query(
    services: State<'_, AppServices>,
    jql: String,
    max_results: Option<usize>,
) -> Result<JqlSearchResponse, String> {
    let services = services.inner().clone();
    run_blocking_result("Jira JQL worker", move || {
        services.run_jql_query(&jql, max_results.unwrap_or(50))
    })
    .await
}

#[tauri::command]
pub async fn draft_jql_with_ai(
    services: State<'_, AppServices>,
    prompt: String,
) -> Result<JqlAiDraft, String> {
    let services = services.inner().clone();
    run_blocking_result("JQL AI worker", move || services.draft_jql_with_ai(&prompt)).await
}
