use tauri::{AppHandle, Emitter, State};

use super::worker::run_blocking_result;
use crate::models::{JiraConnectionTestResult, JiraCreateIssuesResult, JiraProjectOption};
use crate::services::AppServices;

#[tauri::command]
pub async fn test_jira_connection(
    services: State<'_, AppServices>,
) -> Result<JiraConnectionTestResult, String> {
    let services = services.inner().clone();
    run_blocking_result("Jira connection worker", move || {
        Ok(services.test_jira_connection())
    })
    .await
}

#[tauri::command]
pub async fn test_jira_api_token(
    services: State<'_, AppServices>,
    token: String,
    site_url: Option<String>,
    account_email: Option<String>,
) -> Result<JiraConnectionTestResult, String> {
    let services = services.inner().clone();
    run_blocking_result("Jira connection worker", move || {
        Ok(services.test_jira_connection_with_api_token(
            &token,
            site_url.as_deref(),
            account_email.as_deref(),
        ))
    })
    .await
}

#[tauri::command]
pub async fn test_jira_connection_settings(
    services: State<'_, AppServices>,
    site_url: String,
    account_email: String,
) -> Result<JiraConnectionTestResult, String> {
    let services = services.inner().clone();
    run_blocking_result("Jira connection worker", move || {
        Ok(services.test_jira_connection_settings(&site_url, &account_email))
    })
    .await
}

#[tauri::command]
pub async fn list_jira_projects_for_connection(
    services: State<'_, AppServices>,
    site_url: String,
    account_email: String,
) -> Result<Vec<JiraProjectOption>, String> {
    let services = services.inner().clone();
    run_blocking_result("Jira project discovery worker", move || {
        services.list_jira_projects_for_connection(&site_url, &account_email)
    })
    .await
}

#[tauri::command]
pub async fn create_jira_parent_issues(
    app_handle: AppHandle,
    services: State<'_, AppServices>,
    tray_id: String,
    allow_missing_descriptions: bool,
    include_exported_tasks: bool,
    include_missing_description_tasks: bool,
) -> Result<JiraCreateIssuesResult, String> {
    let services = services.inner().clone();
    run_blocking_result("Jira creation worker", move || {
        services.create_jira_parent_issues_with_progress(
            &tray_id,
            allow_missing_descriptions,
            include_exported_tasks,
            include_missing_description_tasks,
            |progress| {
                let _ = app_handle.emit("jira-create-progress", progress);
            },
        )
    })
    .await
}
