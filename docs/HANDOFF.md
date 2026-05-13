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
- First prototype should be built inside the real app skeleton with fake/in-memory data.
- First prototype should include the complete shell: `Trays`, `JQL`, `Categories`, `Settings`, and task detail panel.
- Prototype styling should be Jira-like from the start and use real-ish fake data.

## Open Grill Area

Most product scope is now settled. Remaining useful grill areas:

- exact tech stack for Windows desktop packaging
- SQLite schema and migration strategy
- Jira API payload details and auth tradeoffs
- first prototype/wireframe fidelity
- v1 issue breakdown

## Likely Implementation Path

Recommended stack to discuss next:

- Local-first app with SQLite persistence.
- JSON import/export for tray drafts.
- CSV export using the existing script logic as seed.
- Jira REST API client for:
  - create issue
  - bulk create issues
  - search issues with JQL
  - query priority Highest/High
- Keep the first version small: local tray + CSV export + settings + API credentials test.

## Suggested Skills For Next Session

- `grill-with-docs`: continue resolving product/domain decisions and update `CONTEXT.md`/ADRs as decisions settle.
- `prototype`: when ready to try UI flows before committing to a tech stack.
- `tdd`: useful once core parsing, tray persistence, CSV export, and Jira payload generation begin.
- `diagnose`: if Jira API authentication or sync errors become tricky.
