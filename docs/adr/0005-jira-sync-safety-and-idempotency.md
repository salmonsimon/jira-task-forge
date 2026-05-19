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

Before enabling real Jira writes in v1, implement duplicate prevention with both
local state and a remote correlation marker when Jira permissions allow it. The
preferred marker is a Jira entity property or equivalent Jira-supported metadata
containing the local task id and sync attempt identity. Retry logic should query
that marker before creating a replacement issue when local state is ambiguous.
If the current Jira account cannot use a remote correlation marker, Jira writes
must remain behind an explicit HITL review with a documented fallback warning.

For v1, prefer single-issue creates with backend-managed local batching instead
of Jira bulk create. This keeps audit, retry, and partial-success behavior
simple enough to reason about for a personal local-first app.

When a tray contains nested work, sync order should be dependency-aware:

1. validate credentials and required local fields
2. sync or create required epics
3. create parent stories or bugs
4. create accepted sub-tasks under their saved parent Jira issues
5. upload selected attachments

Each step should record audit events and only advance local sync state after the
required Jira key/link is persisted locally.

Partial success should preserve completed parent work. If a parent story or bug
is created and its Jira key/link is saved locally, the parent local task becomes
`Created` even if later sub-task creation or attachment upload fails. Failed
child operations should be tracked as retryable sync details or audit events and
shown in the UI as a created task with warnings. Retry must not recreate the
parent; it should retry only the missing child operations. If the app cannot
confirm whether a parent Jira issue was created, retry must first search by the
remote correlation marker before attempting another create.

Tasks marked `Exported` from CSV may later be created through the Jira API, but
preflight must show an extra duplicate-risk warning because the app cannot know
whether the CSV was imported into Jira. The user may confirm and continue. A
future manual-link flow may let exported tasks become `Created` without creating
a new Jira issue.

## Consequences

- Sync behavior can be tested around local state transitions before real Jira
  writes are enabled.
- Audit events help diagnose failed or partial syncs.
- Retry code must be conservative and boring; robustness matters more than
  preserving visual tray order.
- Jira write operations remain HITL-gated until credential and idempotency
  details are reviewed.

## HITL Decisions Still Needed

- None for v1 architecture review.
