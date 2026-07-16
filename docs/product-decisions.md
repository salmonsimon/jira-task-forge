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
- Settings should stay compact after Personal v1 hardening. Jira Site URL,
  account email, Jira creation project key, and Jira API token setup are
  configured through a guided `Set Connection` flow, then shown as read-only
  connection state in Settings. Settings should not offer a second manual Jira
  token editor.
- The guided Jira connection flow should surface a compact
  `Privacy & Diagnostics` warning/link that opens a secondary in-app detail
  view. Personal v1 should not send users to an external web page for this
  explanation.

## Roadmap Milestones

- **Personal v1** is the near-term product milestone. It should be reliable
  enough for Saimon's real Jira preparation workflow, with stronger tests and
  security hardening over the current local-first app, but it does not need to
  solve public distribution, multi-user administration, or full enterprise
  authentication yet.
- **Distributable v1** is a later milestone after Personal v1 proves useful.
  It should let another person install, connect Jira and AI providers, understand
  privacy/security boundaries, and use the app without Saimon's guidance.
- Personal v1 work should avoid choices that block Distributable v1. OAuth,
  installer/update polish, first-run privacy onboarding, distribution docs, and
  a formal security review are expected to land in or before Distributable v1,
  not as blockers for Personal v1 unless a specific Personal v1 risk demands it.
- Distributable v1 preparation may be captured as notes or research during
  Personal v1, but implementation work for OAuth, public installer/update flows,
  distribution docs, and full onboarding belongs to the later Distributable v1
  milestone unless explicitly pulled forward.
- Personal v1 uses bring-your-own-key credentials for Jira API tokens and AI
  provider API keys stored in the OS credential store. Notion catalog sync is
  the exception pulled forward for distribution readiness: it should use a
  public connection OAuth flow with the client secret protected outside the
  desktop app. Broader Jira OAuth and AI provider OAuth remain later V2 /
  distributable research topics, not Personal v1 blockers.
- V2 should research Jira OAuth 2.0 and AI provider authentication options. If
  OAuth is practical, prefer it for distribution. If not, keep BYOK with stronger
  onboarding, documentation, redaction, and local secret-handling practices.
- Personal v1 supports OpenAI, Anthropic Claude, and Google Gemini using the
  same provider/model/key pattern: local OS credential storage, backups without
  secrets, redacted logs, and a successful `Test connection` before saving a new
  API key. V2 should add optional OpenRouter support through that same pattern.

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
- Creating a new tray opens a guided modal that asks for tray name and canonical Epic Scope first, then asks for the confirmed Transversal plural scope when the canonical scope is not `TBD`. The Transversal suggestion may be AI-assisted, but the user must review or edit it before the tray is created.
- Tray states are:
  - `Active`
  - `Needs attention`
  - `Completed`
  - `Archived`
- A tray becomes `Completed` automatically when all tasks in it are created in Jira.
- The tray list may show an `Exported` presentation tag for active trays where
  every uncreated parent task has already been exported. Adding a new `Pending`
  task makes the tray present as `Active` again; this does not add a persisted
  tray state.
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
- Internal app projects are preparation categories, not Jira project keys.
- Jira issue creation uses the single Jira creation project key configured in
  Settings.
- Within each project, tasks keep manual/capture order for review.
- Jira creation does not need to preserve visual order; robustness matters more.
- Tray search is scoped only to the currently open **Preparation Tray**. It
  should not search across other active, completed, recovery, or archived trays.
  The first search surface should filter the open tray by local task title,
  project, area, description text, Jira key, and sub-task titles without
  changing task order.
- Keyboard shortcuts should be contextual rather than global. In Quick Capture,
  `Ctrl+Enter`/`Cmd+Enter` in the title field adds the task. In description
  prompt textareas, it generates a proposal. In manual section edit textareas,
  it saves the section. JQL keeps its existing `Ctrl+Enter`/`Cmd+Enter` run or
  draft behavior.
- Scrollable dropdowns, popovers, and internal overlay lists should contain
  pointer-wheel scrolling. When the pointer is over an internal scroll surface
  and that surface reaches its top or bottom, the underlying app surface should
  not scroll. Normal modal/body scrolling remains allowed when the pointer is
  not over a bounded internal list.

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
- Jira parent Story/Bug summaries should begin with the task's area code in
  brackets, followed by the local title: `[{Area}] {Title}`. Until categories
  have a separate code field, the trimmed `Area` value is the area code. Do not
  duplicate the prefix when the title already starts with it.
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
- The focused task window should allow editing the same local `Title` for
  Pending, Failed, and Exported tasks. Created tasks remain read-only.
