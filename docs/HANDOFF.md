# Jira Task Forge Handoff

## Goal

Build a small Windows app for preparing Jira tasks locally, then creating or querying Jira issues through the Jira Cloud REST API.

This project came from an existing ChatGPT workflow where tasks were written as compact lines like:

```text
- [Bug] Resolver problema timer ****
- [3D] Panel de informacion Metro ***
```

The app should make that flow easier through structured inputs, keyboard-friendly dropdowns, a preparation tray, draft saving, and Jira API actions.

## Existing Source Material

- Handoff prompt: `C:\Users\simon.bahamonde\Downloads\prompt_codex_jira_csv_app.md`
- Existing script: `C:\Users\simon.bahamonde\Downloads\jira_issue_csv_generator.py`
- Project context: `/home/saimon/Development/jira-task-forge/CONTEXT.md`
- Product decisions: `/home/saimon/Development/jira-task-forge/docs/product-decisions.md`
- Persistence/sync decision: `/home/saimon/Development/jira-task-forge/docs/adr/0001-local-drafts-and-jira-sync.md`

## Decisions Already Made

- Project name: `jira-task-forge`
- Preferred location: `/home/saimon/Development/jira-task-forge`
- Jira is the primary integration target.
- The app should use Jira Cloud REST API for creating and querying Jira issues.
- Jira is not the only source of truth while work is still being prepared.
- The app should have a local **Preparation Tray**.
- Pressing Enter or adding a row should enqueue a local task, not immediately create a Jira issue.
- The Jira API should be called only when the user presses `Crear en Jira`.
- If the tray has one task, create one Jira issue.
- If the tray has multiple tasks, create all queued tasks.
- Tray drafts should be saved locally.
- Tray drafts should also support JSON export/import.
- CSV export should remain available as a fallback when Jira API/auth/network is unavailable.

## Current Domain Language

Use `/home/saimon/Development/jira-task-forge/CONTEXT.md` as the source for canonical terms.

Important terms:

- **Preparation Tray**: editable queue of local tasks before Jira creation.
- **Tray Draft**: saved version of a preparation tray.
- **Local Task**: task owned by the app before sync/export.
- **Jira Issue**: task already created in Jira.
- **Project**: destination such as STT, PilotLab, MR Studio, Transversal.
- **Area**: category such as Bug, 3D, Polish, Programacion.
- **Priority**: Low, Medium, High, Highest.
- **Jira Sync**: REST API read/write with Jira.
- **CSV Export**: Jira-importable fallback file.

## UX Direction

The intended capture flow:

1. Choose or type an **Area** with autocomplete/dropdown, e.g. Bug, 3D, Polish.
2. Press Enter to move to the task title field.
3. Type the task title.
4. Choose **Priority** with keyboard-friendly options.
5. Add the row to the **Preparation Tray**.
6. Review/edit multiple tasks.
7. Press `Crear en Jira` to create all queued tasks.

The app should feel fast and simple, closer to a focused desktop utility than a full project management suite.

## Current Product Scope

The latest decisions are captured in `/home/saimon/Development/jira-task-forge/docs/product-decisions.md`.

High-level shape:

- Windows desktop app.
- English UI.
- Spanish Jira content by default.
- Main tabs: `Trays` and `JQL`.
- Global chips: `Categories` and `Settings`.
- Multiple named tray drafts.
- Jira API is primary; CSV is minimal fallback.
- AI is manually triggered. Implemented AI slices now draft JQL and generate
  per-task Assisted Description drafts through the Tauri backend, with local
  proposal review and logs before accepted content becomes the Jira description.
- New epics follow `[{Project}] [{Area}] {Scope}` and are synced from Jira to
  avoid duplicates, while legacy `[{Project}] {Area}` epics remain compatible.
- Local SQLite persistence, backup/export without secrets, and sync audit logs are part of v1 scope.
- Technical stack is Tauri + React + TypeScript + shadcn/ui + Tailwind + SQLite.
- Jira and AI calls should run through the Rust/Tauri backend, not directly from React.
- The first prototype has moved into the real app skeleton.
- The shell includes `Trays`, `JQL`, `Categories`, `Settings`, task detail, CSV
  export, backup/restore controls, Jira settings, Jira and AI token storage,
  connection testing, create preflight, task sync audit activity, JQL favorites
  and recent history, Ask AI JQL drafting, and the first guarded Jira write
  flow.

## Current Engineering Checkpoint

As of the merged PR #175 Epic Scope checkpoint, the app includes:

- Tauri + React shell with Jira-like styling.
- SQLite-backed local trays and local tasks.
- Tray lifecycle actions: create, rename, archive, restore, delete, duplicate task, delete editable task, and edit task details.
- CSV export through a native save dialog, including marking eligible tasks as `Exported`.
- JSON backup export/import through native dialogs, excluding stored secrets.
- Persisted non-secret settings.
- Jira API token storage through the OS credential store.
- Jira connection test using the configured site, account email, and saved token.
- Strict Jira Cloud Site URL validation for Personal v1, now routed through the
  guided `Set Jira Connection` flow instead of direct Settings field edits
  in Settings, and hardened external Jira issue-link opening against the
  configured Jira site host.
- Guided Jira connection setup launched from Settings as `Set Connection`,
  covering Jira Site URL, account email, saved Jira API token verification,
  Jira project discovery with manual fallback, review-before-save behavior,
  read-only connection state in Settings, and the in-app `Privacy &
  Diagnostics` detail view.
