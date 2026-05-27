use tauri::State;

use super::worker::run_blocking_result;
use crate::services::AppServices;

#[tauri::command]
pub async fn has_jira_api_token(services: State<'_, AppServices>) -> Result<bool, String> {
    let services = services.inner().clone();
    run_blocking_result("Credential worker", move || {
        services
            .has_jira_api_token()
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn save_jira_api_token(
    services: State<'_, AppServices>,
    token: String,
) -> Result<(), String> {
    if token.trim().is_empty() {
        return Err("Jira API token cannot be empty".to_string());
    }

    let services = services.inner().clone();
    run_blocking_result("Credential worker", move || {
        services
            .save_jira_api_token(&token)
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn delete_jira_api_token(services: State<'_, AppServices>) -> Result<(), String> {
    let services = services.inner().clone();
    run_blocking_result("Credential worker", move || {
        services
            .delete_jira_api_token()
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn has_openai_api_key(services: State<'_, AppServices>) -> Result<bool, String> {
    has_ai_provider_api_key(services, "OpenAI".to_string()).await
}

#[tauri::command]
pub async fn has_ai_provider_api_key(
    services: State<'_, AppServices>,
    ai_provider: String,
) -> Result<bool, String> {
    let services = services.inner().clone();
    run_blocking_result("Credential worker", move || {
        services.has_ai_provider_api_key(&ai_provider)
    })
    .await
}

#[tauri::command]
pub async fn save_openai_api_key(
    services: State<'_, AppServices>,
    api_key: String,
) -> Result<(), String> {
    save_ai_provider_api_key(services, "OpenAI".to_string(), api_key).await
}

#[tauri::command]
pub async fn save_ai_provider_api_key(
    services: State<'_, AppServices>,
    ai_provider: String,
    api_key: String,
) -> Result<(), String> {
    let api_key = api_key.trim().to_string();
    if api_key.is_empty() {
        return Err("AI provider API key cannot be empty".to_string());
    }

    let services = services.inner().clone();
    run_blocking_result("Credential worker", move || {
        services.save_ai_provider_api_key(&ai_provider, &api_key)
    })
    .await
}

#[tauri::command]
pub async fn delete_openai_api_key(services: State<'_, AppServices>) -> Result<(), String> {
    delete_ai_provider_api_key(services, "OpenAI".to_string()).await
}

#[tauri::command]
pub async fn delete_ai_provider_api_key(
    services: State<'_, AppServices>,
    ai_provider: String,
) -> Result<(), String> {
    let services = services.inner().clone();
    run_blocking_result("Credential worker", move || {
        services.delete_ai_provider_api_key(&ai_provider)
    })
    .await
}
