use std::time::Duration;

use base64::Engine;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use super::jira_mapping::{
    jira_error_message, map_create_field, map_issue, JiraCreateFieldsApiResponse,
    JiraCreateIssueTypesApiResponse, JiraSearchApiResponse,
};
use crate::models::{
    JiraAttachmentSettings, JiraCreateIssueResponse, JiraCreateIssueTypeMetadata,
    JiraCreateMetadata, JiraMyself, JiraProjectOption, JiraProjectSearchResponse,
    JiraRemoteMarkerIssue, JqlSearchResponse,
};
use crate::redaction::redact_secret_fragments;

const READ_REQUEST_TIMEOUT: Duration = Duration::from_secs(45);
const WRITE_REQUEST_TIMEOUT: Duration = Duration::from_secs(15);
const ATTACHMENT_REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
const READ_REQUEST_ATTEMPTS: usize = 2;
const JQL_SEARCH_MAX_RESULTS_CAP: usize = 100;

#[derive(Clone, PartialEq, Eq)]
pub struct JiraCredentials {
    pub site_url: String,
    pub account_email: String,
    pub api_token: String,
}

impl std::fmt::Debug for JiraCredentials {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("JiraCredentials")
            .field("site_url", &self.site_url)
            .field("account_email", &self.account_email)
            .field("api_token", &"<redacted>")
            .finish()
    }
}

#[derive(Clone, PartialEq, Eq)]
pub struct JiraClient {
    site_url: String,
    authorization_header: String,
}

