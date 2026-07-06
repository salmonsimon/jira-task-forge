use serde_json::{json, Value};

use super::{strip_json_fence, JsonFeatureRequest};
use crate::epic_scope::normalize_epic_scope;
use crate::integrations::ai::AiProvider;
use crate::models::EpicScopePluralSuggestion;

pub(crate) fn build_plural_scope_request(epic_scope: &str) -> Result<JsonFeatureRequest, String> {
    let scope = normalize_epic_scope(Some(epic_scope)).ok_or_else(|| {
        "Epic Scope is required before suggesting a Transversal scope.".to_string()
    })?;

    if scope == "TBD" {
        return Ok(build_request_from_input("TBD"));
    }

    Ok(build_request_from_input(&format!(
        "Singular Epic Scope: {scope}\nReturn the plural Transversal Epic Scope. Preserve accents, version numbers, and casing."
    )))
}

pub(crate) fn parse_plural_scope_suggestion(
    provider: AiProvider,
    output_text: &str,
) -> Result<EpicScopePluralSuggestion, String> {
    let suggestion: EpicScopePluralSuggestion =
        serde_json::from_str(&strip_json_fence(output_text)).map_err(|error| {
            format!(
                "{} returned an invalid Transversal scope suggestion: {error}",
                provider.label()
            )
        })?;
    validate_plural_scope_suggestion(suggestion)
}

fn build_request_from_input(input: &str) -> JsonFeatureRequest {
    JsonFeatureRequest {
        instructions: plural_scope_instructions(),
        input: input.to_string(),
        schema_name: "epic_scope_plural_suggestion",
        schema: plural_scope_json_schema(),
        json_prompt: format!(
            "{input}\n\nReturn only JSON matching this exact shape: {{\"scope\":\"...\"}}. Do not include markdown fences."
        ),
        max_output_tokens: 80,
    }
}

fn plural_scope_json_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "properties": {
            "scope": {
                "type": "string",
                "description": "The plural Transversal Epic Scope only."
            }
        },
        "required": ["scope"]
    })
}

fn plural_scope_instructions() -> &'static str {
    "You suggest Jira Task Forge Transversal Epic Scope values. Return only valid JSON matching the schema. \
The input scope is the singular/canonical tray scope. Output the Spanish plural scope for Transversal epics. \
Preserve version suffixes, product names, capitalization, and accents. \
If the input is TBD, output exactly TBD. Never output [TBD]. Never pluralize TBD. \
Do not include bracketed project or area prefixes. Never include markdown fences."
}

fn validate_plural_scope_suggestion(
    mut suggestion: EpicScopePluralSuggestion,
) -> Result<EpicScopePluralSuggestion, String> {
    suggestion.scope = normalize_epic_scope(Some(&suggestion.scope))
        .ok_or_else(|| "AI returned an empty Transversal scope suggestion.".to_string())?;
    Ok(suggestion)
}

#[cfg(test)]
mod tests {
    use super::{build_plural_scope_request, parse_plural_scope_suggestion};
    use crate::integrations::ai::AiProvider;

    #[test]
    fn builds_plural_scope_request_without_bracketed_target_format() {
        let request = build_plural_scope_request("Demo Versión 1").expect("request builds");

        assert!(request.input.contains("Demo Versión 1"));
        assert!(!request.input.contains("[Transversal]"));
        assert_eq!(request.schema_name, "epic_scope_plural_suggestion");
    }

    #[test]
    fn normalizes_tbd_suggestion_without_pluralizing() {
        let suggestion = parse_plural_scope_suggestion(AiProvider::OpenAi, r#"{"scope":"[TBD]"}"#)
            .expect("suggestion parses");

        assert_eq!(suggestion.scope, "TBD");
    }
}
