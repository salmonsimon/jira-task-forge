use serde_json::{json, Value};

use crate::redaction::redact_secret_fragments;

const AUDIT_MESSAGE_MAX_CHARS: usize = 500;
const AUDIT_STRING_MAX_CHARS: usize = 500;

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct SyncAuditDetail {
    value: Value,
}

impl SyncAuditDetail {
    pub(crate) fn as_value(&self) -> &Value {
        &self.value
    }

    fn from_allowed_value(value: Value) -> Self {
        Self {
            value: sanitize_allowed_detail_value(value),
        }
    }
}

pub(crate) fn sync_started_detail(
    tray_id: &str,
    tray_name: &str,
    jira_project_key: &str,
    include_exported_tasks: bool,
    include_missing_description_tasks: bool,
) -> SyncAuditDetail {
    SyncAuditDetail::from_allowed_value(json!({
        "trayId": tray_id,
        "trayName": tray_name,
        "jiraProjectKey": jira_project_key,
        "includeExportedTasks": include_exported_tasks,
        "includeMissingDescriptionTasks": include_missing_description_tasks,
    }))
}

pub(crate) fn metadata_preflight_detail(
    jira_project_key: &str,
    issue_types: Vec<String>,
    task_count: usize,
) -> SyncAuditDetail {
    SyncAuditDetail::from_allowed_value(json!({
        "jiraProjectKey": jira_project_key,
        "issueTypes": issue_types,
        "taskCount": task_count,
    }))
}

pub(crate) fn audit_error_detail(message: &str) -> SyncAuditDetail {
    SyncAuditDetail::from_allowed_value(json!({ "message": audit_error_message(message) }))
}

pub(crate) fn audit_error_messages_detail(messages: &[String]) -> SyncAuditDetail {
    SyncAuditDetail::from_allowed_value(json!({
        "messages": messages
            .iter()
            .map(|message| audit_error_message(message))
            .collect::<Vec<_>>()
    }))
}

pub(crate) fn jira_issue_created_detail(
    jira_key: &str,
    epic_key: &str,
    issue_type: &str,
) -> SyncAuditDetail {
    SyncAuditDetail::from_allowed_value(json!({
        "jiraKey": jira_key,
        "epicKey": epic_key,
        "issueType": issue_type,
    }))
}

pub(crate) fn jira_remote_marker_recovered_detail(
    jira_key: &str,
    epic_key: &str,
) -> SyncAuditDetail {
    SyncAuditDetail::from_allowed_value(json!({
        "jiraKey": jira_key,
        "epicKey": epic_key,
        "source": "remote-correlation-marker",
    }))
}

pub(crate) fn jira_subtask_created_detail(
    jira_key: &str,
    parent_jira_key: &str,
    issue_type: &str,
) -> SyncAuditDetail {
    SyncAuditDetail::from_allowed_value(json!({
        "jiraKey": jira_key,
        "parentJiraKey": parent_jira_key,
        "issueType": issue_type,
    }))
}

pub(crate) fn jira_epic_detail(jira_key: &str, summary: &str) -> SyncAuditDetail {
    SyncAuditDetail::from_allowed_value(json!({
        "jiraKey": jira_key,
        "summary": summary,
    }))
}

pub(crate) fn jira_epic_resolved_detail(
    jira_key: &str,
    summary: &str,
    source: &str,
) -> SyncAuditDetail {
    SyncAuditDetail::from_allowed_value(json!({
        "jiraKey": jira_key,
        "summary": summary,
        "source": source,
    }))
}

pub(crate) fn jira_priority_detail(
    jira_key: &str,
    priority: &str,
    source: &str,
) -> SyncAuditDetail {
    SyncAuditDetail::from_allowed_value(json!({
        "jiraKey": jira_key,
        "priority": priority,
        "source": source,
    }))
}

pub(crate) fn jira_priority_error_detail(
    jira_key: &str,
    priority: &str,
    message: &str,
) -> SyncAuditDetail {
    SyncAuditDetail::from_allowed_value(json!({
        "jiraKey": jira_key,
        "priority": priority,
        "message": audit_error_message(message),
    }))
}

