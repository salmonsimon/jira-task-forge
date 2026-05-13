# ADR 0001: Keep preparation trays local before syncing to Jira

## Status

Accepted

## Context

Jira Task Forge is meant to support fast task capture before work is ready to become Jira issues. The user wants to enter multiple tasks, review them in a preparation tray, save drafts, and only call the Jira API when pressing Crear en Jira.

The app should still work when Jira authentication, internet access, or the REST API is unavailable.

## Decision

The app will store preparation trays locally, with SQLite as the normal app store and JSON import/export for portable tray drafts.

Jira will be treated as a destination and query source, not as the only source of truth while tasks are still being prepared.

## Consequences

- Users can create and revise tasks without touching Jira.
- The app can support offline work and CSV export fallback.
- Jira sync needs explicit state tracking so the app knows which local tasks have already become Jira issues.
- The first implementation needs a small local persistence layer before full Jira sync feels reliable.
