<p align="center"><a href="README.md">English</a> | <a href="README.es.md">Español</a></p>

# Jira Task Forge

Jira Task Forge is a local-first Windows desktop app for turning rough
production work into reviewed Jira issues. It gives you one place to capture
notes, organize tasks, prepare consistent descriptions, and decide what is
ready before anything reaches Jira Cloud.

### Download The Beta

Download the current public beta from
[GitHub Releases](https://github.com/salmonsimon/jira-task-forge/releases/tag/v0.1.0-beta.2).
The installer is unsigned, so Windows SmartScreen may display a warning. Report
reproducible problems through
[GitHub Issues](https://github.com/salmonsimon/jira-task-forge/issues).

## Context

Work rarely starts as a Jira-ready issue. It may begin as a production note, a
QA finding, a meeting follow-up, or an AI conversation that still needs scope,
evidence, and review.

Jira Task Forge keeps that early work in a local **Preparation Tray**: a working
group where related tasks can be organized by Project and Area, completed, and
reviewed together. When the tray is ready, the app can create the required
Epics, parent Stories or Bugs, accepted sub-tasks, selected attachments, and
`blocks` or `blocked by` links between tasks.

## Create AI-Assisted Descriptions

Jira Task Forge can draft Story and Bug descriptions using OpenAI, Anthropic
Claude, or Google Gemini. The result remains a local proposal instead of being
sent directly to Jira. In **Proposal review**, each section can be accepted,
rejected, edited manually, or returned to the AI with more context.

<p align="center">
  <img src="docs/assets/proposal-review.gif" alt="Description context followed by Proposal review in Jira Task Forge" width="640">
</p>

Story and Bug templates use predictable Markdown sections, making the final
description easy to scan in Jira and easy to review before creation:

<table align="center">
<tr>
<th width="50%">Story</th>
<th width="50%">Bug</th>
</tr>
<tr>
<td width="50%" valign="top"><samp>&#35;&#35; User Story<br><br>&#35;&#35; Context<br><br>&#35;&#35; Scope<br><br>&#35;&#35; Acceptance Criteria<br><br>&#35;&#35; Minimum Deliverable<br><br>&#35;&#35; Review Checklist</samp></td>
<td width="50%" valign="top"><samp>&#35;&#35; Problem<br><br>&#35;&#35; Context And Impact<br><br>&#35;&#35; Steps To Reproduce<br><br>&#35;&#35; Current Result<br><br>&#35;&#35; Expected Result<br><br>&#35;&#35; Evidence<br><br>&#35;&#35; Acceptance Criteria<br><br>&#35;&#35; Minimum Deliverable<br><br>&#35;&#35; Review Checklist</samp></td>
</tr>
</table>

## Keep Jira Names Consistent

Jira Task Forge derives Jira summaries from the reviewed local fields:

- Epic: `[{Project}] [{Area}] {Scope}`
- Story or Bug: `[{Area}] {Task name}`

The following animation shows how those fields become Jira summaries in
practice.

<p align="center">
  <img src="docs/assets/automatic-naming.gif" alt="Automatic Jira naming from reviewed local fields" width="640">
</p>

## Manage Categories From Their Real Sources

### Areas: Manual Or Notion

Areas can be maintained directly in Jira Task Forge or synchronized from a
Notion catalog. Manual mode is the shortest setup. Notion sync provides a
reusable source for Areas, Jira labels, issue types, delivery formats, and the
rules that define each minimum deliverable.

<p align="center">
  <img src="docs/assets/catalog-sync.gif" alt="Areas changing from Manual mode to a synchronized Notion catalog" width="640">
</p>

The [Catalog Sync Guide](docs/catalog-sync.md) provides a step-by-step path for
copying the public example into your own Notion workspace, authorizing that
page, and synchronizing its Areas and delivery requirements. This keeps the
available options and expected task structure consistent while work is being
prepared.

### Projects: Manual Or Jira

Projects can also be maintained manually or discovered from Jira. Project Sync
parses Jira Epic summaries using the naming format defined above:
`[{Project}] [{Area}] {Scope}`. The review wizard lets you choose which
discovered Projects stay active and which remain ignored but recoverable.

<p align="center">
  <img src="docs/assets/project-sync.gif" alt="Projects discovered from Jira Epic summaries" width="640">
</p>

## Search Jira With Assisted JQL

The JQL workspace supports two paths. Write JQL directly when you know the
syntax, or describe the issues in normal language and let the configured AI
provider draft the equivalent JQL. The generated query moves into **Direct
JQL** for review and does not run automatically.

For example, `Show me high and highest open bugs for STT, sorted by priority`
can become:

```jql
project = STT AND issuetype = Bug AND priority in (High, Highest)
AND statusCategory != Done ORDER BY priority DESC
```

<p align="center">
  <img src="docs/assets/assisted-jql.gif" alt="A natural-language search becoming reviewable JQL" width="640">
</p>

Queries are read-only. You can run them, save favorites, and return to recent
queries after reviewing the final JQL.

## Local Data And Credentials

Jira Task Forge is local-first: most of the work you prepare stays on your
computer until you choose to create it in Jira. Sensitive credentials, such as
Jira and Notion tokens or AI provider keys, are kept in Windows Credential
Manager instead of ordinary app data, so Windows protects the user's most
important secrets.

Selected attachments are copied into app-managed storage while a task is being
prepared. After a Jira-ready attachment uploads successfully, Jira Task Forge
deletes its managed local bytes and keeps only the metadata needed for local
history. AI-only attachment files are removed when the task reaches `Created`,
and deleting an editable task, tray, or attachment also removes its managed
files.

Read [Installation and Security](docs/installation-security.md) for the complete
storage, credential, and network boundaries.

## Documentation

- [Installation and Security](docs/installation-security.md)
- [Known Beta Limitations](docs/beta-limitations.md)
- [Catalog Sync Guide](docs/catalog-sync.md)
- [Create And Host Your Own Notion OAuth Public Connection](docs/notion-oauth-public-connection.md)
  is only for maintainers of forks or self-hosted versions. Standard app users
  do not need this setup.

Jira Task Forge is a personal open project intended for others to use, inspect,
fork, and adapt. The app is Windows-only today.
