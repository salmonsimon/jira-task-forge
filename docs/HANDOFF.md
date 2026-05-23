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
- AI is manually triggered and helps create per-task Jira descriptions.
- Epics follow `[{Project}] {Area}` and are synced from Jira to avoid duplicates.
- Local SQLite persistence, backup/export without secrets, and sync audit logs are part of v1 scope.
- Technical stack is Tauri + React + TypeScript + shadcn/ui + Tailwind + SQLite.
- Jira and AI calls should run through the Rust/Tauri backend, not directly from React.
- The first prototype has moved into the real app skeleton.
- The shell includes `Trays`, `JQL`, `Categories`, `Settings`, task detail, CSV export, Jira settings, token storage, connection testing, and create preflight.

## Current Engineering Checkpoint

As of PR #21, `main` includes:

- Tauri + React shell with Jira-like styling.
- SQLite-backed local trays and local tasks.
- Tray lifecycle actions: create, rename, archive, restore, delete, duplicate task, delete editable task, and edit task details.
- CSV export through a native save dialog, including marking eligible tasks as `Exported`.
- Persisted non-secret settings.
- Jira API token storage through the OS credential store.
- Jira connection test using the configured site, account email, and saved token.
- `Create in Jira` preflight, including credential/project/task validation and a configurable Jira creation project key.
- A reusable backend Jira client and read-only JQL query command wired to the JQL panel.

Still pending:

- Real Jira issue creation through the API.
- Categories/JQL favorites persistence in the UI.
- Attachments, backup/import, audit log behavior, and AI integrations.
- Full native QA in an environment with the Linux system dependencies needed by Tauri/keyring.
- CSV upload-to-Jira fallback validation after the API create flow works.

## Open Grill Area

Most product scope is now settled. Remaining useful grill areas:

- ADRs 0003-0008 should be accepted or revised against the current implementation before expanding into Jira writes, backup/import, attachments, or audit retention.
- Jira API payload details, idempotency, and retry behavior need HITL before creating real Jira issues.
- CSV upload fallback should remain available, but it is now lower priority than API issue creation.

## Likely Implementation Path

Recommended stack to discuss next:

- Review and accept/revise ADRs 0003-0008.
- Run native QA for tray lifecycle, CSV export, settings, token storage, Jira connection test, and create preflight.
- Run native QA for direct JQL queries from the JQL tab.
- Add Jira issue creation behind preflight, idempotency checks, and audit logs.
- After API creation works, verify that Jira CSV upload still works from exported files.

## Suggested Skills For Next Session

- `grill-with-docs`: review ADRs 0003-0008 against the implementation and update docs as decisions settle.
- `tdd`: useful for Jira client extraction, payload generation, idempotency helpers, and audit-log behavior.
- `diagnose`: if Jira API authentication or sync errors become tricky.
