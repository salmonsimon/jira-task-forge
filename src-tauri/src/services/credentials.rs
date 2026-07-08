use super::AppServices;
use crate::integrations::ai::AiProvider;

pub(in crate::services) const JIRA_CREDENTIAL_SERVICE: &str = "jira-task-forge:jira";
pub(in crate::services) const JIRA_API_TOKEN_ACCOUNT: &str = "api-token";
pub(in crate::services) const AI_API_KEY_ACCOUNT: &str = "api-key";
pub(in crate::services) const NOTION_CREDENTIAL_SERVICE: &str = "jira-task-forge:notion";
pub(in crate::services) const NOTION_INTEGRATION_TOKEN_ACCOUNT: &str = "integration-token";

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
            label: "Notion integration token",
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

    pub(in crate::services) fn notion_integration_token(&self) -> Result<String, String> {
        let entry =
            keyring::Entry::new(NOTION_CREDENTIAL_SERVICE, NOTION_INTEGRATION_TOKEN_ACCOUNT)
                .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        match entry.get_password() {
            Ok(token) if token.trim().is_empty() => {
                Err("Notion integration token is empty. Save a new token.".to_string())
            }
            Ok(token) => Ok(token.trim().to_string()),
            Err(keyring::Error::NoEntry) => {
                Err("Save a Notion integration token before syncing the catalog.".to_string())
            }
            Err(error) => Err(format!("Could not read Notion token: {error}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{integration_credential_descriptors, windows_credential_manager_target};

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