- Title editing always edits the local title without the derived area prefix.
  The Jira summary prefix `[{Area}]` is generated for display/Jira payloads and
  should not be duplicated into the stored title.
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
- Exported tasks remain editable and may later become `Created` if explicitly
  included in a Jira API creation run.

## Jira Sync

- Jira is the primary creation path.
- CSV export is a minimal fallback.
- `Create in Jira` should:
  - validate credentials
  - validate Jira project creation metadata
  - validate required task fields
  - sync existing epics
  - resolve or create missing epics
  - create stories/bugs
  - create accepted sub-tasks after parent issues
  - upload selected attachments
  - record audit events
- First Jira write slice included metadata preflight, epic search/create, parent
  Story/Bug creation, local Jira link persistence, remote correlation markers,
  audit events, and partial recovery.
- Later slices have added accepted sub-task creation and selected Jira-ready
  attachment upload to the `Create in Jira` path. Broader relationship sync,
  attachment cleanup/compression hardening, and additional partial-failure polish
  remain separate scopes.
- If there are no warnings, sync starts directly.
- If warnings exist, show a preflight panel.
- Blocking warnings:
  - invalid or expired Jira credentials
  - missing or unreadable Jira creation project metadata
  - unavailable required Jira field or issue type mapping
  - missing project
  - missing area
  - missing title
  - unavailable Jira API when no progress can be made
  - failed epic lookup or creation for the affected project/area group
- Non-blocking/resolvable warnings:
  - missing description
  - unresolved attachments
  - failed tasks being retried
- Missing descriptions require explicit confirmation in the preflight panel
  before Jira sync may create those tasks.
- The confirmation should be intentionally frictional enough to prevent
  accidental upload without descriptions, such as a checkbox per run or per
  affected group.
- If Jira metadata says description is required for the selected issue type,
  missing description becomes blocking for that task.
- Sync progress should be visible and non-blocking.
- The user should not need to press buttons to advance normal sync.
- If a decision is required during sync, pause only that part and show an actionable warning.
- Jira sync should continue with healthy `Project + Area + Scope` groups when another
  group is paused by epic lookup/creation failure.
- Successful tray CSV exports should show a prominent centered confirmation
  notification with the exported task count and saved filename.
- Partial sync results should clearly show which groups and tasks were created,
  paused, or failed.
- Preflight warning groups should aggregate repeated warnings where possible.
  Epic resolution warnings should group by `[{Project}] [{Area}] {Scope}` epic target,
  show the affected task count, and allow expanding to task titles only when
  review is useful. Normal epic targets should not fill the preflight panel when
  there is no action required.
- Sub-task creation summaries should resolve parent task titles from the whole
  tray before grouping sub-tasks. They should not show `Missing parent task`
  when the parent exists outside the filtered sub-task list.
- When partial sync leaves failed or paused tasks, the app should offer to create
  a follow-up tray containing only those problem tasks and a short origin note
  explaining why they were separated.
- Recovery trays move the problem tasks out of the original tray instead of
  duplicating them, preserving each task's local id, retry history, and
  duplicate-protection context.
- The original tray should keep successful created tasks and show a short note or
  link to the recovery tray created from its partial sync.
- Sync audit logs should be structured and retained for debugging.
- Jira sync must not hardcode create payload fields beyond stable domain
  intent. Before writing, it should read Jira metadata for the configured
  **Jira Creation Project Key** and confirm the available issue types, required
  fields, priority field, labels field, and epic-linking field.
- If metadata cannot resolve `Epic`, `Story`, `Bug`, labels, or the field
  needed to link a child issue to its epic, sync blocks before creating partial
  Jira issues.
- If Jira create metadata omits `priority` for parent Story/Bug issues, sync may
  create the issue and immediately set priority through a Jira issue update.
  This keeps `JTFTEST` and similar Jira projects usable when priority is not on
  the create screen. If priority cannot be set either during create or by the
  post-create update, the app must preserve the created Jira link locally and
  surface a warning instead of retrying the create and risking a duplicate.
