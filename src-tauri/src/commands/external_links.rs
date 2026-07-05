use std::process::Command;

use tauri::State;

use crate::integrations::ai::ai_provider_api_key_page_url;
use crate::integrations::jira::normalize_jira_site_url;
use crate::services::AppServices;

const ATLASSIAN_API_TOKENS_URL: &str =
    "https://id.atlassian.com/manage-profile/security/api-tokens";
const NOTION_DEVELOPERS_URL: &str = "https://app.notion.com/developers/connections";

#[tauri::command]
pub fn open_atlassian_api_tokens_page() -> Result<(), String> {
    open_external_url(ATLASSIAN_API_TOKENS_URL)
}

#[tauri::command]
pub fn open_ai_provider_api_keys_page(ai_provider: String) -> Result<(), String> {
    open_external_url(ai_provider_api_keys_url(&ai_provider)?)
}

#[tauri::command]
pub fn open_notion_developers_page() -> Result<(), String> {
    open_external_url(NOTION_DEVELOPERS_URL)
}

#[tauri::command]
pub fn open_jira_issue_url(url: String, services: State<'_, AppServices>) -> Result<(), String> {
    let settings = services
        .get_app_settings()
        .map_err(|error| format!("Could not load Jira settings: {error}"))?;
    let canonical_site_url = normalize_jira_site_url(&settings.jira_site_url)?;
    let url = validate_jira_issue_url(&url, &canonical_site_url)?;
    open_external_url(&url)
}

fn ai_provider_api_keys_url(ai_provider: &str) -> Result<&'static str, String> {
    ai_provider_api_key_page_url(ai_provider)
}

fn open_external_url(url: &str) -> Result<(), String> {
    let mut command = platform_open_command(url)?;
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open browser: {error}"))
}

fn platform_open_command(url: &str) -> Result<Command, String> {
    if cfg!(target_os = "windows") {
        let mut command = Command::new("rundll32.exe");
        command.args(["url.dll,FileProtocolHandler", url]);
        return Ok(command);
    }

    if cfg!(target_os = "macos") {
        let mut command = Command::new("open");
        command.arg(url);
        return Ok(command);
    }

    if cfg!(target_os = "linux") {
        if is_wsl() {
            let mut command = Command::new("/mnt/c/Windows/System32/cmd.exe");
            command.args(["/C", "start", "", url]);
            return Ok(command);
        }

        let mut command = Command::new("xdg-open");
        command.arg(url);
        return Ok(command);
    }

    Err("Opening external links is not supported on this platform.".to_string())
}

fn is_wsl() -> bool {
    std::fs::read_to_string("/proc/sys/kernel/osrelease")
        .or_else(|_| std::fs::read_to_string("/proc/version"))
        .map(|contents| contents.to_ascii_lowercase().contains("microsoft"))
        .unwrap_or(false)
}

fn validate_jira_issue_url(url: &str, canonical_site_url: &str) -> Result<String, String> {
    if url.is_empty() {
        return Err("Jira issue URL is required.".to_string());
    }
    if url
        .chars()
        .any(|character| character.is_whitespace() || character.is_control())
    {
        return Err(
            "Jira issue URL must not include whitespace or control characters.".to_string(),
        );
    }
    if !url.starts_with("https://") {
        return Err("Jira issue URL must start with https://.".to_string());
    }

    let expected_host = site_host(canonical_site_url)?;
    let rest = &url["https://".len()..];
    let path_start = rest
        .find('/')
        .ok_or_else(|| "Jira issue URL must include a browse path.".to_string())?;
    let host = &rest[..path_start];
    let path = &rest[path_start..];

    if host.contains('@') {
        return Err("Jira issue URL must not include credentials.".to_string());
    }
    if host.contains(':') {
        return Err("Jira issue URL must not include a port.".to_string());
    }
    let host = host.to_ascii_lowercase();
    if host != expected_host {
        return Err("Jira issue URL must use the configured Jira site host.".to_string());
    }
    if !path.starts_with("/browse/") {
        return Err("Jira issue URL must point to a Jira issue browse path.".to_string());
    }
    let issue_key = &path["/browse/".len()..];
    if issue_key.is_empty()
        || issue_key.contains('/')
        || issue_key.contains('?')
        || issue_key.contains('#')
        || !issue_key.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
        || !issue_key.contains('-')
    {
        return Err("Jira issue URL must end with a Jira issue key.".to_string());
    }

    Ok(format!("https://{host}/browse/{issue_key}"))
}

fn site_host(canonical_site_url: &str) -> Result<String, String> {
    normalize_jira_site_url(canonical_site_url)
        .map(|site_url| site_url["https://".len()..].to_string())
}

