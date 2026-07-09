use serde::{Deserialize, Serialize};

const NOTION_OAUTH_AUTHORIZE_URL: &str = "https://api.notion.com/v1/oauth/authorize";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionOAuthStartResult {
    pub authorization_url: String,
    pub state: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionOAuthConnectionResult {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionOAuthExchangeRequest {
    pub authorization_code: String,
    pub state: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionOAuthExchangeResponse {
    #[serde(alias = "access_token")]
    pub access_token: String,
    #[serde(default, alias = "refresh_token")]
    pub refresh_token: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionOAuthTokenSet {
    pub access_token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionOAuthBackendStartResponse {
    pub authorization_url: String,
}

pub fn build_notion_oauth_start_result(
    client_id: &str,
    redirect_uri: &str,
    state: &str,
) -> Result<NotionOAuthStartResult, String> {
    let client_id = client_id.trim();
    let redirect_uri = redirect_uri.trim();
    let state = state.trim();
    if client_id.is_empty() {
        return Err("JTF_NOTION_OAUTH_CLIENT_ID is required to start Notion OAuth.".to_string());
    }
    if redirect_uri.is_empty() {
        return Err("JTF_NOTION_OAUTH_REDIRECT_URI is required to start Notion OAuth.".to_string());
    }
    validate_oauth_state(state)?;

    Ok(NotionOAuthStartResult {
        authorization_url: format!(
            "{NOTION_OAUTH_AUTHORIZE_URL}?client_id={}&response_type=code&owner=user&redirect_uri={}&state={}",
            url_component(client_id),
            url_component(redirect_uri),
            url_component(state)
        ),
        state: state.to_string(),
    })
}

pub fn validate_oauth_state(state: &str) -> Result<(), String> {
    let state = state.trim();
    if state.len() < 24 {
        return Err("Notion OAuth state is missing or invalid.".to_string());
    }
    if !state
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err("Notion OAuth state contains invalid characters.".to_string());
    }
    Ok(())
}

pub fn validate_oauth_completion(
    authorization_code: &str,
    returned_state: &str,
    expected_state: &str,
) -> Result<NotionOAuthExchangeRequest, String> {
    let authorization_code = authorization_code.trim();
    if authorization_code.is_empty() {
        return Err("Notion OAuth authorization code is required.".to_string());
    }
    validate_oauth_state(returned_state)?;
    validate_oauth_state(expected_state)?;
    if returned_state.trim() != expected_state.trim() {
        return Err("Notion OAuth state mismatch. Restart the connection flow.".to_string());
    }

    Ok(NotionOAuthExchangeRequest {
        authorization_code: authorization_code.to_string(),
        state: returned_state.trim().to_string(),
    })
}

pub fn validate_exchange_response(
    response: NotionOAuthExchangeResponse,
) -> Result<NotionOAuthTokenSet, String> {
    let access_token = response.access_token.trim();
    if access_token.is_empty() {
        return Err("OAuth exchange did not return a Notion access token.".to_string());
    }
    Ok(NotionOAuthTokenSet {
        access_token: access_token.to_string(),
        refresh_token: response
            .refresh_token
            .map(|token| token.trim().to_string())
            .filter(|token| !token.is_empty()),
    })
}

pub fn validate_backend_start_response(
    response: NotionOAuthBackendStartResponse,
) -> Result<String, String> {
    let authorization_url = response.authorization_url.trim();
    if authorization_url.is_empty() {
        return Err("Notion OAuth backend did not return an authorization URL.".to_string());
    }
    if !authorization_url.starts_with("https://api.notion.com/v1/oauth/authorize?") {
        return Err("Notion OAuth backend returned an unexpected authorization URL.".to_string());
    }
    if authorization_url.contains("secret") {
        return Err("Notion OAuth authorization URL must not contain secrets.".to_string());
    }
    Ok(authorization_url.to_string())
}

fn url_component(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

#[cfg(test)]
mod tests {
    use super::{
        build_notion_oauth_start_result, validate_backend_start_response,
        validate_exchange_response, validate_oauth_completion, NotionOAuthBackendStartResponse,
        NotionOAuthExchangeResponse,
    };

    #[test]
    fn notion_oauth_authorization_url_includes_state_and_redirect_without_secret() {
        let result = build_notion_oauth_start_result(
            "public-client-id",
            "jtf://notion/oauth callback",
            "state_123456789012345678901",
        )
        .expect("authorization url builds");

        assert!(result
            .authorization_url
            .starts_with("https://api.notion.com/v1/oauth/authorize?"));
        assert!(result
            .authorization_url
            .contains("client_id=public-client-id"));
        assert!(result.authorization_url.contains("response_type=code"));
        assert!(result.authorization_url.contains("owner=user"));
        assert!(result
            .authorization_url
            .contains("redirect_uri=jtf%3A%2F%2Fnotion%2Foauth%20callback"));
        assert!(result
            .authorization_url
            .contains("state=state_123456789012345678901"));
        assert!(!result.authorization_url.contains("secret"));
    }

    #[test]
    fn notion_oauth_completion_rejects_state_mismatch_before_exchange() {
        let error = validate_oauth_completion(
            "code-123",
            "state_123456789012345678901",
            "state_999999999999999999999",
        )
        .expect_err("state mismatch rejects");

        assert_eq!(
            error,
            "Notion OAuth state mismatch. Restart the connection flow."
        );
    }

    #[test]
    fn notion_oauth_exchange_response_requires_access_token() {
        let error = validate_exchange_response(NotionOAuthExchangeResponse {
            access_token: "   ".to_string(),
            refresh_token: None,
        })
        .expect_err("empty token rejects");

        assert_eq!(
            error,
            "OAuth exchange did not return a Notion access token."
        );
    }

    #[test]
    fn notion_oauth_exchange_response_preserves_refresh_token() {
        let token_set = validate_exchange_response(NotionOAuthExchangeResponse {
            access_token: " access-token ".to_string(),
            refresh_token: Some(" refresh-token ".to_string()),
        })
        .expect("token set validates");

        assert_eq!(token_set.access_token, "access-token");
        assert_eq!(token_set.refresh_token.as_deref(), Some("refresh-token"));
    }

    #[test]
    fn notion_oauth_backend_start_response_rejects_secret_bearing_urls() {
        let error = validate_backend_start_response(NotionOAuthBackendStartResponse {
            authorization_url: "https://api.notion.com/v1/oauth/authorize?client_secret=leak"
                .to_string(),
        })
        .expect_err("secret-bearing authorization url rejects");

        assert_eq!(
            error,
            "Notion OAuth authorization URL must not contain secrets."
        );
    }

    #[test]
    fn credentials_notion_oauth_state_validation_rejects_short_values() {
        let error = validate_oauth_completion("code-123", "short", "short")
            .expect_err("short state rejects");

        assert_eq!(error, "Notion OAuth state is missing or invalid.");
    }
}