pub(crate) fn attachment_uploaded_detail(
    jira_key: &str,
    filename: &str,
    purpose: &str,
    size_bytes: u64,
) -> SyncAuditDetail {
    SyncAuditDetail::from_allowed_value(json!({
        "jiraKey": jira_key,
        "filename": filename,
        "purpose": purpose,
        "sizeBytes": size_bytes,
    }))
}

pub(crate) fn attachment_error_detail(
    jira_key: &str,
    filename: &str,
    message: &str,
) -> SyncAuditDetail {
    SyncAuditDetail::from_allowed_value(json!({
        "jiraKey": jira_key,
        "filename": filename,
        "message": audit_error_message(message),
    }))
}

pub(crate) fn audit_error_message(message: &str) -> String {
    let redacted = redact_secret_fragments(message);
    cap_audit_message(&redacted)
}

fn cap_audit_message(message: &str) -> String {
    cap_string(message, AUDIT_MESSAGE_MAX_CHARS)
}

fn sanitize_allowed_detail_value(value: Value) -> Value {
    match value {
        Value::String(value) => Value::String(cap_string(
            &redact_secret_fragments(&value),
            AUDIT_STRING_MAX_CHARS,
        )),
        Value::Array(values) => Value::Array(
            values
                .into_iter()
                .map(sanitize_allowed_detail_value)
                .collect::<Vec<_>>(),
        ),
        Value::Object(entries) => Value::Object(
            entries
                .into_iter()
                .map(|(key, value)| (key, sanitize_allowed_detail_value(value)))
                .collect(),
        ),
        other => other,
    }
}

fn cap_string(message: &str, max_chars: usize) -> String {
    if message.chars().count() <= max_chars {
        return message.to_string();
    }

    let prefix = message
        .chars()
        .take(max_chars.saturating_sub(3))
        .collect::<String>();
    format!("{prefix}...")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_secret_shaped_values_from_audit_error_messages() {
        let message = concat!(
            "Jira failed with Authorization: Basic abc123 ",
            "api_token=super-secret token: second-secret ",
            "\"apiToken\":\"json-secret\" Bearer bearer-secret"
        );

        let redacted = audit_error_message(message);

        assert!(redacted.contains("Basic <redacted>"));
        assert!(redacted.contains("api_token=<redacted>"));
        assert!(redacted.contains("token: <redacted>"));
        assert!(redacted.contains("\"apiToken\":\"<redacted>\""));
        assert!(redacted.contains("Bearer <redacted>"));
        assert!(!redacted.contains("abc123"));
        assert!(!redacted.contains("super-secret"));
        assert!(!redacted.contains("second-secret"));
        assert!(!redacted.contains("json-secret"));
        assert!(!redacted.contains("bearer-secret"));
    }

    #[test]
    fn caps_audit_error_messages_to_the_adr_limit() {
        let message = "a".repeat(AUDIT_MESSAGE_MAX_CHARS + 40);

        let capped = audit_error_message(&message);

        assert_eq!(capped.chars().count(), AUDIT_MESSAGE_MAX_CHARS);
        assert!(capped.ends_with("..."));
    }

    #[test]
    fn builds_redacted_audit_error_detail() {
        let detail = audit_error_detail("Failed with Basic abc123");

        assert_eq!(
            detail.as_value()["message"],
            json!("Failed with Basic <redacted>")
        );
    }

    #[test]
    fn sanitizes_allowed_detail_string_values_before_persistence() {
        let detail = SyncAuditDetail::from_allowed_value(json!({
            "jiraKey": "JTFTEST-1",
            "message": format!("API key: sk-proj-secretValue123456 {}", "a".repeat(700)),
            "headers": {
                "authorization": "Bearer bearer-secret"
            },
            "messages": ["token=another-secret"]
        }));

        let serialized = serde_json::to_string(detail.as_value()).expect("serializes");

        assert!(serialized.contains("API key: <redacted>"));
        assert!(serialized.contains("Bearer <redacted>"));
        assert!(serialized.contains("token=<redacted>"));
        assert!(!serialized.contains("sk-proj-secretValue123456"));
        assert!(!serialized.contains("bearer-secret"));
        assert!(!serialized.contains("another-secret"));
        assert!(
            detail.as_value()["message"]
                .as_str()
                .expect("message")
                .chars()
                .count()
                <= AUDIT_STRING_MAX_CHARS
        );
    }
}
