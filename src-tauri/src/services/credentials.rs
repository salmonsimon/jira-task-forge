use super::AppServices;
use crate::integrations::ai::AiProvider;

pub(in crate::services) const JIRA_CREDENTIAL_SERVICE: &str = "jira-task-forge:jira";
pub(in crate::services) const JIRA_API_TOKEN_ACCOUNT: &str = "api-token";
pub(in crate::services) const AI_API_KEY_ACCOUNT: &str = "api-key";

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
}
