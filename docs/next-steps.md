# Jira Task Forge Next Steps

This document is the default execution path for the repo. It is meant to support AFK implementation through parallel branches while keeping architecture and security-sensitive decisions human-in-the-loop.

## Current Checkpoint

Date: 2026-05-17

Main is up to date at:

```text
e90dcf0 Merge pull request #6 from salmonsimon/feature/frontend-tray-interactions
```

Merged since the initial prototype:

- PR #2: added `AGENTS.md` and this AFK/HITL implementation plan.
- PR #3: extracted the single-file frontend prototype into shell, shared UI, and feature modules.
- PR #4: added frontend domain contracts, mock data adapter, and pure task/tray/preflight helpers.
- PR #5: added a pure CSV fallback export helper.
- PR #6: added in-memory tray interactions for quick capture, duplicate, and delete.

Open for HITL review:

- Draft PR #7: proposed v1 architecture ADRs for SQLite, secrets, Jira sync/idempotency, backup/import, attachment path policy, and audit log redaction/retention.

Current validation:

- `npm run build` passes on `main`.
- The prototype runs with `npm run dev` at:

```text
http://localhost:1420/
```

## Resume Checklist

When starting a new chat/session, first do:

```bash
git fetch origin
git checkout main
git pull origin
npm run build
npm run dev
```

Then review the prototype at:

```text
http://localhost:1420/
```

Human QA to run before choosing the next implementation slice:

- Open `Trays`.
- Open an existing tray.
- Add a task with Quick Capture and confirm it appears as a `Pending` local task.
- Duplicate an editable task and confirm the copy appears after the original with `(copy)`.
- Delete `Pending`, `Failed`, or `Exported` tasks.
- Confirm `Created` tasks do not expose duplicate/delete actions.
- Open task detail and confirm it still feels like a Jira-style focused task window.
- Visit `JQL`, `Categories`, and `Settings` and confirm navigation still works.
- Refresh the page and confirm changes disappear; this is expected because persistence is still in-memory.

Expected limitations right now:

- `Create in Jira` is not wired.
- `Export CSV` is not wired to the UI yet, although a pure CSV helper exists.
- SQLite persistence does not exist yet.
- Jira, AI, credentials, attachments, backup/import, and audit log storage are not implemented.
- In-memory changes are intentionally lost on refresh.
- Task detail `Details` fields are still display-only. A later task editing slice should make project, area, and priority editable for non-archived editable tasks; keep auto-generated epic and labels visible but muted/read-only; remove the language row because Jira task content defaults to Spanish.

Recommended next decision:

- If the QA flow feels right, review Draft PR #7 and decide which proposed ADRs should become accepted or need changes.
- Do not start SQLite, secret storage, Jira writes, attachment filesystem work, backup/import, or audit log persistence until the relevant ADRs are reviewed.
- After HITL architecture review, the next implementation slice should be `feature/local-persistence`.
- If QA reveals product/UI friction, do a small frontend-only fix branch before persistence.

## Working Model

- Keep `main` protected and use short-lived feature branches.
- Prefer one branch per vertical slice with a narrow file ownership boundary.
- Start with conflict-reduction branches before spawning many implementation branches.
- Let independent implementation branches run AFK when the task has clear acceptance criteria and no credential, destructive data, or architecture decision risk.
- Pause for HITL review before merging branches that introduce persistence contracts, secret handling, Jira writes, AI provider calls, filesystem import/export behavior, or destructive local data operations.
- Keep frontend prototype work unblocked by using fake data adapters while backend contracts are being designed.

## Parallel Workstreams

### 1. Product And Architecture Track

Branch: `feature/v1-architecture-plan`

Owns:

- `docs/next-steps.md`
- `docs/adr/`
- `CONTEXT.md`
- `docs/product-decisions.md`

Goal:

- Convert the current product direction into implementation slices.
- Add ADRs for SQLite schema, secret storage, sync safety, and backup/import behavior before those areas become code.
- Review proposed ADRs 0003-0008 before implementation branches finalize migrations, secret handling, Jira writes, backup/import behavior, attachment filesystem rules, or audit-log retention/redaction.