- Duplicate prevention should use a mostly invisible remote marker. The
  preferred marker is a Jira entity property containing local task and sync
  attempt identity.
- Local task ids or sync attempt ids should not be written into visible Jira
  summaries, descriptions, or labels.
- A generic human-visible label such as `jira-task-forge` is acceptable only for
  traceability, not as the source of retry identity.
- If the app cannot write or later confirm the remote marker, it should use the
  manual recovery flow instead of auto-creating a possible duplicate.
- If local state is ambiguous after a crash, timeout, or partial failure, retry
  should search for the remote marker before creating again. If that search
  fails, the app should retry the search once with a short backoff. If the marker
  still cannot be confirmed, block creation only for the affected task or
  `Project + Area + Scope` group, continue healthy groups, and record sanitized
  audit history. Do not allow blind retry that could duplicate Jira issues.

## Jira Cloud Test Boundary

- `JTFTEST` is the real Jira write sandbox for implementation and QA.
- Agents may create, update, delete, transition, comment on, and otherwise
  mutate Jira issues in `JTFTEST` without asking Saimon first.
- `DTS` is read-only for agents. Agents may query `DTS` to understand field
  behavior and real work patterns, but must not mutate `DTS` issues.
- Real Jira smoke tests for the first write slice should use `JTFTEST`, never
  `DTS`.

## Epics

- Epic naming rule is `[{Project}] [{Area}] {Scope}`.
- `Scope` is the human-readable suffix of the epic summary. It is required for
  Jira creation, but the app should let Saimon capture Local Tasks before the
  tray has scope.
- The app edits and displays the scope value, not a free-form full epic name.
  The full Jira epic summary is derived from project, area, and scope.
- `TBD` is a valid literal scope. It is not written as `[TBD]`, does not trigger
  AI pluralization, and is also valid for `Transversal`.
- Scope definition happens in two steps when needed:
  1. singular/canonical scope, such as `Demo Version 1` or `TBD`;
  2. optional confirmed transversal/plural scope for `Transversal`, assisted by
     AI only as an editable proposal.
- The app must never use AI-generated transversal scope silently. Saimon must
  accept, edit, or skip the proposal.
- If singular scope is skipped, preflight blocks Jira creation for every group
  that needs scope. If only the transversal scope is skipped, preflight blocks
  only `Transversal` groups.
- Existing Jira epics are searched online before creating new ones.
- The app derives projects, areas, scopes, and mappings from epics matching the
  naming rule.
- The app maintains a mapping of `Project + Area + Scope -> Epic`.
- During Jira sync, each task's `Project + Area + Scope` must resolve to an
  epic before creating the story, bug, or sub-task that belongs to it.
- If no matching epic is found online through Jira search, the app creates the
  missing epic with the naming rule before creating the rest of that group.
- Legacy epics using the old `[{Project}] {Area}` pattern should not break
  existing local data or discovery, but new epics should not be created with the
  legacy format.
- Normal sync should not create stories, bugs, or sub-tasks without their
  resolved epic link.
- If epic search or creation fails, pause the affected group and show an
  actionable warning instead of creating unlinked child issues. Healthy groups
  should continue syncing.

## Categories

- `Categories` manages saved projects and areas.
- Initial known projects include:
  - `STT`
  - `PilotLab`
  - `MR Studio`
  - `Transversal`
- For Personal v1 polish, `Transversal` is pinned to the top of project
  dropdowns and tray project grouping when it exists. Other projects keep their
  normal stored order.
- Projects and areas can be created locally.
- Locally created categories become available immediately for task capture.
- Projects and areas are synced from Jira on demand by reading existing epics.
- Jira category sync should read existing epics whose summaries match the
  current `[{Project}] [{Area}] {Scope}` pattern, while preserving compatibility
  with legacy `[{Project}] {Area}` epics for already-created data. It should not
  infer categories from arbitrary issue labels, summaries, or global Jira scans.
- Newly detected projects/areas are shown as suggestions and must be approved before becoming local categories.
- Already-known categories should not create noise during sync.
- Ignored suggestions may be remembered to avoid repeated noise.
- Projects/areas can be hidden from normal dropdowns.
- Projects/areas are not renamed in v1.
- Hidden options do not appear in normal dropdown lists, but can appear in autocomplete when the user types the start of the name.
- Hidden options should use a crossed-eye visibility icon.
- Alphabetical and manual category ordering are future improvements, not part
  of the first polish pass.
