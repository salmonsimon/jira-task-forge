use std::time::Duration;

use serde_json::{json, Value};

use crate::models::{AssistedDescriptionDraft, JqlAiDraft, LocalTask};
use crate::redaction::redact_secret_fragments;

const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";
const OPENAI_MODELS_URL: &str = "https://api.openai.com/v1/models";
const CLAUDE_MESSAGES_URL: &str = "https://api.anthropic.com/v1/messages";
const GEMINI_API_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta";
const ANTHROPIC_API_VERSION: &str = "2023-06-01";
const AI_REQUEST_TIMEOUT: Duration = Duration::from_secs(45);
const AI_REQUEST_ATTEMPTS: usize = 2;
const JIRA_KNOWN_PROJECT_KEYS: &[&str] = &["DTS", "JTFTEST"];
const JIRA_KNOWN_ISSUE_TYPES: &[&str] = &["Bug", "Story", "Epic", "subtask"];
const JIRA_KNOWN_PRIORITIES: &[&str] = &["Highest", "High", "Medium", "Low", "Lowest"];
const SIMPLE_TASK_TITLE_WORD_LIMIT: usize = 4;
const ASSISTED_DESCRIPTION_REQUIRED_HEADINGS: &[&str] = &[
    "## Historia de usuario",
    "## Contexto",
    "## Alcance",
    "## Criterios de aceptación",
    "## SRE Lite",
    "### Impacto esperado",
    "### Riesgos",
    "### Observabilidad / señales",
    "### Rollback / mitigación",
];
const ASSISTED_DESCRIPTION_TEMPLATE: &str = r#"## Historia de usuario

Como [usuario/persona],
quiero [necesidad],
para que [beneficio].

## Contexto

[Contexto claro]

## Alcance

Incluye:
- ...

No incluye:
- ...

## Criterios de aceptación

- ...

## SRE Lite

### Impacto esperado
...

### Riesgos
- ...

### Observabilidad / señales
QA/Arte/Programacion/etc. debe validar:
- ...

### Rollback / mitigación
..."#;

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

#[derive(Clone, PartialEq, Eq)]
pub struct AiClient {
    provider: AiProvider,
    api_key: String,
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

        let model = ai_model_or_default(self.provider, model);
        let project_context = default_project_key
            .map(str::trim)
            .filter(|project_key| !project_key.is_empty())
            .map(|project_key| {
                format!("Default Jira project key configured in the app: {project_key}.")
            })
            .unwrap_or_else(|| "No default Jira project key is configured.".to_string());
        let input = format!(
            "{project_context}\n{}\nUser request: {prompt}",
            jira_generation_context()
        );