HITL:

- Required for new ADRs, schema contracts, auth strategy, sync behavior, and any decision that changes v1 scope.

### 2. Frontend Interaction Track

Branch: `feature/frontend-extract-shell`, then `feature/frontend-tray-interactions`

Owns:

- `src/App.tsx` until extracted
- `src/styles.css`
- `src/components/shell/`
- `src/components/ui/`
- `src/features/trays/`
- `src/features/jql/`
- `src/features/categories/`
- `src/features/settings/`
- `src/features/task-detail/`

Goal:

- Extract the current single-file prototype into stable modules before multiple UI branches pile up.
- Turn the clickable prototype into richer local UI behavior while still using in-memory adapters.
- Implement tray creation, selection, quick capture, task edit states, duplicate/delete affordances, archived view, and preflight UI.

AFK-safe:

- Visual polish and in-memory UI interactions are generally safe.

HITL:

- Required before changing canonical product language, removing flows, or making Jira/AI behavior look finalized when it is still mocked.

### 3. Frontend Domain Adapter Track

Branch: `feature/domain-contracts`, then `feature/frontend-domain-adapter`

Owns:

- `src/lib/types.ts`
- `src/lib/data.ts`
- future shared DTOs under `src/lib/contracts/`
- future `src/lib/domain/`
- future `src/lib/adapters/`
- mirrored Rust models under `src-tauri/src/models/` once contracts settle

Goal:

- Define tray, task, category, epic mapping, sync audit, settings, AI request/result, and JQL request/result contracts.
- Separate React components from fake data.
- Introduce typed repository/client interfaces that can later call Tauri commands.
- Keep mock data useful for frontend development and tests.

HITL:

- Required for type changes that become backend contracts.

### 4. Local Persistence Track

Branch: `feature/local-persistence`

Owns:

- `src-tauri/src/models/`
- `src-tauri/src/repositories/`
- `src-tauri/src/services/`
- SQLite migration files once added
- Tauri commands for trays, tasks, categories, JQL favorites, and sync audit logs

Goal:

- Add SQLite-backed local storage for preparation trays before real Jira sync.
- Support stable local task ids, tray state, categories, attachments metadata, sync status, and audit logs.

HITL:

- Required before finalizing migrations or any import/merge semantics.

### 5. Backup, Import, And CSV Track

Branch: `feature/backup-csv-export`

Owns:

- backup/export services in `src-tauri/src/services/`
- filesystem bundle code
- CSV export code
- related Tauri commands
- attachment path policy if not handled in its own branch

Goal:

- Add JSON/zip backup without secrets.
- Add import that merges without wiping current data.
- Add minimal Jira-importable CSV export for pending/failed tasks.

HITL:

- Required for import conflict policy, destructive behavior, attachment path handling, and marking tasks as `Exported`.
- Required before implementing filesystem path canonicalization rules, attachment copy/delete lifecycle, or backup bundle layout.

### 6. Jira Integration Track

Branch: `feature/jira-sync`

Owns:

- `src-tauri/src/integrations/jira/`
- Jira auth test commands
- create issue / bulk create / JQL commands
- epic sync and mapping logic

Goal:

- Implement Jira REST API integration after local persistence exists.
- Start with read/test operations, then write operations behind preflight checks.

HITL:

- Always required before choosing auth strategy, testing against real Jira credentials, enabling Jira writes, storing Jira credentials, or creating/deleting/updating remote Jira records.
- Required before retry/idempotency behavior is finalized, because duplicate Jira issues are a real product risk.

### 7. AI Integration Track

Branch: `feature/ai-assisted-descriptions`

Owns:

- `src-tauri/src/integrations/ai/`
- internal prompt templates
- Tauri commands for description generation, missing-info review, sub-task suggestions, and JQL generation

Goal:

- Add explicit user-triggered AI actions only.
- Keep prompts named and internal so they can become configurable later.

