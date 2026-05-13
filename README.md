# Jira Task Forge

Local-first Windows desktop app for preparing Jira work before creating issues through Jira Cloud.

## Current State

This repo currently contains the product/architecture decisions and the first clickable frontend shell prototype.

The prototype uses fake in-memory data and does not yet call Jira, AI providers, or SQLite.

## Stack

- Tauri
- React
- TypeScript
- shadcn-style UI with Tailwind
- SQLite planned for local persistence

## Run Frontend Prototype

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:1420
```

## Build Frontend

```bash
npm run build
```

## Tauri Notes

The Tauri skeleton is present under `src-tauri/`, but running the native app requires Rust/Cargo to be installed in the development environment.
