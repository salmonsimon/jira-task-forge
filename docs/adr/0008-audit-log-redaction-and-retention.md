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

For v1, retain audit logs for as long as the related tray exists. Archived trays
keep their audit logs. Deleting a tray deletes its local audit logs along with
other local tray data. Users may manually clear audit logs for a tray through a
confirmed action. Do not apply an automatic date-based TTL in v1.

Full backup exports should include redacted audit summaries by default. Full
redacted audit events may be included only through an explicit advanced export
option with UI warning copy, never silently.

Audit error details should use an allowlist. Allowed fields include
provider/integration name, operation name, HTTP status code, Jira error key/code
when available, error category, retryable flag, local correlation ids, sync
attempt id, relevant counts, endpoint path without sensitive query values, AI
provider/model name, and a redacted short message capped at 500 characters.
Disallowed fields include authorization headers, API tokens, raw request or
response bodies, full AI prompts, full Jira descriptions, attachment bytes or
base64, and absolute filesystem paths when a managed relative path is enough.

Temporary diagnostic logging is allowed only for development/debug builds or
behind an explicit feature flag. It must be off by default, redacted, excluded
from backups, and written under `logs/diagnostics/` when persisted. Diagnostic
logs may include payload shapes, status codes, timing, endpoint paths, and local
correlation ids, but still must not include secrets. Persisted raw request or
response bodies are out of scope for v1.

## Consequences

- Failed syncs are explainable without turning logs into a privacy risk.
- Tests can assert that known secret-shaped values are not persisted in audit
  details.
- Debugging some Jira/API issues may require reproducing with temporary verbose
  logging that is not persisted by default.
- Retention and backup behavior remain visible HITL decisions.

## HITL Decisions Still Needed

- None for v1 architecture review.
