use std::sync::Mutex;

use base64::Engine;
use rusqlite::Connection;
use serde::Deserialize;

use crate::db::DbResult;
use crate::models::{AppSettings, JiraConnectionTestResult, LocalTask, NewTask, NewTray, Tray};
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
        let settings = match self.get_app_settings() {
            Ok(settings) => settings,
            Err(error) => return failed_result(format!("Could not load Jira settings: {error}")),
        };
        let site_url = match normalize_jira_site_url(&settings.jira_site_url) {
            Ok(site_url) => site_url,
            Err(message) => return failed_result(message),
        };
        let account_email = settings.jira_account_email.trim();

        if account_email.is_empty() {
            return failed_result("Jira account email is required.");
        }

        let entry = match keyring::Entry::new(JIRA_CREDENTIAL_SERVICE, JIRA_API_TOKEN_ACCOUNT) {
            Ok(entry) => entry,
            Err(error) => {
                return failed_result(format!("Could not open OS credential store: {error}"))
            }
        };
        let token = match entry.get_password() {
            Ok(token) => token,
            Err(keyring::Error::NoEntry) => {
                return failed_result("Save a Jira API token before testing the connection.")
            }
            Err(error) => return failed_result(format!("Could not read Jira API token: {error}")),
        };

        let credentials =
            base64::engine::general_purpose::STANDARD.encode(format!("{account_email}:{token}"));
        let request_url = format!("{site_url}/rest/api/3/myself");
        let response = ureq::get(&request_url)
            .set("Accept", "application/json")
            .set("Authorization", &format!("Basic {credentials}"))
            .timeout(std::time::Duration::from_secs(15))
            .call();

        match response {
            Ok(response) => match response.into_json::<JiraMyselfResponse>() {
                Ok(body) => JiraConnectionTestResult {
                    ok: true,
                    message: "Jira connection succeeded.".to_string(),
                    account_display_name: body.display_name,
                    account_email: body.email_address,
                },
                Err(error) => failed_result(format!(
                    "Jira responded with an unexpected payload. Check that the site URL is the Jira Cloud site root, for example https://your-site.atlassian.net. Details: {error}"
                )),
            },
            Err(ureq::Error::Status(401, _)) | Err(ureq::Error::Status(403, _)) => {
                failed_result("Jira rejected the email or API token.")
            }
            Err(ureq::Error::Status(status, _)) => {
                failed_result(format!("Jira returned HTTP {status}."))
            }
            Err(error) => failed_result(format!("Could not reach Jira: {error}")),
        }
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
        priority: &str,
        issue_type: &str,
    ) -> DbResult<Option<LocalTask>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TaskRepository::new(&connection)
            .update_details(task_id, project, area, priority, issue_type)
    }

    pub fn mark_tasks_csv_exported(&self, task_ids: &[String]) -> DbResult<Vec<LocalTask>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TaskRepository::new(&connection).mark_csv_exported(task_ids)
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JiraMyselfResponse {
    display_name: Option<String>,
    email_address: Option<String>,
}

fn normalize_jira_site_url(raw_site_url: &str) -> Result<String, String> {
    let trimmed = raw_site_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("Jira site URL is required.".to_string());
    }
    if !trimmed.starts_with("https://") {
        return Err("Jira site URL must start with https://.".to_string());
    }

    let rest = &trimmed["https://".len()..];
    let host_end = rest
        .find(|character| matches!(character, '/' | '?' | '#'))
        .unwrap_or(rest.len());
    let host = &rest[..host_end];

    if host.is_empty() {
        return Err("Jira site URL must include a host.".to_string());
    }
    if host.chars().any(char::is_whitespace) {
        return Err("Jira site URL must not include spaces.".to_string());
    }

    Ok(format!("https://{}", host.to_ascii_lowercase()))
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
    use super::normalize_jira_site_url;

    #[test]
    fn normalizes_jira_cloud_urls_to_site_root() {
        assert_eq!(
            normalize_jira_site_url(
                "https://salmonsimondts.atlassian.net/jira/software/projects/STT/boards/1"
            )
            .expect("url should normalize"),
            "https://salmonsimondts.atlassian.net"
        );
        assert_eq!(
            normalize_jira_site_url("  https://SALMONSIMONDTS.atlassian.net/  ")
                .expect("url should normalize"),
            "https://salmonsimondts.atlassian.net"
        );
    }

    #[test]
    fn rejects_non_https_jira_urls() {
        assert_eq!(
            normalize_jira_site_url("http://salmonsimondts.atlassian.net")
                .expect_err("http should fail"),
            "Jira site URL must start with https://."
        );
    }
}
