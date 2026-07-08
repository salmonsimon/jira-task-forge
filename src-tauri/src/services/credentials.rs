use super::AppServices;
use crate::area_catalog::test_notion_catalog_page;
use crate::integrations::ai::AiProvider;
use crate::notion_oauth::{
    build_notion_oauth_start_result, validate_backend_start_response, validate_exchange_response,
    validate_oauth_completion, NotionOAuthBackendStartResponse, NotionOAuthExchangeRequest,
    NotionOAuthExchangeResponse, NotionOAuthStartResult, NotionOAuthTokenSet,
};
use uuid::Uuid;

pub(in crate::services) const JIRA_CREDENTIAL_SERVICE: &str = "jira-task-forge:jira";
pub(in crate::services) const JIRA_API_TOKEN_ACCOUNT: &str = "api-token";
pub(in crate::services) const AI_API_KEY_ACCOUNT: &str = "api-key";
pub(in crate::services) const NOTION_CREDENTIAL_SERVICE: &str = "jira-task-forge:notion";
pub(in crate::services) const NOTION_INTEGRATION_TOKEN_ACCOUNT: &str = "integration-token";
const NOTION_OAUTH_PENDING_STATE_ACCOUNT: &str = "oauth-pending-state";
const NOTION_OAUTH_CLIENT_ID_ENV: &str = "JTF_NOTION_OAUTH_CLIENT_ID";
const NOTION_OAUTH_REDIRECT_URI_ENV: &str = "JTF_NOTION_OAUTH_REDIRECT_URI";
const NOTION_OAUTH_BACKEND_BASE_URL_ENV: &str = "JTF_NOTION_OAUTH_BACKEND_BASE_URL";
const NOTION_OAUTH_START_URL_ENV: &str = "JTF_NOTION_OAUTH_START_URL";
const NOTION_OAUTH_EXCHANGE_URL_ENV: &str = "JTF_NOTION_OAUTH_EXCHANGE_URL";
const DEFAULT_NOTION_OAUTH_BACKEND_BASE_URL: &str = "https://notion-oauth.salmonsimon.com";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(in crate::services) struct IntegrationCredentialDescriptor {
    pub label: &'static str,
    pub service: &'static str,
    pub account: &'static str,
    pub windows_target: &'static str,
}

pub(in crate::services) fn integration_credential_descriptors(
) -> &'static [IntegrationCredentialDescriptor] {
    &[
        IntegrationCredentialDescriptor {
            label: "Jira API token",
            service: JIRA_CREDENTIAL_SERVICE,
            account: JIRA_API_TOKEN_ACCOUNT,
            windows_target: "api-token.jira-task-forge:jira",
        },
        IntegrationCredentialDescriptor {
            label: "OpenAI API key",
            service: "jira-task-forge:openai",
            account: AI_API_KEY_ACCOUNT,
            windows_target: "api-key.jira-task-forge:openai",
        },
        IntegrationCredentialDescriptor {
            label: "Claude API key",
            service: "jira-task-forge:claude",
            account: AI_API_KEY_ACCOUNT,
            windows_target: "api-key.jira-task-forge:claude",
        },
        IntegrationCredentialDescriptor {
            label: "Gemini API key",
            service: "jira-task-forge:gemini",
            account: AI_API_KEY_ACCOUNT,
            windows_target: "api-key.jira-task-forge:gemini",
        },
        IntegrationCredentialDescriptor {
            label: "Notion OAuth access token",
            service: NOTION_CREDENTIAL_SERVICE,
            account: NOTION_INTEGRATION_TOKEN_ACCOUNT,
            windows_target: "integration-token.jira-task-forge:notion",
        },
    ]
}

pub(in crate::services) fn windows_credential_manager_target(
    service: &str,
    account: &str,
) -> String {
    format!("{account}.{service}")
}

impl AppServices {
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

    pub fn has_ai_provider_api_key(&self, ai_provider: &str) -> Result<bool, String> {
        let provider = AiProvider::from_settings_value(ai_provider)?;
        let entry = keyring::Entry::new(provider.credential_service(), AI_API_KEY_ACCOUNT)
            .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        match entry.get_password() {
            Ok(_) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(error) => Err(format!(
                "Could not read {} API key status: {error}",
                provider.label()
            )),
        }
    }

    pub fn save_ai_provider_api_key(&self, ai_provider: &str, api_key: &str) -> Result<(), String> {
        let provider = AiProvider::from_settings_value(ai_provider)?;
        let api_key = api_key.trim();
        if api_key.is_empty() {
            return Err(format!("{} API key cannot be empty.", provider.label()));
        }

        let entry = keyring::Entry::new(provider.credential_service(), AI_API_KEY_ACCOUNT)
            .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        entry
            .set_password(api_key)
            .map_err(|error| format!("Could not save {} API key: {error}", provider.label()))?;
        entry
            .get_password()
            .map_err(|error| format!("Could not verify {} API key: {error}", provider.label()))?;
        Ok(())
    }

