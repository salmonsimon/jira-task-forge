use std::time::Duration;

use serde_json::{json, Value};

use super::features::JsonFeatureRequest;
use super::provider::AiProvider;
use crate::redaction::redact_secret_fragments;

const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";
const OPENAI_MODELS_URL: &str = "https://api.openai.com/v1/models";
const CLAUDE_MESSAGES_URL: &str = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODELS_URL: &str = "https://api.anthropic.com/v1/models";
const GEMINI_API_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta";
const ANTHROPIC_API_VERSION: &str = "2023-06-01";
const AI_REQUEST_TIMEOUT: Duration = Duration::from_secs(45);
const AI_REQUEST_ATTEMPTS: usize = 2;

#[derive(Clone, PartialEq, Eq)]
pub(crate) struct AiTransportClient {
    provider: AiProvider,
    api_key: String,
}

impl AiTransportClient {
    pub(crate) fn new(provider: AiProvider, api_key: String) -> Self {
        Self { provider, api_key }
    }

    pub(crate) fn create_json(
        &self,
        model: &str,
        request: &JsonFeatureRequest,
    ) -> Result<String, String> {
        let response = self.send_json(model, request)?;
        extract_provider_output_text(self.provider, &response)
    }

    pub(crate) fn test_connection(
        &self,
        model: &str,
        probe: &JsonFeatureRequest,
    ) -> Result<(), String> {
        match self.provider {
            AiProvider::OpenAi => OpenAiAdapter::new(&self.api_key)
                .get_models_with_retry()
                .map(|_| ()),
            AiProvider::Claude => ClaudeAdapter::new(&self.api_key)
                .get_models_with_retry()
                .map(|_| ()),
            AiProvider::Gemini => self.send_json(model, probe).map(|_| ()),
        }
    }

    pub(crate) fn list_models(&self) -> Result<Vec<String>, String> {
        match self.provider {
            AiProvider::OpenAi => OpenAiAdapter::new(&self.api_key).list_models(),
            AiProvider::Claude => ClaudeAdapter::new(&self.api_key).list_models(),
            AiProvider::Gemini => Ok(self
                .provider
                .fallback_models()
                .iter()
                .map(|model| (*model).to_string())
                .collect()),
        }
    }

    fn send_json(&self, model: &str, request: &JsonFeatureRequest) -> Result<Value, String> {
        match self.provider {
            AiProvider::OpenAi => OpenAiAdapter::new(&self.api_key).create_json(model, request),
            AiProvider::Claude => ClaudeAdapter::new(&self.api_key).create_json(model, request),
            AiProvider::Gemini => GeminiAdapter::new(&self.api_key).create_json(model, request),
        }
    }
}

struct OpenAiAdapter<'a> {
    api_key: &'a str,
}

impl<'a> OpenAiAdapter<'a> {
    fn new(api_key: &'a str) -> Self {
        Self { api_key }
    }

