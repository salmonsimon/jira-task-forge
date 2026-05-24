# ADR 0007: Store attachments as managed files under app data

## Status

Accepted

## Context

Images and attachments are part of task preparation. Each attachment has an
attachment purpose: AI only, Jira attachment, or AI + Jira attachment.

Product decisions already say attachment bytes should live as filesystem files
managed by the app, not as SQLite blobs.

## Proposal

Copy imported or pasted attachment files into an app-managed attachments
directory under the application data root. SQLite stores attachment metadata and
relative managed paths, not arbitrary source paths.

Use the Tauri/Windows app data directory as the storage root. The conceptual v1
layout is:

```text
Jira Task Forge/
  data/
    jira-task-forge.sqlite3
    migrations/
  attachments/
    originals/
    compressed/
    staging/
  backups/
  logs/
```

The implementation should resolve the exact platform path through Tauri or
platform APIs rather than hard-coding an absolute Windows path.

Attachment operations should canonicalize paths and reject any path that escapes
the app-managed storage root. Backups should include attachment files only from
managed storage.

Managed attachment files should live under a folder named by attachment UUID.
Original files use the sanitized original filename for human debugging and
display continuity:

```text
attachments/originals/{attachment_uuid}/{safe_original_filename}
attachments/compressed/{attachment_uuid}/{variant_uuid}-{profile}.{ext}
```

Attachment metadata should store the display filename, MIME type when known,
original size, compressed size when available, managed relative paths, and a file
hash when calculated.

Do not deduplicate attachment files globally in v1. Copy each imported or pasted
attachment into its own managed attachment UUID folder. File hashes may be used
for diagnostics or import conflict review, but not for sharing one physical file
between multiple tasks.

Deleting a pending, failed, or exported local task should delete its local
attachment metadata and app-managed attachment files. Created tasks are read-only
in v1 and should not trigger Jira attachment deletion.

Import should continue when individual attachments are missing, corrupt, or fail
to copy. The imported task may still be restored, while the attachment is either
omitted or imported with a warning status such as `Missing` or `Failed to
restore`. Import Review and post-restore reports should group these under
`Attachments`. `Create in Jira` preflight should warn or block when a task
expects an attachment that is missing locally. Temporary files under `staging/`
should be cleaned after import, and stale staging files should be cleaned on the
next app start after a crash.

Attachment purpose controls transmission:

- AI only: available for AI context when explicitly sent, not uploaded to Jira
- Jira attachment: uploaded to Jira when selected for sync, not sent to AI
- AI + Jira attachment: eligible for both explicit AI use and Jira upload

For supported image attachments, the app may generate a compressed derivative to
reduce Jira upload and backup size. Compression must be reviewable by the user:
show original size, compressed size, and enough preview/quality context for the
user to accept or reject the compressed version. Store the accepted compressed
derivative as a managed file with metadata linking it to the original
attachment. The user may choose whether to keep the original when compression is
not beneficial, but default to preserving originals unless the user explicitly
discards them. Jira upload should use the accepted compressed derivative when
available; otherwise it should use the original managed file.

## Consequences

- The app avoids broken links to arbitrary user folders after import/export.
- Backup and cleanup behavior can be deterministic.
- Path traversal and accidental overwrite risks are concentrated in backend
  filesystem services.
- Sending files to Jira or AI remains an explicit high-risk integration gate.

## HITL Decisions Still Needed

- None for v1 architecture review.
