# ADR 0005: Make Jira sync explicit, audited, and retry-safe

## Status

Accepted

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
Jira project creation metadata, required fields, epic resolution, attachment
availability, and retry warnings. Blocking failures stop unsafe writes.
Non-blocking warnings are shown before or during sync when a user decision is
needed.

Missing descriptions are non-blocking only when Jira metadata allows empty
descriptions, but they must require explicit user confirmation in preflight
before those tasks are created. The app should not invent placeholder
descriptions to satisfy sync.

The sync backend must resolve Jira create metadata for the configured Jira
creation project before building payloads. It should confirm supported issue
types, required fields, labels support, and the field or API shape used to link
stories, bugs, and sub-tasks to their resolved epic. It should set priority
during create when Jira create metadata exposes the field. If Jira create
metadata omits priority for parent Story/Bug issues, the backend may use an
immediate post-create Jira issue update for priority because some Jira projects
hide priority from the create screen while still allowing issue priority edits.
If the required metadata cannot be read or mapped, sync must block before any
Jira issue is created. If a post-create priority update fails after the issue
already exists, the app must preserve the local Jira key/link and surface a
warning instead of retrying creation and risking a duplicate.

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
The marker should be as invisible as Jira allows: local ids and sync attempt ids
must not be added to summaries, descriptions, or labels. A generic
`jira-task-forge` label may be used for human traceability, but it is not the
source of idempotency.
If the current Jira account cannot use a remote correlation marker, Jira writes
must remain behind an explicit HITL review with a documented fallback warning.
If local state is ambiguous after a crash, timeout, or partial failure, retry
must search for the remote correlation marker before creating another Jira
issue. If the marker search fails, the app should retry that search once with a
short backoff. If the marker still cannot be confirmed, retry must pause the
affected local task or `Project + Area + Scope` group for manual recovery instead of
creating another Jira issue. Healthy groups may continue. The manual recovery
path should let the user link the local task to an existing Jira issue or
explicitly confirm a duplicate-risk create. The audit log should record a
sanitized marker-recovery failure without storing raw Jira response payloads.

For v1, prefer single-issue creates with backend-managed local batching instead
of Jira bulk create. This keeps audit, retry, and partial-success behavior
simple enough to reason about for a personal local-first app.

The first real Jira write slice should stop at required epics and parent
Story/Bug issues. It should implement metadata preflight, epic search/create,
parent issue creation, local Jira key/link persistence, remote correlation
markers, audit events, and partial recovery. It should not create sub-tasks or
upload attachments yet; those add separate retry and partial-failure surfaces and
belong in later slices.

Real Jira write QA should use `JTFTEST` as the writable sandbox. Agents may
mutate `JTFTEST` for implementation and QA without additional HITL approval.
`DTS` is read-only reference data for agents and must not be mutated.

When a tray contains nested work, sync order should be dependency-aware:

1. validate credentials and required local fields
2. validate Jira project creation metadata and payload mappings
3. search for required epics by the `[{Project}] [{Area}] {Scope}` naming rule,
   while accepting exact legacy `[{Project}] {Area}` matches for existing epics
4. create any missing required epics
5. create parent stories or bugs linked to their resolved epics
6. create accepted sub-tasks under their saved parent Jira issues
7. upload selected attachments

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

Sync should also preserve progress across independent `Project + Area + Scope` groups.
If epic lookup or epic creation fails for one group, that group should pause with
an actionable warning while other groups continue when their own preflight and
epic resolution are safe. After a partial sync, the UI may offer to create a
follow-up tray containing only failed or paused tasks plus a short origin note
from the sync failure. The follow-up tray should move those tasks rather than
copy them, preserving local task ids, retry history, audit lineage, and
duplicate-protection context.

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
- Jira write implementation can proceed AFK against `JTFTEST` within this
  accepted safety model; mutating `DTS` or changing the model remains HITL.

## HITL Decisions Still Needed

- None for v1 architecture review.

## Resolved HITL Decisions

- 2026-05-23: Ambiguous Jira writes should recover manually. If the app cannot
  confirm whether a local task already became a Jira issue, it must pause that
  task instead of auto-creating a possible duplicate.
- 2026-06-14: Remote marker recovery should retry marker search once with a
  short backoff after an ambiguous sync failure. If marker confirmation still
  fails, block only the affected task or `Project + Area + Scope` group, continue healthy
  groups, and record sanitized audit history. Do not allow blind retry.
- 2026-05-23: Epics are required for normal Jira sync. For every `Project +
  Area` represented in the tray, the app should search Jira for `[{Project}]
  {Area}` and create the missing epic before creating linked stories, bugs, or
  sub-tasks.
- 2026-05-23: Jira sync should continue healthy `Project + Area` groups when
  another group has an epic lookup/creation failure, and should surface the
  failed group with an actionable warning.
- 2026-07-05: Epic grouping now uses `Project + Area + Scope` for new Jira epic
  resolution and creation. Exact legacy `[{Project}] {Area}` epics remain a
  compatibility fallback for existing data.
- 2026-05-23: Recovery trays should move failed or paused tasks without
  duplicating them, preserving each local task's identity for retry safety.
- 2026-05-23: Jira writes must validate the configured Jira project's creation
  metadata before creating issues. If required issue types, fields, priority,
  labels, or epic-linking metadata cannot be resolved, sync blocks before
  partial writes.
- 2026-05-23: Remote duplicate-prevention markers should be as invisible as
  possible. Prefer Jira entity properties; do not expose local task ids or sync
  attempt ids in summaries, descriptions, or labels.
- 2026-05-23: Missing descriptions may be created only after explicit preflight
  confirmation when Jira allows empty descriptions. Do not create placeholder
  descriptions; if Jira requires the field, block the affected task.
- 2026-05-23: First Jira write slice should create required epics and parent
  Story/Bug issues only. Sub-tasks and attachments remain later slices.
- 2026-05-23: Jira write QA may mutate `JTFTEST` without asking, but agents
  must treat `DTS` as read-only reference data.
- 2026-05-24: Parent Story/Bug summaries created in Jira should start with a
  bracketed area code, `[{Area}] {Title}`. Until categories have an explicit
  code field, the trimmed `Area` value is the code. This is user-visible Jira
  naming, not a duplicate-prevention marker, so it does not conflict with the
  rule that local ids and sync attempt ids stay out of summaries.
- 2026-05-24: When Jira create metadata omits parent issue priority, sync may
  create the issue and then immediately set priority through a Jira issue update
  before continuing. This resolves the `JTFTEST` behavior where creates default
  to Medium even when the local task priority is High/Highest.
