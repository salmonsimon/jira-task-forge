# Jira Task Forge Product Decisions

This document captures the product scope decisions from the grill session. UI copy should be in English, while Jira task content can be in Spanish or the selected task language.

## Product Shape

- Jira Task Forge is a Windows desktop app for preparing Jira work locally before creating issues through the Jira Cloud REST API.
- The app is primarily personal-use in v1, but should not block future team distribution.
- The app should feel familiar to Jira: dense tables, issue links, compact controls, focused issue windows, and restrained visual styling.
- The app supports theme selection from Settings: `Light`, `Dark`, or `System`.
- The prototype should default to a Jira-like dark theme for easier comparison with the user's current Jira workflow.
- The app starts on the `Trays` tab with the tray selector. It does not reopen the last used tray automatically.
- Main tabs are `Trays` and `JQL`.
- Global chip-style actions are `Categories` and `Settings`.

## Prototype Scope

- The first prototype should be built inside the real app skeleton, not as a separate throwaway mock.
- The prototype should include the full shell from the start:
  - top app bar
  - global chips: `Categories` and `Settings`
  - main tabs: `Trays` and `JQL`
  - tray selector
  - tray editor
  - task detail panel
  - categories panel
  - settings panel
  - JQL query panel and result table
- The prototype should use fake/in-memory data, not real Jira, real AI, or real SQLite persistence.
- Visual direction should be Jira-like from the start, without being a literal clone.
- Use compact tables, subtle borders, restrained colors, issue-like badges, and a right-side detail panel.
- Prototype data should be real-ish:
  - projects such as `STT`, `PilotLab`, `MR Studio`, and `Transversal`
  - areas such as `Bug`, `3D`, `Polish`, `Programacion`, `Iluminacion`, `Texturas`, `Localizacion`, and `Refactorizacion`
  - tasks such as `Resolver problema timer`, `Bloquear input acorde avance objetivos`, `Maquinas expendedoras`, `Ajustar botones menu`, and `Panel de informacion Metro`
  - fake Jira keys such as `DTS-901`, `DTS-902`, and `DTS-835`
- The task detail prototype should include mixed states:
  - tasks with completed assisted descriptions
  - tasks with missing descriptions
  - tasks with started notes
  - tasks with attachments
  - tasks with failed sync state and visible sync log
- Clicking a task should open a focused floating task window, similar to Jira's issue focus view, instead of a persistent right-side inspector.

## Trays

- The app supports multiple named tray drafts.
- Creating a new tray immediately opens the normal tray editor with a temporary highlighted name such as `New tray`, ready to overwrite by typing.
- Tray states are:
  - `Active`
  - `Needs attention`
  - `Completed`
  - `Archived`
- A tray becomes `Completed` automatically when all tasks in it are created in Jira.
- Completed trays stay visible until the user manually archives them.
- Archived trays are hidden from the main flow and shown only in an explicit archived view.
- Trays can be archived regardless of task state.
- Trays can be deleted directly from the main tray list or archived view.
- Deleting a tray only removes local app data and never deletes Jira issues.
- Empty trays can use lightweight deletion confirmation.
- Trays with local-only tasks require normal deletion confirmation.
- Trays with created Jira tasks require strong confirmation explaining that Jira issues will not be deleted, but local history and links will be removed.
- Trays can be restored from the archived view.
- Duplicating a full tray is out of scope for v1.
- Tray drafts do not need full content versioning in v1.

## Capture Flow

- A tray may contain tasks for multiple projects.
- Capture happens under one active project at a time.
- The active project is selected first, then multiple tasks can be added under it.
- The user can switch active project and continue adding tasks in the same tray.
- The tray view groups tasks by project.
- Within each project, tasks keep manual/capture order for review.
- Jira creation does not need to preserve visual order; robustness matters more.

## Task Fields

- Quick capture includes only necessary fields:
  - `Project`
  - `Area`
  - `Title`
  - `Priority`
- `Project`, `Area`, and `Priority` use visible controls navigable by keyboard arrows and mouse.
- Jira priority values are:
  - `Lowest`
  - `Low`
  - `Medium`
  - `High`
  - `Highest`
- `Medium` is the recommended default priority.
- Issue type is derived automatically:
  - `Area = Bug` creates Jira issue type `Bug`
  - all other areas create Jira issue type `Story`
- Issue type is not part of the main capture input.
- Area is copied automatically into Jira labels/tags for the issue.
- Labels are not edited from the main capture screen.

## Task Editing

