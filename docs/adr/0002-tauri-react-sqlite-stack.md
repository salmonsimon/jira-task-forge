# ADR 0002: Use Tauri, React, TypeScript, shadcn/ui, and SQLite

## Status

Accepted

## Context

Jira Task Forge should be an installable Windows desktop app, not a local web app. The first version is meant for personal use, but it should be built with a stack that can later support broader distribution.

The app needs:

- a polished Jira-like desktop UI
- local-first persistence
- image/attachment storage
- backup and restore
- Jira REST API integration
- AI provider integration
- local secret handling
- a lightweight installer/update path

.NET/WPF/WinUI was considered but rejected because the user wants to learn and reuse web-app skills across future projects.

Electron was considered because it is widely adopted for web-tech desktop apps. It was rejected for v1 because the app is local, focused, and should stay lightweight.

## Decision

Use:

- Tauri for the Windows desktop shell
- React and TypeScript for the frontend
- shadcn/ui and Tailwind for UI components and styling
- Radix primitives where lower-level accessible behavior is needed
- lucide-react for icons
- SQLite for local persistence
- filesystem-backed attachment storage with metadata in SQLite

Use a real app skeleton for the prototype, rather than a fully throwaway prototype.

## Architecture

React/TypeScript owns:

- UI layout and interaction state
- forms and controls
- tray editor
- JQL tab
- categories/settings panels
- task detail panels
- invoking backend commands

Rust/Tauri owns:

- SQLite reads/writes
- filesystem access
- attachment storage
- backup/restore
- local secret handling
- Jira API calls
- AI provider calls
- sync audit log writes

Preferred backend organization:

```text
src-tauri/src/
- commands/
- services/
- repositories/
- integrations/
- models/
```

React should call Tauri commands such as `create_issues_from_tray`, `generate_description`, or `run_jql`, instead of calling Jira or AI providers directly.

## Consequences

- The app remains lighter than an Electron app.
- Most UI work is reusable React/TypeScript knowledge.
- Some Rust/Tauri code is required for native integration, persistence, and API calls.
- API keys and Jira tokens can stay out of the React layer.
- The backend can be tested and audited around services/repositories rather than scattered UI effects.
- shadcn/ui speeds up prototype and implementation while still allowing a custom Jira-like visual style.

## Prototype Scope

The first prototype should run inside the real stack and use fake or in-memory data where needed.

Include:

- Tauri + React + TypeScript shell
- shadcn/ui + Tailwind foundation
- full app shell with `Trays`, `JQL`, `Categories`, and `Settings`
- `Trays` tab
- `JQL` tab
- `Categories` panel
- `Settings` panel
- task detail panel
- compact Jira-like density
- fake real-ish project/task data
- both empty and filled assisted-description states

Exclude at prototype stage:

- real Jira API calls
- real AI calls
- real SQLite persistence
- production installer/update flow