    pub fn delete_ai_provider_api_key(&self, ai_provider: &str) -> Result<(), String> {
        let provider = AiProvider::from_settings_value(ai_provider)?;
        let entry = keyring::Entry::new(provider.credential_service(), AI_API_KEY_ACCOUNT)
            .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(format!(
                "Could not remove {} API key: {error}",
                provider.label()
            )),
        }
    }

    pub fn has_notion_integration_token(&self) -> Result<bool, String> {
        let entry =
            keyring::Entry::new(NOTION_CREDENTIAL_SERVICE, NOTION_INTEGRATION_TOKEN_ACCOUNT)
                .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        match entry.get_password() {
            Ok(_) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(error) => Err(format!("Could not read Notion token status: {error}")),
        }
    }

    pub fn save_notion_integration_token(&self, token: &str) -> Result<(), String> {
        let token = token.trim();
        if token.is_empty() {
            return Err("Notion integration token cannot be empty.".to_string());
        }

        let entry =
            keyring::Entry::new(NOTION_CREDENTIAL_SERVICE, NOTION_INTEGRATION_TOKEN_ACCOUNT)
                .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        entry
            .set_password(token)
            .map_err(|error| format!("Could not save Notion token: {error}"))?;
        entry
            .get_password()
            .map_err(|error| format!("Could not verify Notion token: {error}"))?;
        Ok(())
    }

    pub fn delete_notion_integration_token(&self) -> Result<(), String> {
        let entry =
            keyring::Entry::new(NOTION_CREDENTIAL_SERVICE, NOTION_INTEGRATION_TOKEN_ACCOUNT)
                .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(format!("Could not remove Notion token: {error}")),
        }
    }

    pub fn start_notion_oauth_connection(&self) -> Result<NotionOAuthStartResult, String> {
        let client_id = std::env::var(NOTION_OAUTH_CLIENT_ID_ENV).unwrap_or_default();
        let redirect_uri = std::env::var(NOTION_OAUTH_REDIRECT_URI_ENV).unwrap_or_default();
        let state = format!("jtf_{}", Uuid::new_v4().simple());
        let result = if client_id.trim().is_empty() || redirect_uri.trim().is_empty() {
            start_notion_oauth_with_backend(&state)?
        } else {
            build_notion_oauth_start_result(&client_id, &redirect_uri, &state)?
        };
        self.save_pending_notion_oauth_state(&result.state)?;
        Ok(result)
    }

    pub fn complete_notion_oauth_connection(
        &self,
        authorization_code: &str,
        returned_state: &str,
        page_url_or_id: &str,
    ) -> Result<crate::area_catalog::NotionCatalogConnectionTestResult, String> {
        let expected_state = self.pending_notion_oauth_state()?;
        let exchange_request =
            validate_oauth_completion(authorization_code, returned_state, &expected_state)?;
        self.delete_pending_notion_oauth_state()?;
        let token_set = exchange_notion_oauth_code(exchange_request)?;
        let test_result = test_notion_catalog_page(&token_set.access_token, page_url_or_id)?;
        if !test_result.ok {
            return Err(test_result.message);
        }
        self.save_notion_oauth_token_set(&token_set)?;
        Ok(test_result)
    }

    fn save_pending_notion_oauth_state(&self, state: &str) -> Result<(), String> {
        let entry = keyring::Entry::new(
            NOTION_CREDENTIAL_SERVICE,
            NOTION_OAUTH_PENDING_STATE_ACCOUNT,
        )
        .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        entry
            .set_password(state)
            .map_err(|error| format!("Could not save pending Notion OAuth state: {error}"))
    }

    fn pending_notion_oauth_state(&self) -> Result<String, String> {
        let entry = keyring::Entry::new(
            NOTION_CREDENTIAL_SERVICE,
            NOTION_OAUTH_PENDING_STATE_ACCOUNT,
        )
        .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        match entry.get_password() {
            Ok(state) => Ok(state),
            Err(keyring::Error::NoEntry) => {
                Err("Start Notion OAuth before completing the connection.".to_string())
            }
            Err(error) => Err(format!(
                "Could not read pending Notion OAuth state: {error}"
            )),
        }
    }

    fn delete_pending_notion_oauth_state(&self) -> Result<(), String> {
        let entry = keyring::Entry::new(
            NOTION_CREDENTIAL_SERVICE,
            NOTION_OAUTH_PENDING_STATE_ACCOUNT,
        )
        .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(format!(
                "Could not remove pending Notion OAuth state: {error}"
            )),
        }
    }

    pub(in crate::services) fn notion_integration_token(&self) -> Result<String, String> {
        let entry =
            keyring::Entry::new(NOTION_CREDENTIAL_SERVICE, NOTION_INTEGRATION_TOKEN_ACCOUNT)
                .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        match entry.get_password() {
            Ok(token) if token.trim().is_empty() => {
                Err("Notion integration token is empty. Save a new token.".to_string())
            }
            Ok(token) => notion_access_token_from_credential_value(&token),
            Err(keyring::Error::NoEntry) => {
                Err("Save a Notion integration token before syncing the catalog.".to_string())
            }
            Err(error) => Err(format!("Could not read Notion token: {error}")),
        }
    }

    fn save_notion_oauth_token_set(&self, token_set: &NotionOAuthTokenSet) -> Result<(), String> {
        let credential_value = serde_json::to_string(token_set)
            .map_err(|error| format!("Could not serialize Notion OAuth token set: {error}"))?;
        self.save_notion_integration_token(&credential_value)
    }
}