- Pending and failed tasks remain editable.
- Exported tasks remain editable.
- Created tasks become read-only.
- Created tasks cannot be individually deleted from a tray in v1.
- Pending, failed, and exported tasks may be deleted.
- Deleting a pending/failed/exported task deletes its local attachments and attachment metadata.
- Duplicating a task is supported for editable tasks.
- Duplicated tasks receive a new local id, become `Pending`, and use the title suffix `(copy)`.
- Duplicated tasks copy basic fields, assisted description, accepted/proposed sub-tasks, attachments, and attachment purposes.
- Duplicated tasks do not copy sync status, Jira links, sync audit logs, or original timestamps.
- Inline/basic editing in the tray should support:
  - `Project`
  - `Area`
  - `Title`
  - `Priority`
  - possibly issue type when needed
- Advanced editing opens a focused task window and includes:
  - assisted description
  - images/attachments
  - language override
  - epic association
  - sub-tasks
  - generated labels
  - sync status
  - sync errors and audit log

## Sync Status

- Each local task has a stable local id.
- Local sync statuses are:
  - `Pending`
  - `Failed`
  - `Exported`
  - `Created`
- `Created` means the local task was uploaded and has a Jira issue link.
- Jira workflow status such as `To Do`, `In Progress`, or `Done` is out of scope for v1.
- Created task links are preserved in backups/restores.
- Failed tasks can be edited and retried with the same local id.
- Exported tasks remain editable and may later become `Created` if uploaded through the API.

## Jira Sync

- Jira is the primary creation path.
- CSV export is a minimal fallback.
- `Create in Jira` should:
  - validate credentials
  - validate required task fields
  - sync existing epics
  - resolve or create missing epics
  - create stories/bugs
  - create accepted sub-tasks after parent issues
  - upload selected attachments
  - record audit events
- If there are no warnings, sync starts directly.
- If warnings exist, show a preflight panel.
- Blocking warnings:
  - invalid or expired Jira credentials
  - missing project
  - missing area
  - missing title
  - unavailable Jira API when no progress can be made
- Non-blocking/resolvable warnings:
  - missing description
  - missing epic
  - unresolved attachments
  - failed tasks being retried
- Sync progress should be visible and non-blocking.
- The user should not need to press buttons to advance normal sync.
- If a decision is required during sync, pause only that part and show an actionable warning.
- Sync audit logs should be structured and retained for debugging.

## Epics

- Epic naming rule is `[{Project}] {Area}`.
- Existing Jira epics are synced before creating new ones.
- The app derives projects, areas, and mappings from epics matching the naming rule.
- The app maintains a mapping of `Project + Area -> Epic`.
- When no epic exists for a task's project and area, the app offers:
  - create the suggested epic
  - choose an existing epic
  - create the story without an epic
  - cancel
- The recommended default action is to create the missing epic.

## Categories

- `Categories` manages saved projects and areas.
- Initial known projects include:
  - `STT`
  - `PilotLab`
  - `MR Studio`
  - `Transversal`
- Projects and areas can be created locally.
- Locally created categories become available immediately for task capture.
- Projects and areas are synced from Jira on demand by reading existing epics.
- Newly detected projects/areas are shown as suggestions and must be approved before becoming local categories.
- Already-known categories should not create noise during sync.
- Ignored suggestions may be remembered to avoid repeated noise.
- Projects/areas can be hidden from normal dropdowns.
- Projects/areas are not renamed in v1.
- Hidden options do not appear in normal dropdown lists, but can appear in autocomplete when the user types the start of the name.
- Hidden options should use a crossed-eye visibility icon.

## Assisted Descriptions

- Each task can have its own assisted description.
- Description creation is optional.
- The tray shows description progress/status per task.
- Before creating in Jira, the app warns about tasks missing descriptions but does not always block.
- The assisted description panel supports notes and pasted images.
- The AI asks questions until the required points are resolved, unless the user explicitly chooses to proceed with missing information.
- Story descriptions use:
  - a short user story intro
  - then full SRS Lite sections
- Story description content should default to Spanish.
- If the task/source content is clearly in another language, the app may suggest or use that language.
- UI text remains English.
- AI conversation and generated Jira content use the selected content language.
- Default content language is configured globally in Settings, with per-task override in the advanced panel.

## SRS Lite Story Format

Stories should begin with:

```markdown
## Historia de usuario

Yo como [tipo de usuario],
quiero [accion o capacidad],
para [beneficio o resultado].
```

Then include:

