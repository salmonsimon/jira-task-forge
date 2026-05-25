use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Tray {
    pub id: String,
    pub name: String,
    pub state: TrayState,
    pub created_at: String,
    pub updated_at: String,
    pub archived_at: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrayState {
    Active,
    NeedsAttention,
    Completed,
    Archived,
}

impl TrayState {
    pub fn as_db_value(self) -> &'static str {
        match self {
            Self::Active => "Active",
            Self::NeedsAttention => "Needs attention",
            Self::Completed => "Completed",
            Self::Archived => "Archived",
        }
    }

    pub fn from_db_value(value: &str) -> Result<Self, String> {
        match value {
            "Active" => Ok(Self::Active),
            "Needs attention" => Ok(Self::NeedsAttention),
            "Completed" => Ok(Self::Completed),
            "Archived" => Ok(Self::Archived),
            _ => Err(format!("unknown tray state: {value}")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewTray {
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LocalTask {
    pub id: String,
    pub tray_id: String,
    pub project: String,
    pub area: String,
    pub title: String,
    pub priority: String,
    pub issue_type: String,
    pub sync_status: String,
    pub description_status: String,
    pub content_language: String,
    pub jira_key: Option<String>,
    pub jira_url: Option<String>,
    pub epic_key: Option<String>,
    pub parent_task_id: Option<String>,
    pub task_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewTask {
    pub tray_id: String,
    pub project: String,
    pub area: String,
    pub title: String,
    pub priority: String,
    pub issue_type: String,
    pub content_language: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub category_type: String,
    pub name: String,
    pub source: String,
    pub hidden: bool,
    pub ignored: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JqlFavorite {
    pub id: String,
    pub name: String,
    pub jql: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme_mode: String,
    pub jira_site_url: String,
    pub jira_account_email: String,
    pub jira_auth_method: String,
    #[serde(default, alias = "jiraSandboxProjectKey")]
    pub jira_creation_project_key: String,
    pub ai_provider: String,
    pub ai_model: String,
    pub default_content_language: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JiraConnectionTestResult {
    pub ok: bool,
    pub message: String,
    pub account_display_name: Option<String>,
    pub account_email: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JiraMyself {
    pub account_id: Option<String>,
    pub display_name: Option<String>,
    pub email_address: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JqlSearchResponse {
    pub results: Vec<JqlResult>,
    pub is_last: bool,
    pub next_page_token: Option<String>,
    pub warning_messages: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JqlResult {
    pub key: String,
    pub project: String,
    pub issue_type: String,
    pub priority: String,
    pub status: String,
    pub summary: String,
    pub assignee: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncAuditEvent {
    pub id: String,
    pub sync_attempt_id: Option<String>,
    pub tray_id: Option<String>,
    pub task_id: Option<String>,
    pub event_type: String,
    pub occurred_at: String,
    pub outcome: String,
    pub provider: Option<String>,
    pub operation: Option<String>,
    pub detail: Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JiraCreateMetadata {
    pub project_key: String,
    pub issue_types: Vec<JiraCreateIssueTypeMetadata>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JiraCreateIssueTypeMetadata {
    pub id: String,
    pub name: String,
    pub subtask: bool,
    pub fields: Vec<JiraCreateFieldMetadata>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JiraCreateFieldMetadata {
    pub key: String,
    pub name: String,
    pub required: bool,
    pub allowed_values: Vec<JiraCreateAllowedValue>,
    pub schema: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JiraCreateAllowedValue {
    pub id: Option<String>,
    pub name: Option<String>,
    pub value: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JiraCreateIssueResponse {
    pub id: String,
    pub key: String,
    #[serde(rename = "self")]
    pub self_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JiraCreateIssuesResult {
    pub sync_attempt_id: String,
    pub status: String,
    pub created_issue_count: usize,
    pub skipped_issue_count: usize,
    pub failed_issue_count: usize,
    pub created_issues: Vec<JiraCreatedIssueResult>,
    pub failed_tasks: Vec<JiraFailedTaskResult>,
    pub messages: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JiraCreateProgress {
    pub sync_attempt_id: Option<String>,
    pub step: String,
    pub label: String,
    pub detail: Option<String>,
    pub completed_steps: usize,
    pub total_steps: usize,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JiraCreatedIssueResult {
    pub task_id: Option<String>,
    pub key: String,
    pub url: String,
    pub issue_type: String,
    pub summary: String,
    pub epic_key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JiraFailedTaskResult {
    pub task_id: String,
    pub title: String,
    pub project: String,
    pub area: String,
    pub message: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme_mode: "dark".to_string(),
            jira_site_url: "https://dts.atlassian.net".to_string(),
            jira_account_email: String::new(),
            jira_auth_method: "api-token".to_string(),
            jira_creation_project_key: String::new(),
            ai_provider: "OpenAI".to_string(),
            ai_model: "gpt-4.1".to_string(),
            default_content_language: "Spanish".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{AppSettings, TrayState};

    #[test]
    fn tray_state_round_trips_database_values() {
        for (state, db_value) in [
            (TrayState::Active, "Active"),
            (TrayState::NeedsAttention, "Needs attention"),
            (TrayState::Completed, "Completed"),
            (TrayState::Archived, "Archived"),
        ] {
            assert_eq!(state.as_db_value(), db_value);
            assert_eq!(
                TrayState::from_db_value(db_value).expect("state parses"),
                state
            );
        }

        assert_eq!(
            TrayState::from_db_value("Done").expect_err("unknown state should fail"),
            "unknown tray state: Done"
        );
    }

    #[test]
    fn app_settings_supports_legacy_sandbox_project_key_alias() {
        let settings = serde_json::from_value::<AppSettings>(serde_json::json!({
            "themeMode": "dark",
            "jiraSiteUrl": "https://example.atlassian.net",
            "jiraAccountEmail": "saimon@example.com",
            "jiraAuthMethod": "api-token",
            "jiraSandboxProjectKey": "JTFTEST",
            "aiProvider": "OpenAI",
            "aiModel": "gpt-4.1",
            "defaultContentLanguage": "Spanish"
        }))
        .expect("settings deserialize");

        assert_eq!(settings.jira_creation_project_key, "JTFTEST");
    }

    #[test]
    fn app_settings_defaults_missing_creation_project_key() {
        let settings = serde_json::from_value::<AppSettings>(serde_json::json!({
            "themeMode": "dark",
            "jiraSiteUrl": "https://example.atlassian.net",
            "jiraAccountEmail": "saimon@example.com",
            "jiraAuthMethod": "api-token",
            "aiProvider": "OpenAI",
            "aiModel": "gpt-4.1",
            "defaultContentLanguage": "Spanish"
        }))
        .expect("settings deserialize");

        assert_eq!(settings.jira_creation_project_key, "");
    }
}
