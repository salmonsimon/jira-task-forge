use std::time::Duration;

use base64::Engine;
use serde::de::DeserializeOwned;
use serde_json::{json, Value};

use super::jira_mapping::{
    jira_error_message, map_create_field, map_issue, JiraCreateFieldsApiResponse,
    JiraCreateIssueTypesApiResponse, JiraSearchApiResponse,
};
use crate::models::{
    JiraCreateIssueResponse, JiraCreateIssueTypeMetadata, JiraCreateMetadata, JiraMyself,
    JqlSearchResponse,
};

const READ_REQUEST_TIMEOUT: Duration = Duration::from_secs(45);
const WRITE_REQUEST_TIMEOUT: Duration = Duration::from_secs(15);
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

pub fn normalize_jira_site_url(raw_site_url: &str) -> Result<String, String> {
    let trimmed = raw_site_url.trim();
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

fn is_retryable_jira_read_error(message: &str) -> bool {
    message.contains("could not reach Jira")
        && (message.contains("timed out")
            || message.contains("timeout")
            || message.contains("Connection Failed")
            || message.contains("connection reset")
            || message.contains("connection closed"))
}

#[cfg(test)]
mod tests {
    use super::{
        encode_path_segment, is_retryable_jira_read_error, normalize_jira_site_url, JiraClient,
        JiraCredentials,
    };

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
    fn rejects_empty_or_hostless_jira_urls() {
        assert_eq!(
            normalize_jira_site_url("  ").expect_err("empty url should fail"),
            "Jira site URL is required."
        );
        assert_eq!(
            normalize_jira_site_url("https://").expect_err("missing host should fail"),
            "Jira site URL must include a host."
        );
        assert_eq!(
            normalize_jira_site_url("https://bad host.atlassian.net")
                .expect_err("spaces should fail"),
            "Jira site URL must not include spaces."
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
    fn classifies_retryable_jira_read_errors() {
        assert!(is_retryable_jira_read_error(
            "Jira create field metadata could not reach Jira: Connection Failed: Connect error: connection timed out"
        ));
        assert!(!is_retryable_jira_read_error(
            "Jira create metadata failed with HTTP 400: project is invalid"
        ));
    }
}
