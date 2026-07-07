use tauri::State;

use super::worker::run_blocking_result;
use crate::models::{AssistedDescriptionDraft, EpicScopePluralSuggestion};
use crate::services::AppServices;

#[tauri::command]
pub async fn test_openai_connection(services: State<'_, AppServices>) -> Result<String, String> {
    test_ai_provider_connection(services).await
}

#[tauri::command]
pub async fn test_ai_provider_connection(
    services: State<'_, AppServices>,
) -> Result<String, String> {
    let services = services.inner().clone();
    run_blocking_result("AI provider connection worker", move || {
        services.test_ai_provider_connection()
    })
    .await
}

#[tauri::command]
pub async fn test_openai_api_key(
    services: State<'_, AppServices>,
    api_key: String,
) -> Result<String, String> {
    test_ai_provider_api_key(services, "OpenAI".to_string(), api_key).await
}

#[tauri::command]
pub async fn test_ai_provider_api_key(
    services: State<'_, AppServices>,
    ai_provider: String,
    api_key: String,
) -> Result<String, String> {
    let services = services.inner().clone();
    run_blocking_result("AI provider connection worker", move || {
        services.test_ai_provider_connection_with_api_key(&ai_provider, &api_key)
    })
    .await
}

#[tauri::command]
pub async fn list_ai_provider_models(
    services: State<'_, AppServices>,
    ai_provider: String,
    api_key: Option<String>,
) -> Result<Vec<String>, String> {
    let services = services.inner().clone();
    run_blocking_result("AI provider model list worker", move || {
        services.list_ai_provider_models(&ai_provider, api_key.as_deref())
    })
    .await
}

#[tauri::command]
pub async fn generate_task_description(
    services: State<'_, AppServices>,
    task_id: String,
    additional_context: Option<String>,
    delivery_format: Option<String>,
) -> Result<AssistedDescriptionDraft, String> {
    let services = services.inner().clone();
    run_blocking_result("Task description AI worker", move || {
        services.generate_task_description(
            &task_id,
            additional_context.as_deref(),
            delivery_format.as_deref(),
        )
    })
    .await
}

#[tauri::command]
pub async fn suggest_transversal_epic_scope(
    services: State<'_, AppServices>,
    epic_scope: String,
) -> Result<String, String> {
    let services = services.inner().clone();
    let suggestion: EpicScopePluralSuggestion =
        run_blocking_result("Transversal epic scope AI worker", move || {
            services.suggest_transversal_epic_scope(&epic_scope)
        })
        .await?;
    Ok(suggestion.scope)
}
