use std::sync::{Arc, Mutex};

use rusqlite::Connection;

use crate::backup::{
    export_backup, import_backup, BackupExportResult, BackupFile, BackupImportResult,
};
use crate::db::DbResult;
use crate::integrations::jira::{normalize_jira_site_url, JiraClient, JiraCredentials};
use crate::integrations::openai::{OpenAiClient, OpenAiCredentials};
use crate::jira_sync::JiraSyncRunner;
use crate::models::{
    AppSettings, Category, JiraConnectionTestResult, JiraCreateIssuesResult, JiraCreateProgress,
    JqlAiDraft, JqlFavorite, JqlSearchResponse, LocalTask, NewTask, NewTray, SyncAuditEvent, Tray,
};
use crate::repositories::{
    CategoryRepository, JqlFavoriteRepository, SettingsRepository, SyncRepository, TaskRepository,
    TrayRepository,
};

#[derive(Clone)]
pub struct AppServices {
    connection: Arc<Mutex<Connection>>,
}

const JIRA_CREDENTIAL_SERVICE: &str = "jira-task-forge:jira";
const JIRA_API_TOKEN_ACCOUNT: &str = "api-token";
const OPENAI_CREDENTIAL_SERVICE: &str = "jira-task-forge:openai";
const OPENAI_API_KEY_ACCOUNT: &str = "api-key";

impl AppServices {
    pub fn new(connection: Connection) -> Self {
        Self {
            connection: Arc::new(Mutex::new(connection)),
        }
    }

