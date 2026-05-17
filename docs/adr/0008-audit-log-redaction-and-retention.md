# ADR 0008: Keep sync audit logs structured, redacted, and bounded

## Status

Proposed

## Context

Jira sync needs audit logs for debugging failed exports, retries, partial
successes, and user-visible sync status. Audit logs are not full content version
history.

Logs may accidentally capture sensitive values if request payloads, credentials,
attachments, AI prompts, or Jira content are stored too broadly.

## Proposal

Store sync audit logs as structured events in SQLite. Each event should include
the local task or tray id when available, event type, timestamp, sync attempt id,
outcome, provider/integration name, and a redacted detail object.

Audit detail should prefer stable identifiers, counts, statuses, and error codes
over full payloads. Do not store raw secrets, authorization headers, API tokens,
AI provider keys, attachment bytes, or full Jira/AI request bodies in audit logs.

For v1, retain audit logs locally until the related tray is deleted or until a
manual cleanup/export policy is accepted. Backups may include redacted audit
summaries by default, with full redacted audit export requiring explicit review.

## Consequences

- Failed syncs are explainable without turning logs into a privacy risk.
- Tests can assert that known secret-shaped values are not persisted in audit
  details.
- Debugging some Jira/API issues may require reproducing with temporary verbose
  logging that is not persisted by default.
- Retention and backup behavior remain visible HITL decisions.

## HITL Decisions Still Needed

- Exact retention period or cleanup trigger for v1.
- Whether backups include full redacted audit events or only summaries.
- Whether users can manually clear audit logs per tray.
- Allowed fields for Jira and AI error details.
- Whether temporary diagnostic logging is permitted during development and where
  it may be written.
