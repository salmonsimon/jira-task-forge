use tauri::State;

use super::worker::run_blocking_result;
use crate::models::AssistedDescriptionDraft;
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
pub async fn generate_task_description(
    services: State<'_, AppServices>,
    task_id: String,
    additional_context: Option<String>,
) -> Result<AssistedDescriptionDraft, String> {
    let services = services.inner().clone();
    run_blocking_result("Task description AI worker", move || {
        services.generate_task_description(&task_id, additional_context.as_deref())
    })
    .await
}