    pub fn create_tray(&self, new_tray: NewTray) -> DbResult<Tray> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TrayRepository::new(&connection).create(new_tray)
    }

    pub fn list_trays(&self) -> DbResult<Vec<Tray>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TrayRepository::new(&connection).list()
    }

    pub fn rename_tray(&self, tray_id: &str, name: &str) -> DbResult<Option<Tray>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TrayRepository::new(&connection).update_name(tray_id, name)
    }

    pub fn archive_tray(&self, tray_id: &str) -> DbResult<Option<Tray>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TrayRepository::new(&connection).archive(tray_id)
    }

    pub fn restore_tray(&self, tray_id: &str) -> DbResult<Option<Tray>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TrayRepository::new(&connection).restore(tray_id)
    }

    pub fn delete_tray(&self, tray_id: &str) -> DbResult<bool> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TrayRepository::new(&connection).delete(tray_id)
    }

    pub fn get_app_settings(&self) -> DbResult<AppSettings> {
        let connection = self.connection.lock().expect("database lock poisoned");
        SettingsRepository::new(&connection).get_app_settings()
    }

    pub fn update_app_settings(&self, settings: AppSettings) -> DbResult<AppSettings> {
        let connection = self.connection.lock().expect("database lock poisoned");
        SettingsRepository::new(&connection).update_app_settings(settings)
    }

    pub fn list_categories(&self, category_type: Option<&str>) -> DbResult<Vec<Category>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        CategoryRepository::new(&connection).list(category_type)
    }

    pub fn create_category(&self, category_type: &str, name: &str) -> DbResult<Category> {
        let connection = self.connection.lock().expect("database lock poisoned");
        CategoryRepository::new(&connection).create(category_type, name)
    }

    pub fn update_category(
        &self,
        id: &str,
        name: Option<&str>,
        hidden: Option<bool>,
    ) -> DbResult<Option<Category>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        CategoryRepository::new(&connection).update(id, name, hidden)
    }

    pub fn delete_category(&self, id: &str) -> DbResult<bool> {
        let connection = self.connection.lock().expect("database lock poisoned");
        CategoryRepository::new(&connection).delete(id)
    }

    pub fn list_jql_favorites(&self) -> DbResult<Vec<JqlFavorite>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        JqlFavoriteRepository::new(&connection).list()
    }

    pub fn create_jql_favorite(&self, name: &str, jql: &str) -> DbResult<JqlFavorite> {
        let connection = self.connection.lock().expect("database lock poisoned");
        JqlFavoriteRepository::new(&connection).create(name, jql)
    }

    pub fn update_jql_favorite(
        &self,
        id: &str,
        name: Option<&str>,
        jql: Option<&str>,
    ) -> DbResult<Option<JqlFavorite>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        JqlFavoriteRepository::new(&connection).update(id, name, jql)
    }

    pub fn delete_jql_favorite(&self, id: &str) -> DbResult<bool> {
        let connection = self.connection.lock().expect("database lock poisoned");
        JqlFavoriteRepository::new(&connection).delete(id)
    }

    pub fn has_jira_api_token(&self) -> Result<bool, keyring::Error> {
        let entry = keyring::Entry::new(JIRA_CREDENTIAL_SERVICE, JIRA_API_TOKEN_ACCOUNT)?;
        match entry.get_password() {
            Ok(_) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(error) => Err(error),
        }
    }

    pub fn save_jira_api_token(&self, token: &str) -> Result<(), keyring::Error> {
        let entry = keyring::Entry::new(JIRA_CREDENTIAL_SERVICE, JIRA_API_TOKEN_ACCOUNT)?;
        entry.set_password(token)?;
        entry.get_password()?;
        Ok(())
    }

    pub fn delete_jira_api_token(&self) -> Result<(), keyring::Error> {
        let entry = keyring::Entry::new(JIRA_CREDENTIAL_SERVICE, JIRA_API_TOKEN_ACCOUNT)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error),
        }
    }

    pub fn has_openai_api_key(&self) -> Result<bool, keyring::Error> {
        let entry = keyring::Entry::new(OPENAI_CREDENTIAL_SERVICE, OPENAI_API_KEY_ACCOUNT)?;
        match entry.get_password() {
            Ok(_) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(error) => Err(error),
        }
    }

    pub fn save_openai_api_key(&self, api_key: &str) -> Result<(), keyring::Error> {
        let entry = keyring::Entry::new(OPENAI_CREDENTIAL_SERVICE, OPENAI_API_KEY_ACCOUNT)?;
        entry.set_password(api_key.trim())?;
        entry.get_password()?;
        Ok(())
    }

    pub fn delete_openai_api_key(&self) -> Result<(), keyring::Error> {
        let entry = keyring::Entry::new(OPENAI_CREDENTIAL_SERVICE, OPENAI_API_KEY_ACCOUNT)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error),
        }
    }

    pub fn test_jira_connection(&self) -> JiraConnectionTestResult {
        let client = match self.jira_client() {
            Ok(client) => client,
            Err(message) => return failed_result(message),
        };

        match client.get_myself() {
            Ok(body) => JiraConnectionTestResult {
                ok: true,
                message: "Jira connection succeeded.".to_string(),
                account_display_name: body.display_name,
                account_email: body.email_address,
            },
            Err(message) => failed_result(message),
        }
    }

    pub fn run_jql_query(
        &self,
        jql: &str,
        max_results: usize,
    ) -> Result<JqlSearchResponse, String> {
        self.jira_client()?.search_jql(jql, max_results)
    }

    pub fn draft_jql_with_ai(&self, prompt: &str) -> Result<JqlAiDraft, String> {
        let settings = self
            .get_app_settings()
            .map_err(|error| format!("Could not load AI settings: {error}"))?;
        if settings.ai_provider != "OpenAI" {
            return Err("OpenAI provider must be selected before using Ask AI.".to_string());
        }

        let client = self.openai_client()?;
        client.draft_jql(
            openai_model_or_default(&settings.ai_model),
            prompt,
            Some(&settings.jira_creation_project_key),
        )
    }

    pub fn test_openai_connection(&self) -> Result<String, String> {
        let settings = self
            .get_app_settings()
            .map_err(|error| format!("Could not load AI settings: {error}"))?;
        if settings.ai_provider != "OpenAI" {
            return Err(
                "OpenAI provider must be selected before testing the connection.".to_string(),
            );
        }

        self.openai_client()?.test_connection()?;
        Ok("OpenAI connection succeeded.".to_string())
    }

    pub fn create_jira_parent_issues(
        &self,
        tray_id: &str,
        allow_missing_descriptions: bool,
    ) -> Result<JiraCreateIssuesResult, String> {
        self.create_jira_parent_issues_with_progress(tray_id, allow_missing_descriptions, |_| {})
    }

    pub fn create_jira_parent_issues_with_progress<F>(
        &self,
        tray_id: &str,
        allow_missing_descriptions: bool,
        report_progress: F,
    ) -> Result<JiraCreateIssuesResult, String>
    where
        F: FnMut(JiraCreateProgress),
    {
        let settings = self
            .get_app_settings()
            .map_err(|error| format!("Could not load Jira settings: {error}"))?;
        let creation_project_key = settings
            .jira_creation_project_key
            .trim()
            .to_ascii_uppercase();
        if creation_project_key.is_empty() {
            return Err("Jira creation project key is required.".to_string());
        }

        let mut client = self.jira_client()?;
        let connection = self.connection.lock().expect("database lock poisoned");
        JiraSyncRunner::new(&connection, &mut client, creation_project_key)
            .create_parent_issues_from_tray_with_progress(
                tray_id,
                allow_missing_descriptions,
                report_progress,
            )
    }

    pub fn create_task(&self, new_task: NewTask) -> DbResult<LocalTask> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TaskRepository::new(&connection).create(new_task)
    }

    pub fn list_tasks(&self) -> DbResult<Vec<LocalTask>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TaskRepository::new(&connection).list_all()
    }

    pub fn delete_task(&self, task_id: &str) -> DbResult<bool> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TaskRepository::new(&connection).delete(task_id)
    }

    pub fn update_task_details(
        &self,
        task_id: &str,
        project: &str,
        area: &str,
        title: &str,
        priority: &str,
        issue_type: &str,
    ) -> DbResult<Option<LocalTask>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TaskRepository::new(&connection)
            .update_details(task_id, project, area, title, priority, issue_type)
    }

    pub fn mark_tasks_csv_exported(&self, task_ids: &[String]) -> DbResult<Vec<LocalTask>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TaskRepository::new(&connection).mark_csv_exported(task_ids)
    }

    pub fn create_recovery_tray_from_tasks(
        &self,
        source_tray_id: &str,
        task_ids: &[String],
    ) -> Result<Tray, String> {
        if task_ids.is_empty() {
            return Err("No failed tasks were selected for recovery.".to_string());
        }

        let connection = self.connection.lock().expect("database lock poisoned");
        let tray_repository = TrayRepository::new(&connection);
        let source_tray = tray_repository
            .find_by_id(source_tray_id)
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "Source tray not found.".to_string())?;
        let recovery_tray = tray_repository
            .create(NewTray {
                name: format!("Recovery - {}", source_tray.name),
            })
            .map_err(|error| error.to_string())?;
        TaskRepository::new(&connection)
            .move_tasks_to_tray(task_ids, &recovery_tray.id)
            .map_err(|error| error.to_string())?;

        Ok(recovery_tray)
    }

    pub fn list_task_sync_audit_events(&self, task_id: &str) -> DbResult<Vec<SyncAuditEvent>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        SyncRepository::new(&connection).list_for_task(task_id)
    }

    pub fn export_backup_file(
        &self,
        path: &str,
        source_app_version: Option<String>,
    ) -> Result<BackupExportResult, String> {
        if path.trim().is_empty() {
            return Err("Backup path cannot be empty.".to_string());
        }

        let connection = self.connection.lock().expect("database lock poisoned");
        let backup =
            export_backup(&connection, source_app_version).map_err(|error| error.to_string())?;
        let result = BackupExportResult {
            path: path.to_string(),
            record_counts: backup.manifest.record_counts.clone(),
            secrets_included: backup.manifest.secrets_included,
        };
        let contents = serde_json::to_string_pretty(&backup)
            .map_err(|error| format!("Could not serialize backup: {error}"))?;
        std::fs::write(path, contents)
            .map_err(|error| format!("Could not write backup file: {error}"))?;
        Ok(result)
    }

    pub fn import_backup_file(&self, path: &str) -> Result<BackupImportResult, String> {
        if path.trim().is_empty() {
            return Err("Backup path cannot be empty.".to_string());
        }

        let contents = std::fs::read_to_string(path)
            .map_err(|error| format!("Could not read backup file: {error}"))?;
        let backup: BackupFile = serde_json::from_str(&contents)
            .map_err(|error| format!("Could not parse backup file: {error}"))?;
        let mut connection = self.connection.lock().expect("database lock poisoned");
        import_backup(&mut connection, backup).map_err(|error| error.to_string())
    }

    fn jira_client(&self) -> Result<JiraClient, String> {
        let settings = self
            .get_app_settings()
            .map_err(|error| format!("Could not load Jira settings: {error}"))?;
        let site_url = normalize_jira_site_url(&settings.jira_site_url)?;
        let account_email = settings.jira_account_email.trim();

        if account_email.is_empty() {
            return Err("Jira account email is required.".to_string());
        }

        let entry = keyring::Entry::new(JIRA_CREDENTIAL_SERVICE, JIRA_API_TOKEN_ACCOUNT)
            .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        let api_token = match entry.get_password() {
            Ok(token) => token,
            Err(keyring::Error::NoEntry) => {
                return Err("Save a Jira API token before testing the connection.".to_string())
            }
            Err(error) => return Err(format!("Could not read Jira API token: {error}")),
        };

        Ok(JiraClient::new(JiraCredentials {
            site_url,
            account_email: account_email.to_string(),
            api_token,
        }))
    }

    fn openai_client(&self) -> Result<OpenAiClient, String> {
        let api_key = self.openai_api_key()?;
        Ok(OpenAiClient::new(OpenAiCredentials { api_key }))
    }

    fn openai_api_key(&self) -> Result<String, String> {
        let entry = keyring::Entry::new(OPENAI_CREDENTIAL_SERVICE, OPENAI_API_KEY_ACCOUNT)
            .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        match entry.get_password() {
            Ok(api_key) if api_key.trim().is_empty() => {
                Err("OpenAI API key is empty. Save a new API key in Settings.".to_string())
            }
            Ok(api_key) => Ok(api_key.trim().to_string()),
            Err(keyring::Error::NoEntry) => Err("OpenAI API key is required.".to_string()),
            Err(error) => Err(format!("Could not read OpenAI API key: {error}")),
        }
    }
}

