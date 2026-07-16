[English](README.md) | [Español](README.es.md)

# Jira Task Forge

Jira Task Forge is a local-first Windows desktop app for preparing and reviewing
work before creating anything in Jira Cloud.

It is designed for people who turn production notes, QA findings, meeting
follow-ups, or AI conversations into Jira issues and want a deliberate review
step between the rough idea and Jira.

## Download The Beta

Download the current public beta from
[GitHub Releases](https://github.com/salmonsimon/jira-task-forge/releases/tag/v0.1.0-beta.1).

The installer is unsigned, so Windows SmartScreen may display a warning. This is
a public beta and may contain errors. Report reproducible problems through
[GitHub Issues](https://github.com/salmonsimon/jira-task-forge/issues).

## Prepare First, Create In Jira When Ready

Work begins in a local **Preparation Tray**. You can capture tasks, organize
them by Project and Area, add evidence, prepare descriptions, and review the
result without creating incomplete issues in Jira.

When the tray is ready, Jira Task Forge can create:

- required Epics;
- parent Stories and Bugs;
- accepted sub-tasks;
- selected attachments.

JSON backup and CSV export are available as local backup and fallback paths.

## Review AI Changes Before They Become Jira Content

Jira Task Forge can assist with Story and Bug descriptions using OpenAI,
Anthropic Claude, or Google Gemini. AI output stays local as a proposal.
**Proposal review** lets you accept, reject, edit, or request changes section by
section before the description is used.

![Proposal review in Jira Task Forge](docs/assets/proposal-review.gif)

The description structure remains predictable:

| Story | Bug |
| --- | --- |
| User story | Problem |
| Context | Context and impact |
| Scope | Steps to reproduce |
| Acceptance criteria | Current and expected results |
| Minimum deliverable | Evidence |
| Review checklist | Acceptance criteria, minimum deliverable, and review checklist |

## Keep Jira Names Consistent

Jira Task Forge derives Jira summaries from the reviewed local fields:

- Epic: `[{Project}] [{Area}] {Scope}`
- Story or Bug: `[{Area}] {Task name}`

The examples below use fictitious data.

![Automatic Jira naming from local fields](docs/assets/automatic-naming.gif)

## Manage Categories Manually Or With Notion

Areas can be maintained directly in Jira Task Forge or synchronized from a
Notion catalog. Manual mode is the shortest setup. Notion sync is useful when
you want one reusable source for Areas, Jira labels, issue types, and delivery
formats.

![Categories changing from Manual mode to a validated Notion catalog](docs/assets/catalog-sync.gif)

The public Notion example is a template, not a page that can be used directly
through OAuth. Copy it into your own workspace and select that owned top-level
page when connecting Jira Task Forge. The
[Catalog Sync Guide](docs/catalog-sync.md) explains the complete flow.

## Search Jira With Assisted JQL

The JQL workspace can run read-only Jira searches, keep favorites and recent
queries, and draft JQL with the configured AI provider. You always review the
query before running it.

## Local Data And Credentials

Trays, tasks, accepted descriptions, settings, categories, and sync history are
stored locally. Jira tokens, Notion OAuth tokens, and AI provider keys are kept
in Windows Credential Manager and excluded from JSON backups.

Read [Installation and Security](docs/installation-security.md) before
connecting personal accounts or API keys.

## Documentation

- [Installation and Security](docs/installation-security.md)
- [Known Beta Limitations](docs/beta-limitations.md)
- [Catalog Sync Guide](docs/catalog-sync.md)
- [Notion Public Connection OAuth](docs/notion-oauth-public-connection.md)

Jira Task Forge is a personal open project intended for others to use, inspect,
fork, and adapt. The app is Windows-only today.