```markdown
## SRS Lite

### 1. Problema
### 2. Objetivo
### 3. Alcance
### 4. Fuera de alcance
### 5. Flujos principales
### 6. Requisitos funcionales
### 7. Requisitos no funcionales relevantes
### 8. Restricciones y dependencias
### 9. Criterios de aceptacion de alto nivel
### 10. Riesgos y preguntas abiertas
```

The AI should avoid inventing missing details and should ask follow-up questions before final generation.

## Images and Attachments

- Images can be pasted into a task's assisted description panel.
- Each image has a purpose:
  - `AI only`
  - `Jira attachment`
  - `AI + Jira attachment`
- Images are stored locally with the tray/task.
- Images and attachments live as filesystem files managed by the app, not as SQLite blobs.
- SQLite stores attachment metadata and references to app-managed file paths.
- The app copies pasted or imported attachments into its own app data folder so trays do not depend on external file paths.
- Images marked as Jira attachments are uploaded during Jira sync.
- Images marked AI-only are used for context but are not uploaded.
- Backups include images and attachment metadata.

## Sub-tasks

- Sub-tasks are not part of the quick capture input.
- The AI can suggest sub-tasks from the assisted description panel.
- Suggested sub-tasks appear as a proposal first.
- The user can accept all, some, or none.
- Accepted sub-tasks are created after their parent story/bug.
- Sub-tasks do not use SRS Lite.
- Sub-task descriptions should be simple:
  - brief description
  - acceptance criteria
- V1 uses hardcoded sub-task templates only where useful, such as known 3D/modeling work.
- No sub-task template editor is needed in v1.

## JQL

- `JQL` is a global tab available even when no tray is open.
- The JQL tab supports:
  - direct JQL input
  - natural-language prompt to AI-generated JQL
  - showing generated JQL before execution
  - results table
  - chronological local history
  - named favorites
- Favorites are selected by name and show the JQL in smaller text.
- JQL history is not included in backups by default.
- JQL favorites are included in backups.
- JQL results do not create local tasks in v1.
- Recommended default result columns:
  - `Key`
  - `Project`
  - `Issue Type`
  - `Priority`
  - `Status`
  - `Summary`
  - `Assignee`

## Settings

- Settings are global and compact, not a main tab.
- Settings include:
  - Jira connection/authentication
  - AI provider/model
  - default content language
  - appearance theme: Light, Dark, or System
  - local data and backup/export
  - update-related configuration if needed
- Jira auth should support OAuth 2.0 if setup is reasonable.
- Jira API token auth is an acceptable personal fallback.
- Secrets should be stored locally and excluded from backups.
- Windows Credential Manager is preferred when the stack supports it.
- Settings can be exported/imported without secrets.
- The app should preserve data across app updates.
- V1 should use an installer/version update path that keeps local data.

## AI Configuration

- V1 includes a provider/model selector.
- AI runs only through explicit user actions.
- No silent background AI calls.
- AI actions include:
  - review missing description info
  - generate Jira description
  - suggest sub-tasks
  - generate JQL
- AI prompts/templates are internal in v1.
- They should still be implemented as named templates so they can become configurable later.

## Backup and Restore

- V1 includes backup/export without secrets.
- Backups include:
  - tray drafts
  - local tasks
  - descriptions
  - attachments/images
  - categories
  - epic mappings
  - JQL favorites
  - non-secret settings
  - sync audit logs
- Backups exclude:
  - Jira tokens
  - AI API keys
  - OAuth refresh/access tokens
  - JQL history
- Backup should be a single bundle, such as a zip containing metadata plus attachments.
- Import merges into the current database.
- Import does not wipe existing local data.
- If a tray with the same local id already exists, skip it and report that in the import summary.
- Created Jira links and sync logs are preserved on restore.

## CSV Export

- CSV export is a minimal technical fallback.
- CSV export should support selecting pending and/or failed tasks.
- Created tasks are not exported to avoid duplicates.
- CSV export marks exported tasks as `Exported`.
- CSV export includes only basic Jira-importable fields.
- Descriptions may be exported as text.
- Attached files are not included in CSV export.
- CSV export should strip attachments rather than attempting to reference local files.
- Exported tasks can later become `Created` if uploaded through the API.

## Out of Scope For V1

- Legacy text import from `STT:` blocks and `- [Bug] ... ****` lines.
- Full Jira issue search/browsing module beyond the JQL tab.
- Jira workflow status refresh for created tasks.
- Multi-user/team administration.
- Editable AI prompt/template UI.
- Configurable sub-task template editor.
- Rich CSV export customization.
- Automatic archival of completed trays.
- Full tray duplication.
