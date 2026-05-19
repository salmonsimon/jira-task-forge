# ADR 0003: Use reviewed SQLite migrations for local app data

## Status

Proposed

## Context

Jira Task Forge needs durable local storage for preparation trays, local tasks,
categories, epic mappings, JQL favorites, settings metadata, attachment metadata,
and sync audit logs.

The app is local-first. Jira is a destination and query source, not the only
source of truth while work is being prepared.

## Proposal

Use SQLite as the app database with append-only migration files checked into the
repo. The Rust/Tauri backend owns database access through repository/service
modules; React calls Tauri commands instead of reading SQLite directly.

The initial schema should store these concepts separately:

- `trays`, with tray state and timestamps
- `tasks`, with stable local ids, sync status, Jira issue link fields, and task
  order within a tray/project group
- `categories` for projects and areas, including hidden/ignored state
- `epic_mappings` from project + area to Jira epic identity
- `attachments`, with original file metadata and managed relative paths stored
  separately from file contents
- `attachment_variants`, with accepted compressed derivatives and metadata
- `jql_favorites`
- `settings`, containing only metadata that is safe to persist in SQLite
- `sync_attempts`, grouping a user-triggered sync run
- `sync_audit_events`, using redacted structured event data

Migrations should be monotonic and reviewed before implementation branches depend
on them. Once real user data exists, migrations should only move forward and
should include a backup recommendation before destructive or shape-changing
changes.

Migration rollback files are out of scope for v1. If a migration needs to be
corrected after merge, add a new forward migration instead of editing the
existing one. During early development, deleting a disposable local database is
acceptable, but that should not become a product restore path.

SQLite should not store attachment file bytes or secrets.

SQLite may store non-secret settings and integration metadata, including Jira
site URL, account display name or email returned by Jira, last credential check
time and result, `has_*_credential` flags, selected AI provider name, theme,
default content language, and other non-sensitive UI preferences. SQLite must
not store Jira API tokens, passwords, OAuth access or refresh tokens, AI API
keys, authorization headers, raw environment variables, or unredacted secret
values copied from errors.

Stable local ids should be UUID strings for v1. UUIDs are the boring standard
choice, are widely supported by Rust, TypeScript, SQLite tooling, and backup
inspection workflows, and avoid coupling local identity to database row ids.

Persisted timestamps should use UTC ISO 8601 strings such as
`2026-05-18T12:34:56Z`. UI may render local time, but SQLite rows, backups, and
audit events should use UTC to avoid timezone-dependent import/export behavior.

## Consequences

- Backend code can protect persistence invariants in one place.
- Frontend work can continue against typed contracts while repositories evolve.
- Schema changes become a HITL review point before high-risk data work lands.
- Import/export and sync code need clear mapping rules between database rows and
  portable bundle records.

## HITL Decisions Still Needed

- None for v1 architecture review.