    fn create_json(&self, model: &str, request: &JsonFeatureRequest) -> Result<Value, String> {
        let payload = json!({
            "model": model,
            "store": false,
            "instructions": request.instructions,
            "input": request.input.as_str(),
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": request.schema_name,
                    "strict": true,
                    "schema": request.schema.clone()
                }
            },
            "max_output_tokens": request.max_output_tokens
        });

        self.post_json_with_retry(payload)
    }

    fn post_json_with_retry(&self, payload: Value) -> Result<Value, String> {
        let mut last_error = None;
        for attempt in 1..=AI_REQUEST_ATTEMPTS {
            let response = ureq::post(OPENAI_RESPONSES_URL)
                .set("Authorization", &format!("Bearer {}", self.api_key.trim()))
                .set("Content-Type", "application/json")
                .set("Accept", "application/json")
                .timeout(AI_REQUEST_TIMEOUT)
                .send_json(payload.clone());

            match parse_ai_response(AiProvider::OpenAi, response) {
                Ok(value) => return Ok(value),
                Err(error) if error.retryable && attempt < AI_REQUEST_ATTEMPTS => {
                    last_error = Some(error.message);
                }
                Err(error) => return Err(error.message),
            }
        }

        Err(last_error.unwrap_or_else(|| "OpenAI request failed.".to_string()))
    }

    fn get_models_with_retry(&self) -> Result<Value, String> {
        let mut last_error = None;
        for attempt in 1..=AI_REQUEST_ATTEMPTS {
            let response = ureq::get(OPENAI_MODELS_URL)
                .set("Authorization", &format!("Bearer {}", self.api_key.trim()))
                .set("Accept", "application/json")
                .timeout(AI_REQUEST_TIMEOUT)
                .call();

            match parse_ai_response(AiProvider::OpenAi, response) {
                Ok(value) => return Ok(value),
                Err(error) if error.retryable && attempt < AI_REQUEST_ATTEMPTS => {
                    last_error = Some(error.message);
                }
                Err(error) => return Err(error.message),
            }
        }

        Err(last_error.unwrap_or_else(|| "OpenAI request failed.".to_string()))
    }

    fn list_models(&self) -> Result<Vec<String>, String> {
        let response = self.get_models_with_retry()?;
        let mut models = response
            .get("data")
            .and_then(Value::as_array)
            .ok_or_else(|| "OpenAI models response did not include a data array.".to_string())?
            .iter()
            .filter_map(|model| model.get("id").and_then(Value::as_str))
            .filter(|id| is_supported_openai_model_id(id))
            .map(ToString::to_string)
            .collect::<Vec<_>>();
        models.sort();
        models.dedup();

        if models.is_empty() {
            return Err("OpenAI did not return selectable models.".to_string());
        }

        Ok(models)
    }
}

fn is_supported_openai_model_id(model_id: &str) -> bool {
    let model_id = model_id.to_ascii_lowercase();
    model_id.starts_with("gpt-")
        || model_id.starts_with("o1")
        || model_id.starts_with("o3")
        || model_id.starts_with("o4")
}

struct ClaudeAdapter<'a> {
    api_key: &'a str,
}

impl<'a> ClaudeAdapter<'a> {
    fn new(api_key: &'a str) -> Self {
        Self { api_key }
    }

    fn create_json(&self, model: &str, request: &JsonFeatureRequest) -> Result<Value, String> {
        let payload = json!({
            "model": model,
            "max_tokens": request.max_output_tokens,
            "system": request.instructions,
            "messages": [{ "role": "user", "content": request.json_prompt.as_str() }]
        });

        self.post_json_with_retry(CLAUDE_MESSAGES_URL, payload)
    }

    fn post_json_with_retry(&self, url: &str, payload: Value) -> Result<Value, String> {
        let mut last_error = None;
        for attempt in 1..=AI_REQUEST_ATTEMPTS {
            let response = ureq::post(url)
                .set("x-api-key", self.api_key.trim())
                .set("anthropic-version", ANTHROPIC_API_VERSION)
                .set("Content-Type", "application/json")
                .set("Accept", "application/json")
                .timeout(AI_REQUEST_TIMEOUT)
                .send_json(payload.clone());

            match parse_ai_response(AiProvider::Claude, response) {
                Ok(value) => return Ok(value),
                Err(error) if error.retryable && attempt < AI_REQUEST_ATTEMPTS => {
                    last_error = Some(error.message);
                }
                Err(error) => return Err(error.message),
            }
        }

        Err(last_error.unwrap_or_else(|| "Claude request failed.".to_string()))
    }

    fn get_models_with_retry(&self) -> Result<Value, String> {
        let mut last_error = None;
        for attempt in 1..=AI_REQUEST_ATTEMPTS {
            let response = ureq::get(CLAUDE_MODELS_URL)
                .set("x-api-key", self.api_key.trim())
                .set("anthropic-version", ANTHROPIC_API_VERSION)
                .set("Accept", "application/json")
                .timeout(AI_REQUEST_TIMEOUT)
                .call();

            match parse_ai_response(AiProvider::Claude, response) {
                Ok(value) => return Ok(value),
                Err(error) if error.retryable && attempt < AI_REQUEST_ATTEMPTS => {
                    last_error = Some(error.message);
                }
                Err(error) => return Err(error.message),
            }
        }

        Err(last_error.unwrap_or_else(|| "Claude request failed.".to_string()))
    }