- A broader global Jira scan for category candidates is a future improvement
  after the pattern-based epic sync is useful.

## Assisted Descriptions

- Each task can have its own assisted description.
- Description creation is optional.
- The tray shows description progress/status per task.
- Before creating in Jira, the app warns about tasks missing descriptions and
  requires explicit confirmation to proceed without them.
- The app should not generate placeholder descriptions just to satisfy a sync.
- The assisted description panel supports notes and pasted images.
- For Personal v1, AI description assistance generates or improves a Jira
  description from the task title, project, area, notes, and any available
  context. When the available information is not enough to produce a useful
  description, the AI should ask targeted follow-up questions before finalizing.
- The Personal v1 AI description flow can be multi-step for clarification, but
  it is not a general-purpose free-form chat inside the app.
- Assisted descriptions should render as Markdown when being read, while still
  allowing direct manual editing of the full description even when the task has
  no description yet.
- AI proposal review should use the fixed Jira DTS description sections rather
  than asking which sections to complete. For Jira Task Forge, all required
  sections are always in scope for a proposal.
- The structured description model should keep every required Jira DTS
  description section, even when a section has empty content. The read view
  should hide empty sections by default, while the edit/review view should
  expose them so Saimon can fill them or intentionally clear a section back to
  empty.
- Description sections use the brainstorming-style `Raw` vs `Polished`
  distinction. Empty sections and unreviewed sections stay `Raw`. A section
  should become `Polished` only after accepting/editing meaningful content or
  explicitly marking an existing non-empty section as OK.
- The proposal review UX should allow section-level accept, reject, manual edit,
  and "request changes" iteration with a short user comment.
- "Request changes" should exist at both levels: one action for the whole
  current proposal and one action for an individual section. Section-level
  requests should only ask the AI to revise that section.
- Immediately after generating an AI proposal, the app should open a proposal
  review modal similar to the brainstorming app: proposal header, provider/model
  metadata, per-section current/proposed diff, section-level accept/reject, and
  proposal-level accept/reject remaining actions.
- Proposal diffs should be paragraph-level by section. Unchanged paragraphs
  should be hidden so the review surface shows only meaningful changes rather
  than the full current and proposed text.
- The task detail view should also keep a compact AI/proposal panel with a
  chronological proposal log. Log cards should show only the proposal title or
  summary plus minimal labels for proposal status and provider/model. They
  should not show the full proposed description body inline, section counts, or
  verbose review counters by default.
- Proposal metadata and the chronological iteration log should persist locally
  with the task, similar to the brainstorming app's proposal metadata. This
  history is for local review and backup, not Jira upload.
- Assisted description proposals and proposal-log entries now persist through a
  SQLite migration. This metadata stays attached to the local task, is included
  in local backup/import, and does not change the Jira payload except through the
  accepted final description.
- Accepting or manually editing a proposed section updates the task's final
  Assisted Description. Rejected proposal sections remain in local proposal
  history but are not included in the Jira description.
- Missing-description and missing-field review remains part of the existing
  preflight flow rather than a separate AI review feature in Personal v1.
- Story descriptions use the Jira DTS format:
  - a short user story intro
  - context
  - scope with `Includes` / `Does not include`
  - acceptance criteria
- Story description content should default to Spanish.
- If the task/source content is clearly in another language, the app may suggest or use that language.
- UI text remains English.
- AI conversation and generated Jira content use the selected content language.
- Default content language is configured globally in Settings, with per-task override in the advanced panel.

## Jira DTS Description Format

Stories should begin with:

```markdown
## Historia de usuario

Yo como [tipo de usuario],
quiero [accion o capacidad],
para [beneficio o resultado].
```

Then include:

```markdown
## Contexto

## Alcance

Incluye:

- ...

No incluye:

- ...

## Criterios de aceptacion

- ...

## Entregable minimo

- ...

## Checklist antes de Review

- ...
```

Do not include mandatory `SRS Lite`, `SRE Lite`, validation, risk, rollback,
observability, or open-question sections in the final Personal v1 Jira
description. If information is missing and materially changes the scope or
acceptance criteria, the app should ask targeted clarification questions before
drafting instead of leaving a generic uncertainty section in the Jira
description.

