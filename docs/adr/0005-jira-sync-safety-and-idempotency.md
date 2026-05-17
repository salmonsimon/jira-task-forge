# ADR 0005: Make Jira sync explicit, audited, and retry-safe

## Status

Proposed

## Context

Creating duplicate Jira issues is one of the highest product risks. Local tasks
can be pending, failed, exported, or already created. Failed tasks must be
retryable without losing their local identity.

Jira API details may change during implementation, so this ADR should define the
safety model without over-specifying exact REST payloads.

## Proposal

Treat Jira sync as an explicit backend operation started by `Create in Jira`.
Each local task keeps a stable local id and sync status. A task becomes `Created`
only after the app records the created Jira issue key/link locally.

Before writing to Jira, sync should run preflight validation for credentials,
required fields, epic resolution, attachment availability, and retry warnings.
Blocking failures stop unsafe writes. Non-blocking warnings are shown before or
during sync when a user decision is needed.

Retries should use local state to avoid repeat creation:

- skip tasks already marked `Created`
- preserve the same local task id across failed attempts
- record each attempt in the sync audit log
- store enough request intent metadata to explain what was attempted
- check local Jira issue link fields before attempting another create

The initial implementation may avoid advanced remote idempotency if Jira does not
provide a suitable native key, but it must not rely on UI state alone to prevent
duplicates.

## Consequences

- Sync behavior can be tested around local state transitions before real Jira
  writes are enabled.
- Audit events help diagnose failed or partial syncs.
- Retry code must be conservative and boring; robustness matters more than
  preserving visual tray order.
- Jira write operations remain HITL-gated until credential and idempotency
  details are reviewed.

## HITL Decisions Still Needed

- Jira auth strategy and credential-test flow.
- Whether v1 uses Jira bulk create or single-issue creates with local batching.
- Exact duplicate-prevention strategy if Jira supports external correlation
  fields or entity properties.
- How to handle partial success when parent stories are created but sub-tasks or
  attachments fail.
- Whether exported CSV tasks can later be API-created without extra warning.