        let response_json = match self.provider {
            AiProvider::OpenAi => self.create_openai_response(&model, &input, 700)?,
            AiProvider::Claude => self.create_claude_message(&model, &input, 700)?,
            AiProvider::Gemini => self.create_gemini_content(&model, &input, 700)?,
        };
        let output_text = extract_provider_output_text(self.provider, &response_json)?;
        let draft: JqlAiDraft =
            serde_json::from_str(&strip_json_fence(&output_text)).map_err(|error| {
                format!(
                    "{} returned an invalid JQL draft payload: {error}",
                    self.provider.label()
                )
            })?;
        validate_jql_draft(draft)
    }

    pub fn draft_task_description(
        &self,
        model: &str,
        task: &LocalTask,
        additional_context: Option<&str>,
    ) -> Result<AssistedDescriptionDraft, String> {
        let additional_context = additional_context.unwrap_or("").trim();
        if task_description_needs_clarification(task, additional_context) {
            return Ok(clarification_draft_for_task(task));
        }

        let model = ai_model_or_default(self.provider, model);
        let input = task_description_generation_context(task, additional_context);

        let response_json = match self.provider {
            AiProvider::OpenAi => {
                self.create_openai_task_description_response(&model, &input, 2000)?
            }
            AiProvider::Claude => {
                self.create_claude_task_description_message(&model, &input, 2000)?
            }
            AiProvider::Gemini => {
                self.create_gemini_task_description_content(&model, &input, 2000)?
            }
        };
        let output_text = extract_provider_output_text(self.provider, &response_json)?;
        let draft: AssistedDescriptionDraft = serde_json::from_str(&strip_json_fence(&output_text))
            .map_err(|error| {
                format!(
                    "{} returned an invalid assisted description payload: {error}",
                    self.provider.label()
                )
            })?;
        validate_assisted_description_draft(draft)
    }

    pub fn test_connection(&self, model: &str) -> Result<(), String> {
        let model = ai_model_or_default(self.provider, model);
        match self.provider {
            AiProvider::OpenAi => self.get_openai_models_with_retry().map(|_| ()),
            AiProvider::Claude => self
                .create_claude_message(&model, "Reply with ok.", 16)
                .map(|_| ()),
            AiProvider::Gemini => self
                .create_gemini_content(&model, "Reply with ok.", 16)
                .map(|_| ()),
        }
    }

    fn create_openai_response(
        &self,
        model: &str,
        input: &str,
        max_output_tokens: usize,
    ) -> Result<Value, String> {
        self.create_openai_json_response(
            model,
            jql_generation_instructions(),
            input,
            "jql_ai_draft",
            jql_ai_draft_json_schema(),
            max_output_tokens,
        )
    }

    fn create_openai_task_description_response(
        &self,
        model: &str,
        input: &str,
        max_output_tokens: usize,
    ) -> Result<Value, String> {
        self.create_openai_json_response(
            model,
            task_description_generation_instructions(),
            input,
            "assisted_description_draft",
            assisted_description_json_schema(),
            max_output_tokens,
        )
    }

    fn create_openai_json_response(
        &self,
        model: &str,
        instructions: &str,
        input: &str,
        schema_name: &str,
        schema: Value,
        max_output_tokens: usize,
    ) -> Result<Value, String> {
        let payload = json!({
            "model": model,
            "store": false,
            "instructions": instructions,
            "input": input,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": schema_name,
                    "strict": true,
                    "schema": schema
                }
            },
            "max_output_tokens": max_output_tokens
        });

        self.post_openai_json_with_retry(payload)
    }

    fn create_claude_message(
        &self,
        model: &str,
        input: &str,
        max_output_tokens: usize,
    ) -> Result<Value, String> {
        self.create_claude_message_with_system(
            model,
            jql_generation_instructions(),
            &provider_json_prompt(input),
            max_output_tokens,
        )
    }

    fn create_claude_task_description_message(
        &self,
        model: &str,
        input: &str,
        max_output_tokens: usize,
    ) -> Result<Value, String> {
        self.create_claude_message_with_system(
            model,
            task_description_generation_instructions(),
            &provider_task_description_json_prompt(input),
            max_output_tokens,
        )
    }

    fn create_claude_message_with_system(
        &self,
        model: &str,
        system: &str,
        user_content: &str,
        max_output_tokens: usize,
    ) -> Result<Value, String> {
        let payload = json!({
            "model": model,
            "max_tokens": max_output_tokens,
            "system": system,
            "messages": [{ "role": "user", "content": user_content }]
        });

        self.post_json_with_retry(AiProvider::Claude, CLAUDE_MESSAGES_URL, payload)
    }

    fn create_gemini_content(
        &self,
        model: &str,
        input: &str,
        max_output_tokens: usize,
    ) -> Result<Value, String> {
        self.create_gemini_content_with_system(
            model,
            jql_generation_instructions(),
            &provider_json_prompt(input),
            max_output_tokens,
        )
    }

    fn create_gemini_task_description_content(
        &self,
        model: &str,
        input: &str,
        max_output_tokens: usize,
    ) -> Result<Value, String> {
        self.create_gemini_content_with_system(
            model,
            task_description_generation_instructions(),
            &provider_task_description_json_prompt(input),
            max_output_tokens,
        )
    }

    fn create_gemini_content_with_system(
        &self,
        model: &str,
        system: &str,
        user_content: &str,
        max_output_tokens: usize,
    ) -> Result<Value, String> {
        let encoded_model = encode_url_component(model);
        let payload = json!({
            "systemInstruction": { "parts": [{ "text": system }] },
            "contents": [{ "role": "user", "parts": [{ "text": user_content }] }],
            "generationConfig": {
                "maxOutputTokens": max_output_tokens,
                "responseMimeType": "application/json"
            }
        });

        self.post_json_with_retry(
            AiProvider::Gemini,
            &format!("{GEMINI_API_BASE_URL}/models/{encoded_model}:generateContent"),
            payload,
        )
    }

    fn post_openai_json_with_retry(&self, payload: Value) -> Result<Value, String> {
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

    fn get_openai_models_with_retry(&self) -> Result<Value, String> {
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

    fn post_json_with_retry(
        &self,
        provider: AiProvider,
        url: &str,
        payload: Value,
    ) -> Result<Value, String> {
        let mut last_error = None;
        for attempt in 1..=AI_REQUEST_ATTEMPTS {
            let request = match provider {
                AiProvider::Claude => ureq::post(url)
                    .set("x-api-key", self.api_key.trim())
                    .set("anthropic-version", ANTHROPIC_API_VERSION),
                AiProvider::Gemini => ureq::post(url).set("x-goog-api-key", self.api_key.trim()),
                AiProvider::OpenAi => unreachable!("OpenAI uses post_openai_json_with_retry"),
            };
            let response = request
                .set("Content-Type", "application/json")
                .set("Accept", "application/json")
                .timeout(AI_REQUEST_TIMEOUT)
                .send_json(payload.clone());

            match parse_ai_response(provider, response) {
                Ok(value) => return Ok(value),
                Err(error) if error.retryable && attempt < AI_REQUEST_ATTEMPTS => {
                    last_error = Some(error.message);
                }
                Err(error) => return Err(error.message),
            }
        }

        Err(last_error.unwrap_or_else(|| format!("{} request failed.", provider.label())))
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

fn is_model_from_another_provider(provider: AiProvider, model: &str) -> bool {
    let model = model.to_ascii_lowercase();
    match provider {
        AiProvider::OpenAi => model.starts_with("claude") || model.starts_with("gemini"),
        AiProvider::Claude => model.starts_with("gpt-") || model.starts_with("gemini"),
        AiProvider::Gemini => model.starts_with("gpt-") || model.starts_with("claude"),
    }
}

fn provider_json_prompt(input: &str) -> String {
    format!(
        "{input}\n\nReturn only JSON matching this exact shape: {{\"jql\":\"...\",\"explanation\":\"...\",\"warnings\":[\"...\"]}}. Do not include markdown fences."
    )
}

fn provider_task_description_json_prompt(input: &str) -> String {
    format!(
        "{input}\n\nReturn only JSON matching this exact shape: {{\"status\":\"drafted\",\"description\":\"...\",\"clarificationQuestions\":[]}} or {{\"status\":\"needs_clarification\",\"description\":null,\"clarificationQuestions\":[\"...\"]}}. Do not include markdown fences."
    )
}

fn jql_ai_draft_json_schema() -> Value {
    json!({
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
    })
}

fn assisted_description_json_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "properties": {
            "status": {
                "type": "string",
                "enum": ["drafted", "needs_clarification"]
            },
            "description": {
                "type": ["string", "null"],
                "description": "The complete Markdown Jira task description, or null when clarification is needed."
            },
            "clarificationQuestions": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Concise questions to ask before drafting when the input is too thin."
            }
        },
        "required": ["status", "description", "clarificationQuestions"]
    })
}

