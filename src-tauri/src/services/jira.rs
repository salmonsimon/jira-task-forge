use super::credentials::{JIRA_API_TOKEN_ACCOUNT, JIRA_CREDENTIAL_SERVICE};
use super::AppServices;
use crate::integrations::jira::{normalize_jira_site_url, JiraClient, JiraCredentials};
use crate::jira_sync::JiraSyncRunner;
use crate::models::{JiraConnectionTestResult, JiraCreateIssuesResult, JiraCreateProgress};

impl AppServices {
    pub fn test_jira_connection(&self) -> JiraConnectionTestResult {
        let client = match self.jira_client() {
            Ok(client) => client,
            Err(message) => return failed_result(message),
        };

        self.test_jira_client(client)
    }

    pub fn test_jira_connection_with_api_token(&self, token: &str) -> JiraConnectionTestResult {
        let token = token.trim();
        if token.is_empty() {
            return failed_result("Jira API token cannot be empty.");
        }

        let client = match self.jira_client_with_api_token(token) {
            Ok(client) => client,
            Err(message) => return failed_result(message),
        };

        self.test_jira_client(client)
    }

    fn test_jira_client(&self, client: JiraClient) -> JiraConnectionTestResult {
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

    pub fn create_jira_parent_issues(
        &self,
        tray_id: &str,
        allow_missing_descriptions: bool,
        include_exported_tasks: bool,
        include_missing_description_tasks: bool,
    ) -> Result<JiraCreateIssuesResult, String> {
        self.create_jira_parent_issues_with_progress(
            tray_id,
            allow_missing_descriptions,
            include_exported_tasks,
            include_missing_description_tasks,
            |_| {},
        )
    }

    pub fn create_jira_parent_issues_with_progress<F>(
        &self,
        tray_id: &str,
        allow_missing_descriptions: bool,
        include_exported_tasks: bool,
        include_missing_description_tasks: bool,
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
        let connection = self.connection();
        JiraSyncRunner::new(&connection, &mut client, creation_project_key)
            .with_app_data_dir(self.app_data_dir().to_path_buf())
            .create_parent_issues_from_tray_with_progress(
                tray_id,
                allow_missing_descriptions,
                include_exported_tasks,
                include_missing_description_tasks,
                report_progress,
            )
    }

    pub(in crate::services) fn jira_client(&self) -> Result<JiraClient, String> {
        let (site_url, account_email) = self.jira_connection_settings()?;
        let api_token = self.jira_api_token()?;
        self.jira_client_from_parts(site_url, account_email, &api_token)
    }

    fn jira_client_with_api_token(&self, api_token: &str) -> Result<JiraClient, String> {
        let (site_url, account_email) = self.jira_connection_settings()?;
        self.jira_client_from_parts(site_url, account_email, api_token)
    }

    fn jira_connection_settings(&self) -> Result<(String, String), String> {
        let settings = self
            .get_app_settings()
            .map_err(|error| format!("Could not load Jira settings: {error}"))?;
        let site_url = normalize_jira_site_url(&settings.jira_site_url)?;
        let account_email = settings.jira_account_email.trim();

        if account_email.is_empty() {
            return Err("Jira account email is required.".to_string());
        }

        Ok((site_url, account_email.to_string()))
    }

    fn jira_client_from_parts(
        &self,
        site_url: String,
        account_email: String,
        api_token: &str,
    ) -> Result<JiraClient, String> {
        let api_token = api_token.trim();
        if api_token.is_empty() {
            return Err("Jira API token cannot be empty.".to_string());
        }

        Ok(JiraClient::new(JiraCredentials {
            site_url,
            account_email,
            api_token: api_token.to_string(),
        }))
    }

    fn jira_api_token(&self) -> Result<String, String> {
        let entry = keyring::Entry::new(JIRA_CREDENTIAL_SERVICE, JIRA_API_TOKEN_ACCOUNT)
            .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        match entry.get_password() {
            Ok(token) => Ok(token),
            Err(keyring::Error::NoEntry) => {
                return Err("Save a Jira API token before testing the connection.".to_string())
            }
            Err(error) => return Err(format!("Could not read Jira API token: {error}")),
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
