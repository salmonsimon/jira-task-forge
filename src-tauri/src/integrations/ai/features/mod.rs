pub(crate) mod assisted_description;
pub(crate) mod epic_scope;
pub(crate) mod jql;

use serde_json::Value;

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct JsonFeatureRequest {
    pub instructions: &'static str,
    pub input: String,
    pub schema_name: &'static str,
    pub schema: Value,
    pub json_prompt: String,
    pub max_output_tokens: usize,
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

#[cfg(test)]
mod tests {
    use super::strip_json_fence;

    #[test]
    fn strips_json_fences() {
        assert_eq!(
            strip_json_fence("```json\n{\"jql\":\"project = DTS\"}\n```"),
            "{\"jql\":\"project = DTS\"}"
        );
        assert_eq!(
            strip_json_fence("```\n{\"status\":\"drafted\"}\n```"),
            "{\"status\":\"drafted\"}"
        );
    }
}
