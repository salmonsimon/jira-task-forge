# Jira Task Forge

Jira Task Forge is a local-first Windows desktop app for turning rough work notes into reviewed Jira-ready issues before anything is created in Jira.

It is built for people who prepare many Jira tasks from production notes, AI conversations, QA findings, or meeting follow-ups and want a private review step before sending work to Jira Cloud.

## What It Helps With

- Capture local tasks in a **Preparation Tray** before Jira is touched.
- Review generated Story or Bug descriptions before they become Jira content.
- Keep project and area naming consistent with automatic summaries such as:
  - Epic: `[F1 Car Simulator] [Gameplay] Pit Stop Polish`
  - Story/Bug: `[Gameplay] Smooth pit entry steering assist`
- Create Jira Epics, Stories/Bugs, accepted sub-tasks, and selected attachments through the Jira Cloud API.
- Draft JQL with AI assistance and run read-only Jira searches from the app.
- Use either manual Areas or synchronized Areas from a Notion catalog.
- Keep Jira, Notion, and AI credentials out of backups by storing secrets in Windows Credential Manager.

Jira relationship links such as `blocks` and `blocked by` are still pending [Issue #200](https://github.com/salmonsimon/jira-task-forge/issues/200). The app can keep local relationship drafts, but public docs should not claim Jira relationship-link creation is shipped until that issue is merged.

## Who It Is For

Jira Task Forge is a personal open project that other people can use, fork, and adapt. It is useful when you want a structured local drafting space instead of creating half-reviewed Jira issues directly.

The app is Windows-only today because it is packaged as a Tauri desktop app and uses Windows Credential Manager for local secret storage. The source is MIT licensed.

## Current Beta

The current public beta is `v0.1.0-beta.1`.

Download:

https://github.com/salmonsimon/jira-task-forge/releases/tag/v0.1.0-beta.1

The installer is unsigned, so Windows SmartScreen may warn before installation. This beta may contain errors. Please report reproducible problems in [GitHub Issues](https://github.com/salmonsimon/jira-task-forge/issues).

## Main Features

- Local Preparation Trays with editable task drafts.
- Jira Cloud connection setup and project metadata validation.
- AI-assisted JQL drafting.
- AI-assisted Story and Bug descriptions using OpenAI, Anthropic Claude, or Google Gemini.
- Proposal Review for accepting, rejecting, editing, or requesting another AI revision before description content is final.
- Epic Scope support with Jira Epic naming: `[{Project}] [{Area}] {Scope}`.
- Story/Bug summary naming: `[{Area}] {Task name}`.
- Accepted sub-task creation after parent issues are created.
- Selected attachment upload to Jira.
- CSV export as a fallback for Jira admin import workflows.
- JSON backup/import without secrets.
- Manual Areas or Notion-synchronized catalog Areas.

## Documentation

English:

- [Catalog sync guide](docs/catalog-sync.md)
- [Assisted descriptions](docs/assisted-descriptions.md)
- [Jira formatting](docs/jira-formatting.md)
- [Installation and security](docs/installation-security.md)
- [Known beta limitations](docs/beta-limitations.md)
- [Agent-ready workflow](docs/contributing-agent-workflow.md)
- [Video animation kit](docs/video-kit/README.md)

Spanish:

- [Guion de demo de 60-90 segundos](docs/video-kit/spanish-demo-script.md)
- [Guia rapida: sincronizacion de catalogo](docs/catalog-sync.md#ruta-rapida-en-espanol)
- [Notas de beta](docs/beta-limitations.md#resumen-en-espanol)

Technical references:

- [Source contract for Notion catalog pages](docs/notion-catalog-source-requirements.md)
- [Notion public OAuth connection](docs/notion-oauth-public-connection.md)
- [Canonical Jira description format](docs/jira-description-format.md)
- [Product decisions](docs/product-decisions.md)
- [Project context for agents](CONTEXT.md)

## Assisted Description Templates

Story descriptions focus on user value and delivery scope:

```markdown
## Historia de usuario

Como [usuario o rol],
quiero [accion o resultado],
para [beneficio].

## Contexto

## Alcance

## Criterios de aceptacion

## Entregable minimo

## Checklist antes de Review
```

Bug descriptions focus on reproducible failure and expected behavior:

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

See [docs/jira-description-format.md](docs/jira-description-format.md) for the exact format.

## Catalog Modes

Jira Task Forge can use two Area catalog modes:

- **Manual mode**: maintain Areas directly in the app. This is best for a quick setup or a personal project with a small stable Area list.
- **Sync from Notion page**: connect Notion through OAuth, select a catalog page in your own workspace, validate the JSON contract, and sync Areas plus delivery-format mappings.

The public Notion example is only a reference. It is not a usable OAuth source by itself. To sync from Notion, duplicate or copy the example into your own Notion workspace, keep or move it as a top-level page, select/share that owned page in the OAuth picker, validate it in Jira Task Forge, and then sync.

Start here: [docs/catalog-sync.md](docs/catalog-sync.md).

## For Agents

This repository is agent-ready. Before making product, architecture, or implementation changes, read:

- [AGENTS.md](AGENTS.md)
- [CONTEXT.md](CONTEXT.md)
- [docs/product-decisions.md](docs/product-decisions.md)
- [docs/HANDOFF.md](docs/HANDOFF.md)

User-facing UI copy should be English. Jira task content and user-authored task descriptions may be Spanish.

## Development

Install dependencies:

```bash
npm install
```

Run the frontend dev server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:1420
```

Run the native app:

```bash
npm run tauri dev
```

Build the frontend:

```bash
npm run build
```

Regenerate the public animation kit:

```bash
npm run assets:video-kit
```

Package the unsigned Windows installer from WSL:

```bash
CARGO_BUILD_JOBS=1 npm run package:windows:cross
```

See [docs/windows-packaging.md](docs/windows-packaging.md) for packaging details.
