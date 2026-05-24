use std::collections::HashMap;

use serde::Deserialize;
use serde_json::Value;

use crate::models::{JiraCreateAllowedValue, JiraCreateFieldMetadata, JqlResult};

pub(super) fn jira_error_message(body_text: &str) -> String {
    let Ok(error_body) = serde_json::from_str::<JiraErrorResponse>(body_text) else {
        return String::new();
    };

    let mut messages = error_body.error_messages;
    for (field, detail) in error_body.errors {
        let detail = detail
            .as_str()
            .map(str::to_string)
            .unwrap_or_else(|| detail.to_string());
        messages.push(format!("{field}: {detail}"));
    }

    messages.join(" ")
}

pub(super) fn map_issue(issue: JiraIssue) -> JqlResult {
    JqlResult {
        key: issue.key,
        project: issue
            .fields
            .project
            .and_then(|project| project.key.or(project.name))
            .unwrap_or_else(|| "Unknown".to_string()),
        issue_type: issue
            .fields
            .issue_type
            .and_then(|issue_type| issue_type.name)
            .unwrap_or_else(|| "Unknown".to_string()),
        priority: issue
            .fields
            .priority
            .and_then(|priority| priority.name)
            .unwrap_or_else(|| "None".to_string()),
        status: issue
            .fields
            .status
            .and_then(|status| status.name)
            .unwrap_or_else(|| "Unknown".to_string()),
        summary: issue
            .fields
            .summary
            .unwrap_or_else(|| "Untitled issue".to_string()),
        assignee: issue
            .fields
            .assignee
            .and_then(|assignee| assignee.display_name)
            .unwrap_or_else(|| "Unassigned".to_string()),
    }
}