fn failed_result(message: impl Into<String>) -> JiraConnectionTestResult {
    JiraConnectionTestResult {
        ok: false,
        message: message.into(),
        account_display_name: None,
        account_email: None,
    }
}

fn openai_model_or_default(model: &str) -> &str {
    let model = model.trim();
    if model.is_empty() {
        "gpt-4.1"
    } else {
        model
    }
}

#[cfg(test)]
mod tests {
    use super::{failed_result, AppServices};
    use crate::db::open_in_memory_database;
    use crate::models::{AppSettings, NewTask, NewTray, TrayState};

    #[test]
    fn failed_connection_result_has_empty_account_fields() {
        assert_eq!(failed_result("nope").message, "nope");
        assert!(!failed_result("nope").ok);
        assert_eq!(failed_result("nope").account_display_name, None);
        assert_eq!(failed_result("nope").account_email, None);
    }

    #[test]
    fn manages_tray_lifecycle_through_services() {
        let services = AppServices::new(open_in_memory_database().expect("database opens"));

        let tray = services
            .create_tray(NewTray {
                name: "Service tray".to_string(),
            })
            .expect("tray creates");
        assert_eq!(
            services.list_trays().expect("trays list"),
            vec![tray.clone()]
        );

        let renamed = services
            .rename_tray(&tray.id, "Renamed service tray")
            .expect("tray renames")
            .expect("tray exists");
        assert_eq!(renamed.name, "Renamed service tray");

        let archived = services
            .archive_tray(&tray.id)
            .expect("tray archives")
            .expect("tray exists");
        assert_eq!(archived.state, TrayState::Archived);
        assert!(archived.archived_at.is_some());

        let restored = services
            .restore_tray(&tray.id)
            .expect("tray restores")
            .expect("tray exists");
        assert_eq!(restored.state, TrayState::Active);
        assert_eq!(restored.archived_at, None);

        assert!(services.delete_tray(&tray.id).expect("tray deletes"));
        assert!(services.list_trays().expect("trays list").is_empty());
    }

