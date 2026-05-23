use std::sync::Mutex;

use rusqlite::Connection;

use crate::db::DbResult;
use crate::integrations::jira::{normalize_jira_site_url, JiraClient, JiraCredentials};
use crate::models::{
    AppSettings, JiraConnectionTestResult, JqlSearchResponse, LocalTask, NewTask, NewTray, Tray,
};
use crate::repositories::{SettingsRepository, TaskRepository, TrayRepository};

pub struct AppServices {
    connection: Mutex<Connection>,
}

const JIRA_CREDENTIAL_SERVICE: &str = "jira-task-forge:jira";
const JIRA_API_TOKEN_ACCOUNT: &str = "api-token";

impl AppServices {
    pub fn new(connection: Connection) -> Self {
        Self {
            connection: Mutex::new(connection),
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
}

fn failed_result(message: impl Into<String>) -> JiraConnectionTestResult {
    JiraConnectionTestResult {
        ok: false,
        message: message.into(),
        account_display_name: None,
        account_email: None,
    }
}

#[cfg(test)]
mod tests {
    use super::failed_result;

    #[test]
    fn failed_connection_result_has_empty_account_fields() {
        assert_eq!(failed_result("nope").message, "nope");
        assert!(!failed_result("nope").ok);
        assert_eq!(failed_result("nope").account_display_name, None);
        assert_eq!(failed_result("nope").account_email, None);
    }
}
