use std::collections::HashMap;
use std::time::Duration;

use base64::Engine;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::models::{
    JiraCreateAllowedValue, JiraCreateFieldMetadata, JiraCreateIssueResponse,
    JiraCreateIssueTypeMetadata, JiraCreateMetadata, JiraMyself, JqlResult, JqlSearchResponse,
};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);
const JQL_SEARCH_MAX_RESULTS_CAP: usize = 100;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JiraCredentials {
    pub site_url: String,
    pub account_email: String,
    pub api_token: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JiraClient {
    site_url: String,
    authorization_header: String,
}

impl JiraClient {
    pub fn new(credentials: JiraCredentials) -> Self {
        let encoded_credentials = base64::engine::general_purpose::STANDARD.encode(format!(
            "{}:{}",
            credentials.account_email, credentials.api_token
        ));

        Self {
            site_url: credentials.site_url,
            authorization_header: format!("Basic {encoded_credentials}"),
        }
    }

    pub fn get_myself(&self) -> Result<JiraMyself, String> {
        parse_response(
            self.get("/rest/api/3/myself").call(),
            "Jira connection test",
            Some("Jira rejected the email or API token."),
        )
    }

    pub fn search_jql(&self, jql: &str, max_results: usize) -> Result<JqlSearchResponse, String> {
        let jql = jql.trim();
        if jql.is_empty() {
            return Err("JQL query is required.".to_string());
        }

        let max_results = max_results.clamp(1, JQL_SEARCH_MAX_RESULTS_CAP);
        let response: JiraSearchApiResponse = parse_response(
            self.post("/rest/api/3/search/jql").send_json(json!({
                "fields": ["summary", "project", "issuetype", "priority", "status", "assignee"],
                "fieldsByKeys": true,
                "jql": jql,
                "maxResults": max_results
            })),
            "Jira JQL search",
            None,
        )?;

        Ok(JqlSearchResponse {
            results: response.issues.into_iter().map(map_issue).collect(),
            is_last: response.is_last,
            next_page_token: response.next_page_token,
            warning_messages: response.warning_messages,
        })
    }

    pub fn get_create_issue_metadata(
        &self,
        project_key: &str,
    ) -> Result<JiraCreateMetadata, String> {
        let project_key = project_key.trim();
        if project_key.is_empty() {
            return Err("Jira creation project key is required.".to_string());
        }

        let issue_types_response: JiraCreateIssueTypesApiResponse = parse_response(
            self.get(&format!(
                "/rest/api/3/issue/createmeta/{}/issuetypes?maxResults=100",
                encode_path_segment(project_key)
            ))
            .call(),
            "Jira create metadata",
            None,
        )?;

        let mut issue_types = Vec::new();
        for issue_type in issue_types_response.issue_types {
            let fields_response: JiraCreateFieldsApiResponse = parse_response(
                self.get(&format!(
                    "/rest/api/3/issue/createmeta/{}/issuetypes/{}?maxResults=200",
                    encode_path_segment(project_key),
                    encode_path_segment(&issue_type.id)
                ))
                .call(),
                "Jira create field metadata",
                None,
            )?;

            issue_types.push(JiraCreateIssueTypeMetadata {
                id: issue_type.id,
                name: issue_type.name,
                subtask: issue_type.subtask,
                fields: fields_response
                    .fields
                    .into_iter()
                    .filter_map(map_create_field)
                    .collect(),
            });
        }

        Ok(JiraCreateMetadata {
            project_key: project_key.to_ascii_uppercase(),
            issue_types,
        })
    }

    pub fn create_issue(&self, payload: Value) -> Result<JiraCreateIssueResponse, String> {
        parse_response(
            self.post("/rest/api/3/issue").send_json(payload),
            "Jira issue create",
            None,
        )
    }

    pub fn update_issue_fields(&self, key: &str, payload: Value) -> Result<(), String> {
        let key = key.trim();
        if key.is_empty() {
            return Err("Jira issue key is required.".to_string());
        }

        parse_empty_response(
            self.put(&format!("/rest/api/3/issue/{}", encode_path_segment(key)))
                .send_json(payload),
            "Jira issue update",
        )
    }

    pub fn issue_browse_url(&self, key: &str) -> String {
        format!("{}/browse/{}", self.site_url, encode_path_segment(key))
    }

    fn get(&self, path: &str) -> ureq::Request {
        ureq::get(&self.url(path))
            .set("Accept", "application/json")
            .set("Authorization", &self.authorization_header)
            .timeout(REQUEST_TIMEOUT)
    }

    fn post(&self, path: &str) -> ureq::Request {
        ureq::post(&self.url(path))
            .set("Accept", "application/json")
            .set("Content-Type", "application/json")
            .set("Authorization", &self.authorization_header)
            .timeout(REQUEST_TIMEOUT)
    }

    fn put(&self, path: &str) -> ureq::Request {
        ureq::put(&self.url(path))
            .set("Accept", "application/json")
            .set("Content-Type", "application/json")
            .set("Authorization", &self.authorization_header)
            .timeout(REQUEST_TIMEOUT)
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.site_url, path)
    }
}

