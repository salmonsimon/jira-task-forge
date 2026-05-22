use serde::{Deserialize, Serialize};

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
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme_mode: String,
    pub jira_site_url: String,
    pub jira_account_email: String,
    pub jira_auth_method: String,
    #[serde(default = "default_jira_sandbox_mode")]
    pub jira_sandbox_mode: bool,
    #[serde(default)]
    pub jira_sandbox_project_key: String,
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

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme_mode: "dark".to_string(),
            jira_site_url: "https://dts.atlassian.net".to_string(),
            jira_account_email: String::new(),
            jira_auth_method: "api-token".to_string(),
            jira_sandbox_mode: default_jira_sandbox_mode(),
            jira_sandbox_project_key: String::new(),
            ai_provider: "OpenAI".to_string(),
            ai_model: "gpt-4.1".to_string(),
            default_content_language: "Spanish".to_string(),
        }
    }
}

fn default_jira_sandbox_mode() -> bool {
    true
}