impl std::fmt::Debug for JiraClient {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("JiraClient")
            .field("site_url", &self.site_url)
            .field("authorization_header", &"<redacted>")
            .finish()
    }
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

    pub fn get_attachment_settings(&self) -> Result<JiraAttachmentSettings, String> {
        parse_response(
            self.get("/rest/api/3/attachment/meta").call(),
            "Jira attachment settings",
            None,
        )
    }

    pub fn list_projects(&self) -> Result<Vec<JiraProjectOption>, String> {
        let response: JiraProjectSearchResponse = self.get_json_with_retry(
            "/rest/api/3/project/search?maxResults=100",
            "Jira project discovery",
        )?;
        let mut projects = response
            .values
            .into_iter()
            .filter(|project| !project.key.trim().is_empty())
            .map(|project| JiraProjectOption {
                key: project.key.trim().to_ascii_uppercase(),
                name: project.name.trim().to_string(),
            })
            .collect::<Vec<_>>();
        projects.sort_by(|left, right| left.key.cmp(&right.key));
        projects.dedup_by(|left, right| left.key == right.key);
        Ok(projects)
    }

    pub fn search_jql(&self, jql: &str, max_results: usize) -> Result<JqlSearchResponse, String> {
        let jql = jql.trim();
        if jql.is_empty() {
            return Err("JQL query is required.".to_string());
        }

        let max_results = max_results.clamp(1, JQL_SEARCH_MAX_RESULTS_CAP);
        let response: JiraSearchApiResponse = self.post_json_with_retry(
            "/rest/api/3/search/jql",
            json!({
                "fields": ["summary", "project", "issuetype", "priority", "status", "assignee"],
                "fieldsByKeys": true,
                "jql": jql,
                "maxResults": max_results
            }),
            "Jira JQL search",
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

        let issue_types_response: JiraCreateIssueTypesApiResponse = self.get_json_with_retry(
            &format!(
                "/rest/api/3/issue/createmeta/{}/issuetypes?maxResults=100",
                encode_path_segment(project_key)
            ),
            "Jira create metadata",
        )?;

        let mut issue_types = Vec::new();
        for issue_type in issue_types_response.issue_types {
            let fields_response: JiraCreateFieldsApiResponse = self.get_json_with_retry(
                &format!(
                    "/rest/api/3/issue/createmeta/{}/issuetypes/{}?maxResults=200",
                    encode_path_segment(project_key),
                    encode_path_segment(&issue_type.id)
                ),
                "Jira create field metadata",
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

    pub fn find_parent_issue_by_remote_marker(
        &self,
        project_key: &str,
        property_key: &str,
        issue_type: &str,
        summary: &str,
        local_task_id: &str,
    ) -> Result<Option<JiraRemoteMarkerIssue>, String> {
        let project_key = project_key.trim();
        if project_key.is_empty() {
            return Err("Jira creation project key is required.".to_string());
        }
        let issue_type = issue_type.trim();
        if issue_type.is_empty() {
            return Err("Jira issue type is required.".to_string());
        }
        let summary = summary.trim();
        if summary.is_empty() {
            return Err("Jira issue summary is required.".to_string());
        }
        let local_task_id = local_task_id.trim();
        if local_task_id.is_empty() {
            return Err("Local task id is required.".to_string());
        }
        let property_key = property_key.trim();
        if property_key.is_empty() {
            return Err("Jira marker property key is required.".to_string());
        }

        let jql = format!(
            "project = {} AND summary ~ \"{}\" ORDER BY created DESC",
            escape_jql_identifier(project_key),
            escape_jql_string(summary)
        );
        let response = self.search_jql(&jql, 20)?;
        let mut matches = Vec::new();

        for issue in response.results.into_iter().filter(|issue| {
            issue.summary == summary && issue.issue_type.eq_ignore_ascii_case(issue_type)
        }) {
            let Some(marker) = self.get_issue_property_value(&issue.key, property_key)? else {
                continue;
            };
            if remote_marker_matches_parent_local_task(&marker, local_task_id) {
                matches.push(issue.key);
            }
        }

        match matches.len() {
            0 => Ok(None),
            1 => Ok(Some(JiraRemoteMarkerIssue {
                key: matches.remove(0),
            })),
            count => Err(format!(
                "Remote marker lookup found {count} Jira issues matching the same Local Task."
            )),
        }
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

    pub fn upload_attachment(
        &self,
        key: &str,
        filename: &str,
        mime_type: Option<&str>,
        bytes: Vec<u8>,
    ) -> Result<(), String> {
        let key = key.trim();
        if key.is_empty() {
            return Err("Jira issue key is required.".to_string());
        }
        if filename.trim().is_empty() {
            return Err("Attachment filename is required.".to_string());
        }
        if bytes.is_empty() {
            return Err("Attachment file cannot be empty.".to_string());
        }

        let boundary = attachment_multipart_boundary();
        let body = multipart_attachment_body(&boundary, filename, mime_type, &bytes);
        parse_empty_response(
            ureq::post(&self.url(&format!(
                "/rest/api/3/issue/{}/attachments",
                encode_path_segment(key)
            )))
            .set("Accept", "application/json")
            .set("Authorization", &self.authorization_header)
            .set("X-Atlassian-Token", "no-check")
            .set(
                "Content-Type",
                &format!("multipart/form-data; boundary={boundary}"),
            )
            .timeout(ATTACHMENT_REQUEST_TIMEOUT)
            .send_bytes(&body),
            "Jira attachment upload",
        )
    }

    pub fn issue_browse_url(&self, key: &str) -> String {
        format!("{}/browse/{}", self.site_url, encode_path_segment(key))
    }

    fn get(&self, path: &str) -> ureq::Request {
        ureq::get(&self.url(path))
            .set("Accept", "application/json")
            .set("Authorization", &self.authorization_header)
            .timeout(READ_REQUEST_TIMEOUT)
    }

    fn post(&self, path: &str) -> ureq::Request {
        ureq::post(&self.url(path))
            .set("Accept", "application/json")
            .set("Content-Type", "application/json")
            .set("Authorization", &self.authorization_header)
            .timeout(WRITE_REQUEST_TIMEOUT)
    }

    fn post_read(&self, path: &str) -> ureq::Request {
        ureq::post(&self.url(path))
            .set("Accept", "application/json")
            .set("Content-Type", "application/json")
            .set("Authorization", &self.authorization_header)
            .timeout(READ_REQUEST_TIMEOUT)
    }

    fn put(&self, path: &str) -> ureq::Request {
        ureq::put(&self.url(path))
            .set("Accept", "application/json")
            .set("Content-Type", "application/json")
            .set("Authorization", &self.authorization_header)
            .timeout(WRITE_REQUEST_TIMEOUT)
    }

    fn get_issue_property_value(
        &self,
        issue_key: &str,
        property_key: &str,
    ) -> Result<Option<Value>, String> {
        let response = self
            .get(&format!(
                "/rest/api/3/issue/{}/properties/{}",
                encode_path_segment(issue_key),
                encode_path_segment(property_key)
            ))
            .call();

        match response {
            Ok(response) => {
                let property =
                    response
                        .into_json::<JiraIssuePropertyResponse>()
                        .map_err(|error| {
                            redact_secret_fragments(&format!(
                                "Jira issue property read returned an unexpected payload: {error}"
                            ))
                        })?;
                Ok(Some(property.value))
            }
            Err(ureq::Error::Status(404, _)) => Ok(None),
            Err(error) => parse_response::<JiraIssuePropertyResponse>(
                Err(error),
                "Jira issue property read",
                None,
            )
            .map(|property| Some(property.value)),
        }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.site_url, path)
    }

    fn get_json_with_retry<T: DeserializeOwned>(
        &self,
        path: &str,
        action: &str,
    ) -> Result<T, String> {
        let mut last_error = None;
        for attempt in 1..=READ_REQUEST_ATTEMPTS {
            match parse_response::<T>(self.get(path).call(), action, None) {
                Ok(value) => return Ok(value),
                Err(error)
                    if attempt < READ_REQUEST_ATTEMPTS && is_retryable_jira_read_error(&error) =>
                {
                    last_error = Some(error);
                }
                Err(error) => return Err(error),
            }
        }

        Err(last_error.unwrap_or_else(|| format!("{action} could not reach Jira.")))
    }

    fn post_json_with_retry<T: DeserializeOwned>(
        &self,
        path: &str,
        payload: Value,
        action: &str,
    ) -> Result<T, String> {
        let mut last_error = None;
        for attempt in 1..=READ_REQUEST_ATTEMPTS {
            match parse_response::<T>(
                self.post_read(path).send_json(payload.clone()),
                action,
                None,
            ) {
                Ok(value) => return Ok(value),
                Err(error)
                    if attempt < READ_REQUEST_ATTEMPTS && is_retryable_jira_read_error(&error) =>
                {
                    last_error = Some(error);
                }
                Err(error) => return Err(error),
            }
        }

        Err(last_error.unwrap_or_else(|| format!("{action} could not reach Jira.")))
    }
}

fn attachment_multipart_boundary() -> String {
    format!("jtf-{}", Uuid::new_v4().simple())
}

fn multipart_attachment_body(
    boundary: &str,
    filename: &str,
    mime_type: Option<&str>,
    bytes: &[u8],
) -> Vec<u8> {
    let escaped_filename = sanitize_multipart_filename(filename);
    let content_type = sanitize_multipart_mime_type(mime_type);
    let mut body = Vec::new();
    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(
        format!(
            "Content-Disposition: form-data; name=\"file\"; filename=\"{escaped_filename}\"\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(format!("Content-Type: {content_type}\r\n\r\n").as_bytes());
    body.extend_from_slice(bytes);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    body
}

fn sanitize_multipart_filename(filename: &str) -> String {
    let basename = filename
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(filename)
        .trim();
    let sanitized = basename
        .chars()
        .map(|character| {
            if character.is_control() || matches!(character, '"' | '\\' | '/' | ':') {
                '-'
            } else {
                character
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let sanitized = sanitized.trim();
    let truncated = if sanitized.is_empty() {
        "attachment".to_string()
    } else {
        sanitized.chars().take(180).collect::<String>()
    };

    truncated.replace('"', "-")
}

fn sanitize_multipart_mime_type(mime_type: Option<&str>) -> String {
    let Some(candidate) = mime_type.map(str::trim).filter(|value| !value.is_empty()) else {
        return "application/octet-stream".to_string();
    };
    if candidate.chars().any(|character| character.is_control()) {
        return "application/octet-stream".to_string();
    }

    let Some((media_type, subtype)) = candidate.split_once('/') else {
        return "application/octet-stream".to_string();
    };
    if media_type.is_empty()
        || subtype.is_empty()
        || !media_type.chars().all(is_mime_token_character)
        || !subtype.chars().all(is_mime_token_character)
    {
        return "application/octet-stream".to_string();
    }

    format!(
        "{}/{}",
        media_type.to_ascii_lowercase(),
        subtype.to_ascii_lowercase()
    )
}

fn is_mime_token_character(character: char) -> bool {
    character.is_ascii_alphanumeric()
        || matches!(
            character,
            '!' | '#' | '$' | '&' | '^' | '_' | '.' | '+' | '-'
        )
}

pub fn normalize_jira_site_url(raw_site_url: &str) -> Result<String, String> {
    if raw_site_url.is_empty() {
        return Err("Jira site URL is required.".to_string());
    }
    if raw_site_url
        .chars()
        .any(|character| character.is_whitespace() || character.is_control())
    {
        return Err("Jira site URL must not include whitespace or control characters.".to_string());
    }
    if !raw_site_url.starts_with("https://") {
        return Err("Jira site URL must start with https://.".to_string());
    }

    let rest = &raw_site_url["https://".len()..];
    let host_end = rest
        .find(|character| matches!(character, '/' | '?' | '#'))
        .unwrap_or(rest.len());
    let host = &rest[..host_end];
    let suffix = &rest[host_end..];

    if host.is_empty() {
        return Err("Jira site URL must include a host.".to_string());
    }
    if host.contains('@') {
        return Err("Jira site URL must not include credentials.".to_string());
    }
    if host.contains(':') {
        return Err("Jira site URL must not include a port.".to_string());
    }
    if !(suffix.is_empty() || suffix == "/") {
        return Err("Jira site URL must be the Atlassian Cloud site root.".to_string());
    }

    let host = host.to_ascii_lowercase();
    let Some(site) = host.strip_suffix(".atlassian.net") else {
        return Err("Jira site URL must use an Atlassian Cloud host.".to_string());
    };
    if site.is_empty()
        || site.contains('.')
        || site.starts_with('-')
        || site.ends_with('-')
        || !site
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err("Jira site URL must use a standard Atlassian Cloud site host.".to_string());
    }

    Ok(format!("https://{host}"))
}

fn parse_response<T: DeserializeOwned>(
    response: Result<ureq::Response, ureq::Error>,
    action: &str,
    auth_error_message: Option<&str>,
) -> Result<T, String> {
    match response {
        Ok(response) => response.into_json::<T>().map_err(|error| {
            redact_secret_fragments(&format!("{action} returned an unexpected payload: {error}"))
        }),
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
                Err(redact_secret_fragments(&format!(
                    "{action} failed with HTTP {status}: {jira_message}"
                )))
            }
        }
        Err(error) => Err(redact_secret_fragments(&format!(
            "{action} could not reach Jira: {error}"
        ))),
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
                Err(redact_secret_fragments(&format!(
                    "{action} failed with HTTP {status}: {jira_message}"
                )))
            }
        }
        Err(error) => Err(redact_secret_fragments(&format!(
            "{action} could not reach Jira: {error}"
        ))),
    }
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

fn escape_jql_identifier(value: &str) -> String {
    if value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '_')
    {
        value.to_string()
    } else {
        format!("\"{}\"", escape_jql_string(value))
    }
}

fn escape_jql_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn is_retryable_jira_read_error(message: &str) -> bool {
    message.contains("could not reach Jira")
        && (message.contains("timed out")
            || message.contains("timeout")
            || message.contains("Connection Failed")
            || message.contains("connection reset")
            || message.contains("connection closed"))
}

#[derive(Debug, Deserialize)]
struct JiraIssuePropertyResponse {
    value: Value,
}

fn remote_marker_matches_parent_local_task(marker: &Value, local_task_id: &str) -> bool {
    marker.get("source").and_then(Value::as_str) == Some("jira-task-forge")
        && marker.get("kind").and_then(Value::as_str) == Some("parent")
        && marker.get("localTaskId").and_then(Value::as_str) == Some(local_task_id)
}

#[cfg(test)]
mod tests {
    use super::{
        attachment_multipart_boundary, encode_path_segment, is_retryable_jira_read_error,
        multipart_attachment_body, normalize_jira_site_url, parse_empty_response, parse_response,
        JiraClient, JiraCredentials,
    };
    use crate::models::JiraAttachmentSettings;
    use serde_json::{json, Value};

    #[test]
    fn normalizes_standard_jira_cloud_site_roots() {
        assert_eq!(
            normalize_jira_site_url("https://SALMON-SIMON-DTS.atlassian.net/")
                .expect("url should normalize"),
            "https://salmon-simon-dts.atlassian.net"
        );
        assert_eq!(
            normalize_jira_site_url("https://salmonsimondts.atlassian.net")
                .expect("url should normalize"),
            "https://salmonsimondts.atlassian.net"
        );
    }

    #[test]
    fn rejects_empty_or_hostless_jira_urls() {
        assert_eq!(
            normalize_jira_site_url("").expect_err("empty url should fail"),
            "Jira site URL is required."
        );
        assert_eq!(
            normalize_jira_site_url("https://").expect_err("missing host should fail"),
            "Jira site URL must include a host."
        );
        assert_eq!(
            normalize_jira_site_url("https://bad host.atlassian.net")
                .expect_err("spaces should fail"),
            "Jira site URL must not include whitespace or control characters."
        );
    }

    #[test]
    fn rejects_unsupported_jira_site_url_shapes() {
        assert_eq!(
            normalize_jira_site_url("http://salmonsimondts.atlassian.net")
                .expect_err("http should fail"),
            "Jira site URL must start with https://."
        );
        assert_eq!(
            normalize_jira_site_url(" https://salmonsimondts.atlassian.net ")
                .expect_err("surrounding whitespace should fail"),
            "Jira site URL must not include whitespace or control characters."
        );
        assert_eq!(
            normalize_jira_site_url("https://user@salmonsimondts.atlassian.net")
                .expect_err("credentials should fail"),
            "Jira site URL must not include credentials."
        );
        assert_eq!(
            normalize_jira_site_url("https://salmonsimondts.atlassian.net:443")
                .expect_err("ports should fail"),
            "Jira site URL must not include a port."
        );
        assert_eq!(
            normalize_jira_site_url(
                "https://salmonsimondts.atlassian.net/jira/software/projects/STT/boards/1"
            )
            .expect_err("paths should fail"),
            "Jira site URL must be the Atlassian Cloud site root."
        );
        assert_eq!(
            normalize_jira_site_url("https://jira.example.com")
                .expect_err("custom domains require HITL"),
            "Jira site URL must use an Atlassian Cloud host."
        );
        assert_eq!(
            normalize_jira_site_url("https://team.eu.atlassian.net")
                .expect_err("multi-label hosts should fail"),
            "Jira site URL must use a standard Atlassian Cloud site host."
        );
    }

    #[test]
    fn encodes_path_segments_for_jira_urls() {
        assert_eq!(encode_path_segment("JTFTEST"), "JTFTEST");
        assert_eq!(encode_path_segment("issue type"), "issue%20type");
        assert_eq!(encode_path_segment("A/B"), "A%2FB");
        assert_eq!(encode_path_segment("éxito"), "%C3%A9xito");
    }

    #[test]
    fn redacts_jira_credentials_debug_output() {
        let credentials = JiraCredentials {
            site_url: "https://example.atlassian.net".to_string(),
            account_email: "saimon@example.com".to_string(),
            api_token: "secret-api-token".to_string(),
        };

        let debug_output = format!("{credentials:?}");

        assert!(debug_output.contains("JiraCredentials"));
        assert!(debug_output.contains("https://example.atlassian.net"));
        assert!(debug_output.contains("saimon@example.com"));
        assert!(debug_output.contains("<redacted>"));
        assert!(!debug_output.contains("secret-api-token"));
    }

    #[test]
    fn redacts_jira_client_debug_output() {
        let client = JiraClient::new(JiraCredentials {
            site_url: "https://example.atlassian.net".to_string(),
            account_email: "saimon@example.com".to_string(),
            api_token: "secret-api-token".to_string(),
        });

        let debug_output = format!("{client:?}");

        assert!(debug_output.contains("JiraClient"));
        assert!(debug_output.contains("https://example.atlassian.net"));
        assert!(debug_output.contains("<redacted>"));
        assert!(!debug_output.contains("secret-api-token"));
        assert!(!debug_output.contains("Basic "));
    }

    #[test]
    fn builds_authenticated_json_requests_for_jira() {
        let client = JiraClient::new(JiraCredentials {
            site_url: "https://example.atlassian.net".to_string(),
            account_email: "saimon@example.com".to_string(),
            api_token: "secret-api-token".to_string(),
        });

        let get_request = client.get("/rest/api/3/myself");
        assert_eq!(get_request.method(), "GET");
        assert_eq!(
            get_request.url(),
            "https://example.atlassian.net/rest/api/3/myself"
        );
        assert_eq!(get_request.header("Accept"), Some("application/json"));
        assert!(get_request
            .header("Authorization")
            .expect("authorization header")
            .starts_with("Basic "));

        let post_request = client.post("/rest/api/3/issue");
        assert_eq!(post_request.method(), "POST");
        assert_eq!(
            post_request.header("Content-Type"),
            Some("application/json")
        );

        let post_read_request = client.post_read("/rest/api/3/search/jql");
        assert_eq!(post_read_request.method(), "POST");
        assert_eq!(
            post_read_request.url(),
            "https://example.atlassian.net/rest/api/3/search/jql"
        );

        let put_request = client.put("/rest/api/3/issue/JTFTEST-1");
        assert_eq!(put_request.method(), "PUT");
        assert_eq!(put_request.header("Content-Type"), Some("application/json"));
    }

    #[test]
    fn builds_jira_browse_urls_with_encoded_issue_keys() {
        let client = JiraClient::new(JiraCredentials {
            site_url: "https://example.atlassian.net".to_string(),
            account_email: "saimon@example.com".to_string(),
            api_token: "secret-api-token".to_string(),
        });

        assert_eq!(
            client.issue_browse_url("JTFTEST/1"),
            "https://example.atlassian.net/browse/JTFTEST%2F1"
        );
    }

    #[test]
    fn validates_required_inputs_before_jira_network_calls() {
        let client = JiraClient::new(JiraCredentials {
            site_url: "https://example.atlassian.net".to_string(),
            account_email: "saimon@example.com".to_string(),
            api_token: "secret-api-token".to_string(),
        });

        assert_eq!(
            client
                .search_jql("   ", 50)
                .expect_err("empty JQL should fail before request"),
            "JQL query is required."
        );
        assert_eq!(
            client
                .get_create_issue_metadata("  ")
                .expect_err("empty project key should fail before request"),
            "Jira creation project key is required."
        );
        assert_eq!(
            client
                .update_issue_fields("  ", json!({}))
                .expect_err("empty issue key should fail before request"),
            "Jira issue key is required."
        );
    }

    #[test]
    fn parses_successful_json_responses() {
        let response =
            ureq::Response::new(200, "OK", r#"{"name":"Jira"}"#).expect("response builds");

        let parsed: Value =
            parse_response(Ok(response), "Jira connection test", None).expect("json parses");

        assert_eq!(parsed["name"], "Jira");
    }

    #[test]
    fn parses_attachment_settings_responses() {
        let response =
            ureq::Response::new(200, "OK", r#"{"enabled":true,"uploadLimit":1000000000}"#)
                .expect("response builds");

        let parsed: JiraAttachmentSettings =
            parse_response(Ok(response), "Jira attachment settings", None)
                .expect("attachment settings parse");

        assert!(parsed.enabled);
        assert_eq!(parsed.upload_limit, 1_000_000_000);
    }

    #[test]
    fn reports_malformed_json_responses() {
        let response = ureq::Response::new(200, "OK", "not json").expect("response builds");

        let error = parse_response::<Value>(Ok(response), "Jira connection test", None)
            .expect_err("malformed json should fail");

        assert!(error.starts_with("Jira connection test returned an unexpected payload:"));
    }

    #[test]
    fn maps_auth_status_responses_to_actionable_errors() {
        let response =
            ureq::Response::new(401, "Unauthorized", r#"{"errorMessages":["bad token"]}"#)
                .expect("response builds");

        let error = parse_response::<Value>(
            Err(ureq::Error::Status(401, response)),
            "Jira connection test",
            Some("Jira rejected the email or API token."),
        )
        .expect_err("auth failure should use friendly message");

        assert_eq!(error, "Jira rejected the email or API token.");
    }

    #[test]
    fn includes_jira_error_messages_from_status_responses() {
        let response = ureq::Response::new(
            400,
            "Bad Request",
            r#"{"errorMessages":["The JQL query is invalid."]}"#,
        )
        .expect("response builds");

        let error = parse_response::<Value>(
            Err(ureq::Error::Status(400, response)),
            "Jira JQL search",
            None,
        )
        .expect_err("status failure should fail");

        assert_eq!(
            error,
            "Jira JQL search failed with HTTP 400: The JQL query is invalid."
        );
    }

    #[test]
    fn redacts_secret_fragments_from_status_error_messages() {
        let response = ureq::Response::new(
            400,
            "Bad Request",
            r#"{"errorMessages":["Proxy leaked Authorization: Bearer jira-secret-token"]}"#,
        )
        .expect("response builds");

        let error = parse_response::<Value>(
            Err(ureq::Error::Status(400, response)),
            "Jira JQL search",
            None,
        )
        .expect_err("status failure should fail");

        assert_eq!(
            error,
            "Jira JQL search failed with HTTP 400: Proxy leaked Authorization: Bearer <redacted>"
        );
        assert!(!error.contains("jira-secret-token"));
    }

    #[test]
    fn reports_status_without_jira_error_body() {
        let response = ureq::Response::new(500, "Server Error", "{}").expect("response builds");

        let error = parse_response::<Value>(
            Err(ureq::Error::Status(500, response)),
            "Jira JQL search",
            None,
        )
        .expect_err("status failure should fail");

        assert_eq!(error, "Jira JQL search failed with HTTP 500.");
    }

    #[test]
    fn parses_empty_update_responses() {
        let response = ureq::Response::new(204, "No Content", "").expect("response builds");

        parse_empty_response(Ok(response), "Jira issue update").expect("empty response is ok");
    }

    #[test]
    fn creates_rfc_safe_multipart_boundary() {
        let boundary = attachment_multipart_boundary();

        assert!(boundary.len() <= 70);
        assert!(boundary.starts_with("jtf-"));
        assert!(boundary
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-'));
    }

    #[test]
    fn sanitizes_multipart_attachment_headers() {
        let body = multipart_attachment_body(
            "boundary",
            "folder/bad\"\r\nX-Bad: yes.txt",
            Some("text/plain\r\nX-Injected: yes"),
            b"bytes",
        );
        let body_text = String::from_utf8(body).expect("multipart body is utf8 around headers");

        assert!(body_text.contains("filename=\"bad---X-Bad- yes.txt\""));
        assert!(body_text.contains("Content-Type: application/octet-stream"));
        assert!(!body_text.contains("\r\nX-Bad: yes"));
        assert!(!body_text.contains("\r\nX-Injected: yes"));
    }

    #[test]
    fn includes_jira_error_messages_from_empty_response_failures() {
        let response = ureq::Response::new(
            400,
            "Bad Request",
            r#"{"errors":{"priority":"Priority is required"}}"#,
        )
        .expect("response builds");

        let error =
            parse_empty_response(Err(ureq::Error::Status(400, response)), "Jira issue update")
                .expect_err("status failure should fail");

        assert_eq!(
            error,
            "Jira issue update failed with HTTP 400: priority: Priority is required"
        );
    }

    #[test]
    fn classifies_retryable_jira_read_errors() {
        assert!(is_retryable_jira_read_error(
            "Jira create field metadata could not reach Jira: Connection Failed: Connect error: connection timed out"
        ));
        assert!(is_retryable_jira_read_error(
            "Jira JQL search could not reach Jira: operation timed out"
        ));
        assert!(is_retryable_jira_read_error(
            "Jira JQL search could not reach Jira: connection reset by peer"
        ));
        assert!(is_retryable_jira_read_error(
            "Jira JQL search could not reach Jira: connection closed before message completed"
        ));
        assert!(!is_retryable_jira_read_error(
            "Jira create metadata failed with HTTP 400: project is invalid"
        ));
    }
}