pub fn normalize_jira_site_url(raw_site_url: &str) -> Result<String, String> {
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

fn parse_response<T: DeserializeOwned>(
    response: Result<ureq::Response, ureq::Error>,
    action: &str,
    auth_error_message: Option<&str>,
) -> Result<T, String> {
    match response {
        Ok(response) => response
            .into_json::<T>()
            .map_err(|error| format!("{action} returned an unexpected payload: {error}")),
        Err(ureq::Error::Status(status, response)) => {
            if matches!(status, 401 | 403) {
                if let Some(message) = auth_error_message {
                    return Err(message.to_string());
                }
            }

            let body_text = response.into_string().unwrap_or_default();
            let jira_message = jira_error_message(&body_text);
            if jira_message.is_empty() {
                Err(format!("{action} failed with HTTP {status}."))
            } else {
                Err(format!(
                    "{action} failed with HTTP {status}: {jira_message}"
                ))
            }
        }
        Err(error) => Err(format!("{action} could not reach Jira: {error}")),
    }
}

fn parse_empty_response(
    response: Result<ureq::Response, ureq::Error>,
    action: &str,
) -> Result<(), String> {
    match response {
        Ok(_) => Ok(()),
        Err(ureq::Error::Status(status, response)) => {
            let body_text = response.into_string().unwrap_or_default();
            let jira_message = jira_error_message(&body_text);
            if jira_message.is_empty() {
                Err(format!("{action} failed with HTTP {status}."))
            } else {
                Err(format!(
                    "{action} failed with HTTP {status}: {jira_message}"
                ))
            }
        }
        Err(error) => Err(format!("{action} could not reach Jira: {error}")),
    }
}

fn jira_error_message(body_text: &str) -> String {
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

fn map_issue(issue: JiraIssue) -> JqlResult {
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

fn map_create_field(field: JiraCreateFieldApi) -> Option<JiraCreateFieldMetadata> {
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

fn encode_path_segment(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![byte as char]
            }
            _ => format!("%{byte:02X}").chars().collect(),
        })
        .collect()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JiraSearchApiResponse {
    #[serde(default)]
    issues: Vec<JiraIssue>,
    #[serde(default)]
    is_last: bool,
    next_page_token: Option<String>,
    #[serde(default)]
    warning_messages: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JiraCreateIssueTypesApiResponse {
    #[serde(default)]
    issue_types: Vec<JiraCreateIssueTypeApi>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JiraCreateIssueTypeApi {
    id: String,
    name: String,
    #[serde(default)]
    subtask: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JiraCreateFieldsApiResponse {
    #[serde(default)]
    fields: Vec<JiraCreateFieldApi>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JiraCreateFieldApi {
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
struct JiraIssue {
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
    use super::{encode_path_segment, jira_error_message, normalize_jira_site_url};

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
    fn encodes_path_segments_for_jira_urls() {
        assert_eq!(encode_path_segment("JTFTEST"), "JTFTEST");
        assert_eq!(encode_path_segment("issue type"), "issue%20type");
        assert_eq!(encode_path_segment("A/B"), "A%2FB");
    }
}
