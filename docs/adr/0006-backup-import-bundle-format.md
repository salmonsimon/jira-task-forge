# ADR 0006: Use versioned JSON backups without secrets

## Status

Accepted

## Context

Tray drafts should be portable, and the app should support backup/restore before
high-risk sync and filesystem features land. Backups may include local tasks,
created Jira links, categories, epic mappings, JQL favorites, attachment
metadata, and redacted audit summaries.

Backups must not become a second secret store.

Earlier versions of this ADR selected a future archive-based backup with
attachment files. That direction is no longer planned for Personal v1. The
implemented JSON backup path is the accepted backup format unless a future
product review explicitly reopens attachment-byte backup/restore.

## Proposal

Use a versioned JSON import/export file for Personal v1 backups. This is the
same format used by the current native backup/import commands.

The manifest should include:

- `app`: `jira-task-forge`
- `format_version`: `1`
- `exported_at`: UTC ISO string
- `export_id`: UUID
- `source_app_version`, when available
- exported `record_counts`
- content `sections` included
- `attachment_metadata_included`
- `attachment_bytes_included`: always `false` for Personal v1
- `full_redacted_audit_included`: always `false` for Personal v1 unless a
  reviewed diagnostics export explicitly changes that behavior
- `secrets_included`: always `false`
- warning text that Jira and AI credentials are excluded

The JSON file should use stable domain sections such as trays, tasks,
categories, epic mappings, JQL favorites, non-secret settings, attachment
metadata, and sync audit summaries. Secrets and raw credential material are
always excluded.

Backups include redacted sync audit summaries by default. A separate advanced
export option may include full redacted audit events for debugging, but that
option must be explicit in the UI and is not part of the Personal v1 backup
roadmap. Neither summaries nor full redacted events may include secrets,
authorization headers, raw request bodies, full AI prompts, or attachment bytes.

Import should merge into existing local data by default and should not wipe the
current database unless a separate destructive restore flow is explicitly
designed and reviewed.

V1 may include a destructive full-restore mode, but it must be a separate flow
from normal merge import. Full restore should require strong confirmation,
clearly explain that it replaces local app data but does not delete Jira issues
or restore excluded credentials, and recommend or create a fresh backup of the
current local data before proceeding. The confirmation should require typing a
specific phrase rather than only clicking a button.

Personal v1 backups preserve attachment metadata and managed relative paths, but
do not copy attachment file bytes. Attachment bytes are managed by the attachment
lifecycle: Jira-ready bytes are removed after successful Jira upload, AI-only
bytes are removed when the Local Task becomes `Created`, and remaining editable
task bytes stay in managed local storage rather than being duplicated into
backups. Attachment-byte backup/restore, image compression for backups, and
backup-size warnings are out of scope unless explicitly reopened in a future
product decision.

Before applying an import, show an import review grouped by domain category:
trays, tasks, categories, attachments, Jira links, and audit data. The review
should separate safe auto-merge items from conflicts that need user attention.
Safe items may be merged by default. Ambiguous items should not overwrite local
records silently.

Default v1 conflict policy:

- tray name collisions import with a clear suffix such as `(imported
  2026-05-18)`
- identical existing records may be skipped
- conflicting imported local ids receive new UUIDs while preserving an
  `imported_from_id` reference for diagnostics
- projects and areas merge by normalized name and type
- tasks with Jira issue keys or links already present locally require conflict
  review before linking or duplicating
- missing parent, tray, or attachment references are reported in the relevant
  review category
- missing attachment bytes are expected for restored metadata-only backups and
  should be explained clearly

## Consequences

- Backups can preserve created Jira links without copying credentials.
- Attachment metadata can be restored without duplicating local file bytes.
- The backup format version gives future migrations a stable compatibility
  point.
- Import conflict handling becomes a required product decision before code.

## HITL Decisions Still Needed

- None for v1 architecture review.
