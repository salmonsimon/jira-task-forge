use serde_json::{json, Value};

use super::{strip_json_fence, JsonFeatureRequest};
use crate::integrations::ai::AiProvider;
use crate::models::JqlAiDraft;

const JIRA_KNOWN_PROJECT_KEYS: &[&str] = &["DTS", "JTFTEST"];
const JIRA_KNOWN_ISSUE_TYPES: &[&str] = &["Bug", "Story", "Epic", "subtask"];
const JIRA_KNOWN_PRIORITIES: &[&str] = &["Highest", "High", "Medium", "Low", "Lowest"];

pub(crate) fn build_request(
    prompt: &str,
    default_project_key: Option<&str>,
) -> Result<JsonFeatureRequest, String> {
    let prompt = prompt.trim();
    if prompt.is_empty() {
        return Err("Ask AI prompt is required.".to_string());
    }

    Ok(build_request_from_input(
        &format!(
            "{}\n{}\nUser request: {prompt}",
            project_context(default_project_key),
            jira_generation_context()
        ),
        700,
    ))
}

pub(crate) fn build_connection_probe_request() -> JsonFeatureRequest {
    build_request_from_input("Reply with ok.", 16)
}

pub(crate) fn parse_draft(provider: AiProvider, output_text: &str) -> Result<JqlAiDraft, String> {
    let draft: JqlAiDraft =
        serde_json::from_str(&strip_json_fence(output_text)).map_err(|error| {
            format!(
                "{} returned an invalid JQL draft payload: {error}",
                provider.label()
            )
        })?;
    validate_jql_draft(draft)
}

fn build_request_from_input(input: &str, max_output_tokens: usize) -> JsonFeatureRequest {
    JsonFeatureRequest {
        instructions: jql_generation_instructions(),
        input: input.to_string(),
        schema_name: "jql_ai_draft",
        schema: jql_ai_draft_json_schema(),
        json_prompt: provider_json_prompt(input),
        max_output_tokens,
    }
}

fn project_context(default_project_key: Option<&str>) -> String {
    default_project_key
        .map(str::trim)
        .filter(|project_key| !project_key.is_empty())
        .map(|project_key| {
            format!("Default Jira project key configured in the app: {project_key}.")
        })
        .unwrap_or_else(|| "No default Jira project key is configured.".to_string())
}

fn provider_json_prompt(input: &str) -> String {
    format!(
        "{input}\n\nReturn only JSON matching this exact shape: {{\"jql\":\"...\",\"explanation\":\"...\",\"warnings\":[\"...\"]}}. Do not include markdown fences."
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

#[cfg(test)]
mod tests {
    use super::{
        build_connection_probe_request, build_request, jira_generation_context,
        jql_generation_instructions, parse_draft, validate_jql_draft,
    };
    use crate::integrations::ai::AiProvider;
    use crate::models::JqlAiDraft;

    #[test]
    fn rejects_empty_prompt_before_network_request() {
        assert_eq!(
            build_request("   ", Some("JTFTEST")).expect_err("empty prompt rejected"),
            "Ask AI prompt is required."
        );
    }

    #[test]
    fn builds_jql_prompt_with_default_project_context() {
        let request =
            build_request("show latest issue", Some(" JTFTEST ")).expect("request builds");

        assert!(request
            .input
            .contains("Default Jira project key configured in the app: JTFTEST."));
        assert!(request.input.contains("User request: show latest issue"));
        assert!(request
            .json_prompt
            .contains("Return only JSON matching this exact shape"));
        assert_eq!(request.schema_name, "jql_ai_draft");
        assert_eq!(request.max_output_tokens, 700);
    }

    #[test]
    fn builds_connection_probe_with_existing_jql_json_shape() {
        let request = build_connection_probe_request();

        assert_eq!(request.input, "Reply with ok.");
        assert_eq!(request.max_output_tokens, 16);
        assert!(request.json_prompt.contains("\"jql\":\"...\""));
    }

    #[test]
    fn instructions_pin_jira_safety_rules() {
        let instructions = jql_generation_instructions();

        assert!(instructions.contains("Return only valid JSON"));
        assert!(instructions.contains("do not translate those into an issue type filter"));
        assert!(instructions.contains("Do not replace a known Jira project key"));
        assert!(instructions.contains("Never include markdown fences"));
    }

    #[test]
    fn parses_json_fenced_provider_output() {
        let draft = parse_draft(
            AiProvider::Claude,
            "```json\n{\"jql\":\"project = DTS\",\"explanation\":\"ok\",\"warnings\":[]}\n```",
        )
        .expect("draft parses");

        assert_eq!(draft.jql, "project = DTS");
        assert_eq!(draft.explanation, "ok");
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

    #[test]
    fn rejects_empty_jql_drafts() {
        let error = validate_jql_draft(JqlAiDraft {
            jql: " ".to_string(),
            explanation: "Generated".to_string(),
            warnings: Vec::new(),
        })
        .expect_err("empty jql rejected");

        assert_eq!(error, "AI provider returned an empty JQL query.");
    }

    #[test]
    fn jira_generation_context_contains_static_vocab() {
        let context = jira_generation_context();

        assert!(context.contains("Known Jira project keys: DTS, JTFTEST."));
        assert!(context.contains("Known Jira issue types: Bug, Story, Epic, subtask."));
        assert!(context.contains("Known Jira priorities: Highest, High, Medium, Low, Lowest."));
        assert!(context.contains("STT"));
    }
}
