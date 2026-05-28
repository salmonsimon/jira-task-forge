use tauri::{AppHandle, Emitter, State};

use super::worker::run_blocking_result;
use crate::models::{JiraConnectionTestResult, JiraCreateIssuesResult};
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
) -> Result<JiraConnectionTestResult, String> {
    let services = services.inner().clone();
    run_blocking_result("Jira connection worker", move || {
        Ok(services.test_jira_connection_with_api_token(&token))
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
