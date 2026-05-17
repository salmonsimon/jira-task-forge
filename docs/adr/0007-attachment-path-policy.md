# ADR 0007: Store attachments as managed files under app data

## Status

Proposed

## Context

Images and attachments are part of task preparation. Each attachment has an
attachment purpose: AI only, Jira attachment, or AI + Jira attachment.

Product decisions already say attachment bytes should live as filesystem files
managed by the app, not as SQLite blobs.

## Proposal

Copy imported or pasted attachment files into an app-managed attachments
directory under the application data root. SQLite stores attachment metadata and
relative managed paths, not arbitrary source paths.

Attachment operations should canonicalize paths and reject any path that escapes
the app-managed storage root. Backups should include attachment files only from
managed storage.

Deleting a pending, failed, or exported local task should delete its local
attachment metadata and app-managed attachment files. Created tasks are read-only
in v1 and should not trigger Jira attachment deletion.

Attachment purpose controls transmission:

- AI only: available for AI context when explicitly sent, not uploaded to Jira
- Jira attachment: uploaded to Jira when selected for sync, not sent to AI
- AI + Jira attachment: eligible for both explicit AI use and Jira upload

## Consequences

- The app avoids broken links to arbitrary user folders after import/export.
- Backup and cleanup behavior can be deterministic.
- Path traversal and accidental overwrite risks are concentrated in backend
  filesystem services.
- Sending files to Jira or AI remains an explicit high-risk integration gate.

## HITL Decisions Still Needed

- Exact app data directory layout on Windows.
- File naming strategy for copied attachments.
- Whether duplicate attachment files are deduplicated or copied per task.
- Whether original source path is stored for display, and how much to redact.
- Attachment cleanup behavior when import partially fails.
