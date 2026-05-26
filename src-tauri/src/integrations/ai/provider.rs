const OPENAI_API_KEYS_URL: &str = "https://platform.openai.com/home";
const CLAUDE_API_KEYS_URL: &str = "https://platform.claude.com/dashboard";
const GEMINI_API_KEYS_URL: &str = "https://aistudio.google.com/api-keys";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AiProvider {
    OpenAi,
    Claude,
    Gemini,
}

impl AiProvider {
    pub fn from_settings_value(value: &str) -> Result<Self, String> {
        match value.trim().to_ascii_lowercase().as_str() {
            "openai" => Ok(Self::OpenAi),
            "claude" | "anthropic" | "anthropic claude" => Ok(Self::Claude),
            "gemini" | "google gemini" | "google" | "google ai studio" => Ok(Self::Gemini),
            "none" | "" => Err("Select an AI provider before using AI.".to_string()),
            _ => Err(format!("Unsupported AI provider '{}'.", value.trim())),
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::OpenAi => "OpenAI",
            Self::Claude => "Claude",
            Self::Gemini => "Gemini",
        }
    }

    pub fn credential_service(self) -> &'static str {
        match self {
            Self::OpenAi => "jira-task-forge:openai",
            Self::Claude => "jira-task-forge:claude",
            Self::Gemini => "jira-task-forge:gemini",
        }
    }

    pub fn default_model(self) -> &'static str {
        match self {
            Self::OpenAi => "gpt-4.1",
            Self::Claude => "claude-sonnet-4-20250514",
            Self::Gemini => "gemini-2.5-flash",
        }
    }

    pub fn api_key_page_url(self) -> &'static str {
        match self {
            Self::OpenAi => OPENAI_API_KEYS_URL,
            Self::Claude => CLAUDE_API_KEYS_URL,
            Self::Gemini => GEMINI_API_KEYS_URL,
        }
    }
}

#[derive(Clone, PartialEq, Eq)]
pub struct AiCredentials {
    pub provider: AiProvider,
    pub api_key: String,
}

impl std::fmt::Debug for AiCredentials {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("AiCredentials")
            .field("provider", &self.provider)
            .field("api_key", &"<redacted>")
            .finish()
    }
}

pub fn ai_model_or_default(provider: AiProvider, model: &str) -> String {
    let model = model.trim();
    if model.is_empty() || is_model_from_another_provider(provider, model) {
        provider.default_model().to_string()
    } else {
        model.to_string()
    }
}

pub fn ai_provider_api_key_page_url(ai_provider: &str) -> Result<&'static str, String> {
    let normalized_provider = ai_provider.trim().to_ascii_lowercase();
    if normalized_provider.is_empty() || normalized_provider == "none" {
        return Err("Select an AI provider before opening its API key page.".to_string());
    }

    AiProvider::from_settings_value(ai_provider)
        .map(AiProvider::api_key_page_url)
        .map_err(|_| {
            format!(
                "API key page is not configured for AI provider '{}'.",
                ai_provider.trim()
            )
        })
}

fn is_model_from_another_provider(provider: AiProvider, model: &str) -> bool {
    let model = model.to_ascii_lowercase();
    match provider {
        AiProvider::OpenAi => model.starts_with("claude") || model.starts_with("gemini"),
        AiProvider::Claude => model.starts_with("gpt-") || model.starts_with("gemini"),
        AiProvider::Gemini => model.starts_with("gpt-") || model.starts_with("claude"),
    }
}

#[cfg(test)]
mod tests {
    use super::{ai_model_or_default, ai_provider_api_key_page_url, AiProvider};

    #[test]
    fn defaults_models_by_provider() {
        assert_eq!(ai_model_or_default(AiProvider::OpenAi, ""), "gpt-4.1");
        assert_eq!(
            ai_model_or_default(AiProvider::Claude, "   "),
            "claude-sonnet-4-20250514"
        );
        assert_eq!(
            ai_model_or_default(AiProvider::Claude, "gpt-4.1"),
            "claude-sonnet-4-20250514"
        );
        assert_eq!(ai_model_or_default(AiProvider::Gemini, "custom"), "custom");
    }

    #[test]
    fn resolves_provider_metadata_from_settings_values() {
        assert_eq!(
            AiProvider::from_settings_value("OpenAI").expect("openai resolves"),
            AiProvider::OpenAi
        );
        assert_eq!(
            AiProvider::from_settings_value("anthropic claude").expect("claude resolves"),
            AiProvider::Claude
        );
        assert_eq!(
            AiProvider::from_settings_value("Google AI Studio").expect("gemini resolves"),
            AiProvider::Gemini
        );
        assert_eq!(
            AiProvider::from_settings_value("None").expect_err("none rejected"),
            "Select an AI provider before using AI."
        );
    }

    #[test]
    fn resolves_provider_api_key_pages() {
        assert_eq!(
            ai_provider_api_key_page_url("OpenAI").expect("openai url resolves"),
            "https://platform.openai.com/home"
        );
        assert_eq!(
            ai_provider_api_key_page_url("Claude").expect("claude url resolves"),
            "https://platform.claude.com/dashboard"
        );
        assert_eq!(
            ai_provider_api_key_page_url("Gemini").expect("gemini url resolves"),
            "https://aistudio.google.com/api-keys"
        );
        assert_eq!(
            ai_provider_api_key_page_url("None").expect_err("none has no key page"),
            "Select an AI provider before opening its API key page."
        );
        assert_eq!(
            ai_provider_api_key_page_url("Unknown").expect_err("unknown has no key page"),
            "API key page is not configured for AI provider 'Unknown'."
        );
    }
}
