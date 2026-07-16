# Jira Formatting

Jira Task Forge keeps naming and description formatting predictable before
creating Jira issues.

## Issue Naming

Epics use:

```text
[{Project}] [{Area}] {Scope}
```

Story and Bug tasks use:

```text
[{Area}] {Task name}
```

Fictitious example:

```text
Epic: [F1 Car Simulator] [Gameplay] Pit Stop Polish
Story: [Gameplay] Smooth pit entry steering assist
Bug: [QA] Pit lane timer does not reset after retry
```

The local task title should not include the Area prefix. Jira Task Forge derives
the prefix for display and Jira payloads.

## Issue Types

- `Bug` Area creates a Jira Bug.
- Other catalog Areas create Jira Stories unless the catalog explicitly maps
  them differently.

## Descriptions

Story and Bug descriptions follow the app's practical Jira format:

- Story: user story, context, scope, acceptance criteria, minimum deliverable,
  and review checklist.
- Bug: problem, impact, reproduction steps, current result, expected result,
  evidence, acceptance criteria, minimum deliverable, and review checklist.

See [docs/jira-description-format.md](jira-description-format.md) for the exact
headings.

## Relationships

Local `blocks` and `blocked by` drafts exist in the app, but Jira relationship
link creation is pending [Issue #200](https://github.com/salmonsimon/jira-task-forge/issues/200).
Update this section after Issue #200 is merged and validated.
