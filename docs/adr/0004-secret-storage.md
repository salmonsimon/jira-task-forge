# ADR 0004: Keep Jira and AI secrets out of React and backups

## Status

Proposed

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

SQLite may store non-secret metadata such as account display name, Jira site URL,
last successful credential check time, selected provider name, and whether a
credential exists.

Backups, imports, logs, and diagnostics should exclude secrets by default. Import
should restore non-secret settings and then require the user to reconnect Jira or
AI providers manually.

## Consequences

- API keys and Jira tokens stay out of local JSON/zip bundles.
- Backend commands become the security boundary for integrations.
- Restored backups remain portable without silently reusing credentials on a new
  machine.
- Tests need fixtures that prove export and audit paths omit secret values.

## HITL Decisions Still Needed

- Exact secret-store crate or Tauri plugin to use for Windows v1.
- Jira authentication method for v1.
- Whether AI provider keys are in v1 scope or only reserved in the model.
- UX wording for reconnecting credentials after backup import.
- Whether local development can use environment variables, and how to prevent
  them from leaking into logs.
