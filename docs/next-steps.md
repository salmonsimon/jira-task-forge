# Jira Task Forge Next Steps

This document is the default execution path for the repo. It is meant to support AFK implementation through parallel branches while keeping architecture and security-sensitive decisions human-in-the-loop.

## Current Checkpoint

Date: 2026-05-25

Main is up to date at:

```text
d588934 Update coverage report after stabilization tests (#47)
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
- PR #20: updated the roadmap and handoff to the PR #19 checkpoint.
- PR #21: added a reusable backend Jira client and read-only JQL query command wired to the JQL panel.
- PR #25: accepted ADRs 0003-0008 for the first real Jira write slice.
- PR #26: added guarded Jira parent issue creation, including metadata
  preflight, epic resolution/creation, parent Story/Bug creation, priority
  fallback updates, local recovery, JTFTEST live QA, and compositor-friendly
  loading treatments for the Jira write path.
- PR #27: hardened Jira sync diagnostics.
- PR #28/#32: increased backend coverage, including service-layer workflows.
- PR #29/#30/#31: extracted command-worker, sync-audit detail, and Jira
  response mapping helpers.
- PR #33/#34: wired Jira links, JQL favorites/admin controls, preflight
  checkbox polish, and category deletion fixes.
- PR #37: added honest JQL states and the AI placeholder.
- PR #38: added backup restore MVP.
- PR #39: showed task sync audit activity.
- PR #41: added JQL Ask AI drafting through the OpenAI backend integration.
- PR #42: documented the Personal v1 roadmap.
- PR #43/#44/#45: refreshed and raised Rust coverage for backup, OpenAI, and
  services.
- PR #46: added the first frontend Vitest domain test harness.
- PR #47: updated the coverage report after stabilization tests.

Open for HITL review:

- ADRs 0003-0008 are `Accepted`. Changes to those persistence, secrets, sync,
  backup/import, attachment, or audit-log contracts should go through HITL
  review.

Current validation:

- `npm install` may be needed after pulling because Vitest and Tauri dialog
  dependencies are part of the current checkpoint.
- `npm run build` passes on `main` after dependencies are installed.
- `cargo fmt -- --check` passes after installing Rust/Cargo with rustup.
- `cargo test` passes in the current WSL checkout. As of PR #47, the Rust suite
  has 82 tests covering SQLite schema/repositories, settings defaults, Jira URL
  and error helpers, guarded Jira parent issue sync, Jira credential debug
  redaction, sync audit error redaction/capping, backend delete protection for
  created tasks, command/model/db helper behavior, service-layer local-first
  workflows, backup behavior, and OpenAI integration helpers.
- Rust coverage is measured with `cargo llvm-cov --summary-only`. The current
  Rust line coverage is 78.26%; see `docs/coverage-report.md`.
- `npm test` passes in WSL with 20 frontend domain/workflow tests. The script pins
  `TMPDIR` to `/tmp` by default so Vitest does not inherit a Windows temp path
  that is not creatable from WSL.
- The React frontend has a test runner but no coverage reporting or component/
  DOM test strategy yet.
- Playwright screenshots are blocked in the current WSL environment by missing Chromium runtime library `libnspr4.so`.
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
npm test
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

Human QA to run before choosing the next implementation slice is captured in
`docs/live-qa.md`. Summary:

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
- Export and import a JSON backup, confirming secrets are excluded and restored
  Jira links/audit history remain useful.
- Visit `JQL`, `Categories`, and `Settings` and confirm navigation still works.
- Save non-secret Jira settings and confirm they persist across app restart.
- Save, delete, and re-save a Jira API token through the OS credential store.
- Save, delete, and re-save an OpenAI API key through the OS credential store.
- Test Jira connection from Settings after entering a real Jira site, email, and token.
- Test OpenAI connection from Settings after entering a real provider key.
- Run a direct JQL query from the JQL tab and confirm Jira results populate the table.
- Save, rename, delete, and reuse a JQL favorite.
- Use Ask AI in the JQL tab and confirm it drafts a query without running it automatically.
- Open `Create in Jira` preflight and confirm missing credentials, missing creation project, and missing task fields produce blocking warnings.
- Against `JTFTEST`, confirm preflight can create missing epics, create parent Story/Bug issues, persist Jira keys locally, and move failed tasks to a recovery tray without duplicating them.
- Re-check that Settings token actions, Settings connection test, direct JQL,
  and Create in Jira show loading before blocking work and remain responsive
  enough after the command worker split.
- After the API create path has live QA, test that Jira's admin CSV importer can
  still use exported CSV files manually. This is intentionally lower priority
  than API creation.

Expected limitations right now:

- `Create in Jira` creates required epics and parent Story/Bug issues only. Sub-tasks and attachments are intentionally still out of scope.
- `Export CSV` is wired and opens a native save dialog.
- SQLite persistence exists for trays, local tasks, and non-secret app settings.
- Jira API token storage exists through the OS credential store.
- Jira connection testing exists through `/rest/api/3/myself`.
- Read-only JQL queries are wired through Jira Cloud REST API v3.
- JQL favorites persistence, session JQL history, backup/import, sync progress,
  task sync audit activity, OpenAI settings, and Ask AI JQL drafting are wired.
- Categories persistence, per-task assisted descriptions, attachments, audit log
  UI, sub-task creation, and attachment upload are not fully implemented.
- Task detail `Details` supports editable project, area, and priority for editable non-archived tasks. Auto-generated epic and labels remain visible but muted/read-only.

Near-term decided follow-ups:

- Keep Jira API creation ahead of manual CSV import fallback validation.
- Preserve CSV export as a fallback, then verify Jira admin CSV import manually
  after the API path is working.
- Use `JTFTEST` as the real Jira write sandbox. Agents may mutate `JTFTEST`
  without asking; `DTS` is read-only reference data only.

Recommended next implementation:

- Re-check native QA after the stabilization, backup, audit, JQL, and Ask AI
  changes.
- Raise backend coverage above 80% by targeting `commands.rs` and
  `integrations/jira.rs`.
- Expand frontend workflow tests around JQL recent history, backup notices,
  Settings state, and preflight/progress view models.
- Next write slices should stay narrow: sub-task creation first, attachment upload later.
- If QA reveals product/UI friction, do a small frontend-only fix branch before expanding integration writes.

## Working Model

- Keep `main` protected and use short-lived feature branches.
- Prefer one branch per vertical slice with a narrow file ownership boundary.
- Start with conflict-reduction branches before spawning many implementation branches.
- Let independent implementation branches run AFK when the task has clear acceptance criteria and no credential, destructive data, or architecture decision risk.
- Jira write QA is AFK-safe only against `JTFTEST`; never mutate `DTS`.
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
- Use accepted ADRs 0003-0008 as the implementation contracts for SQLite schema,
  secret storage, Jira sync safety, backup/import behavior, attachment
  filesystem rules, and audit-log retention/redaction.

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
- Test manual Jira admin CSV import after API creation is proven, since API
  creation has priority and Jira Cloud does not expose a supported CSV import
  REST endpoint.

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
- Reuse the backend Jira client added in PR #21.
- Continue from read-only JQL into write operations behind preflight checks.
- Keep API issue creation ahead of manual CSV import fallback validation.

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
2. Finish the post-PR #26 stabilization branch: command workers, audit
   redaction, credential debug safety, and architecture/test candidates.
3. Re-check native QA for settings, credential storage, connection test, JQL
   query, preflight, and Jira creation after the worker split.
4. Test that Jira's admin CSV importer still works from exported files.
5. Add sub-task creation as the next narrow Jira write slice.
6. Add backup/import and attachment filesystem behavior as later slices under the accepted ADR contracts.
7. Add categories/JQL favorites persistence if needed to support Jira read-only workflows.
8. Add AI-assisted descriptions and JQL generation after settings/secrets are settled.

## HITL Gates

Pause and ask before implementing or merging changes that:

- introduce or modify SQLite migrations after data exists
- choose Jira authentication strategy or store credentials
- mutate Jira projects outside the `JTFTEST` sandbox
- write to `DTS` through the API
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
- real Jira write QA against `JTFTEST` for already accepted Jira sync flows

## Next Slice

Recommended next implementation slice:

Branch: `codex/post-jira-architecture-tests`

Deliverables:

- Stabilize the merged Jira write path before adding sub-task creation,
  attachment upload, or AI writes.
- Keep already accepted PR #26 behavior intact while tightening security and
  responsiveness around Jira credentials, JQL, keyring operations, audit logs,
  and command worker usage.
- Add focused tests for accepted rules rather than introducing broad coverage
  tooling before the useful seams are clear.
- Document deeper architecture candidates for HITL review instead of making
  larger module splits silently.

Reason:

- The first Jira write path is live-tested and merged. A short stabilization
  slice gives future write surfaces a safer base and reduces the chance that
  AFK agents duplicate Jira issues or leak sensitive diagnostics.

## Following Slice

Recommended following implementation slice:

Branch: `codex/jira-subtasks-first`

Deliverables:

- Add sub-task creation behind the existing preflight and metadata model.
- Preserve the existing epic/parent issue safety model and recovery behavior.
- Keep attachment upload, AI-generated descriptions, and manual CSV import
  validation out of this slice unless separately approved.

Reason:

- Parent issue creation is proven. Sub-tasks are the narrowest next Jira write
  surface before attachments or AI provider calls.

## Security And Reliability Tests To Add

- Frontend/domain: created tasks are read-only, delete states are allowed only for pending/failed/exported tasks, tray completion derives from created tasks, duplicated tasks exclude sync status/Jira links/audit logs, and preflight warnings are classified correctly.
- Rust services/repositories: path canonicalization stays under app data, attachment copy/delete lifecycle is deterministic, backups exclude secrets, imports merge without wiping local data, CSV strips attachments, sync status transitions are valid, Jira payload generation is stable, and retries do not create duplicate Jira issues.
- Release: migration review checklist, installer/update data-preservation check, branch protection expectations, and Tauri security config review before real integrations ship.

## Post-PR Architecture And Test Deepening

After the guarded Jira parent issue creation slice is merged, pause feature
expansion for one stabilization branch using the `improve-codebase-architecture`
skill.

Goals:

- Review the Jira sync runner, Jira client, Tauri command layer, persistence
  repositories, and preflight UI for shallow modules or overloaded interfaces.
- Preserve the accepted ADR 0005 safety model while improving locality around
  Jira payload generation, post-create updates, audit events, and recovery
  outcomes.
- Decide where the next useful test seams live before adding sub-task creation,
  attachment upload, or AI provider calls.
- Add a real frontend test approach if the architecture pass finds UI behavior
  that should stop relying on manual QA only.
- Include a focused security review of the surfaces that now matter most:
  credential storage, Jira token reads, audit-log redaction, Tauri command
  exposure, external URL opening, local file writes, and the `JTFTEST`/`DTS`
  mutation boundary.
- Before creating new UI controls from scratch, check existing repo UI modules
  and installed libraries first. Current ready-to-use UI building blocks are the
  local `src/components/ui/` primitives, Tailwind classes, and `lucide-react`
  icons; add or build new controls only when the current options cannot cover a
  critical interaction safely.
- Treat the current compositor-friendly `LoadingOrb` as functionally accepted
  but visually provisional. It solved the loading stutter for PR #26, but Saimon
  wants to review better spinner/loading visual options later before promoting
  it as a polished framework-style control.
- Consider coverage tooling only after the seams are clear; avoid chasing a
  percentage before the tests represent the product risks.

Initial deepening opportunities from the first pass:

1. **Jira Sync planning Module**

   Files: `src-tauri/src/jira_sync.rs`, `src-tauri/src/models.rs`

   Problem: metadata resolution, epic planning, payload generation, post-create
   priority repair, result shaping, and audit events all live inside one large
   Implementation. The current Interface is still one useful `JiraSyncRunner`,
   but maintainers need to scan too much unrelated behavior to change one sync
   rule.

   Solution: keep `JiraSyncRunner` as the public Interface, then deepen the
   internal planning Module around accepted concepts: **Jira Creation Metadata**,
   **Epic Mapping**, parent issue payloads, and post-create repair.

   Benefits: better Locality for Jira payload and metadata bugs, more Leverage
   from small tests around accepted sync rules, and less risk before adding
   sub-task creation.

2. **Sync Audit Log detail Module**

   Files: `src-tauri/src/jira_sync.rs`, `src-tauri/src/repositories.rs`,
   `docs/adr/0008-audit-log-redaction-and-retention.md`

   Problem: audit redaction is now covered for the highest-risk Jira error
   messages, but it still sits as private helper Implementation inside the sync
   runner. As audit UI, backup/export, and future integrations arrive, that
   shallow location will invite duplicated redaction rules.

   Solution: create a small, deep audit detail Module with an allowlisted
   Interface for structured details and redacted short messages.

   Benefits: one Seam for ADR 0008 enforcement, stronger secret-handling tests,
   and clearer Locality when future AI/Jira/file events need audit records.

3. **Tauri command worker Adapter**

   Files: `src-tauri/src/commands.rs`, `src-tauri/src/services.rs`

   Problem: blocking work now uses `spawn_blocking` in several command
   implementations, but the pattern is repeated manually. That Interface is
   simple today, yet shallow enough that future network/keyring commands may
   forget the responsiveness rule.

   Solution: introduce a command worker Adapter only if repetition continues
   after the next Jira write slice. For now, document the rule and keep tests
   and builds proving behavior compiles.

   Benefits: preserves UI responsiveness and improves Locality for future event
   loop/loading fixes without introducing abstraction too early.

4. **Frontend workflow state Module**

   Files: `src/App.tsx`, `src/features/*`, `src/lib/adapters/*`,
   `src/lib/domain/*`

   Problem: `src/App.tsx` remains the largest frontend Module and still owns
   many workflow transitions. The feature views are extracted, but the workflow
   Interface is not yet a good frontend test surface.

   Solution: after this stabilization branch, add a frontend test runner and
   extract workflow state in thin slices only where tests prove value: preflight,
   JQL result clearing/loading, tray completion, and created-task read-only
   behavior.

   Benefits: stronger Locality for UI regressions, less manual QA burden, and
   better Leverage from tests around the behaviors Saimon has been live-testing.

5. **CSV save Adapter**

   Files: `src-tauri/src/commands.rs`, `src/lib/domain/csvExport.ts`,
   `src/lib/adapters/tauriPersistence.ts`

   Problem: the frontend currently obtains a save path and passes it to a
   backend write command. This works, but the command Interface is broader than
   the intended user flow because any frontend caller can provide an arbitrary
   path.

   Solution: consider a backend-owned save Adapter that combines save dialog
   selection and CSV write, after HITL review because this touches filesystem
   behavior.

   Benefits: tighter security Locality around file writes and a clearer Adapter
   seam for future backup/export behavior.
