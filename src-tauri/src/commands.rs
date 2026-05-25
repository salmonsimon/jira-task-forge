use std::process::Command;
use tauri::{AppHandle, Emitter, State};

use crate::backup::{BackupExportResult, BackupImportResult};
use crate::models::{
    AppSettings, Category, JiraConnectionTestResult, JiraCreateIssuesResult, JqlAiDraft,
    JqlFavorite, JqlSearchResponse, LocalTask, NewTask, NewTray, SyncAuditEvent, Tray,
};
use crate::services::AppServices;

const ATLASSIAN_API_TOKENS_URL: &str =
    "https://id.atlassian.com/manage-profile/security/api-tokens";

async fn run_blocking_result<T, F>(worker_name: &str, work: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|error| format!("{worker_name} failed: {error}"))?
}

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
    let services = services.inner().clone();
    run_blocking_result("Credential worker", move || {
        services
            .has_openai_api_key()
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn save_openai_api_key(
    services: State<'_, AppServices>,
    api_key: String,
) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("OpenAI API key cannot be empty".to_string());
    }

    let services = services.inner().clone();
    run_blocking_result("Credential worker", move || {
        services
            .save_openai_api_key(&api_key)
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn delete_openai_api_key(services: State<'_, AppServices>) -> Result<(), String> {
    let services = services.inner().clone();
    run_blocking_result("Credential worker", move || {
        services
            .delete_openai_api_key()
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn test_openai_connection(services: State<'_, AppServices>) -> Result<String, String> {
    let services = services.inner().clone();
    run_blocking_result("OpenAI connection worker", move || {
        services.test_openai_connection()
    })
    .await
}

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

#[tauri::command]
pub async fn create_jira_parent_issues(
    app_handle: AppHandle,
    services: State<'_, AppServices>,
    tray_id: String,
    allow_missing_descriptions: bool,
) -> Result<JiraCreateIssuesResult, String> {
    let services = services.inner().clone();
    run_blocking_result("Jira creation worker", move || {
        services.create_jira_parent_issues_with_progress(
            &tray_id,
            allow_missing_descriptions,
            |progress| {
                let _ = app_handle.emit("jira-create-progress", progress);
            },
        )
    })
    .await
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
pub fn list_task_sync_audit_events(
    services: State<'_, AppServices>,
    task_id: String,
) -> Result<Vec<SyncAuditEvent>, String> {
    services
        .list_task_sync_audit_events(&task_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn export_backup(
    services: State<'_, AppServices>,
    path: String,
) -> Result<BackupExportResult, String> {
    services.export_backup_file(&path, Some(env!("CARGO_PKG_VERSION").to_string()))
}

#[tauri::command]
pub fn import_backup(
    services: State<'_, AppServices>,
    path: String,
) -> Result<BackupImportResult, String> {
    services.import_backup_file(&path)
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

#[tauri::command]
pub fn open_jira_issue_url(url: String) -> Result<(), String> {
    let url = validate_jira_issue_url(&url)?;
    open_external_url(&url)
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
        if is_wsl() {
            let mut command = Command::new("powershell.exe");
            command.args(["-NoProfile", "-Command", "Start-Process", "-FilePath", url]);
            return Ok(command);
        }

        let mut command = Command::new("xdg-open");
        command.arg(url);
        return Ok(command);
    }

    Err("Opening external links is not supported on this platform.".to_string())
}

fn is_wsl() -> bool {
    std::fs::read_to_string("/proc/sys/kernel/osrelease")
        .or_else(|_| std::fs::read_to_string("/proc/version"))
        .map(|contents| contents.to_ascii_lowercase().contains("microsoft"))
        .unwrap_or(false)
}

fn validate_jira_issue_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim();
    if !trimmed.starts_with("https://") {
        return Err("Jira issue URL must start with https://.".to_string());
    }
    if trimmed.chars().any(char::is_whitespace) {
        return Err("Jira issue URL must not include spaces.".to_string());
    }

    let rest = &trimmed["https://".len()..];
    let path_start = rest
        .find('/')
        .ok_or_else(|| "Jira issue URL must include a browse path.".to_string())?;
    let host = &rest[..path_start];
    let path = &rest[path_start..];

    if !host.ends_with(".atlassian.net") {
        return Err("Jira issue URL must use an Atlassian Cloud host.".to_string());
    }
    if !path.starts_with("/browse/") {
        return Err("Jira issue URL must point to a Jira issue browse path.".to_string());
    }
    let issue_key = &path["/browse/".len()..];
    if issue_key.is_empty()
        || issue_key.contains('/')
        || issue_key.contains('?')
        || issue_key.contains('#')
        || !issue_key.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
        || !issue_key.contains('-')
    {
        return Err("Jira issue URL must end with a Jira issue key.".to_string());
    }

    Ok(trimmed.to_string())
}

fn derive_issue_type_from_area(area: &str) -> &'static str {
    if area.trim().eq_ignore_ascii_case("bug") {
        "Bug"
    } else {
        "Story"
    }
}

#[cfg(test)]
mod tests {
    use super::{
        derive_issue_type_from_area, is_wsl, platform_open_command, save_csv_file,
        validate_jira_issue_url,
    };

    #[test]
    fn derives_bug_issue_type_only_from_bug_area() {
        assert_eq!(derive_issue_type_from_area("Bug"), "Bug");
        assert_eq!(derive_issue_type_from_area("  bug  "), "Bug");
        assert_eq!(derive_issue_type_from_area("Programacion"), "Story");
        assert_eq!(derive_issue_type_from_area("3D"), "Story");
        assert_eq!(derive_issue_type_from_area(""), "Story");
    }

    #[test]
    fn rejects_empty_csv_save_paths() {
        assert_eq!(
            save_csv_file("   ".to_string(), "summary".to_string())
                .expect_err("empty path should fail"),
            "CSV path cannot be empty"
        );
    }

    #[test]
    fn writes_csv_contents_to_selected_path() {
        let path =
            std::env::temp_dir().join(format!("jira-task-forge-csv-{}.csv", uuid::Uuid::new_v4()));

        save_csv_file(
            path.to_string_lossy().to_string(),
            "Summary,Issue Type\nTask,Story\n".to_string(),
        )
        .expect("csv saves");

        assert_eq!(
            std::fs::read_to_string(&path).expect("csv reads"),
            "Summary,Issue Type\nTask,Story\n"
        );
        std::fs::remove_file(path).expect("csv cleanup");
    }

    #[test]
    fn builds_platform_open_command_for_external_links() {
        let command = platform_open_command("https://example.test").expect("command builds");

        if cfg!(target_os = "windows") {
            assert_eq!(command.get_program(), "cmd");
            assert!(command.get_args().any(|arg| arg == "https://example.test"));
        } else if cfg!(target_os = "macos") {
            assert_eq!(command.get_program(), "open");
            assert!(command.get_args().any(|arg| arg == "https://example.test"));
        } else if cfg!(target_os = "linux") {
            if is_wsl() {
                assert_eq!(command.get_program(), "powershell.exe");
            } else {
                assert_eq!(command.get_program(), "xdg-open");
            }
            assert!(command.get_args().any(|arg| arg == "https://example.test"));
        }
    }

    #[test]
    fn validates_jira_issue_urls_before_opening() {
        assert_eq!(
            validate_jira_issue_url(" https://salmonsimondts.atlassian.net/browse/JTFTEST-1 ")
                .expect("url validates"),
            "https://salmonsimondts.atlassian.net/browse/JTFTEST-1"
        );
        assert_eq!(
            validate_jira_issue_url("https://example.com/browse/JTFTEST-1")
                .expect_err("non-atlassian host should fail"),
            "Jira issue URL must use an Atlassian Cloud host."
        );
        assert_eq!(
            validate_jira_issue_url("https://salmonsimondts.atlassian.net/jira/software")
                .expect_err("non-issue path should fail"),
            "Jira issue URL must point to a Jira issue browse path."
        );
        assert_eq!(
            validate_jira_issue_url("https://salmonsimondts.atlassian.net/browse/JTFTEST-1?x=1")
                .expect_err("query string should fail"),
            "Jira issue URL must end with a Jira issue key."
        );
    }
}