fn exchange_notion_oauth_code(
    request: NotionOAuthExchangeRequest,
) -> Result<NotionOAuthTokenSet, String> {
    let exchange_url =
        configured_notion_oauth_endpoint(NOTION_OAUTH_EXCHANGE_URL_ENV, "/notion/oauth/exchange")?;

    let response = ureq::post(&exchange_url)
        .set("Accept", "application/json")
        .set("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(20))
        .send_json(serde_json::json!(request))
        .map_err(notion_oauth_exchange_error)?;

    let exchange_response = response
        .into_json::<NotionOAuthExchangeResponse>()
        .map_err(|error| format!("Notion OAuth exchange returned invalid JSON: {error}"))?;

    validate_exchange_response(exchange_response)
}

fn notion_access_token_from_credential_value(credential_value: &str) -> Result<String, String> {
    let credential_value = credential_value.trim();
    if credential_value.starts_with('{') {
        let token_set = serde_json::from_str::<NotionOAuthTokenSet>(credential_value)
            .map_err(|error| format!("Could not read saved Notion OAuth token set: {error}"))?;
        if token_set.access_token.trim().is_empty() {
            return Err("Notion OAuth access token is empty. Reconnect Notion.".to_string());
        }
        return Ok(token_set.access_token.trim().to_string());
    }
    Ok(credential_value.to_string())
}

fn start_notion_oauth_with_backend(state: &str) -> Result<NotionOAuthStartResult, String> {
    let start_url =
        configured_notion_oauth_endpoint(NOTION_OAUTH_START_URL_ENV, "/notion/oauth/start")?;
    let response = ureq::post(&start_url)
        .set("Accept", "application/json")
        .set("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(20))
        .send_json(serde_json::json!({ "state": state }))
        .map_err(notion_oauth_start_error)?;

    let backend_response = response
        .into_json::<NotionOAuthBackendStartResponse>()
        .map_err(|error| format!("Notion OAuth backend returned invalid JSON: {error}"))?;
    let authorization_url = validate_backend_start_response(backend_response)?;
    Ok(NotionOAuthStartResult {
        authorization_url,
        state: state.to_string(),
    })
}

fn configured_notion_oauth_endpoint(
    explicit_url_env: &str,
    default_path: &str,
) -> Result<String, String> {
    let explicit_url = std::env::var(explicit_url_env).unwrap_or_default();
    notion_oauth_endpoint_url(
        explicit_url.trim(),
        std::env::var(NOTION_OAUTH_BACKEND_BASE_URL_ENV)
            .unwrap_or_else(|_| DEFAULT_NOTION_OAUTH_BACKEND_BASE_URL.to_string())
            .trim(),
        default_path,
    )
}

fn notion_oauth_endpoint_url(
    explicit_url: &str,
    backend_base_url: &str,
    default_path: &str,
) -> Result<String, String> {
    let endpoint = if explicit_url.trim().is_empty() {
        format!(
            "{}/{}",
            backend_base_url.trim().trim_end_matches('/'),
            default_path.trim_start_matches('/')
        )
    } else {
        explicit_url.trim().to_string()
    };
    validate_notion_oauth_backend_url(&endpoint)?;
    Ok(endpoint)
}

fn validate_notion_oauth_backend_url(url: &str) -> Result<(), String> {
    let url = url.trim();
    let is_local_http =
        url.starts_with("http://127.0.0.1:") || url.starts_with("http://localhost:");
    if url.starts_with("https://") || is_local_http {
        return Ok(());
    }
    Err("Notion OAuth backend URL must use HTTPS, except for localhost development.".to_string())
}

fn notion_oauth_start_error(error: ureq::Error) -> String {
    match error {
        ureq::Error::Status(status, _) => {
            format!("Notion OAuth backend failed with HTTP {status}.")
        }
        ureq::Error::Transport(error) => {
            format!(
                "Could not reach Notion OAuth backend. Check {NOTION_OAUTH_BACKEND_BASE_URL_ENV} or the deployed Notion OAuth service: {error}"
            )
        }
    }
}

fn notion_oauth_exchange_error(error: ureq::Error) -> String {
    match error {
        ureq::Error::Status(status, _) => {
            format!("Notion OAuth exchange failed with HTTP {status}.")
        }
        ureq::Error::Transport(error) => {
            format!("Could not reach Notion OAuth exchange service: {error}")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        integration_credential_descriptors, notion_access_token_from_credential_value,
        notion_oauth_endpoint_url, windows_credential_manager_target,
        DEFAULT_NOTION_OAUTH_BACKEND_BASE_URL,
    };

    #[test]
    fn windows_credential_manager_targets_match_keyring_convention() {
        for descriptor in integration_credential_descriptors() {
            assert_eq!(
                windows_credential_manager_target(descriptor.service, descriptor.account),
                descriptor.windows_target,
                "{} Windows target must match the keyring crate convention",
                descriptor.label
            );
        }
    }

    #[test]
    fn notion_oauth_endpoint_defaults_to_local_backend_path() {
        let endpoint =
            notion_oauth_endpoint_url("", "http://127.0.0.1:5177/", "/notion/oauth/exchange")
                .expect("localhost endpoint is allowed");

        assert_eq!(endpoint, "http://127.0.0.1:5177/notion/oauth/exchange");
    }

    #[test]
    fn notion_oauth_endpoint_defaults_to_product_backend_path() {
        let endpoint = notion_oauth_endpoint_url(
            "",
            DEFAULT_NOTION_OAUTH_BACKEND_BASE_URL,
            "/notion/oauth/start",
        )
        .expect("product endpoint is allowed");

        assert_eq!(
            endpoint,
            "https://notion-oauth.salmonsimon.com/notion/oauth/start"
        );
    }

    #[test]
    fn notion_oauth_endpoint_requires_https_for_non_local_backends() {
        let error = notion_oauth_endpoint_url(
            "http://example.com/notion/oauth/exchange",
            "http://127.0.0.1:5177",
            "/notion/oauth/exchange",
        )
        .expect_err("remote http endpoint rejects");

        assert_eq!(
            error,
            "Notion OAuth backend URL must use HTTPS, except for localhost development."
        );
    }

    #[test]
    fn notion_oauth_credential_value_supports_legacy_plain_tokens() {
        assert_eq!(
            notion_access_token_from_credential_value(" legacy-token ").expect("token reads"),
            "legacy-token"
        );
    }

    #[test]
    fn notion_oauth_credential_value_reads_access_token_from_json_token_set() {
        let value = serde_json::json!({
            "accessToken": " access-token ",
            "refreshToken": "refresh-token"
        })
        .to_string();

        assert_eq!(
            notion_access_token_from_credential_value(&value).expect("token set reads"),
            "access-token"
        );
    }

    #[test]
    fn release_uninstall_hook_covers_every_integration_credential() {
        let hook = include_str!("../../nsis/credential-cleanup.nsh");
        for descriptor in integration_credential_descriptors() {
            assert!(
                hook.contains(descriptor.windows_target),
                "NSIS uninstall hook must remove {} credential target {}",
                descriptor.label,
                descriptor.windows_target
            );
        }
    }

    #[test]
    fn release_uninstall_hook_deletes_only_named_targets_without_listing_or_reading_secrets() {
        let hook = include_str!("../../nsis/credential-cleanup.nsh");

        assert!(hook.contains("cmdkey.exe"));
        assert!(hook.contains("/delete:"));
        assert!(
            !hook.contains("/list"),
            "NSIS hook must not enumerate Credential Manager entries"
        );
        assert!(
            !hook.contains("CredRead"),
            "NSIS hook must not read Credential Manager values"
        );
        assert!(
            !hook.contains("get_password"),
            "NSIS hook must not read keyring values"
        );
    }

    #[test]
    fn desktop_startup_does_not_attach_automatic_credential_cleanup() {
        let desktop_entrypoint = include_str!("../main.rs");

        assert!(
            !desktop_entrypoint.contains("purge_credentials_after_app_data_reset"),
            "desktop startup must not delete credentials just because app data is fresh or reset"
        );
        assert!(
            !desktop_entrypoint.contains("delete_all_integration_credentials"),
            "bulk credential cleanup must stay tied to uninstall, not ordinary app launch"
        );
    }
}