fn jql_generation_instructions() -> &'static str {
    "You generate Jira JQL for Jira Task Forge. Return only valid JSON matching the schema. \
Use Jira Cloud JQL syntax. Prefer compact, readable queries. \
Do not invent field names beyond common Jira fields unless the user asked for them. \
Do not include issue type filters unless the user explicitly asks for a Jira issue type such as Story, Bug, Epic, or subtask. \
Spanish words like tarea, tareas, trabajo, pendiente, or issue can mean generic work items; do not translate those into an issue type filter unless the user clearly asks for a specific Jira issue type. \
When filtering by issue type, use issuetype = \"Exact Name\" or issuetype in (\"Exact Name\") with exact names from context. \
Use statusCategory != Done for open work when the user asks for open, active, pending, or unfinished issues. \
When the user asks for newest, latest, oldest, or recent issues, prefer ORDER BY created DESC or ASC as appropriate. \
Use ORDER BY updated DESC when no ordering is requested. \
If the user clearly mentions a known Jira project key, use that exact project key. \
Do not replace a known Jira project key with an app category, area, or internal project name. \
If no Jira project key is mentioned and a default Jira project key is provided, include that exact project key. \
If the request is ambiguous, still produce the safest useful JQL and include the assumption in warnings. \
Never include markdown fences."
}

fn task_description_generation_instructions() -> &'static str {
    "You generate Assisted Descriptions for Jira Task Forge Local Tasks. Return only valid JSON matching the schema. \
Generated Jira task descriptions may be Spanish when the task language is Spanish. UI copy is not part of the response. \
Use the exact Markdown section headings from the requested template. \
Do not invent product behavior, implementation scope, acceptance criteria, risk, observability, or rollback detail. \
If the title and context are too thin to fill any useful section, return status needs_clarification with up to three concise questions in the task language and description null. \
If only one section is uncertain, draft the useful sections and put a short explicit uncertainty note in that section instead of making facts up. \
Keep the description compact and Jira-ready. Do not include markdown fences."
}

