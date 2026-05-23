# Jira Task Forge

Local-first Windows desktop app for preparing Jira work before creating issues through Jira Cloud.

## Current State

This repo contains the product/architecture decisions and the first Tauri/React desktop app skeleton.

The app now has SQLite-backed local trays/tasks, persisted non-secret settings,
CSV export, Jira API token storage through the OS credential store, Jira
connection testing, read-only JQL search, and a `Create in Jira` preflight
dialog.

It does not yet create Jira issues through the API, call AI providers, manage
real attachments, or support backup/import.

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
