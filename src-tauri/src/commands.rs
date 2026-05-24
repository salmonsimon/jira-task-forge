use std::process::Command;
use tauri::State;

use crate::models::{
    AppSettings, JiraConnectionTestResult, JiraCreateIssuesResult, JqlSearchResponse, LocalTask,
    NewTask, NewTray, Tray,
};
use crate::services::AppServices;

const ATLASSIAN_API_TOKENS_URL: &str =
    "https://id.atlassian.com/manage-profile/security/api-tokens";

#[tauri::command]
pub fn create_tray(services: State<'_, AppServices>, name: String) -> Result<Tray, String> {
    services
        .create_tray(NewTray { name })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_trays(services: State<'_, AppServices>) -> Result<Vec<Tray>, String> {
    services.list_trays().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn rename_tray(
    services: State<'_, AppServices>,
    tray_id: String,
    name: String,
) -> Result<Option<Tray>, String> {
    services
        .rename_tray(&tray_id, &name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn archive_tray(
    services: State<'_, AppServices>,
    tray_id: String,
) -> Result<Option<Tray>, String> {
    services
        .archive_tray(&tray_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn restore_tray(
    services: State<'_, AppServices>,
    tray_id: String,
) -> Result<Option<Tray>, String> {
    services
        .restore_tray(&tray_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_tray(services: State<'_, AppServices>, tray_id: String) -> Result<bool, String> {
    services
        .delete_tray(&tray_id)
        .map_err(|error| error.to_string())
}

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

#[tauri::command]
pub async fn has_jira_api_token(services: State<'_, AppServices>) -> Result<bool, String> {
    let services = services.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        services
            .has_jira_api_token()
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| format!("Credential worker failed: {error}"))?
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
    tauri::async_runtime::spawn_blocking(move || {
        services
            .save_jira_api_token(&token)
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| format!("Credential worker failed: {error}"))?
}

#[tauri::command]
pub async fn delete_jira_api_token(services: State<'_, AppServices>) -> Result<(), String> {
    let services = services.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        services
            .delete_jira_api_token()
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| format!("Credential worker failed: {error}"))?
}

#[tauri::command]
pub async fn test_jira_connection(
    services: State<'_, AppServices>,
) -> Result<JiraConnectionTestResult, String> {
    let services = services.inner().clone();
    tauri::async_runtime::spawn_blocking(move || services.test_jira_connection())
        .await
        .map_err(|error| format!("Jira connection worker failed: {error}"))
}

#[tauri::command]
pub async fn run_jql_query(
    services: State<'_, AppServices>,
    jql: String,
    max_results: Option<usize>,
) -> Result<JqlSearchResponse, String> {
    let services = services.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        services.run_jql_query(&jql, max_results.unwrap_or(50))
    })
    .await
    .map_err(|error| format!("Jira JQL worker failed: {error}"))?
}

#[tauri::command]
pub async fn create_jira_parent_issues(
    services: State<'_, AppServices>,
    tray_id: String,
    allow_missing_descriptions: bool,
) -> Result<JiraCreateIssuesResult, String> {
    let services = services.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        services.create_jira_parent_issues(&tray_id, allow_missing_descriptions)
    })
    .await
    .map_err(|error| format!("Jira creation worker failed: {error}"))?
}

#[tauri::command]
pub fn create_task(
    services: State<'_, AppServices>,
    tray_id: String,
    project: String,
    area: String,
    title: String,
    priority: String,
    issue_type: String,
    content_language: String,
) -> Result<LocalTask, String> {
    services
        .create_task(NewTask {
            tray_id,
            project,
            area,
            title,
            priority,
            issue_type,
            content_language,
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_tasks(services: State<'_, AppServices>) -> Result<Vec<LocalTask>, String> {
    services.list_tasks().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_task(services: State<'_, AppServices>, task_id: String) -> Result<bool, String> {
    services
        .delete_task(&task_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_task_details(
    services: State<'_, AppServices>,
    task_id: String,
    project: String,
    area: String,
    title: String,
    priority: String,
    issue_type: String,
) -> Result<Option<LocalTask>, String> {
    let normalized_issue_type = if issue_type.trim().is_empty() {
        derive_issue_type_from_area(&area).to_string()
    } else {
        issue_type.trim().to_string()
    };

    services
        .update_task_details(
            &task_id,
            &project,
            &area,
            &title,
            &priority,
            &normalized_issue_type,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn mark_tasks_csv_exported(
    services: State<'_, AppServices>,
    task_ids: Vec<String>,
) -> Result<Vec<LocalTask>, String> {
    services
        .mark_tasks_csv_exported(&task_ids)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_recovery_tray_from_tasks(
    services: State<'_, AppServices>,
    source_tray_id: String,
    task_ids: Vec<String>,
) -> Result<Tray, String> {
    services.create_recovery_tray_from_tasks(&source_tray_id, &task_ids)
}

#[tauri::command]
pub fn save_csv_file(path: String, contents: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("CSV path cannot be empty".to_string());
    }

    std::fs::write(path, contents).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_atlassian_api_tokens_page() -> Result<(), String> {
    open_external_url(ATLASSIAN_API_TOKENS_URL)
}

fn open_external_url(url: &str) -> Result<(), String> {
    let mut command = platform_open_command(url)?;
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open browser: {error}"))
}

fn platform_open_command(url: &str) -> Result<Command, String> {
    if cfg!(target_os = "windows") {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", url]);
        return Ok(command);
    }

    if cfg!(target_os = "macos") {
        let mut command = Command::new("open");
        command.arg(url);
        return Ok(command);
    }

    if cfg!(target_os = "linux") {
        let mut command = Command::new("xdg-open");
        command.arg(url);
        return Ok(command);
    }

    Err("Opening external links is not supported on this platform.".to_string())
}

fn derive_issue_type_from_area(area: &str) -> &'static str {
    if area.trim().eq_ignore_ascii_case("bug") {
        "Bug"
    } else {
        "Story"
    }
}