Bug descriptions use a separate bug-focused template instead of the Story
template. They should include:

```markdown
## Problema

## Contexto / impacto

## Pasos para reproducir

## Resultado actual

## Resultado esperado

## Evidencia

## Criterios de aceptacion

## Entregable minimo

## Checklist antes de Review
```

Bug descriptions should explain what fails, how to reproduce it, what should
happen instead, and what evidence proves the fix. Story descriptions should
stay focused on user value, scope, and acceptance criteria.

Personal v1 refines the current "Crear descripciones de JIRA" chat format into
the fixed internal template captured in `docs/jira-description-format.md`. Keep
the implemented prompt shape and required sections aligned with the dedicated
`docs/assisted-description-context.md` context.
- The Personal v1 clarification UX should be structured rather than chat-like:
  AI shows the targeted questions it needs answered, Saimon responds in a single
  textarea, and then the app generates an editable Jira description.
- AI-generated descriptions are never uploaded automatically. They must remain
  editable and are uploaded only through the normal `Create in Jira` flow.
- Jira issue relationship links such as `blocks` and `blocked by` are tracked
  by Issue #200 and are not shipped until that implementation PR is merged and
  validated. Public docs should keep relationship-link wording conditional until
  then.

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
- Attachment selection for Personal v1 is backend-owned: Rust/Tauri opens the
  native file dialog, validates selected files, copies accepted files into
  managed storage, and returns metadata to React.
- React should not pass arbitrary filesystem paths to a backend copy command.
- Drag-and-drop attachment selection is out of scope for Personal v1 and is not
  a priority afterward. If it is ever added, it should require a new
  provenance/consent decision rather than reusing arbitrary frontend-provided
  paths.
- Jira-ready attachments larger than 25 MB should show a warning before sync.
- Jira-ready attachments larger than 100 MB should be blocked, even if Jira's
  configured upload limit is higher.
- Jira-ready attachments must always be blocked when they exceed Jira's reported
  attachment `uploadLimit`.
- These thresholds protect Personal v1 sync/backup behavior and Jira Free plan
  storage, where 100 MB is already about 5% of the 2 GB file storage limit.
- Symbolic links should be rejected for Personal v1 attachments. The user should
  choose the original file instead.
- Files inside Jira Task Forge internal app data directories should be blocked
  as attachment sources, including `data/`, `settings/`, `credentials/`,
  `logs/`, `logs/diagnostics/`, `backups/`, and `attachments/`.
- Images marked as Jira attachments are uploaded during Jira sync.
- Images marked AI-only are used for context but are not uploaded.
- After a Jira-ready attachment uploads successfully to Jira, the app should
  delete the local managed attachment file and keep only minimal metadata/audit
  history: display filename, type, size, purpose, upload status, timestamp, and
  Jira issue key or link when available.
- `AI + Jira attachment` files should also be deleted locally after successful
  Jira upload; Jira becomes the durable copy for that asset.
- `AI only` files are not uploaded to Jira during sync, but they should be
  deleted locally when the Local Task becomes `Created`; Jira Task Forge should
  keep only minimal metadata/audit history after the task is loaded to Jira.
- Backups include attachment bytes only while those bytes still exist in managed
  local storage. After successful Jira upload or automatic `AI only` cleanup on
  task creation, backups should include only the remaining metadata/audit
  history and must not retain hidden post-upload copies.
- Personal v1 attachment support should prioritize uploading files/images to
  Jira from local tasks.
- The app should attempt to store compressed copies of image attachments when it
  can do so without adding disproportionate complexity or harming usefulness.
- If attachment compression/upload proves too complex for Personal v1, the
  fallback is to complete Jira creation with text descriptions first and defer
  richer attachment support.

## Sub-tasks

- Sub-tasks are not part of the quick capture input.
- Personal v1 sub-task suggestions should be hardcoded for known 3D work first,
  rather than fully AI-generated.
- Suggested sub-tasks appear as a proposal first.
- The user can accept all, some, or none.
- Proposed sub-tasks are selected by default before Jira sync.
- Preflight should clearly state how many sub-tasks will be created and allow
  Saimon to deselect the ones he does not want.
