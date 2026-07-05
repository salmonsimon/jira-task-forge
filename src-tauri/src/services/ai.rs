use super::credentials::AI_API_KEY_ACCOUNT;
use super::AppServices;
use crate::integrations::ai::{ai_model_or_default, AiClient, AiCredentials, AiProvider};
use crate::models::{AssistedDescriptionDraft, JqlAiDraft};
use crate::repositories::{CategoryRepository, TaskRepository};

impl AppServices {
    pub fn draft_jql_with_ai(&self, prompt: &str) -> Result<JqlAiDraft, String> {
        let settings = self
            .get_app_settings()
            .map_err(|error| format!("Could not load AI settings: {error}"))?;
        let provider = AiProvider::from_settings_value(&settings.ai_provider)?;
        let client = self.ai_client(provider)?;
        let model = ai_model_or_default(provider, &settings.ai_model);
        client.draft_jql(&model, prompt, Some(&settings.jira_creation_project_key))
    }

    pub fn generate_task_description(
        &self,
        task_id: &str,
        additional_context: Option<&str>,
    ) -> Result<AssistedDescriptionDraft, String> {
        let settings = self
            .get_app_settings()
            .map_err(|error| format!("Could not load AI settings: {error}"))?;
        let provider = AiProvider::from_settings_value(&settings.ai_provider)?;
        let client = self.ai_client(provider)?;
        let model = ai_model_or_default(provider, &settings.ai_model);
        let task = {
            let connection = self.connection();
            TaskRepository::new(&connection)
                .find_by_id(task_id)
                .map_err(|error| format!("Could not load task: {error}"))?
        }
        .ok_or_else(|| "Task not found.".to_string())?;

        let catalog_context = {
            let connection = self.connection();
            CategoryRepository::new(&connection)
                .catalog_template_context_for_area(
                    &task.area,
                    &format!(
                        "{}
{}
{}",
                        task.title,
                        additional_context.unwrap_or_default(),
                        task.description.as_deref().unwrap_or_default()
                    ),
                )
                .map_err(|error| format!("Could not load catalog template context: {error}"))?
        };

        client.draft_task_description(
            &model,
            &task,
            additional_context,
            catalog_context.as_deref(),
        )
    }

    pub fn test_ai_provider_connection(&self) -> Result<String, String> {
        let settings = self
            .get_app_settings()
            .map_err(|error| format!("Could not load AI settings: {error}"))?;
        let provider = AiProvider::from_settings_value(&settings.ai_provider)?;
        let model = ai_model_or_default(provider, &settings.ai_model);

        self.ai_client(provider)?.test_connection(&model)?;
        Ok(format!("{} connection succeeded.", provider.label()))
    }

    pub fn test_ai_provider_connection_with_api_key(
        &self,
        ai_provider: &str,
        api_key: &str,
    ) -> Result<String, String> {
        let provider = AiProvider::from_settings_value(ai_provider)?;
        let model = self.model_for_ai_provider(provider)?;

        self.ai_client_with_api_key(provider, api_key)?
            .test_connection(&model)?;
        Ok(format!("{} connection succeeded.", provider.label()))
    }

    pub fn list_ai_provider_models(
        &self,
        ai_provider: &str,
        api_key: Option<&str>,
    ) -> Result<Vec<String>, String> {
        let provider = AiProvider::from_settings_value(ai_provider)?;
        let models = match api_key.map(str::trim).filter(|value| !value.is_empty()) {
            Some(api_key) => self
                .ai_client_with_api_key(provider, api_key)?
                .list_models()?,
            None => self.ai_client(provider)?.list_models()?,
        };

        if models.is_empty() {
            Ok(provider
                .fallback_models()
                .iter()
                .map(|model| (*model).to_string())
                .collect())
        } else {
            Ok(models)
        }
    }

    fn ai_client(&self, provider: AiProvider) -> Result<AiClient, String> {
        let api_key = self.ai_provider_api_key(provider)?;
        self.ai_client_with_api_key(provider, &api_key)
    }

    fn ai_client_with_api_key(
        &self,
        provider: AiProvider,
        api_key: &str,
    ) -> Result<AiClient, String> {
        let api_key = api_key.trim();
        if api_key.is_empty() {
            return Err(format!("{} API key cannot be empty.", provider.label()));
        }

        Ok(AiClient::new(AiCredentials {
            provider,
            api_key: api_key.to_string(),
        }))
    }

    fn ai_provider_api_key(&self, provider: AiProvider) -> Result<String, String> {
        let entry = keyring::Entry::new(provider.credential_service(), AI_API_KEY_ACCOUNT)
            .map_err(|error| format!("Could not open OS credential store: {error}"))?;
        match entry.get_password() {
            Ok(api_key) if api_key.trim().is_empty() => Err(format!(
                "{} API key is empty. Save a new API key in Settings.",
                provider.label()
            )),
            Ok(api_key) => Ok(api_key.trim().to_string()),
            Err(keyring::Error::NoEntry) => {
                Err(format!("{} API key is required.", provider.label()))
            }
            Err(error) => Err(format!(
                "Could not read {} API key: {error}",
                provider.label()
            )),
        }
    }

    fn model_for_ai_provider(&self, provider: AiProvider) -> Result<String, String> {
        let settings = self
            .get_app_settings()
            .map_err(|error| format!("Could not load AI settings: {error}"))?;
        let selected_provider = AiProvider::from_settings_value(&settings.ai_provider).ok();
        if selected_provider == Some(provider) {
            Ok(ai_model_or_default(provider, &settings.ai_model))
        } else {
            Ok(provider.default_model().to_string())
        }
    }
}
