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

CSV export provides a portable fallback for reviewed task content.

## Review AI Changes Before They Become Jira Content

Jira Task Forge can assist with Story and Bug descriptions using OpenAI,
Anthropic Claude, or Google Gemini. AI output stays local as a proposal.
**Proposal review** lets you accept, reject, edit, or request changes section by
section before the description is used.

![Proposal review in Jira Task Forge](docs/assets/proposal-review.gif)

The description structure remains predictable. Story and Bug templates use
separate Markdown sections so the result is readable in Jira and easy to review
before creation:

<table>
<tr>
<th width="50%">Story</th>
<th width="50%">Bug</th>
</tr>
<tr>
<td width="50%" valign="top"><pre><code>&#35;&#35; User Story&#10;&#10;&#35;&#35; Context&#10;&#10;&#35;&#35; Scope&#10;&#10;&#35;&#35; Acceptance Criteria&#10;&#10;&#35;&#35; Minimum Deliverable&#10;&#10;&#35;&#35; Review Checklist</code></pre></td>
<td width="50%" valign="top"><pre><code>&#35;&#35; Problem&#10;&#10;&#35;&#35; Context And Impact&#10;&#10;&#35;&#35; Steps To Reproduce&#10;&#10;&#35;&#35; Current Result&#10;&#10;&#35;&#35; Expected Result&#10;&#10;&#35;&#35; Evidence&#10;&#10;&#35;&#35; Acceptance Criteria&#10;&#10;&#35;&#35; Minimum Deliverable&#10;&#10;&#35;&#35; Review Checklist</code></pre></td>
</tr>
</table>

## Keep Jira Names Consistent

Jira Task Forge derives Jira summaries from the reviewed local fields:

- Epic: `[{Project}] [{Area}] {Scope}`
- Story or Bug: `[{Area}] {Task name}`

The following animation shows how those fields become Jira summaries in
practice.

![Automatic Jira naming from local fields](docs/assets/automatic-naming.gif)

## Manage Categories From Their Real Sources

### Areas: Manual Or Notion

Areas can be maintained directly in Jira Task Forge or synchronized from a
Notion catalog. Manual mode is the shortest setup. Notion sync is useful when
you want one reusable source for Areas, Jira labels, issue types, and delivery
formats.

![Categories changing from Manual mode to a validated Notion catalog](docs/assets/catalog-sync.gif)

The public Notion example is a template, not a page that can be used directly
through OAuth. Copy it into your own workspace and select that owned top-level
page when connecting Jira Task Forge. The
[Catalog Sync Guide](docs/catalog-sync.md) explains the complete flow.

### Projects: Manual Or Jira

Projects can also be maintained manually or discovered from Jira. Project Sync
parses Jira Epic summaries using the naming format defined above:
`[{Project}] [{Area}] {Scope}`. The review wizard lets you choose which
discovered Projects stay active and which remain ignored but recoverable.

![Projects discovered from Jira Epic summaries](docs/assets/project-sync.gif)

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

![A natural-language search becoming reviewable JQL](docs/assets/assisted-jql.gif)

Queries are read-only. You can run them, save favorites, and return to recent
queries after reviewing the final JQL.

## Local Data And Credentials

Trays, tasks, accepted descriptions, non-secret settings, categories, and sync
history stay on this computer. Jira tokens, Notion OAuth tokens, and AI
provider keys are stored in Windows Credential Manager instead of the app's
local database. This uses the Windows credential vault so the app does not need
to expose secrets in its interface or ordinary local data.

Selected attachments are copied into app-managed storage while a task is being
prepared. After a Jira-ready attachment uploads successfully, Jira Task Forge
deletes its managed local bytes and keeps only the metadata needed for local
history. AI-only attachment files are removed when the task reaches `Created`,
and deleting an editable task, tray, or attachment also removes its managed
files.

Read [Installation and Security](docs/installation-security.md) before
connecting personal accounts or API keys.

## Documentation

- [Installation and Security](docs/installation-security.md)
- [Known Beta Limitations](docs/beta-limitations.md)
- [Catalog Sync Guide](docs/catalog-sync.md)
- [Notion Public Connection OAuth](docs/notion-oauth-public-connection.md)

Jira Task Forge is a personal open project intended for others to use, inspect,
fork, and adapt. The app is Windows-only today.
