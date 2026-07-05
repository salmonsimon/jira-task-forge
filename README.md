# Jira Task Forge

Local-first Windows desktop app for preparing Jira work before creating issues through Jira Cloud.

## Current State

This repo contains the product/architecture decisions and the first Tauri/React desktop app skeleton.

The app now has SQLite-backed local trays/tasks, persisted non-secret settings,
CSV export, JSON backup/restore without secrets, Jira API token storage through
the OS credential store, Jira connection testing, read-only JQL search with
favorites/recent history, AI-assisted JQL drafting through the Tauri backend,
sync audit activity, Jira-admin-import-friendly CSV export, official
area catalog sync from Notion with OS credential-store token handling, task
detail sub-tasks, local issue relationship drafts, attachment metadata and
managed-file ingestion, assisted description sections/proposals, and a guarded
`Create in Jira` flow that creates required epics, parent Story/Bug issues,
accepted sub-tasks, and selected Jira-ready attachments.

## Stack

- Tauri
- React
- TypeScript
- shadcn-style UI with Tailwind
- SQLite via `rusqlite` for local persistence

## Run Frontend Dev Server

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:1420
```

## Run Native Tauri App

Running the native app requires Rust/Cargo in the WSL development environment.

```bash
npm install
npm run tauri dev
```

## Build Frontend

```bash
npm run build
```

## Internal Release Readiness

Before using a new batch of PRs for daily internal work, run the concise
readiness gate in [`docs/internal-release-readiness.md`](docs/internal-release-readiness.md).
Use [`docs/live-qa.md`](docs/live-qa.md) for the longer native and live Jira QA
procedure.

## Local Git Guard

This repo uses a local Git hook to block direct pushes to `main` from this workspace.

Enable it after cloning:

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-push
```

GitHub branch protection is still preferred when available for the repository owner/plan.

## Tauri Notes

The Tauri app stores local data under the app data directory. Jira API tokens
are intentionally stored outside SQLite through the OS credential store.