#[cfg(test)]
mod tests {
    use super::{ai_provider_api_keys_url, is_wsl, platform_open_command, validate_jira_issue_url};

    #[test]
    fn resolves_ai_provider_api_key_pages() {
        assert_eq!(
            ai_provider_api_keys_url("OpenAI").expect("openai url resolves"),
            "https://platform.openai.com/home"
        );
        assert_eq!(
            ai_provider_api_keys_url("Claude").expect("claude url resolves"),
            "https://platform.claude.com/dashboard"
        );
        assert_eq!(
            ai_provider_api_keys_url("Gemini").expect("gemini url resolves"),
            "https://aistudio.google.com/api-keys"
        );
        assert_eq!(
            ai_provider_api_keys_url("None").expect_err("none has no key page"),
            "Select an AI provider before opening its API key page."
        );
    }

    #[test]
    fn builds_platform_open_command_for_external_links() {
        let command = platform_open_command("https://example.test").expect("command builds");

        if cfg!(target_os = "windows") {
            assert_eq!(command.get_program(), "rundll32.exe");
            assert!(command.get_args().any(|arg| arg == "https://example.test"));
        } else if cfg!(target_os = "macos") {
            assert_eq!(command.get_program(), "open");
            assert!(command.get_args().any(|arg| arg == "https://example.test"));
        } else if cfg!(target_os = "linux") {
            if is_wsl() {
                assert_eq!(command.get_program(), "/mnt/c/Windows/System32/cmd.exe");
                assert!(command.get_args().any(|arg| arg == "/C"));
                assert!(command.get_args().any(|arg| arg == "start"));
            } else {
                assert_eq!(command.get_program(), "xdg-open");
            }
            assert!(command.get_args().any(|arg| arg == "https://example.test"));
        }
    }

    #[test]
    fn validates_jira_issue_urls_against_configured_site_before_opening() {
        let site_url = "https://salmonsimondts.atlassian.net";

        assert_eq!(
            validate_jira_issue_url(
                "https://SALMONSIMONDTS.atlassian.net/browse/JTFTEST-1",
                site_url,
            )
            .expect("url validates"),
            "https://salmonsimondts.atlassian.net/browse/JTFTEST-1"
        );
        assert_eq!(
            validate_jira_issue_url(
                "http://salmonsimondts.atlassian.net/browse/JTFTEST-1",
                site_url,
            )
            .expect_err("non-https should fail"),
            "Jira issue URL must start with https://."
        );
        assert_eq!(
            validate_jira_issue_url(
                " https://salmonsimondts.atlassian.net/browse/JTFTEST-1 ",
                site_url,
            )
            .expect_err("surrounding spaces should fail"),
            "Jira issue URL must not include whitespace or control characters."
        );
        assert_eq!(
            validate_jira_issue_url(
                "https://salmonsimondts.atlassian.net/browse/JTFTEST-1;calc",
                site_url,
            )
            .expect_err("metacharacters should fail"),
            "Jira issue URL must end with a Jira issue key."
        );
        assert_eq!(
            validate_jira_issue_url(
                "https://user@salmonsimondts.atlassian.net/browse/JTFTEST-1",
                site_url,
            )
            .expect_err("credentials should fail"),
            "Jira issue URL must not include credentials."
        );
        assert_eq!(
            validate_jira_issue_url("https://evil.atlassian.net/browse/JTFTEST-1", site_url,)
                .expect_err("mismatched host should fail"),
            "Jira issue URL must use the configured Jira site host."
        );
        assert_eq!(
            validate_jira_issue_url(
                "https://salmonsimondts.atlassian.net/jira/software",
                site_url,
            )
            .expect_err("non-issue path should fail"),
            "Jira issue URL must point to a Jira issue browse path."
        );
        assert_eq!(
            validate_jira_issue_url(
                "https://salmonsimondts.atlassian.net/browse/JTFTEST-1?x=1",
                site_url,
            )
            .expect_err("query string should fail"),
            "Jira issue URL must end with a Jira issue key."
        );
        assert_eq!(
            validate_jira_issue_url("https://salmonsimondts.atlassian.net/browse/", site_url)
                .expect_err("empty issue key should fail"),
            "Jira issue URL must end with a Jira issue key."
        );
        assert_eq!(
            validate_jira_issue_url(
                "https://salmonsimondts.atlassian.net/browse/JTFTEST",
                site_url
            )
            .expect_err("issue keys need project and number"),
            "Jira issue URL must end with a Jira issue key."
        );
        assert_eq!(
            validate_jira_issue_url(
                "https://salmonsimondts.atlassian.net/browse/JTFTEST-1/child",
                site_url,
            )
            .expect_err("nested path should fail"),
            "Jira issue URL must end with a Jira issue key."
        );
    }
}
