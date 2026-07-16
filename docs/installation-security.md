[English](installation-security.md) | [Español](installation-security.es.md) · [Back to README](../README.md)

# Installation And Security

## Install The Current Beta

Download Jira Task Forge only from the
[official GitHub release](https://github.com/salmonsimon/jira-task-forge/releases/tag/v0.1.0-beta.1).

The Windows installer is currently unsigned. Windows SmartScreen may warn before
running it, so confirm that the installer came from this repository.

## Credentials

Jira Task Forge stores these secrets in Windows Credential Manager:

- Jira API tokens;
- Notion OAuth token sets;
- OpenAI, Anthropic Claude, or Google Gemini API keys.

Secrets are designed to stay out of SQLite, JSON backups, application logs,
screenshots, and committed files. A backup restores local work and settings, but
you must reconnect credentials on the restored installation.

## Local Data

The app stores Preparation Trays, tasks, accepted descriptions, categories,
non-secret settings, sync history, and attachment metadata locally. Selected
attachments are copied into app-managed local storage.

The detailed storage and cleanup boundary is documented in
[Local Data Storage Inventory](local-data-storage-inventory.md).

## Network Connections

Depending on the actions you trigger, Jira Task Forge may contact:

- Jira Cloud for connection tests, metadata, JQL searches, and issue creation;
- your selected AI provider for assisted JQL or descriptions;
- Notion and the Jira Task Forge OAuth backend when catalog sync is enabled.

The Notion OAuth backend exchanges the temporary authorization code without
placing the Notion client secret inside the desktop app. See
[Notion Public Connection OAuth](notion-oauth-public-connection.md).

## Before Connecting Real Accounts

- Review the [known beta limitations](beta-limitations.md).
- Use API tokens and keys with the narrowest practical permissions.
- Do not share logs or screenshots that expose authorization codes or tokens.
- Keep a current JSON backup of important local trays.

Report reproducible security or privacy problems through
[GitHub Issues](https://github.com/salmonsimon/jira-task-forge/issues).