- Accepted sub-tasks are created after their parent story/bug.
- Sub-tasks do not use the Jira DTS description format.
- Personal v1 does not require generated descriptions for sub-tasks.
- V1 uses hardcoded sub-task templates only where useful, such as known
  3D/modeling work. The initial 3D template titles are:
  - `Recolectar referencias`
  - `Bloquear forma/escala base`
  - `Modelar asset principal`
  - `Aplicar materiales/texturas base`
  - `Integrar en escena`
  - `Validar escala, lectura y colisiones en contexto`
- Initial 3D sub-task proposals should appear for `3D`, `Modelos 3D`,
  `Texturas`, and equivalent 3D/modeling categories. They are selected by
  default, and Saimon can deselect, edit titles, or delete proposals before
  Jira sync.
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
- Jira issue keys in JQL results should open the matching Jira issue externally
  in the browser, using the configured Jira site URL and the same external-link
  safety path used by created task links. Jira Task Forge does not need an
  internal Jira issue viewer for this polish pass.
- Direct and AI-generated JQL must include a search restriction; Jira Cloud may reject unlimited queries such as `ORDER BY created DESC` with a 400 error. For broad smoke tests, prefer bounded forms such as `created IS NOT EMPTY ORDER BY created DESC`.
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
- A new Jira API token or AI provider API key must pass a connection test before
  the Settings UI allows saving it to the OS credential store.
- Jira and AI provider credential controls should use the same action shape:
  `Save key`, `Remove key`, and `Test connection`.
- The guided `Set Jira Connection` flow should become the only user-facing path
  for Site URL, account email, and Jira project key setup. Do not keep parallel
  manual fields or an advanced manual mode for those values, because that makes
  connection state harder to reason about. Settings should show the saved Site
  URL, account email, and Jira creation project key as read-only connection
  state with a `Set Jira Connection` or `Change Jira Connection` action. The
  flow should validate the site, verify credentials, and offer available Jira
  project keys before saving. If project key discovery fails, the wizard may
  allow a manual project key with a clear warning. The connection should be
  saved only at the end of the wizard, after validation succeeds or the user
  accepts the warned manual fallback. URL normalization or rejection should be
  shown as explicit feedback in the wizard rather than silently changing fields
  while the user types. API token management should remain a separate Settings
  section. See issue #112.
- AI provider credential controls should include a provider-specific
  `Create or manage key` link. Personal v1 routes OpenAI to
  `https://platform.openai.com/home`, Claude to
  `https://platform.claude.com/dashboard`, and Gemini to
  `https://aistudio.google.com/api-keys`.
- Connection success and failure should appear as clear app-level notifications,
  not as result panels inserted into the Settings column.
- Settings can be exported/imported without secrets.
- The app should preserve data across app updates.
- V1 should use an installer/version update path that keeps local data.

## AI Configuration

- V1 includes a provider/model selector.
- Personal v1 supports OpenAI, Claude, and Gemini as active AI providers for
  key storage, connection testing, and Ask AI JQL generation. OpenRouter remains
  part of the later V2/provider expansion.
- AI runs only through explicit user actions.
- No silent background AI calls.
- AI actions include:
  - review missing description info
  - generate Jira description
  - suggest sub-tasks
  - generate JQL
- AI prompts/templates are internal in v1.
- They should still be implemented as named templates so they can become configurable later.

## Distribution Security Hardening

- The app should be distributable beyond personal use, but any move toward
  broader distribution should include an explicit security hardening pass.
- Jira and AI keys should continue to be stored in the operating system
  credential store, excluded from SQLite, excluded from backups, and redacted
  from logs and debug output.
- Settings should explain that Jira and OpenAI credentials are sent only to
  their respective providers over HTTPS/TLS.
- Jira Site URLs should be limited to standard Atlassian Cloud site roots for
  Personal v1: `https://<site>.atlassian.net`. Paths, query strings, fragments,
  credentials, ports, custom Jira domains, or arbitrary HTTPS hosts are rejected.
  Custom Jira domains require a future HITL decision before support is added.
- External Jira issue links may open only when they match the configured
  canonical Jira site host and use `/browse/<issue-key>`. Mismatched hosts,
  query strings, nested paths, or incomplete issue keys should be rejected before
  launching a browser.
- Settings should explain that AI providers receive the user's AI prompt and
  relevant local/Jira context, but never the Jira API token.
- Error surfaces should keep provider details useful while redacting request
  headers, authorization values, token-shaped strings, and secret-shaped payloads.