    #[test]
    fn manages_task_lifecycle_through_services() {
        let services = AppServices::new(open_in_memory_database().expect("database opens"));
        let tray = services
            .create_tray(NewTray {
                name: "Task service tray".to_string(),
            })
            .expect("tray creates");
        let task = services
            .create_task(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Service task".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");

        assert_eq!(
            services.list_tasks().expect("tasks list"),
            vec![task.clone()]
        );

        let updated = services
            .update_task_details(
                &task.id,
                "PilotLab",
                "Programacion",
                "Updated service task",
                "High",
                "Story",
            )
            .expect("task updates")
            .expect("task remains editable");
        assert_eq!(updated.project, "PilotLab");
        assert_eq!(updated.area, "Programacion");
        assert_eq!(updated.title, "Updated service task");
        assert_eq!(updated.priority, "High");
        assert_eq!(updated.issue_type, "Story");

        let exported = services
            .mark_tasks_csv_exported(std::slice::from_ref(&task.id))
            .expect("task marks exported");
        assert_eq!(exported.len(), 1);
        assert_eq!(exported[0].sync_status, "Exported");

        assert!(services.delete_task(&task.id).expect("task deletes"));
        assert!(services.list_tasks().expect("tasks list").is_empty());
    }

    #[test]
    fn creates_recovery_trays_by_moving_retryable_tasks() {
        let services = AppServices::new(open_in_memory_database().expect("database opens"));
        let source_tray = services
            .create_tray(NewTray {
                name: "Source".to_string(),
            })
            .expect("source tray creates");
        let retryable_task = services
            .create_task(NewTask {
                tray_id: source_tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Retry me".to_string(),
                priority: "High".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");

        assert_eq!(
            services
                .create_recovery_tray_from_tasks(&source_tray.id, &[])
                .expect_err("empty task list should fail"),
            "No failed tasks were selected for recovery."
        );

        let recovery_tray = services
            .create_recovery_tray_from_tasks(
                &source_tray.id,
                std::slice::from_ref(&retryable_task.id),
            )
            .expect("recovery tray creates");
        assert_eq!(recovery_tray.name, "Recovery - Source");

        let moved_task = services
            .list_tasks()
            .expect("tasks list")
            .into_iter()
            .find(|task| task.id == retryable_task.id)
            .expect("task remains");
        assert_eq!(moved_task.tray_id, recovery_tray.id);
    }

    #[test]
    fn reads_and_updates_settings_through_services() {
        let services = AppServices::new(open_in_memory_database().expect("database opens"));

        assert_eq!(
            services
                .get_app_settings()
                .expect("default settings load")
                .jira_creation_project_key,
            ""
        );

        let updated = services
            .update_app_settings(AppSettings {
                theme_mode: "system".to_string(),
                jira_site_url: "https://example.atlassian.net".to_string(),
                jira_account_email: "saimon@example.com".to_string(),
                jira_auth_method: "api-token".to_string(),
                jira_creation_project_key: "JTFTEST".to_string(),
                ai_provider: "OpenAI".to_string(),
                ai_model: "gpt-4.1".to_string(),
                default_content_language: "Spanish".to_string(),
            })
            .expect("settings update");

        assert_eq!(updated.jira_creation_project_key, "JTFTEST");
        assert_eq!(
            services
                .get_app_settings()
                .expect("settings reload")
                .jira_account_email,
            "saimon@example.com"
        );
    }

    #[test]
    fn returns_early_jira_errors_before_keyring_or_network_work() {
        let services = AppServices::new(open_in_memory_database().expect("database opens"));
        let tray = services
            .create_tray(NewTray {
                name: "Jira early errors".to_string(),
            })
            .expect("tray creates");

        assert_eq!(
            services
                .create_jira_parent_issues(&tray.id, true)
                .expect_err("missing project key should fail"),
            "Jira creation project key is required."
        );

        let connection_result = services.test_jira_connection();
        assert!(!connection_result.ok);
        assert_eq!(connection_result.message, "Jira account email is required.");

        assert_eq!(
            services
                .run_jql_query("project = JTFTEST", 50)
                .expect_err("missing email should fail"),
            "Jira account email is required."
        );

        services
            .update_app_settings(AppSettings {
                jira_creation_project_key: "JTFTEST".to_string(),
                ..AppSettings::default()
            })
            .expect("settings update");
        assert_eq!(
            services
                .create_jira_parent_issues(&tray.id, true)
                .expect_err("missing email should fail"),
            "Jira account email is required."
        );
    }
}