pub(super) fn map_create_field(field: JiraCreateFieldApi) -> Option<JiraCreateFieldMetadata> {
    let key = field.key.or(field.field_id)?.trim().to_string();
    if key.is_empty() {
        return None;
    }

    Some(JiraCreateFieldMetadata {
        key,
        name: field.name.unwrap_or_else(|| "Unknown field".to_string()),
        required: field.required,
        allowed_values: field
            .allowed_values
            .into_iter()
            .map(|allowed_value| JiraCreateAllowedValue {
                id: allowed_value.id,
                name: allowed_value.name,
                value: allowed_value.value,
            })
            .collect(),
        schema: field.schema,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JiraSearchApiResponse {
    #[serde(default)]
    pub(super) issues: Vec<JiraIssue>,
    #[serde(default)]
    pub(super) is_last: bool,
    pub(super) next_page_token: Option<String>,
    #[serde(default)]
    pub(super) warning_messages: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JiraCreateIssueTypesApiResponse {
    #[serde(default)]
    pub(super) issue_types: Vec<JiraCreateIssueTypeApi>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JiraCreateIssueTypeApi {
    pub(super) id: String,
    pub(super) name: String,
    #[serde(default)]
    pub(super) subtask: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JiraCreateFieldsApiResponse {
    #[serde(default)]
    pub(super) fields: Vec<JiraCreateFieldApi>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JiraCreateFieldApi {
    field_id: Option<String>,
    key: Option<String>,
    name: Option<String>,
    #[serde(default)]
    required: bool,
    #[serde(default)]
    allowed_values: Vec<JiraCreateAllowedValueApi>,
    schema: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JiraCreateAllowedValueApi {
    id: Option<String>,
    name: Option<String>,
    value: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(super) struct JiraIssue {
    key: String,
    fields: JiraIssueFields,
}

#[derive(Debug, Deserialize)]
struct JiraIssueFields {
    summary: Option<String>,
    project: Option<JiraProjectField>,
    #[serde(rename = "issuetype")]
    issue_type: Option<JiraNamedField>,
    priority: Option<JiraNamedField>,
    status: Option<JiraNamedField>,
    assignee: Option<JiraUserField>,
}

#[derive(Debug, Deserialize)]
struct JiraProjectField {
    key: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JiraNamedField {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JiraUserField {
    display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JiraErrorResponse {
    #[serde(default)]
    error_messages: Vec<String>,
    #[serde(default)]
    errors: HashMap<String, Value>,
}

#[cfg(test)]
mod tests {
    use super::{
        jira_error_message, map_create_field, map_issue, JiraCreateAllowedValueApi,
        JiraCreateFieldApi, JiraIssue, JiraIssueFields, JiraNamedField, JiraProjectField,
        JiraUserField,
    };
    use serde_json::json;

    #[test]
    fn formats_jira_error_payloads() {
        assert_eq!(
            jira_error_message(
                r#"{"errorMessages":["The JQL query is invalid."],"errors":{"jql":"Bad clause"}}"#
            ),
            "The JQL query is invalid. jql: Bad clause"
        );
    }

    #[test]
    fn formats_empty_or_non_string_jira_error_payloads() {
        assert_eq!(jira_error_message("not-json"), "");
        assert_eq!(
            jira_error_message(r#"{"errors":{"summary":{"reason":"required"}}}"#),
            r#"summary: {"reason":"required"}"#
        );
    }

    #[test]
    fn maps_jira_issues_with_defaults_for_missing_fields() {
        let mapped = map_issue(JiraIssue {
            key: "JTFTEST-1".to_string(),
            fields: JiraIssueFields {
                summary: None,
                project: None,
                issue_type: None,
                priority: None,
                status: None,
                assignee: None,
            },
        });

        assert_eq!(mapped.key, "JTFTEST-1");
        assert_eq!(mapped.project, "Unknown");
        assert_eq!(mapped.issue_type, "Unknown");
        assert_eq!(mapped.priority, "None");
        assert_eq!(mapped.status, "Unknown");
        assert_eq!(mapped.summary, "Untitled issue");
        assert_eq!(mapped.assignee, "Unassigned");
    }

    #[test]
    fn maps_jira_issues_with_named_fields() {
        let mapped = map_issue(JiraIssue {
            key: "DTS-1097".to_string(),
            fields: JiraIssueFields {
                summary: Some("Distribute vegetation".to_string()),
                project: Some(JiraProjectField {
                    key: Some("DTS".to_string()),
                    name: Some("DTS Name".to_string()),
                }),
                issue_type: Some(JiraNamedField {
                    name: Some("Historia".to_string()),
                }),
                priority: Some(JiraNamedField {
                    name: Some("High".to_string()),
                }),
                status: Some(JiraNamedField {
                    name: Some("To Do".to_string()),
                }),
                assignee: Some(JiraUserField {
                    display_name: Some("Saimon".to_string()),
                }),
            },
        });

        assert_eq!(mapped.project, "DTS");
        assert_eq!(mapped.issue_type, "Historia");
        assert_eq!(mapped.priority, "High");
        assert_eq!(mapped.status, "To Do");
        assert_eq!(mapped.summary, "Distribute vegetation");
        assert_eq!(mapped.assignee, "Saimon");
    }

    #[test]
    fn maps_create_fields_from_key_or_field_id() {
        let mapped = map_create_field(JiraCreateFieldApi {
            field_id: Some("customfield_10011".to_string()),
            key: None,
            name: None,
            required: true,
            allowed_values: vec![JiraCreateAllowedValueApi {
                id: Some("1".to_string()),
                name: Some("High".to_string()),
                value: None,
            }],
            schema: Some(json!({ "type": "priority" })),
        })
        .expect("field maps");

        assert_eq!(mapped.key, "customfield_10011");
        assert_eq!(mapped.name, "Unknown field");
        assert!(mapped.required);
        assert_eq!(mapped.allowed_values[0].id.as_deref(), Some("1"));
        assert_eq!(mapped.schema, Some(json!({ "type": "priority" })));

        assert_eq!(
            map_create_field(JiraCreateFieldApi {
                field_id: None,
                key: Some("   ".to_string()),
                name: Some("Blank".to_string()),
                required: false,
                allowed_values: Vec::new(),
                schema: None,
            }),
            None
        );
    }
}