- `Create in Jira` preflight, including credential/project/task validation and a configurable Jira creation project key.
- Jira write path behind preflight: creation metadata validation, epic
  search/create, parent Story/Bug creation, accepted sub-task creation, selected
  Jira-ready attachment upload, local Jira key/link persistence, remote
  correlation markers through Jira issue properties, sync audit events, and
  partial recovery via moving failed tasks to a recovery tray.
- A reusable backend Jira client and read-only JQL query command wired to the JQL panel.
- Persisted JQL favorites, session recent JQL history, and honest empty/error/loading states in the JQL panel.
- OpenAI key storage, connection testing, and AI-assisted JQL draft generation through the Rust/Tauri backend.
- Visible sync progress steps and per-task sync audit activity.
- Stabilization coverage work for backup, OpenAI, services, frontend domain
  helpers, frontend coverage reporting, and dependency audit documentation.
- Minimal production Tauri CSP, with Jira and AI traffic kept behind backend
  commands instead of direct frontend network calls.
- Centralized sync audit detail allowlisting/redaction and capped long activity
  details.
- Assisted Description proposal review, proposal logs, backup/import behavior,
  DTS-format prompt/copy polish, and no-change proposal handling.
- Official catalog support for Areas, including catalog-managed area options,
  safe normalization, display-name/Jira-label separation, Bug/Story issue-type
  derivation, delivery-format mappings, conditional Arquitectura Brief/Propuesta
  Final resolution, and Assisted Description/Jira payload catalog context.
- Notion synchronization for the `JTF Sync Catalog` page, including Settings
  setup, Notion API page/block reads, Notion integration-token storage in the OS
  credential store, connection testing, and manual/public fallback modes.
- Jira QA boundary: `JTFTEST` is the writable test project. Agents may freely
  mutate `JTFTEST` for implementation and QA. `DTS` is read-only reference data
  and must not be mutated by agents.
- The post-PR #26 stabilization work has landed: Jira credential diagnostics,
  audit-log error redaction/capping, command-worker responsiveness, Jira
  response mapping helpers, and coverage-focused tests are now on `main`.
- Recent workflow polish has also landed: tray selector markup fixes, Notion
  setup direct routing, Jira token/setup copy, AI provider setup, shared drawer
  scrims, topmost overlay Escape behavior, nested modal/listbox popup
  standardization, local data storage inventory, managed attachment byte
  cleanup after Jira sync, and bounded stale backup-import staging cleanup.
- Story/Bug Assisted Description template separation has landed, including
  issue-type-specific prompt/validation behavior and Bug-specific required
  sections.
- Epic Scope modeling has landed, including tray-level canonical scope,
  optional confirmed Transversal scope, `TBD` handling without brackets, legacy
  epic compatibility, scoped preflight blocking, and Jira epic search/create
  with `[{Project}] [{Area}] {Scope}` targets.

Still pending:

- Re-check native/live QA after the catalog, Notion sync, Assisted Description
  template-context, Jira payload, Epic Scope, overlay/listbox, setup, and
  attachment lifecycle changes. Use `JTFTEST` for writes and keep `DTS`
  read-only.
- Issue #138: documentation alignment remains the current docs workstream until
  product decisions, handoff, live QA, and format docs all reflect the new
  workflow.
- Issue #139: run JTFTEST live workflow QA for the landed Story/Bug templates
  and Epic Scope workflow. This requires credentials in the runtime under test.
- Issue #179 documents the minimum contract for the Notion catalog sync source,
  using the current Notion page as the reference example while keeping the
  contract portable to Obsidian, Markdown, or another structured source.
- Issue #153 packages the Windows app and chooses/applies the final icon after
  Issue #138, Issue #139, and Issue #179, so the team can run the app without
  `npm run tauri dev` and still has a clear catalog-source maintenance
  reference.
- Regularizacion is out of current JTF scope. Issue #135 is closed as not
  planned and should not block current roadmap, docs, or QA work.
- Full native QA in an environment with the Linux system dependencies needed by
  Tauri/keyring remains useful before daily internal use.
- Manual Jira admin CSV import fallback validation remains lower priority than
  the API create path.
- Keep Rust backend line coverage above 80%; see `docs/coverage-report.md`.
- Continue growing frontend workflow tests beyond the current domain/workflow
  helper coverage, especially around Settings, overlay behavior, and preflight
  flows.

## Open Grill Area

Most product scope is now settled. ADRs 0003-0008 are accepted. Remaining useful
grill areas:

- Any change to the accepted persistence, secret-storage, sync, backup/import,
  attachment, or audit-log contracts should go through HITL review.
- CSV export fallback should remain available as a manual/admin Jira import
  artifact. The tested fallback shape omits local `Project` and `Priority`,
  and maps `Bug`/`Story` issue type values to `Error`/`Historia`.

## Likely Implementation Path

Recommended stack to work next:

- Finish Issue #138 docs alignment so future agents do not relaunch
  already-merged workflow model work or follow stale `[{Project}] {Area}`
  guidance.
- Run Issue #139 JTFTEST live workflow QA against the landed Story/Bug template
  and Epic Scope behavior, including credentialed Jira writes and local sync
  audit verification.
- Document the minimum Notion catalog sync source contract in Issue #179 before
  packaging, so the source can be maintained or ported without relying on memory
  of the current page.
- Run Issue #153 packaging/icon after Issue #138, Issue #139, and Issue #179 so
  the Windows build reflects the reviewed workflow, QA evidence, and catalog
  source maintenance docs.

## Suggested Skills For Next Session

- `tdd`: useful for Jira client extraction, metadata preflight, payload
  generation, idempotency helpers, and audit-log behavior.
- `diagnose`: if Jira API authentication or sync errors become tricky.
