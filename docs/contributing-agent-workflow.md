# Contributing And Agent Workflow

Jira Task Forge is open for personal use, forks, and adaptation.

## Contribution Basics

- Keep user-facing app copy in English.
- Jira task content and user-authored descriptions may be Spanish.
- Keep public docs free of private workspace names, real Jira keys, and secrets.
- Use fictitious examples such as `F1 Car Simulator` when showing public flows.
- Report bugs or proposed improvements through GitHub Issues.

## Agent-Ready Context

Agents should read these files before changing product behavior or public docs:

- [AGENTS.md](../AGENTS.md)
- [CONTEXT.md](../CONTEXT.md)
- [docs/product-decisions.md](product-decisions.md)
- [docs/HANDOFF.md](HANDOFF.md)
- [docs/jira-description-format.md](jira-description-format.md)
- [docs/notion-catalog-source-requirements.md](notion-catalog-source-requirements.md)

Use the WSL checkout and branch workflow described in `AGENTS.md`. Do not mutate
the DTS Jira project; use JTFTEST for writable Jira QA.