    fn list_models(&self) -> Result<Vec<String>, String> {
        let response = self.get_models_with_retry()?;
        claude_model_ids(&response)
    }
}

fn claude_model_ids(response: &Value) -> Result<Vec<String>, String> {
    let mut models = response
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| "Claude models response did not include a data array.".to_string())?
        .iter()
        .filter_map(|model| model.get("id").and_then(Value::as_str))
        .filter(|id| id.to_ascii_lowercase().starts_with("claude-"))
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    models.dedup();

    Ok(models)
}

struct GeminiAdapter<'a> {
    api_key: &'a str,
}

impl<'a> GeminiAdapter<'a> {
    fn new(api_key: &'a str) -> Self {
        Self { api_key }
    }

    fn create_json(&self, model: &str, request: &JsonFeatureRequest) -> Result<Value, String> {
        let encoded_model = encode_url_component(model);
        let payload = json!({
            "systemInstruction": { "parts": [{ "text": request.instructions }] },
            "contents": [{ "role": "user", "parts": [{ "text": request.json_prompt.as_str() }] }],
            "generationConfig": {
                "maxOutputTokens": request.max_output_tokens,
                "responseMimeType": "application/json"
            }
        });

        self.post_json_with_retry(
            &format!("{GEMINI_API_BASE_URL}/models/{encoded_model}:generateContent"),
            payload,
        )
    }