- Distribution documentation should call out realistic local-app risks:
  compromised machines, trusted TLS-inspection proxies, and processes running
  under the same OS user may still access or intercept secrets.
- Before distribution, add a short privacy/security note in Settings or first-run
  onboarding so users understand what leaves the machine during Jira and AI
  actions.
- Agents may run `npm audit` locally for dependency/security work. This sends
  dependency metadata from `package-lock.json` to the configured npm registry,
  but does not send app data, Jira content, attachments, credentials, or secrets.
- Agents must not run `npm audit fix` automatically; dependency changes require
  explicit review.
- `npm audit` should not be added as a CI or merge gate for Personal v1. Revisit
  CI gating before broader distribution.
- PR-blocking checks should be fast, deterministic, and actionable. Unit tests,
  integration tests, builds, formatting, and stable local smoke checks may become
  blocking when they meet that bar.
- Live Jira E2E against `JTFTEST` should remain advisory/manual for Personal v1
  because it depends on credentials, network, remote Jira state, and rate limits.
- Before release or merge of Jira-write behavior, run focused live Jira QA
  manually or as an advisory check; do not make it an automatic PR gate until it
  is stable enough to fail only on product regressions.

## Personal V1 Quality And Security Bar

- Personal v1 should not move into more Jira/AI feature expansion until the
  current app surface has a strong quality and security stabilization pass.
- The stabilization pass should raise Rust/Tauri backend line coverage back
  above 80%.
- The stabilization pass should add focused coverage for newer surfaces,
  including OpenAI integration, backup/import behavior, service orchestration,
  and command boundaries where useful.
- The stabilization pass should introduce the first frontend test runner and
  cover workflow/domain behavior before chasing broad UI percentage coverage.
- The stabilization pass should include and apply a security checklist covering
  key storage, backup/export/import, logs and error messages, Jira requests,
  OpenAI requests, and attachment filesystem boundaries.
- Settings should visibly explain which Jira and AI data leaves the local
  machine, while preserving the current rule that secrets are stored in the OS
  credential store and excluded from backups.
- It is acceptable for this pass to take longer if it leaves the app at a level
  that feels trustworthy for real personal use.
- The stabilization pass can run as parallel technical-debt PRs. If automated
  checks and live QA pass, agents may merge these stabilization PRs without
  waiting for HITL approval on each individual PR.
- The planned stabilization PRs are:
  - Coverage Baseline: refresh the measured coverage report and standardize the
    coverage command.
  - Backend Coverage: raise Rust/Tauri backend line coverage above 80%, focusing
    on newer and riskier modules first.
  - Frontend Test Harness: introduce the first frontend test runner and cover
    workflow/domain behavior.
  - Security Hardening: document and apply a checklist for secrets, backups,
    provider requests, logs/errors, and filesystem boundaries.
- Stabilization PRs may be auto-merged after the relevant QA gate passes:
  `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml`,
  `cargo llvm-cov --summary-only` when coverage is touched, and focused native
  QA for any affected UI or provider flow.
- Coverage Baseline and Backend Coverage PRs do not require native live QA
  unless they change runtime behavior.
- Frontend Test Harness PRs require the new frontend test command plus a basic
  app-open smoke check.
- Security Hardening PRs require focused QA of Settings, backup export/import,
  Jira test connection, OpenAI test connection, and Ask AI when those flows are
  affected.
- Agent-run dev servers should avoid port 1420 because Saimon uses it for local
  testing.

## Personal V1 Feature Order After Stabilization

- After the quality and security stabilization pass, Personal v1 feature work
  has advanced through sub-task creation, attachment metadata/filesystem policy,
  attachment upload to Jira, AI-assisted Jira descriptions, and JQL generation.
  Remaining Personal v1 feature work should stay focused on hardcoded 3D
  sub-task suggestions, Jira issue relationship sync, and QA hardening for the
  new Jira child-operation and AI proposal-review paths.

## Personal V1 Definition Of Done

- Personal v1 is done when Saimon can use Jira Task Forge for a real Jira task
  preparation and creation flow without falling back to CSV/manual Jira except
  as an emergency workaround.
- Personal v1 requires the quality and security stabilization bar to be met:
  backend coverage above 80%, a minimal frontend test harness, an applied
  security checklist, and visible Settings copy explaining which Jira and AI
  data leaves the local machine.