fn task_description_generation_context(task: &LocalTask, additional_context: &str) -> String {
    let existing_description = task
        .description
        .as_deref()
        .map(str::trim)
        .filter(|description| !description.is_empty())
        .unwrap_or("None");
    let additional_context = if additional_context.is_empty() {
        "None"
    } else {
        additional_context
    };

    format!(
        "Local Task context:\n\
- Project: {project}\n\
- Area: {area}\n\
- Issue type: {issue_type}\n\
- Priority: {priority}\n\
- Task language: {language}\n\
- Title/prompt: {title}\n\
- Existing description: {existing_description}\n\
- Additional user context: {additional_context}\n\n\
Target Markdown format:\n{template}",
        project = task.project,
        area = task.area,
        issue_type = task.issue_type,
        priority = task.priority,
        language = task.content_language,
        title = task.title,
        template = ASSISTED_DESCRIPTION_TEMPLATE
    )
}

fn jira_generation_context() -> String {
    format!(
        "Known Jira project keys: {}.\n\
Known Jira issue types: {}.\n\
Known Jira priorities: {}.\n\
Use priority names exactly as listed. Examples: lowest priority -> priority = Lowest; high priority -> priority = High.\n\
Important mapping rule: DTS and JTFTEST are Jira project keys. Names like STT, PilotLab, MR Studio, Transversal, area, or category are local planning labels, not Jira project keys.",
        JIRA_KNOWN_PROJECT_KEYS.join(", "),
        JIRA_KNOWN_ISSUE_TYPES.join(", "),
        JIRA_KNOWN_PRIORITIES.join(", ")
    )
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
            let message = provider_error_message(&body_text);
            let retryable = (500..=599).contains(&status);
            if message.is_empty() {
                Err(AiRequestError {
                    message: format!("{} request failed with HTTP {status}.", provider.label()),
                    retryable,
                })
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

fn strip_json_fence(text: &str) -> String {
    let trimmed = text.trim();
    let without_opening = trimmed
        .strip_prefix("```json")
        .or_else(|| trimmed.strip_prefix("```"))
        .unwrap_or(trimmed)
        .trim();
    without_opening
        .strip_suffix("```")
        .unwrap_or(without_opening)
        .trim()
        .to_string()
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
        return Err("AI provider returned an empty JQL query.".to_string());
    }
    if draft.jql.contains('\n') {
        draft.jql = draft.jql.split_whitespace().collect::<Vec<_>>().join(" ");
    }
    if draft.explanation.is_empty() {
        draft.explanation = "Generated JQL loaded into the editor.".to_string();
    }

    Ok(draft)
}

fn validate_assisted_description_draft(
    mut draft: AssistedDescriptionDraft,
) -> Result<AssistedDescriptionDraft, String> {
    draft.status = draft.status.trim().to_string();
    draft.description = draft
        .description
        .map(|description| description.trim().to_string())
        .filter(|description| !description.is_empty());
    draft.clarification_questions = draft
        .clarification_questions
        .into_iter()
        .map(|question| question.trim().to_string())
        .filter(|question| !question.is_empty())
        .take(3)
        .collect();

    match draft.status.as_str() {
        "drafted" => {
            let Some(description) = draft.description.as_deref() else {
                return Err("AI provider returned an empty assisted description.".to_string());
            };
            if let Some(missing_heading) = ASSISTED_DESCRIPTION_REQUIRED_HEADINGS
                .iter()
                .find(|heading| !description.contains(**heading))
            {
                return Err(format!(
                    "AI provider omitted required assisted description section {missing_heading}."
                ));
            }
            draft.clarification_questions.clear();
        }
        "needs_clarification" => {
            draft.description = None;
            if draft.clarification_questions.is_empty() {
                return Err(
                    "AI provider asked for clarification without returning questions.".to_string(),
                );
            }
        }
        _ => {
            return Err(format!(
                "AI provider returned unsupported assisted description status '{}'.",
                draft.status
            ));
        }
    }

    Ok(draft)
}

fn task_description_needs_clarification(task: &LocalTask, additional_context: &str) -> bool {
    if !additional_context.trim().is_empty() {
        return false;
    }

    let title = task.title.trim();
    if title.is_empty() {
        return true;
    }

    title.split_whitespace().count() <= SIMPLE_TASK_TITLE_WORD_LIMIT
}

fn clarification_draft_for_task(task: &LocalTask) -> AssistedDescriptionDraft {
    AssistedDescriptionDraft {
        status: "needs_clarification".to_string(),
        description: None,
        clarification_questions: clarification_questions_for_language(&task.content_language),
    }
}

fn clarification_questions_for_language(language: &str) -> Vec<String> {
    if language.trim().eq_ignore_ascii_case("english") {
        return vec![
            "Who is affected, and what are they trying to accomplish?".to_string(),
            "What should change, including the most important in-scope and out-of-scope details?"
                .to_string(),
            "How should QA, art, programming, or another owner validate success?".to_string(),
        ];
    }

    vec![
        "Que usuario o persona se ve afectado, y que necesita lograr?".to_string(),
        "Que debe cambiar, incluyendo lo mas importante dentro y fuera de alcance?".to_string(),
        "Como debe validar el exito QA, Arte, Programacion u otro responsable?".to_string(),
    ]
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
    use super::{
        ai_model_or_default, extract_claude_output_text, extract_gemini_output_text,
        extract_openai_output_text, provider_error_message, strip_json_fence,
        task_description_needs_clarification, validate_assisted_description_draft,
        validate_jql_draft, AiClient, AiCredentials, AiProvider,
    };
    use crate::models::{AssistedDescriptionDraft, JqlAiDraft, LocalTask};
    use serde_json::json;

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
    fn redacts_provider_error_messages() {
        let body =
            r#"{"error":{"message":"Incorrect API key provided: sk-proj-secretValue123456"}}"#;
        let message = provider_error_message(body);

        assert_eq!(message, "Incorrect API key provided: <redacted>");
    }

    #[test]
    fn strips_json_fences_and_validates_drafts() {
        assert_eq!(
            strip_json_fence("```json\n{\"jql\":\"project = DTS\"}\n```"),
            "{\"jql\":\"project = DTS\"}"
        );

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

    #[test]
    fn asks_for_clarification_when_task_title_is_too_thin() {
        let task = task_with_title("Maquinas expendedoras");

        assert!(task_description_needs_clarification(&task, ""));
        assert!(!task_description_needs_clarification(
            &task,
            "Crear un set dressing de maquinas expendedoras para el anden del Metro, validando escala, materiales y ubicacion final."
        ));
    }

    #[test]
    fn validates_assisted_description_template_sections() {
        let draft = validate_assisted_description_draft(AssistedDescriptionDraft {
            status: " drafted ".to_string(),
            description: Some(
                "## Historia de usuario\n\nComo usuario,\nquiero algo,\npara lograr valor.\n\n\
## Contexto\n\nContexto claro.\n\n\
## Alcance\n\nIncluye:\n- A\n\nNo incluye:\n- B\n\n\
## Criterios de aceptación\n\n- Criterio\n\n\
## SRE Lite\n\n### Impacto esperado\nBajo\n\n\
### Riesgos\n- Riesgo\n\n\
### Observabilidad / señales\nQA/Arte/Programacion/etc. debe validar:\n- Senal\n\n\
### Rollback / mitigación\nMitigar."
                    .to_string(),
            ),
            clarification_questions: vec!["  ".to_string(), "extra".to_string()],
        })
        .expect("description template validates");

        assert_eq!(draft.status, "drafted");
        assert!(draft.description.is_some());
        assert!(draft.clarification_questions.is_empty());
    }

    #[test]
    fn validates_clarification_question_payload() {
        let draft = validate_assisted_description_draft(AssistedDescriptionDraft {
            status: "needs_clarification".to_string(),
            description: Some("ignore me".to_string()),
            clarification_questions: vec![
                " Que usuario se ve afectado? ".to_string(),
                " ".to_string(),
                " Que validacion espera? ".to_string(),
            ],
        })
        .expect("clarification validates");

        assert_eq!(draft.description, None);
        assert_eq!(
            draft.clarification_questions,
            vec!["Que usuario se ve afectado?", "Que validacion espera?"]
        );
    }

    fn task_with_title(title: &str) -> LocalTask {
        LocalTask {
            id: "task-1".to_string(),
            tray_id: "tray-1".to_string(),
            project: "STT".to_string(),
            area: "3D".to_string(),
            title: title.to_string(),
            priority: "Medium".to_string(),
            issue_type: "Story".to_string(),
            sync_status: "Pending".to_string(),
            description_status: "Missing".to_string(),
            description: None,
            content_language: "Spanish".to_string(),
            jira_key: None,
            jira_url: None,
            epic_key: None,
            parent_task_id: None,
            task_order: 0,
            created_at: "2026-05-26T00:00:00Z".to_string(),
            updated_at: "2026-05-26T00:00:00Z".to_string(),
        }
    }
}
