pub(crate) fn redact_secret_fragments(message: &str) -> String {
    let marked = [
        "api_token=",
        "apiToken=",
        "apiToken: ",
        "api token: ",
        "API token: ",
        "token=",
        "token: ",
        "API key provided: ",
        "api key provided: ",
        "API key: ",
        "api key: ",
        "api_key=",
        "apiKey=",
        "\"api_token\":\"",
        "\"apiToken\":\"",
        "\"token\":\"",
        "\"api_key\":\"",
        "\"apiKey\":\"",
        "Basic ",
        "Bearer ",
    ]
    .into_iter()
    .fold(message.to_string(), redact_value_after_marker);

    redact_secret_shaped_words(&marked)
}

fn redact_value_after_marker(message: String, marker: &str) -> String {
    let mut redacted = message;
    let mut search_start = 0;

    while let Some(relative_index) = redacted[search_start..].find(marker) {
        let value_start = search_start + relative_index + marker.len();
        let value_end = redacted[value_start..]
            .find(is_secret_delimiter)
            .map(|index| value_start + index)
            .unwrap_or(redacted.len());

        if value_end > value_start {
            redacted.replace_range(value_start..value_end, "<redacted>");
            search_start = value_start + "<redacted>".len();
        } else {
            search_start = value_start;
        }
    }

    redacted
}

fn is_secret_delimiter(character: char) -> bool {
    matches!(
        character,
        ' ' | '\n' | '\r' | '\t' | '"' | '\'' | ',' | ';' | '&' | '}' | ']'
    )
}

fn redact_secret_shaped_words(message: &str) -> String {
    let mut redacted = String::new();
    let mut word = String::new();

    for character in message.chars() {
        if is_secret_word_character(character) {
            word.push(character);
            continue;
        }

        push_redacted_word(&mut redacted, &word);
        word.clear();
        redacted.push(character);
    }

    push_redacted_word(&mut redacted, &word);
    redacted
}

fn is_secret_word_character(character: char) -> bool {
    character.is_ascii_alphanumeric()
        || matches!(character, '-' | '_' | '*' | '.' | ':' | '/' | '+')
}

fn push_redacted_word(output: &mut String, word: &str) {
    if word.is_empty() {
        return;
    }

    let trimmed_word = word.trim_matches(|character: char| matches!(character, '.' | ':' | '/'));
    if is_secret_shaped_word(trimmed_word) {
        output.push_str(&word.replace(trimmed_word, "<redacted>"));
    } else {
        output.push_str(word);
    }
}

fn is_secret_shaped_word(word: &str) -> bool {
    let lowercase = word.to_ascii_lowercase();

    (lowercase.starts_with("sk-") && word.len() >= 10)
        || (lowercase.starts_with("svcac") && word.len() >= 10)
        || (word.starts_with("AIza") && word.len() >= 20)
        || (word.len() >= 12 && word.matches('*').count() >= 6)
}

#[cfg(test)]
mod tests {
    use super::redact_secret_fragments;

    #[test]
    fn redacts_marker_based_secret_values() {
        let message = concat!(
            "Authorization: Basic abc123 ",
            "api_token=super-secret token: second-secret ",
            "\"apiKey\":\"json-secret\" Bearer bearer-secret"
        );

        let redacted = redact_secret_fragments(message);

        assert!(redacted.contains("Basic <redacted>"));
        assert!(redacted.contains("api_token=<redacted>"));
        assert!(redacted.contains("token: <redacted>"));
        assert!(redacted.contains("\"apiKey\":\"<redacted>\""));
        assert!(redacted.contains("Bearer <redacted>"));
        assert!(!redacted.contains("abc123"));
        assert!(!redacted.contains("super-secret"));
        assert!(!redacted.contains("second-secret"));
        assert!(!redacted.contains("json-secret"));
        assert!(!redacted.contains("bearer-secret"));
    }

    #[test]
    fn redacts_openai_key_fragments_from_provider_errors() {
        let message = concat!(
            "Incorrect API key provided: ",
            "svcac*************************************fdaY. You can find your API key at ",
            "https://platform.openai.com/account/api-keys."
        );

        let redacted = redact_secret_fragments(message);

        assert!(redacted.contains("Incorrect API key provided: <redacted>"));
        assert!(!redacted.contains("svcac"));
        assert!(!redacted.contains("fdaY"));
        assert!(!redacted.contains("******"));
    }

    #[test]
    fn redacts_unmarked_openai_keys() {
        let redacted = redact_secret_fragments("OpenAI rejected sk-proj-secretValue123456");

        assert_eq!(redacted, "OpenAI rejected <redacted>");
    }

    #[test]
    fn redacts_unmarked_gemini_keys() {
        let redacted = redact_secret_fragments("Gemini rejected AIzaSySecretValue1234567890");

        assert_eq!(redacted, "Gemini rejected <redacted>");
    }
}
