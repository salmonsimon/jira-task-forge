# ADR 0006: Use a versioned backup bundle without secrets

## Status

Proposed

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

The manifest should include:

- bundle format version
- app name and export timestamp
- exported record counts
- content sections included
- warning that secrets are excluded

Data files should use stable domain names such as trays, tasks, categories, epic
mappings, JQL favorites, attachment metadata, and sync audit summaries. Secrets
and raw credential material are always excluded.

Import should merge into existing local data by default and should not wipe the
current database unless a separate destructive restore flow is explicitly
designed and reviewed.

## Consequences

- Backups can preserve created Jira links without copying credentials.
- Attachments can be restored along with metadata when included.
- The bundle version gives future migrations a stable compatibility point.
- Import conflict handling becomes a required product decision before code.

## HITL Decisions Still Needed

- Exact bundle file names and manifest schema.
- Whether full sync audit details or only summaries are included in backups.
- Import conflict policy for duplicate tray ids, task ids, categories, and Jira
  issue links.
- Whether a destructive full-restore mode exists in v1.
- Maximum attachment size or bundle size guidance.
