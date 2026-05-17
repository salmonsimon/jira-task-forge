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

- tray drafts, with tray state and timestamps
- local tasks, with stable local ids, sync status, Jira issue link fields, and
  task order within a tray/project group
- categories for projects and areas, including hidden/ignored state
- epic mappings from project + area to Jira epic identity
- attachment metadata, with file paths stored separately from file contents
- JQL favorites
- settings metadata that is safe to persist in SQLite
- sync audit logs, using redacted structured event data

Migrations should be monotonic and reviewed before implementation branches depend
on them. Once real user data exists, migrations should only move forward and
should include a backup recommendation before destructive or shape-changing
changes.

SQLite should not store attachment file bytes or secrets.

## Consequences

- Backend code can protect persistence invariants in one place.
- Frontend work can continue against typed contracts while repositories evolve.
- Schema changes become a HITL review point before high-risk data work lands.
- Import/export and sync code need clear mapping rules between database rows and
  portable bundle records.

## HITL Decisions Still Needed

- Exact table and column names before the first migration is accepted.
- Whether stable local ids are UUIDs, ULIDs, or another generated identifier.
- Whether timestamps use local time, UTC strings, or integer epoch values.
- Which settings are safe for SQLite and which must live only in secret storage.
- Migration rollback expectations during v1 development.
