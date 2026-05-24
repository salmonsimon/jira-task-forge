# Jira Task Forge Agent Notes

This repo is Saimon's local-first Windows desktop app for preparing Jira work
before creating issues through Jira Cloud.

## Platform

Use the WSL2 Ubuntu checkout:

```text
/home/saimon/Development/jira-task-forge
```

For agent-internal tooling, Saimon has given standing permission to install
missing development tools and validation dependencies when needed to do the
work, without pausing for product approval. If the environment requires an
interactive sudo/password prompt that Codex cannot satisfy, report the exact
command Saimon should run.

## Project Context

Before product, architecture, or implementation work, read:

- `README.md`
- `CONTEXT.md`
- relevant ADRs in `docs/adr/`
- `docs/product-decisions.md` when touching product behavior
- `docs/HANDOFF.md` when continuing planned work

User-facing UI copy is English. Jira task content, descriptions, areas, epics,
and user-authored text may remain Spanish.

## Jira Cloud Safety Boundary

Agents may read Jira data from the DTS project to understand real work patterns
and field behavior, but must not create, update, delete, transition, comment on,
or otherwise mutate DTS issues.

Agents may freely create, update, delete, transition, comment on, and otherwise
mutate issues in the JTFTEST project for implementation and QA without asking
Saimon first. Prefer JTFTEST for real Jira write smoke tests whenever it helps
AFK progress.

## Delivery Workflow

Use an AFK-first implementation flow:

- Use PRDs when product direction is clear enough to specify.
- Break PRDs and plans into thin vertical issues or implementation slices.
- Treat implementation slices as AFK when an agent can complete them without
  Saimon after the slice is ready.
- Reserve HITL for product direction, architecture tradeoffs, provider choices,
  integration risk, and final PR review.
- Use TDD for deep modules and high-risk behavior.

The Matt Pocock-style skills are global workflow tools for this project:
`to-prd`, `to-issues`, `triage`, `grill-with-docs`, `tdd`, `diagnose`,
`improve-codebase-architecture`, and `zoom-out`.

## Framework Inbox

Use the global `framework-inbox` skill when reusable UI, architecture, testing,
workflow, or agent-pattern candidates appear. Capture candidates in:

```text
/home/saimon/Development/salmon-simon-framework/docs/framework-inbox.md
```

Good Jira Task Forge candidates include local-first state modules, Tauri app
shell patterns, command adapters, tray editors, dropdowns, popovers, config
editors, and Jira sync testing patterns.
