use serde_json::{json, Value};

use crate::redaction::redact_secret_fragments;

const AUDIT_MESSAGE_MAX_CHARS: usize = 500;

pub(crate) fn audit_error_detail(message: &str) -> Value {
    json!({ "message": audit_error_message(message) })
}

pub(crate) fn audit_error_messages_detail(messages: &[String]) -> Value {
    json!({
        "messages": messages
            .iter()
            .map(|message| audit_error_message(message))
            .collect::<Vec<_>>()
    })
}

pub(crate) fn audit_error_message(message: &str) -> String {
    let redacted = redact_secret_fragments(message);
    cap_audit_message(&redacted)
}

fn cap_audit_message(message: &str) -> String {
    if message.chars().count() <= AUDIT_MESSAGE_MAX_CHARS {
        return message.to_string();
    }

    let prefix = message
        .chars()
        .take(AUDIT_MESSAGE_MAX_CHARS.saturating_sub(3))
        .collect::<String>();
    format!("{prefix}...")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_secret_shaped_values_from_audit_error_messages() {
        let message = concat!(
            "Jira failed with Authorization: Basic abc123 ",
            "api_token=super-secret token: second-secret ",
            "\"apiToken\":\"json-secret\" Bearer bearer-secret"
        );

        let redacted = audit_error_message(message);

        assert!(redacted.contains("Basic <redacted>"));
        assert!(redacted.contains("api_token=<redacted>"));
        assert!(redacted.contains("token: <redacted>"));
        assert!(redacted.contains("\"apiToken\":\"<redacted>\""));
        assert!(redacted.contains("Bearer <redacted>"));
        assert!(!redacted.contains("abc123"));
        assert!(!redacted.contains("super-secret"));
        assert!(!redacted.contains("second-secret"));
        assert!(!redacted.contains("json-secret"));
        assert!(!redacted.contains("bearer-secret"));
    }

    #[test]
    fn caps_audit_error_messages_to_the_adr_limit() {
        let message = "a".repeat(AUDIT_MESSAGE_MAX_CHARS + 40);

        let capped = audit_error_message(&message);

        assert_eq!(capped.chars().count(), AUDIT_MESSAGE_MAX_CHARS);
        assert!(capped.ends_with("..."));
    }

    #[test]
    fn builds_redacted_audit_error_detail() {
        let detail = audit_error_detail("Failed with Basic abc123");

        assert_eq!(detail["message"], json!("Failed with Basic <redacted>"));
    }
}
