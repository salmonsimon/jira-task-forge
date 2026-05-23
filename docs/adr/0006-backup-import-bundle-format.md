# ADR 0006: Use a versioned backup bundle without secrets

## Status

Accepted

## Context

Tray drafts should be portable, and the app should support backup/restore before
high-risk sync and filesystem features land. Backups may include local tasks,
created Jira links, categories, epic mappings, JQL favorites, attachment
metadata, and selected attachment files.

Backups must not become a second secret store.

## Proposal

Use a versioned import/export bundle for v1 backups. The preferred shape is a zip
file containing a manifest JSON file, data JSON files, and an attachments
directory. A single-tray JSON export can remain available for lightweight tray
draft sharing, but the full backup should use the bundle format.

Full backup zip names should use:

```text
jira-task-forge-backup-YYYYMMDD-HHMMSS.zip
```

The v1 bundle layout should be:

```text
manifest.json
data/trays.json
data/tasks.json
data/categories.json
data/epic-mappings.json
data/jql-favorites.json
data/settings.json
data/attachment-metadata.json
data/audit-summaries.json
data/audit-events.json        # only when advanced audit export is enabled
attachments/
```

The manifest should include:

- `app`: `jira-task-forge`
- `format_version`: `1`
- `exported_at`: UTC ISO string
- `export_id`: UUID
- `source_app_version`, when available
- exported `record_counts`
- content `sections` included
- `attachments_included`
- `full_redacted_audit_included`
- `secrets_included`: always `false`
- warning text that Jira and AI credentials are excluded

Data files should use stable domain names such as trays, tasks, categories, epic
mappings, JQL favorites, attachment metadata, and sync audit summaries. Secrets
and raw credential material are always excluded.

Full backups include redacted sync audit summaries by default. A separate
advanced export option may include full redacted audit events for debugging, but
that option must be explicit in the UI. Neither summaries nor full redacted
events may include secrets, authorization headers, raw request bodies, full AI
prompts, or attachment bytes.

Import should merge into existing local data by default and should not wipe the
current database unless a separate destructive restore flow is explicitly
designed and reviewed.

V1 may include a destructive full-restore mode, but it must be a separate flow
from normal merge import. Full restore should require strong confirmation,
clearly explain that it replaces local app data but does not delete Jira issues
or restore excluded credentials, and recommend or create a fresh backup of the
current local data before proceeding. The confirmation should require typing a
specific phrase rather than only clicking a button.

Attachments should show size warnings before backup/export/sync. For v1, warn
when a single attachment is over 25 MB and block normal attachment handling when
a single attachment is over 100 MB. Supported image attachments should be
compressed before upload/export where doing so can materially reduce size
without making the Jira artifact unusable. Compression should be user-reviewed:
show original size, compressed size, and preview/quality context before treating
a compressed derivative as accepted. The UI should distinguish original file size
from prepared/compressed size when available. Full backup bundles should warn
when the estimated bundle size is over 500 MB.

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
- attachments are copied into managed storage; attachment failures should not
  silently fail the whole import

## Consequences

- Backups can preserve created Jira links without copying credentials.
- Attachments can be restored along with metadata when included.
- The bundle version gives future migrations a stable compatibility point.
- Import conflict handling becomes a required product decision before code.

## HITL Decisions Still Needed

- None for v1 architecture review.
