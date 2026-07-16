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

Windows Credential Manager keeps these secrets in the operating system's
credential vault instead of the app's SQLite database, ordinary logs,
screenshots, or committed files. Jira Task Forge retrieves a credential only
when the related connection or action needs it and does not display stored
secret values in the interface.

## Local Data

The app stores Preparation Trays, tasks, accepted descriptions, categories,
non-secret settings, sync history, and attachment metadata locally. Selected
attachments are copied into app-managed local storage while work is prepared.

After a Jira-ready attachment uploads successfully, the app deletes its managed
local bytes and retains the metadata needed for local history. Files used only
as AI context are removed when the task reaches `Created`. Deleting an editable
task, tray, or attachment also removes the corresponding managed files, and the
app clears stale staging files left by interrupted imports.

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
- Verify created Jira issues and uploaded attachments before deleting important
  source files.

Report reproducible security or privacy problems through
[GitHub Issues](https://github.com/salmonsimon/jira-task-forge/issues).