HITL:

- Required for provider/key storage, prompt behavior that could invent Jira content, attachment/image use, and any default model/provider decision.
- Required before transmitting pasted images, attachments, task descriptions, or Jira content to an external AI provider.

### 8. Test And Quality Track

Branch: `feature/test-harness`

Owns:

- frontend tests once a test runner is added
- Rust tests under `src-tauri/`
- fixture data
- CI/check scripts if introduced

Goal:

- Establish tests around domain rules before high-risk integrations land.
- Cover issue type derivation, priority mapping, sync status transitions, backup exclusions, import merge behavior, and Jira payload generation.

HITL:

- Required before adding CI/release gates that affect developer workflow.

## Recommended Sequence

1. Extract the frontend shell from `src/App.tsx` into feature modules to reduce merge conflicts.
2. Freeze the v1 data model with a SQLite/schema ADR and shared DTO contracts.
3. Add frontend domain adapters so UI work and backend work can proceed in parallel.
4. Implement local SQLite persistence for trays/tasks/categories.
5. Wire frontend to Tauri persistence commands.
6. Add backup/import and CSV export.
7. Add Jira auth test and JQL read-only query.
8. Add Jira create flow behind preflight, idempotency checks, and audit logs.
9. Add AI-assisted descriptions and JQL generation after settings/secrets are settled.

## HITL Gates

Pause and ask before implementing or merging changes that:

- introduce or modify SQLite migrations after data exists
- choose Jira authentication strategy or store credentials
- test auth against real Jira credentials
- write to Jira through the API
- upload attachments to Jira
- call an AI provider or transmit task attachments/images to AI
- import backups into an existing database
- delete trays, tasks, attachments, or local app data
- change backup contents or secret-exclusion policy
- change audit log redaction, retention, or payload contents
- finalize attachment path handling or filesystem cleanup behavior
- change canonical domain language in `CONTEXT.md`
- change accepted ADR decisions
- ship real integrations while Tauri `csp` remains `null`
- add update/installer behavior
- change branch protection, CI gates, release gates, or local Git guard behavior

## AFK-Safe Work

These can usually run without interruption when acceptance criteria are clear:

- frontend-only prototype interactions using fake data
- component extraction and styling consistency
- non-destructive read-only domain helpers
- mock adapters and fixtures
- docs cleanup that does not change decisions
- tests for already accepted rules
- read-only Jira payload shape exploration without credentials

## First Slice

Recommended first implementation slice:

Branch: `feature/frontend-extract-shell`

Deliverables:

- Extract `src/App.tsx` into shell, tray, JQL, categories, settings, task detail, and shared UI modules.
- Keep the current UI behavior intact.
- Keep fake data unchanged.

Reason:

- This reduces merge conflict risk before multiple AFK agents work on frontend, adapters, and integration surfaces.

## Second Slice

Recommended second implementation slice:

Branch: `feature/domain-contracts`

Deliverables:

- Move fake data access behind typed frontend interfaces.
- Keep the current UI behavior intact.
- Add pure domain helpers for issue type derivation, editable/read-only task rules, tray completion, and task duplication.
- Add focused tests for those pure helpers before SQLite work starts.

Reason:

- This creates a clean boundary between UI and persistence.
- It lets frontend and Tauri persistence work proceed in parallel with less merge conflict risk.

## Security And Reliability Tests To Add

- Frontend/domain: created tasks are read-only, delete states are allowed only for pending/failed/exported tasks, tray completion derives from created tasks, duplicated tasks exclude sync status/Jira links/audit logs, and preflight warnings are classified correctly.
- Rust services/repositories: path canonicalization stays under app data, attachment copy/delete lifecycle is deterministic, backups exclude secrets, imports merge without wiping local data, CSV strips attachments, sync status transitions are valid, Jira payload generation is stable, and retries do not create duplicate Jira issues.
- Release: migration review checklist, installer/update data-preservation check, branch protection expectations, and Tauri security config review before real integrations ship.
