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
- Epics follow `[{Project}] {Area}` and are synced from Jira to avoid duplicates.
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

As of the merged PR #128 guided Jira connection setup checkpoint, the
app includes:

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
  search/create by `[{Project}] {Area}`, parent Story/Bug creation, accepted
  sub-task creation, selected Jira-ready attachment upload, local Jira key/link
  persistence, remote correlation markers through Jira issue properties, sync
  audit events, and partial recovery via moving failed tasks to a recovery tray.
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
- Jira QA boundary: `JTFTEST` is the writable test project. Agents may freely
  mutate `JTFTEST` for implementation and QA. `DTS` is read-only reference data
  and must not be mutated by agents.
- The post-PR #26 stabilization work has landed: Jira credential diagnostics,
  audit-log error redaction/capping, command-worker responsiveness, Jira
  response mapping helpers, and coverage-focused tests are now on `main`.

Still pending:

- Re-check native QA after the post-PR command-worker, backup, audit, JQL, and
  Ask AI changes.
- Categories persistence in the UI.
- Audit log UI, broader Jira issue relationship sync, attachment source validation,
  focused `Privacy & Diagnostics` copy/test polish if review finds gaps, local data cleanup/storage inventory,
  and remaining native/live QA hardening around assisted descriptions,
  sub-tasks, and attachment upload.
- Full native QA in an environment with the Linux system dependencies needed by Tauri/keyring.
- Manual Jira admin CSV import fallback validation after the API create flow works.
- Keep Rust backend line coverage above 80%; it is currently 80.40% in
  `docs/coverage-report.md`.
- Continue growing frontend workflow tests beyond the current domain/workflow
  helper coverage, especially around Settings and preflight flows.
- Issue #112's guided `Set Connection` flow landed in PR #128. Keep Jira Site
  URL, account email, and project key setup in that guided path; Settings should
  continue to show those values as read-only connection state, save them only at
  the wizard review step, allow manual project-key fallback only when discovery
  is unavailable, and keep API token management separate.
- Treat issue #102 as mostly satisfied by the guided setup's in-app `Privacy &
  Diagnostics` detail view. Leave only focused copy, docs, or rendering-test
  follow-up if review finds the current text insufficient. Do not add a
  permanent privacy-copy block to the main Settings panel for Personal v1.
- Issue #94 has landed as a Jira sync reliability slice: failed parent tasks
  without a local Jira key query Remote Correlation Markers before retrying
  creation, recover the local Jira link when a match exists, and fail safely
  without creating when marker lookup cannot be confirmed.
- Implement issue #95 as a dedicated attachment provenance/source-validation
  slice, separate from Jira sync internals.
- Implement issue #103 as documentation-only storage inventory; if it lands
  before #95, mark attachment lifecycle details as pending rather than final.

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

- Run native QA for tray lifecycle, CSV export, backup/restore, settings, token
  storage, Jira/OpenAI connection tests, direct JQL, Ask AI drafting, create
  preflight, and visible sync/audit behavior.
- Run live QA for Jira issue creation against `JTFTEST`: missing description
  confirmation, metadata preflight, epic reuse/create, parent Story/Bug
  creation, accepted sub-task creation, selected Jira-ready attachment upload,
  partial failure, and recovery tray movement.
- Keep remaining Jira write work narrow. Prioritize Remote Correlation Marker
  recovery before broader Jira issue relationship sync.
- Keep attachment provenance/source validation separate from sync/audit work.
- After API creation works, verify that Jira's admin CSV importer can still use
  exported files manually.

## Suggested Skills For Next Session

- `tdd`: useful for Jira client extraction, metadata preflight, payload
  generation, idempotency helpers, and audit-log behavior.
- `diagnose`: if Jira API authentication or sync errors become tricky.
