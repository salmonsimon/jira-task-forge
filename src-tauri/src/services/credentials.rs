use super::AppServices;
use crate::integrations::ai::AiProvider;

pub(in crate::services) const JIRA_CREDENTIAL_SERVICE: &str = "jira-task-forge:jira";
pub(in crate::services) const JIRA_API_TOKEN_ACCOUNT: &str = "api-token";
pub(in crate::services) const AI_API_KEY_ACCOUNT: &str = "api-key";
pub(in crate::services) const NOTION_CREDENTIAL_SERVICE: &str = "jira-task-forge:notion";
pub(in crate::services) const NOTION_INTEGRATION_TOKEN_ACCOUNT: &str = "integration-token";

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
