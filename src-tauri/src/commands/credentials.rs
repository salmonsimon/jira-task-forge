use tauri::State;

use super::worker::run_blocking_result;
use crate::area_catalog::NotionCatalogConnectionTestResult;
use crate::notion_oauth::NotionOAuthStartResult;
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

#[tauri::command]
pub async fn has_notion_integration_token(
    services: State<'_, AppServices>,
) -> Result<bool, String> {
    let services = services.inner().clone();
    run_blocking_result("Credential worker", move || {
        services.has_notion_integration_token()
    })
    .await
}

#[tauri::command]
pub async fn save_notion_integration_token(
    services: State<'_, AppServices>,
    token: String,
) -> Result<(), String> {
    let token = token.trim().to_string();
    if token.is_empty() {
        return Err("Notion integration token cannot be empty".to_string());
    }

    let services = services.inner().clone();
    run_blocking_result("Credential worker", move || {
        services.save_notion_integration_token(&token)
    })
    .await
}

#[tauri::command]
pub async fn delete_notion_integration_token(
    services: State<'_, AppServices>,
) -> Result<(), String> {
    let services = services.inner().clone();
    run_blocking_result("Credential worker", move || {
        services.delete_notion_integration_token()
    })
    .await
}

#[tauri::command]
pub async fn start_notion_oauth_connection(
    services: State<'_, AppServices>,
) -> Result<NotionOAuthStartResult, String> {
    let services = services.inner().clone();
    run_blocking_result("Credential worker", move || {
        services.start_notion_oauth_connection()
    })
    .await
}

#[tauri::command]
pub async fn complete_notion_oauth_connection(
    services: State<'_, AppServices>,
    authorization_code: String,
    state: String,
    page_url_or_id: String,
) -> Result<NotionCatalogConnectionTestResult, String> {
    let services = services.inner().clone();
    run_blocking_result("Credential worker", move || {
        services.complete_notion_oauth_connection(&authorization_code, &state, &page_url_or_id)
    })
    .await
}