- Personal v1 Jira creation should support parent Story/Bug issues, sub-tasks,
  attachments, understandable partial failure handling, and recovery flows.
- Personal v1 AI should remain manually triggered and include useful JQL and
  Jira description assistance. Hardcoded 3D sub-task suggestions are part of the
  v1 workflow, but broad AI-generated sub-task planning is not required.
  Silent background AI calls are out of scope.
- Personal v1 is acceptable for daily work only after the automated baseline
  passes and full live QA in `JTFTEST` covers the Jira create flow, sub-tasks,
  attachments, backup/restore, and Settings behavior. A native smoke test alone
  is not enough to declare Personal v1 ready, and real controlled use is a
  follow-up confidence step rather than the readiness gate.
- Personal v1 final QA should run full write coverage only against `JTFTEST`.
  Read-only QA against `DTS` is allowed for JQL, epic discovery, metadata
  assumptions, priorities, issue types, and real-work examples. `DTS` must not
  be mutated.
- Personal v1 data safety requires backup/restore QA, secrets excluded from
  backups, and useful redacted audit logs.
- Installer polish and OAuth are not required for Personal v1 completion.

## Personal V1.5 Polish

- A real high-volume Jira upload week should be treated as a stress test for
  Personal v1 behavior and feeling.
- Feedback from that stress test can feed a Personal v1.5 polish pass focused on
  workflow friction, perceived speed, recovery clarity, progress/audit feeling,
  and small UI rough edges discovered during real use.
- During the stress-test week, Saimon will report point problems in the Codex
  conversation. Agents should group those reports into notes for later triage
  instead of immediately turning every report into implementation work.
- Create `docs/stress-test-notes.md` lazily when the first real stress-test
  report arrives. Structure it for later review by type, severity, affected
  flow, reproduction context, and likely roadmap bucket.
- After the stress-test week, review the grouped notes and decide which items
  belong in Personal v1 fixes, Personal v1.5 polish, or later roadmap work.
- After Personal v1 is complete, run a dedicated Personal v1.5 polish grill using
  `docs/stress-test-notes.md` as the source material.
- After Personal v1.5, or when distribution becomes an active goal, run a
  dedicated V2/distributable grill covering OAuth, installer/update flow,
  onboarding, user documentation, AI provider authentication, and formal security
  review.

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
- Backup uses the accepted Personal v1 versioned JSON format.
- Backup includes attachment metadata but does not copy attachment bytes.
- Import merges into the current database.
- Import does not wipe existing local data.
- If a tray with the same local id already exists, skip it and report that in the import summary.
- Created Jira links and sync logs are preserved on restore.

## CSV Export

- CSV export is a minimal technical fallback.
- CSV export is a manual/admin fallback artifact. Jira Cloud documents CSV
  import through Jira administration, not through a supported CSV file upload
  REST endpoint for this app.
- CSV export should support selecting pending and/or failed tasks.
- Created tasks are not exported to avoid duplicates.
- CSV export marks exported tasks as `Exported`.
- CSV export includes only basic Jira-importable fields that are assigned in
  the tested Jira admin import flow: `Summary`, `Issue Type`, `Labels`, and
  `Description`.
- CSV export should not include local `Project` or `Priority` in the fallback
  file, because those are not assigned during the tested import mapping.
- CSV export maps local issue types to the tested `JTFTEST` importer values:
  `Bug` -> `Error` and `Story` -> `Historia`.
- Descriptions may be exported as text.
- Attached files are not included in CSV export.
- CSV export should strip attachments rather than attempting to reference local files.
- Exported tasks can later become `Created` if uploaded through the API, but the
  `Create in Jira` preflight must default to excluding them and require an
  explicit checkbox confirmation that summarizes how many exported tasks could
  duplicate CSV-imported work.

## Out of Scope For V1

- Legacy text import from `STT:` blocks and `- [Bug] ... ****` lines.
- Full Jira issue search/browsing module beyond the JQL tab.
- Jira workflow status refresh for created tasks.
- Multi-user/team administration.
- Editable AI prompt/template UI.
- Configurable sub-task template editor.
- Jira issue relationship creation such as `blocks` and `blocked by` remains
  pending Issue #200 until its implementation PR is merged and validated.
- Rich CSV export customization.
- Automatic archival of completed trays.
- Full tray duplication.
