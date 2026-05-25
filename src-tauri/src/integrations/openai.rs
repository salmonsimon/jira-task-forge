use std::time::Duration;

use serde_json::{json, Value};

use crate::models::JqlAiDraft;

const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";
const OPENAI_REQUEST_TIMEOUT: Duration = Duration::from_secs(45);

#[derive(Clone, PartialEq, Eq)]
pub struct OpenAiCredentials {
    pub api_key: String,
}

impl std::fmt::Debug for OpenAiCredentials {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("OpenAiCredentials")
            .field("api_key", &"<redacted>")
            .finish()
    }
}

#[derive(Clone, PartialEq, Eq)]
pub struct OpenAiClient {
    api_key: String,
}

impl std::fmt::Debug for OpenAiClient {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("OpenAiClient")
            .field("api_key", &"<redacted>")
            .finish()
    }
}

impl OpenAiClient {
    pub fn new(credentials: OpenAiCredentials) -> Self {
        Self {
            api_key: credentials.api_key,
        }
    }

    pub fn draft_jql(
        &self,
        model: &str,
        prompt: &str,
        default_project_key: Option<&str>,
    ) -> Result<JqlAiDraft, String> {
        let prompt = prompt.trim();
        if prompt.is_empty() {
            return Err("Ask AI prompt is required.".to_string());
        }

        let model = model.trim();
        if model.is_empty() {
            return Err("OpenAI model is required.".to_string());
        }

        let project_context = default_project_key
            .map(str::trim)
            .filter(|project_key| !project_key.is_empty())
            .map(|project_key| {
                format!("Default Jira project key configured in the app: {project_key}.")
            })
            .unwrap_or_else(|| "No default Jira project key is configured.".to_string());

        let payload = json!({
            "model": model,
            "store": false,
            "instructions": jql_generation_instructions(),
            "input": format!("{project_context}\nUser request: {prompt}"),
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "jql_ai_draft",
                    "strict": true,
                    "schema": {
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                            "jql": {
                                "type": "string",
                                "description": "The generated Jira JQL query only."
                            },
                            "explanation": {
                                "type": "string",
                                "description": "Short plain-English explanation of the query."
                            },
                            "warnings": {
                                "type": "array",
                                "items": { "type": "string" },
                                "description": "Important ambiguity or assumption notes."
                            }
                        },
                        "required": ["jql", "explanation", "warnings"]
                    }
                }
            },
            "max_output_tokens": 700
        });

        let response = ureq::post(OPENAI_RESPONSES_URL)
            .set("Authorization", &format!("Bearer {}", self.api_key))
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .timeout(OPENAI_REQUEST_TIMEOUT)
            .send_json(payload);

        let response_json = parse_openai_response(response)?;
        let output_text = extract_output_text(&response_json)?;
        let draft: JqlAiDraft = serde_json::from_str(&output_text)
            .map_err(|error| format!("OpenAI returned an invalid JQL draft payload: {error}"))?;
        validate_jql_draft(draft)
    }

    pub fn test_connection(&self, model: &str) -> Result<(), String> {
        let model = model.trim();
        if model.is_empty() {
            return Err("OpenAI model is required.".to_string());
        }

        let payload = json!({
            "model": model,
            "store": false,
            "instructions": "Reply with the single word ok.",
            "input": "Connection test",
            "max_output_tokens": 12
        });

        let response = ureq::post(OPENAI_RESPONSES_URL)
            .set("Authorization", &format!("Bearer {}", self.api_key))
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .timeout(OPENAI_REQUEST_TIMEOUT)
            .send_json(payload);

        parse_openai_response(response).map(|_| ())
    }
}

fn jql_generation_instructions() -> &'static str {
    "You generate Jira JQL for Jira Task Forge. Return only valid JSON matching the schema. \
Use Jira Cloud JQL syntax. Prefer compact, readable queries. \
Do not invent field names beyond common Jira fields unless the user asked for them. \
Use statusCategory != Done for open work when the user asks for open, active, pending, or unfinished issues. \
Use ORDER BY updated DESC when no ordering is requested. \
If the user clearly mentions a project key, use that project key. \
If no project is mentioned and a default Jira project key is provided, include that exact project key. \
If the request is ambiguous, still produce the safest useful JQL and include the assumption in warnings. \
Never include markdown fences."
}

fn parse_openai_response(response: Result<ureq::Response, ureq::Error>) -> Result<Value, String> {
    match response {
        Ok(response) => response
            .into_json::<Value>()
            .map_err(|error| format!("OpenAI returned an unexpected payload: {error}")),
        Err(ureq::Error::Status(status, response)) => {
            let body_text = response.into_string().unwrap_or_default();
            let message = openai_error_message(&body_text);
            if message.is_empty() {
                Err(format!("OpenAI request failed with HTTP {status}."))
            } else {
                Err(format!(
                    "OpenAI request failed with HTTP {status}: {message}"
                ))
            }
        }
        Err(error) => Err(format!("OpenAI request could not reach the API: {error}")),
    }
}

fn openai_error_message(body_text: &str) -> String {
    serde_json::from_str::<Value>(body_text)
        .ok()
        .and_then(|value| {
            value
                .get("error")
                .and_then(|error| error.get("message"))
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .unwrap_or_default()
}

fn extract_output_text(response: &Value) -> Result<String, String> {
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

fn validate_jql_draft(mut draft: JqlAiDraft) -> Result<JqlAiDraft, String> {
    draft.jql = draft.jql.trim().to_string();
    draft.explanation = draft.explanation.trim().to_string();
    draft.warnings = draft
        .warnings
        .into_iter()
        .map(|warning| warning.trim().to_string())
        .filter(|warning| !warning.is_empty())
        .collect();

    if draft.jql.is_empty() {
        return Err("OpenAI returned an empty JQL query.".to_string());
    }
    if draft.jql.contains('\n') {
        draft.jql = draft.jql.split_whitespace().collect::<Vec<_>>().join(" ");
    }
    if draft.explanation.is_empty() {
        draft.explanation = "Generated JQL loaded into the editor.".to_string();
    }

    Ok(draft)
}

#[cfg(test)]
mod tests {
    use super::{extract_output_text, openai_error_message, validate_jql_draft};
    use crate::models::JqlAiDraft;
    use serde_json::json;

    #[test]
    fn extracts_output_text_from_responses_payload() {
        let payload = json!({
            "output": [{
                "content": [{
                    "type": "output_text",
                    "text": "{\"jql\":\"project = DTS\",\"explanation\":\"ok\",\"warnings\":[]}"
                }]
            }]
        });

        assert_eq!(
            extract_output_text(&payload).expect("output text extracts"),
            "{\"jql\":\"project = DTS\",\"explanation\":\"ok\",\"warnings\":[]}"
        );
    }

    #[test]
    fn reads_openai_error_messages() {
        let body = r#"{"error":{"message":"Invalid API key"}}"#;
        assert_eq!(openai_error_message(body), "Invalid API key");
    }

    #[test]
    fn validates_and_normalizes_jql_drafts() {
        let draft = validate_jql_draft(JqlAiDraft {
            jql: " project = DTS\nORDER BY updated DESC ".to_string(),
            explanation: " ".to_string(),
            warnings: vec!["  assumed DTS  ".to_string(), " ".to_string()],
        })
        .expect("draft valid");

        assert_eq!(draft.jql, "project = DTS ORDER BY updated DESC");
        assert_eq!(draft.explanation, "Generated JQL loaded into the editor.");
        assert_eq!(draft.warnings, vec!["assumed DTS"]);
    }
}
