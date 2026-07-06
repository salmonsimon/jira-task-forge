# ADR 0004: Keep Jira and AI secrets out of React and backups

## Status

Accepted

## Context

Jira Task Forge will need Jira credentials and may later need AI provider keys.
Those secrets must not be exposed to the React layer, written into portable
backups, or copied into audit logs.

The app is primarily a Windows desktop app, but the repo should avoid choices
that make future distribution impossible.

## Proposal

Store secrets through the Rust/Tauri backend using an OS-backed secret store
where available. React may request credential tests or display connection state,
but it should never receive raw tokens or API keys after initial entry.

For Windows v1, use Windows Credential Manager from the Rust/Tauri backend,
preferably through the Rust `keyring` crate unless the selected Tauri version
offers a better-supported official secret-store plugin at implementation time.
Do not implement custom encryption-at-rest for v1.

SQLite may store non-secret metadata such as account display name, Jira site URL,
last successful credential check time, selected provider name, and whether a
credential exists.

Use Jira Cloud email + API token authentication for v1. The backend should hide
that detail behind an integration credential provider so a later OAuth flow can
replace it without changing React command contracts or local task/sync data.
Store the API token only in Windows Credential Manager; SQLite may store the
Jira site URL, account email/display name, auth method label, and credential
check metadata.

AI-assisted features are in v1 scope, but AI provider keys follow the same
secret boundary as Jira credentials. Store AI API keys only in Windows
Credential Manager, never in React state beyond initial entry, SQLite, backups,
audit logs, or diagnostics. The backend may transmit the key only to the
selected AI provider when the user explicitly triggers an AI action. Task
content, prompts, images, or attachments should not be sent to an AI provider
implicitly.

Backups, imports, logs, and diagnostics should exclude secrets by default. Import
should restore non-secret settings and then require the user to reconnect Jira or
AI providers manually.

Local development may read explicitly named environment variables such as
`JIRA_TASK_FORGE_JIRA_TOKEN` or `JIRA_TASK_FORGE_AI_API_KEY` as temporary
credential sources. Environment values must not be persisted to SQLite or the
OS secret store automatically, displayed back to React after initial entry,
written to audit logs, included in backups, or copied into diagnostic output.
Release builds should treat Windows Credential Manager as the normal credential
source.

After backup import, show a reconnect prompt because portable backups never
include Jira or AI credentials. Recommended UI copy:

- Title: `Reconnect integrations`
- Message: `This backup restored local data only. Jira and AI credentials are
  never included in backups. Reconnect Jira and AI providers from Settings before
  syncing or generating assisted content.`
- Actions: `Open Settings` and `Continue without reconnecting`

## Consequences

- API keys and Jira tokens stay out of local backup files.
- Backend commands become the security boundary for integrations.
- Restored backups remain portable without silently reusing credentials on a new
  machine.
- Tests need fixtures that prove export and audit paths omit secret values.

## HITL Decisions Still Needed

- None for v1 architecture review.
