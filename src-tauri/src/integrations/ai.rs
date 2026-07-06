mod features;
mod provider;
mod transport;

use crate::models::{AssistedDescriptionDraft, EpicScopePluralSuggestion, JqlAiDraft, LocalTask};

pub use provider::{ai_model_or_default, ai_provider_api_key_page_url, AiCredentials, AiProvider};
use transport::AiTransportClient;

#[derive(Clone, PartialEq, Eq)]
pub struct AiClient {
    provider: AiProvider,
    transport: AiTransportClient,
}

impl std::fmt::Debug for AiClient {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("AiClient")
            .field("provider", &self.provider)
            .field("api_key", &"<redacted>")
            .finish()
    }
}

impl AiClient {
    pub fn new(credentials: AiCredentials) -> Self {
        Self {
            provider: credentials.provider,
            transport: AiTransportClient::new(credentials.provider, credentials.api_key),
        }
    }

    pub fn draft_jql(
        &self,
        model: &str,
        prompt: &str,
        default_project_key: Option<&str>,
    ) -> Result<JqlAiDraft, String> {
        let request = features::jql::build_request(prompt, default_project_key)?;
        let model = ai_model_or_default(self.provider, model);
        let output_text = self.transport.create_json(&model, &request)?;

        features::jql::parse_draft(self.provider, &output_text)
    }

    pub fn suggest_transversal_epic_scope(
        &self,
        model: &str,
        epic_scope: &str,
    ) -> Result<EpicScopePluralSuggestion, String> {
        let request = features::epic_scope::build_plural_scope_request(epic_scope)?;
        let model = ai_model_or_default(self.provider, model);
        let output_text = self.transport.create_json(&model, &request)?;

        features::epic_scope::parse_plural_scope_suggestion(self.provider, &output_text)
    }

    pub fn draft_task_description(
        &self,
        model: &str,
        task: &LocalTask,
        additional_context: Option<&str>,
        catalog_template_context: Option<&str>,
    ) -> Result<AssistedDescriptionDraft, String> {
        let request = features::assisted_description::build_request(
            task,
            additional_context.unwrap_or_default(),
            catalog_template_context,
        )?;
        let request = match request {
            features::assisted_description::AssistedDescriptionRequest::Clarification(draft) => {
                return Ok(draft);
            }
            features::assisted_description::AssistedDescriptionRequest::Generate(request) => {
                request
            }
        };

        let model = ai_model_or_default(self.provider, model);
        let output_text = self.transport.create_json(&model, &request)?;

        features::assisted_description::parse_draft(self.provider, &output_text)
    }

    pub fn test_connection(&self, model: &str) -> Result<(), String> {
        let model = ai_model_or_default(self.provider, model);
        let probe = features::jql::build_connection_probe_request();

        self.transport.test_connection(&model, &probe)
    }

    pub fn list_models(&self) -> Result<Vec<String>, String> {
        self.transport.list_models()
    }
}

#[cfg(test)]
mod tests {
    use super::{AiClient, AiCredentials, AiProvider};

    #[test]
    fn redacts_ai_secret_debug_output() {
        let credentials = AiCredentials {
            provider: AiProvider::Claude,
            api_key: "sk-ant-secret-value".to_string(),
        };
        let client = AiClient::new(credentials.clone());

        assert_eq!(
            format!("{credentials:?}"),
            r#"AiCredentials { provider: Claude, api_key: "<redacted>" }"#
        );
        assert_eq!(
            format!("{client:?}"),
            r#"AiClient { provider: Claude, api_key: "<redacted>" }"#
        );
    }

    #[test]
    fn rejects_empty_jql_prompt_before_network_request() {
        let client = AiClient::new(AiCredentials {
            provider: AiProvider::OpenAi,
            api_key: "sk-test".to_string(),
        });

        assert_eq!(
            client
                .draft_jql("gpt-4.1", "   ", Some("JTFTEST"))
                .expect_err("empty prompt rejected"),
            "Ask AI prompt is required."
        );
    }
}
