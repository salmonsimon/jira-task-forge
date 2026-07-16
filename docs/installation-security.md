# Installation And Security

Jira Task Forge is currently distributed as an unsigned Windows beta installer.

## Install

Download the current beta from GitHub Releases:

https://github.com/salmonsimon/jira-task-forge/releases/tag/v0.1.0-beta.1

Because the installer is unsigned, Windows SmartScreen may warn before running
it. Only install releases from the official repository.

## Secrets

Jira Task Forge stores secrets in Windows Credential Manager:

- Jira API token
- Notion OAuth token set
- AI provider API keys

Secrets are not stored in SQLite, JSON backups, logs, screenshots, or committed
files by design.

## Local Data

The app stores local trays, tasks, accepted descriptions, non-secret settings,
sync audit history, categories, and attachment metadata locally. JSON backups
exclude secrets.

See [docs/local-data-storage-inventory.md](local-data-storage-inventory.md) for
the current storage inventory.

## Network Calls

The app may contact:

- Jira Cloud for metadata, JQL, issue creation, sub-task creation, attachment
  upload, and issue links once Issue #200 lands.
- The configured AI provider for manually triggered JQL or description
  assistance.
- Notion through the public OAuth connection when catalog sync is enabled.
- `https://notion-oauth.salmonsimon.com` for the Notion OAuth code exchange.

## Beta Boundary

This beta is useful but not final distribution polish. Report reproducible
problems in [GitHub Issues](https://github.com/salmonsimon/jira-task-forge/issues).