    fn post_json_with_retry(&self, url: &str, payload: Value) -> Result<Value, String> {
        let mut last_error = None;
        for attempt in 1..=AI_REQUEST_ATTEMPTS {
            let response = ureq::post(url)
                .set("x-goog-api-key", self.api_key.trim())
                .set("Content-Type", "application/json")
                .set("Accept", "application/json")
                .timeout(AI_REQUEST_TIMEOUT)
                .send_json(payload.clone());

            match parse_ai_response(AiProvider::Gemini, response) {
                Ok(value) => return Ok(value),
                Err(error) if error.retryable && attempt < AI_REQUEST_ATTEMPTS => {
                    last_error = Some(error.message);
                }
                Err(error) => return Err(error.message),
            }
        }

        Err(last_error.unwrap_or_else(|| "Gemini request failed.".to_string()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct AiRequestError {
    message: String,
    retryable: bool,
}

fn parse_ai_response(
    provider: AiProvider,
    response: Result<ureq::Response, ureq::Error>,
) -> Result<Value, AiRequestError> {
    match response {
        Ok(response) => response
            .into_json::<Value>()
            .map_err(|error| AiRequestError {
                message: redact_secret_fragments(&format!(
                    "{} returned an unexpected payload: {error}",
                    provider.label()
                )),
                retryable: false,
            }),
        Err(ureq::Error::Status(status, response)) => {
            let body_text = response.into_string().unwrap_or_default();
            let raw_message = provider_error_message(&body_text);
            let is_direct_claude_message =
                is_direct_claude_http_error(provider, status, &raw_message);
            let message = provider_http_error_message(provider, status, &raw_message);
            let retryable = (500..=599).contains(&status);
            if message.is_empty() {
                Err(AiRequestError {
                    message: format!("{} request failed with HTTP {status}.", provider.label()),
                    retryable,
                })
            } else if is_direct_claude_message {
                Err(AiRequestError { message, retryable })
            } else {
                Err(AiRequestError {
                    message: redact_secret_fragments(&format!(
                        "{} request failed with HTTP {status}: {message}",
                        provider.label()
                    )),
                    retryable,
                })
            }
        }
        Err(error) => Err(AiRequestError {
            message: redact_secret_fragments(&format!(
                "{} request could not reach the API: {error}",
                provider.label()
            )),
            retryable: true,
        }),
    }
}

fn is_direct_claude_http_error(provider: AiProvider, status: u16, message: &str) -> bool {
    provider == AiProvider::Claude
        && (matches!(status, 401 | 403)
            || (status == 404 && message.trim().strip_prefix("model:").is_some()))
}

fn provider_http_error_message(provider: AiProvider, status: u16, message: &str) -> String {
    if provider == AiProvider::Claude {
        if matches!(status, 401 | 403) {
            return "Claude rejected the API key. Check that the key is active and has Anthropic API access.".to_string();
        }

        if status == 404 {
            if let Some(model) = message.trim().strip_prefix("model:").map(str::trim) {
                if !model.is_empty() {
                    return format!(
                        "Claude model is unavailable or deprecated: {model}. Refresh the model list or choose another Claude model."
                    );
                }
            }
        }
    }

    message.to_string()
}

fn provider_error_message(body_text: &str) -> String {
    serde_json::from_str::<Value>(body_text)
        .ok()
        .and_then(|value| {
            value
                .get("error")
                .and_then(|error| error.get("message"))
                .or_else(|| value.get("message"))
                .and_then(Value::as_str)
                .map(redact_secret_fragments)
        })
        .unwrap_or_default()
}

fn extract_provider_output_text(provider: AiProvider, response: &Value) -> Result<String, String> {
    match provider {
        AiProvider::OpenAi => extract_openai_output_text(response),
        AiProvider::Claude => extract_claude_output_text(response),
        AiProvider::Gemini => extract_gemini_output_text(response),
    }
}

fn extract_openai_output_text(response: &Value) -> Result<String, String> {
    if let Some(text) = response.get("output_text").and_then(Value::as_str) {
        return Ok(text.to_string());
    }

    let output = response
        .get("output")
        .and_then(Value::as_array)
        .ok_or_else(|| "OpenAI response did not include output text.".to_string())?;

    for item in output {
        let Some(content) = item.get("content").and_then(Value::as_array) else {
            continue;
        };
        for content_item in content {
            if let Some(text) = content_item.get("text").and_then(Value::as_str) {
                return Ok(text.to_string());
            }
        }
    }

    Err("OpenAI response did not include output text.".to_string())
}

fn extract_claude_output_text(response: &Value) -> Result<String, String> {
    let chunks = response
        .get("content")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|content| content.get("text").and_then(Value::as_str))
        .collect::<Vec<_>>();

    if chunks.is_empty() {
        Err("Claude response did not include output text.".to_string())
    } else {
        Ok(chunks.join("\n"))
    }
}

fn extract_gemini_output_text(response: &Value) -> Result<String, String> {
    let mut chunks = Vec::new();
    for candidate in response
        .get("candidates")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        for part in candidate
            .get("content")
            .and_then(|content| content.get("parts"))
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            if let Some(text) = part.get("text").and_then(Value::as_str) {
                chunks.push(text);
            }
        }
    }

    if chunks.is_empty() {
        Err("Gemini response did not include output text.".to_string())
    } else {
        Ok(chunks.join("\n"))
    }
}

fn encode_url_component(value: &str) -> String {
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

#[cfg(test)]
mod tests {
    use super::super::provider::AiProvider;
    use super::{
        claude_model_ids, encode_url_component, extract_claude_output_text,
        extract_gemini_output_text, extract_openai_output_text, parse_ai_response,
        provider_error_message,
    };
    use serde_json::json;

    #[test]
    fn extracts_provider_output_text() {
        assert_eq!(
            extract_openai_output_text(&json!({"output_text":"{\"jql\":\"project = DTS\",\"explanation\":\"ok\",\"warnings\":[]}"}))
                .expect("openai text extracts"),
            "{\"jql\":\"project = DTS\",\"explanation\":\"ok\",\"warnings\":[]}"
        );
        assert_eq!(
            extract_claude_output_text(&json!({"content":[{"type":"text","text":"{\"jql\":\"project = DTS\",\"explanation\":\"ok\",\"warnings\":[]}"}]}))
                .expect("claude text extracts"),
            "{\"jql\":\"project = DTS\",\"explanation\":\"ok\",\"warnings\":[]}"
        );
        assert_eq!(
            extract_gemini_output_text(&json!({"candidates":[{"content":{"parts":[{"text":"{\"jql\":\"project = DTS\",\"explanation\":\"ok\",\"warnings\":[]}"}]}}]}))
                .expect("gemini text extracts"),
            "{\"jql\":\"project = DTS\",\"explanation\":\"ok\",\"warnings\":[]}"
        );
    }

    #[test]
    fn rejects_missing_provider_output_text() {
        assert_eq!(
            extract_openai_output_text(&json!({"id": "response_123"}))
                .expect_err("missing output rejected"),
            "OpenAI response did not include output text."
        );
        assert_eq!(
            extract_claude_output_text(&json!({"content":[{"type":"tool_use"}]}))
                .expect_err("missing output rejected"),
            "Claude response did not include output text."
        );
        assert_eq!(
            extract_gemini_output_text(&json!({"candidates":[{"content":{"parts":[]}}]}))
                .expect_err("missing output rejected"),
            "Gemini response did not include output text."
        );
    }

    #[test]
    fn redacts_provider_error_messages() {
        let body =
            r#"{"error":{"message":"Incorrect API key provided: sk-proj-secretValue123456"}}"#;
        let message = provider_error_message(body);

        assert_eq!(message, "Incorrect API key provided: <redacted>");
    }

    #[test]
    fn reads_top_level_provider_error_messages() {
        let body = r#"{"message":"Invalid API key"}"#;

        assert_eq!(provider_error_message(body), "Invalid API key");
        assert_eq!(provider_error_message("not json"), "");
    }

    #[test]
    fn parses_claude_model_list_response() {
        let response = json!({
            "data": [
                {"type": "model", "id": "claude-3-5-haiku-20241022", "display_name": "Claude 3.5 Haiku"},
                {"type": "model", "id": "not-a-claude-model"}
            ],
            "has_more": false
        });

        assert_eq!(
            claude_model_ids(&response).expect("models parse"),
            vec!["claude-3-5-haiku-20241022"]
        );
    }

    #[test]
    fn empty_claude_model_list_allows_builtin_fallback() {
        assert_eq!(
            claude_model_ids(&json!({"data": [], "has_more": false})).expect("empty list parses"),
            Vec::<String>::new()
        );
    }

    #[test]
    fn classifies_claude_unauthorized_as_credentials() {
        let response = ureq::Response::new(
            401,
            "Unauthorized",
            r#"{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}"#,
        )
        .expect("response builds");

        let error = parse_ai_response(AiProvider::Claude, Err(ureq::Error::Status(401, response)))
            .expect_err("unauthorized is rejected");

        assert_eq!(
            error.message,
            "Claude rejected the API key. Check that the key is active and has Anthropic API access."
        );
    }

    #[test]
    fn classifies_claude_model_404_as_model_availability_not_invalid_credentials() {
        let response = ureq::Response::new(
            404,
            "Not Found",
            r#"{"type":"error","error":{"type":"not_found_error","message":"model: claude-sonnet-4-20250514"}}"#,
        )
        .expect("response builds");

        let error = parse_ai_response(AiProvider::Claude, Err(ureq::Error::Status(404, response)))
            .expect_err("model 404 is rejected");

        assert_eq!(
            error.message,
            "Claude model is unavailable or deprecated: claude-sonnet-4-20250514. Refresh the model list or choose another Claude model."
        );
        assert!(!error.message.to_ascii_lowercase().contains("api key"));
    }

    #[test]
    fn encodes_gemini_model_path_segments() {
        assert_eq!(encode_url_component("gemini-2.5-flash"), "gemini-2.5-flash");
        assert_eq!(
            encode_url_component("model/with space"),
            "model%2Fwith%20space"
        );
    }
}
