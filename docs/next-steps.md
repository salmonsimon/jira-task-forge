# Jira Task Forge Next Steps

This document is the default execution path for the repo. It is meant to support AFK implementation through parallel branches while keeping architecture and security-sensitive decisions human-in-the-loop.

## Current Checkpoint

Date: 2026-05-22

Main is up to date at:

```text
19848c8 Add Jira creation project target
```

Merged since the first in-memory tray interactions:

- PR #7: proposed v1 architecture ADRs for SQLite, secrets, Jira sync/idempotency, backup/import, attachment path policy, and audit log redaction/retention.
- PR #8: added a continuation checkpoint.
- PR #9: added the SQLite persistence foundation.
- PR #10: wired trays to Tauri persistence.
- PR #11: added tray lifecycle actions.
- PR #12: wired tray CSV export.
- PR #13: added task detail editing from the focus window.
- PR #14: added risk-aware tray delete confirmation.
- PR #15: persisted non-secret app settings.
- PR #16: stored Jira API tokens in the OS credential store.
- PR #17: added Jira connection testing from Settings.
- PR #18: added Jira create preflight review.
- PR #19: added the Jira creation project target setting.

Open for HITL review:

- ADRs 0003-0008 are still `Proposed`, but parts of SQLite persistence, secret storage, and Jira preflight are already implemented. Review them against the current code before expanding into Jira writes, backup/import, attachments, or audit log retention behavior.

Current validation:

- `npm install` may be needed after pulling because `@tauri-apps/plugin-dialog` was added.
- `npm run build` passes on `main` after dependencies are installed.
- Rust/Cargo tests were not run in the current WSL environment because `cargo` is not installed there.
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
npm install
npm run build
npm run dev
```

Then review the prototype at:

```text
http://localhost:1420/
```

If Rust/Cargo is available in the WSL environment, also run:

```bash
npm run tauri dev
```

Human QA to run before choosing the next implementation slice:

- Open `Trays`.
- Create and rename a tray.
- Add a task with Quick Capture and confirm it appears as a `Pending` local task.
- Duplicate an editable task and confirm the copy appears after the original with `(copy)`.
- Delete `Pending`, `Failed`, or `Exported` tasks.
- Confirm `Created` tasks do not expose duplicate/delete actions.
- Open task detail and confirm it still feels like a Jira-style focused task window.
- Edit project, area, and priority from task detail for editable tasks.
- Archive, restore, and delete trays, including risk-aware delete confirmation copy.
- Export CSV from a tray and confirm exported local tasks move to `Exported` status.
- Visit `JQL`, `Categories`, and `Settings` and confirm navigation still works.
- Save non-secret Jira settings and confirm they persist across app restart.
- Save, delete, and re-save a Jira API token through the OS credential store.
- Test Jira connection from Settings after entering a real Jira site, email, and token.
- Open `Create in Jira` preflight and confirm missing credentials, missing creation project, and missing task fields produce blocking warnings.
- After the API create path works, test that uploading tasks from the exported CSV still works as a fallback. This is intentionally lower priority than API creation.

Expected limitations right now:

- `Create in Jira` is preflight-only; it does not yet create Jira issues through the API.
- `Export CSV` is wired and opens a native save dialog.
- SQLite persistence exists for trays, local tasks, and non-secret app settings.
- Jira API token storage exists through the OS credential store.
- Jira connection testing exists through `/rest/api/3/myself`.
- Categories, JQL favorites, attachments, audit logs, backup/import, AI, and real Jira sync artifacts are not fully implemented.
- Task detail `Details` supports editable project, area, and priority for editable non-archived tasks. Auto-generated epic and labels remain visible but muted/read-only.

Near-term decided follow-ups:

- Keep Jira API creation ahead of CSV upload fallback validation.
- Preserve CSV export as a fallback, then verify Jira CSV upload after the API path is working.

Recommended next decision:

- If the QA flow feels right, review ADRs 0003-0008 and decide which should become accepted or need changes.
- Do not start Jira writes, attachment filesystem work, backup/import, or audit log persistence until the relevant ADRs are reviewed.
- After HITL architecture review, the next implementation slice should be Jira read-only foundation or a small Jira client extraction that supports both JQL and create flow.
- If QA reveals product/UI friction, do a small frontend-only fix branch before integration writes.

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

Branch: `feature/local-persistence`, then focused follow-ups

Owns:

- `src-tauri/src/models/`
- `src-tauri/src/repositories/`
- `src-tauri/src/services/`
- SQLite migration files once added
- Tauri commands for trays, tasks, categories, JQL favorites, and sync audit logs

Goal:

- Extend the current SQLite-backed trays/tasks/settings foundation before real Jira sync.
- Support categories, JQL favorites, attachments metadata, sync audit logs, and future migration safety.

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
- Keep minimal Jira-importable CSV export working for pending/failed/exported tasks.
- Test Jira CSV upload after API creation is proven, since API creation has priority.

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

- Implement Jira REST API integration on top of the current settings and token storage.
- Extract a reusable backend Jira client from the current connection test.
- Start with read-only operations and JQL, then write operations behind preflight checks.
- Keep API issue creation ahead of CSV upload fallback validation.

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

1. Keep the repo roadmap/docs synced with the current merged checkpoint.
2. Run native Tauri QA for tray lifecycle, CSV export, settings, credential storage, Jira connection test, and create preflight.
3. Review ADRs 0003-0008 against the current implementation and accept or revise them before risky persistence/sync expansion.
4. Extract a backend Jira client and add read-only Jira/JQL operations.
5. Add Jira create flow behind preflight, idempotency checks, and audit logs.
6. After API creation works, test that Jira CSV upload still works from exported files.
7. Add backup/import and attachment filesystem behavior after the relevant ADRs are accepted.
8. Add categories/JQL favorites persistence if needed to support Jira read-only workflows.
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

## Next Slice

Recommended next implementation slice:

Branch: `codex/update-current-roadmap`

Deliverables:

- Update README, handoff, and next-steps docs to match the PR #19 checkpoint.
- Add the CSV upload fallback QA note after API creation.
- Keep this as docs-only work with no product decision changes.

Reason:

- The previous roadmap still pointed at PR #6 and would send future agents down completed paths.

## Following Slice

Recommended following implementation slice:

Branch: `codex/jira-readonly-foundation`

Deliverables:

- Extract a backend Jira client around site URL normalization, token lookup, and authenticated requests.
- Keep Jira operations read-only except for the existing token save/delete commands.
- Add a read-only JQL command or metadata probe that reuses the same credential boundary.
- Add focused Rust tests around URL normalization and Jira client request construction where practical.

Reason:

- The app already has credential storage and connection testing; the next low-risk step is reusable read-only integration before Jira writes.

## Security And Reliability Tests To Add

- Frontend/domain: created tasks are read-only, delete states are allowed only for pending/failed/exported tasks, tray completion derives from created tasks, duplicated tasks exclude sync status/Jira links/audit logs, and preflight warnings are classified correctly.
- Rust services/repositories: path canonicalization stays under app data, attachment copy/delete lifecycle is deterministic, backups exclude secrets, imports merge without wiping local data, CSV strips attachments, sync status transitions are valid, Jira payload generation is stable, and retries do not create duplicate Jira issues.
- Release: migration review checklist, installer/update data-preservation check, branch protection expectations, and Tauri security config review before real integrations ship.
