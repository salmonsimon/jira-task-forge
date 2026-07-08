# Credential and Keyring Recovery

Jira Task Forge stores Jira and AI provider credentials in the operating system
keyring. The app only keeps saved-token state and connection metadata in local
configuration; tokens and API keys should stay out of logs, screenshots, docs,
and diagnostic output.

Use this guide when Jira or AI credentials appear to be missing after a machine,
Windows, WSL, or development-session change.

## Common Symptoms

- Settings no longer shows a saved Jira token or saved AI credential state that
  was present in an earlier session.
- Jira or AI connection tests fail immediately after switching Windows users,
  restarting WSL, rebuilding the dev environment, changing Tauri profiles, or
  moving between worktrees.
- The app behaves like credentials have not been configured even though local
  configuration files still exist.
- Live QA works in one session but a later session cannot reuse the same saved
  credential state.
- After uninstalling a packaged Windows build, Jira, AI provider, and Notion
  credentials owned by the app should be removed from Windows Credential
  Manager.

These symptoms usually mean the app cannot read the same keyring entry it wrote
earlier. They should not be debugged by printing tokens, API keys, request
headers, authorization headers, or secret-shaped values.

## Safe Diagnostics

Keep diagnostics limited to presence, provider names, profile names, and error
categories.

Safe checks:

- Confirm which app profile, dev profile, or worktree is running.
- Confirm whether Settings reports credentials as saved or missing.
- Run the Jira and AI connection tests from Settings and record only pass/fail,
  provider name, and non-secret error wording.
- Check whether the session changed recently, such as a WSL restart, Windows
  sign-out, different Windows account, clean dev profile, or Tauri app data
  reset.
- Review logs only for non-secret status messages. Redact any token-like,
  API-key-like, bearer-header, cookie, or request-header value before sharing.

Do not:

- Print environment variables that may contain secrets.
- Print request headers or HTTP client debug output.
- Copy keyring item contents into terminal output, docs, issues, or PR comments.
- Paste Jira API tokens, AI API keys, bearer tokens, cookies, or secret-shaped
  values into GitHub, Jira, screenshots, or chat.

## Re-Save Jira Credentials

1. Open Jira Task Forge.
2. Go to Settings.
3. Open the Jira credentials section.
4. Re-enter the Jira site, account identifier, and API token as requested by the
   UI.
5. Save the credentials.
6. Run the Jira connection test from Settings.
7. Record only whether the test passed and any non-secret error category.

If the test still fails, check the Jira site/account values and whether the
current Windows or WSL session is the same environment that originally saved the
credential.

## Re-Save AI Credentials

1. Open Jira Task Forge.
2. Go to Settings.
3. Open the AI provider credentials section.
4. Select the provider used for the test session.
5. Re-enter the API key or credential value requested by the UI.
6. Save the credentials.
7. Run the AI connection test from Settings.
8. Record only provider name, pass/fail status, and any non-secret error
   category.

If multiple providers are configured during QA, re-save only the provider needed
for the current test. Do not inspect or compare stored secret values.

## Uninstall Credential Cleanup

Packaged Windows uninstalls remove the app-owned Credential Manager targets for
Jira, OpenAI, Claude, Gemini, and Notion credentials.

Validate this behavior only with fake or dedicated test credentials. Do not
delete or inspect Saimon's real Credential Manager entries during AFK work.

## WSL and Dev-Session Caveats

Prior live QA attempts showed that credential availability can differ across
Windows, WSL, Tauri, and worktree sessions. A credential saved in one visible app
session may not be readable after:

- Restarting WSL or switching WSL distributions.
- Running the app from a different worktree or app data profile.
- Switching Windows accounts or signing out and back in.
- Clearing local app data, rebuilding the app profile, or changing development
  identifiers.
- Moving from a packaged app session to `npm run tauri dev`, or the reverse.

For AFK QA, treat missing saved-token state after a session change as a recovery
case: re-save the relevant Jira or AI credential through Settings, run the
connection test again, and document only non-secret outcomes.

## Reporting Results

When reporting a credential recovery issue, include:

- App profile or worktree used.
- Whether the problem affected Jira credentials, AI credentials, or both.
- Whether Settings showed the credential as saved or missing.
- Whether re-saving through Settings restored the connection test.
- Any non-secret error category or UI state.

Never include raw tokens, API keys, authorization headers, cookies, or secret
values in the report.
