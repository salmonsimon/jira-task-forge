# Jira Task Forge Next Steps

This document is the default execution path for the repo. It is meant to support AFK implementation through parallel branches while keeping architecture and security-sensitive decisions human-in-the-loop.

## Current Checkpoint

Date: 2026-07-05

Main is up to date through:

```text
#144 Add official area catalog sync foundation
```

Recent Personal v1 hardening merged since the older May checkpoint:

- PR #107 added local/manual dependency audit commands and frontend Vitest/V8 coverage reporting.
- PR #108 added a reusable live QA evidence template and linked it from the live QA checklist.
- PR #109 documented the local AFK worktree-thread workflow in `AGENTS.md`.
- PR #110 added keyring recovery documentation for Jira and AI credentials.
- PR #111 enforced strict Jira Cloud Site URL validation, hardened external Jira issue links against the configured site host, and made Site URL editing explicit with a `Save` action. The later HITL decision for #112 supersedes direct Settings edits with a guided connection flow.
- PR #115 refreshed the live QA checklist for the current capability set.
- PR #116 synced docs with current capabilities after the URL-hardening and
  guided-connection decisions.
- PR #117 added the internal release readiness gate for daily-use checks.
- PR #118 documented current HITL product decisions, including the Jira
  description format direction and guided connection setup.
- PR #119 added the repeatable 200-task large-tray smoke scenario for local
  performance/usability checks without mutating `DTS`.
- PR #120 recorded Windows-native backup/import dialog smoke evidence,
  including Computer Use/Tauri limitations and the Windows-native setup path.
- PR #121 added the realistic backup/restore drill and focused backend backup
  seam coverage.
- PR #124 added a minimal Tauri CSP and finished the related manual QA fixes
  for Settings theme switching, external Settings help links, light-mode
  button/dropdown presentation, and CSV export cancel feedback.
- PR #125 centralized sync audit detail shaping behind allowlisted/redacted
  builders and capped long activity details to keep failures readable.
- PR #126 polished Assisted Description toward the DTS Jira format, removed
  stale SRS/SRE Lite framing, hid proposal-created noise from the user-facing
  proposal log, and kept no-change AI proposals from being persisted.
- PR #127 refreshed the roadmap after the first hardening batch.
- PR #128 landed the guided `Set Connection` flow from issue #112: Settings now
  shows Jira Site URL, account email, Jira creation project key, and token state
  as read-only connection state; the wizard validates the Atlassian Cloud site
  root with explicit feedback, verifies the saved token, discovers project keys
  with manual fallback, saves connection fields together only at review, keeps
  Jira API token handling separate, and exposes the in-app `Privacy &
  Diagnostics` detail view.
- PR #129 refreshed the roadmap after the guided connection checkpoint.
- PR #131 added attachment source validation for Jira-ready uploads.
- PR #130 added safer Jira parent retry recovery through remote correlation
  markers, candidate issue search, REST property verification, and safe failure
  when a retry cannot be reconciled confidently.
- PR #142 refreshed the roadmap for the workflow AFK batches.
- PR #143 clarified that the catalog uses official final labels and should not
  keep deprecated labels selectable.
- PR #144 added the official area catalog sync foundation: versioned catalog
  data, Notion API sync through a stored integration token, Settings Notion
  synchronization setup, catalog-managed Areas, safe normalization,
  delivery-format mappings, conditional Arquitectura formats, Bug/Story
  issue-type derivation, Assisted Description/Jira payload catalog context, and
  live Notion/OpenAI/JTFTEST verification.

Historical baseline from the first checkpoint:

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
- `cargo test` passes in the current WSL checkout. As of the current checkpoint,
  the Rust suite has 171 tests covering SQLite schema/repositories, settings
  defaults, Jira URL and error helpers, guarded Jira parent/sub-task sync, Jira
  credential debug redaction, sync audit error redaction/capping, backend delete
  protection for created tasks, command/model/db helper behavior, service-layer
  local-first workflows, backup behavior, and OpenAI integration helpers.
- Rust coverage is measured with `npm run coverage:rust`. The current
  Rust line coverage is 80.40%; see `docs/coverage-report.md`.
- `npm test` passes in WSL with 102 frontend tests across 25 files. The script pins
  `TMPDIR` to `/tmp` by default so Vitest does not inherit a Windows temp path
  that is not creatable from WSL.
- Frontend coverage reporting exists through `npm run coverage:frontend` using
  Vitest/V8. It is advisory-only for Personal v1; current all-files frontend
  line coverage is 20.53%.
- Playwright screenshots are blocked in the current WSL environment by missing Chromium runtime library `libnspr4.so`.
- Computer Use can inspect text for the Windows-native Tauri app, but direct
  screenshot/click automation for native Save/Open dialogs failed in the
  2026-06-14 smoke with `SetIsBorderRequired failed: Interfaz no compatible
  (0x80004002)`. Treat native dialog automation as manual/HITL unless a future
  preflight proves screenshot capture works.
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
`docs/live-qa.md`. Use `docs/internal-release-readiness.md` as the shorter
internal daily-use readiness gate after a batch of PRs lands. Summary:

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
- For a repeatable backup/restore drill with realistic local data, use
  `docs/backup-restore-drill.md`.
- Visit `JQL`, `Categories`, and `Settings` and confirm navigation still works.
- Confirm Settings shows Jira Site URL, account email, and Jira creation project
  key as read-only connection state.
- Use `Set Jira Connection` or `Change Jira Connection` to set a standard
  Atlassian Cloud site root, account email, and `JTFTEST` project key; confirm
  invalid URL shapes show explicit feedback and do not silently persist.
- Save non-secret Jira connection state and confirm it persists across app
  restart.
- Save, delete, and re-save a Jira API token through the OS credential store.
- Save, delete, and re-save an OpenAI API key through the OS credential store.
- Test Jira connection from Settings after entering a real Jira site, email, and token.
- Test OpenAI connection from Settings after entering a real provider key.
- Run a direct JQL query from the JQL tab and confirm Jira results populate the table.
- Save, rename, delete, and reuse a JQL favorite.
- Use Ask AI in the JQL tab and confirm it drafts a query without running it automatically.
- Open `Create in Jira` preflight and confirm missing credentials, missing creation project, and missing task fields produce blocking warnings.
- Against `JTFTEST`, confirm preflight can create missing epics, create parent
  Story/Bug issues, create accepted sub-tasks, upload selected Jira-ready
  attachments, persist Jira keys locally, and move failed tasks to a recovery
  tray without duplicating them.
- Re-check that Settings token actions, Settings connection test, direct JQL,
  and Create in Jira show loading before blocking work and remain responsive
  enough after the command worker split.
- After the API create path has live QA, test that Jira's admin CSV importer can
  still use exported CSV files manually. This is intentionally lower priority
  than API creation.

Expected limitations right now:

- `Create in Jira` creates required epics, parent Story/Bug issues, accepted
  sub-tasks, and selected Jira-ready attachments. Live QA should continue to
  cover partial failure and retry behavior for these child operations.
- `Export CSV` is wired and opens a native save dialog.
- JSON backup export/import is wired and the issue #101 drill covers realistic
  trays, Local Tasks, Jira links, JQL favorites, attachment metadata, audit
  summary export policy, and secret exclusion. Current JSON backups do not yet
  copy attachment bytes or restore audit summaries into local audit tables.
- SQLite persistence exists for trays, local tasks, and non-secret app settings.
- Jira API token storage exists through the OS credential store.
- Jira connection testing exists through `/rest/api/3/myself`.
- Read-only JQL queries are wired through Jira Cloud REST API v3.
- JQL favorites persistence, session JQL history, backup/import, sync progress,
  task sync audit activity, OpenAI settings, and Ask AI JQL drafting are wired.
- Catalog-managed Areas, Notion synchronization, remote correlation marker
  recovery, attachment source validation, guided Jira Connection setup, per-task
  assisted description structure/proposal logs, local sub-task editing, managed
  attachment ingestion, Jira attachment upload, minimal CSP, sync audit detail
  allowlisting, and setup-time `Privacy & Diagnostics` have landed and still
  need regular native/live QA coverage. Remaining open roadmap slices are now
  tracked in GitHub issues: popup/modal visual audit and standardization,
  Escape/sidebar polish, Jira Verify/Token ordering, AI Provider setup modal,
  read-only Jira catalog drift audit, tray selector nested button markup, Story
  vs Bug description template separation, Epic Scope modeling, docs alignment,
  JTFTEST workflow QA, and local data cleanup/storage inventory.
- Task detail `Details` supports editable project, area, and priority for editable non-archived tasks. Auto-generated epic and labels remain visible but muted/read-only.

Near-term decided follow-ups:

- Keep Jira API creation ahead of manual CSV import fallback validation.
- Preserve CSV export as a fallback, then verify Jira admin CSV import manually
  after the API path is working.
- Use `JTFTEST` as the real Jira write sandbox. Agents may mutate `JTFTEST`
  without asking; `DTS` is read-only reference data only.

Recommended next implementation:

- Issue #150 first slice: do a visual audit before any popup/modal
  standardization implementation. Capture screenshots of all reachable
  popup-like surfaces, including centered modals, setup guides, side panels,
  dropdowns, popovers, notices, and task focus windows. Group them by
  interaction pattern and wait for Saimon to choose the target pattern before
  consolidating components.
- Issue #149: complete or verify Escape behavior for Settings, Categories, and
  nested modals. This is small and pairs naturally with the popup audit because
  it documents current overlay behavior before standardization.
- Issue #147: clarify the Jira setup guide order and responsibilities for
  Verify vs Token. Current code still has `Verify` before `Token`, so this
  should remain a focused UX/logic slice.
- Issue #146: create the reusable AI Provider setup modal after the popup audit
  chooses the preferred setup/modal pattern. This avoids building another
  one-off surface before standardization.
- Issue #152: open the Notion synchronization setup guide directly when
  Categories Sync is blocked by missing Notion configuration. This keeps the
  sync action tied to the setup needed to complete it.
- Issue #140: fix the tray selector nested button markup independently. It is
  frontend markup/accessibility debt and can run without product decisions.
- Issue #134: separate the exact Story and Bug Assisted Description templates.
  PR #144 added catalog delivery-format context, but the backend still validates
  a single Story-shaped target template, so this issue remains open.
- Issue #132: implement Epic Scope modeling as its own HITL-sensitive slice
  because it changes local modeling, preflight grouping, Jira epic search/create,
  and sync tests.
- Issue #103: add the local data cleanup and storage inventory note. Keep it
  documentation-only and avoid destructive cleanup UI or commands.
- Issue #138: keep docs alignment as a follow-up after the remaining behavior
  changes land. This roadmap refresh does not close the full workflow
  documentation issue.
- Issue #139: run live JTFTEST workflow QA only after the workflow model slices
  it depends on are implemented.
- Issue #153: package the Windows app and choose/apply the final icon after
  Issue #138 and Issue #139, so the shareable build reflects the reviewed docs
  and live QA evidence.
- Regularizacion is out of scope for now and is no longer a planned roadmap
  slice. Do not block any current issue, QA path, or documentation update on
  Regularizacion behavior.

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

Branch: follow-up `codex/...` slices as needed

Owns:

- `src-tauri/src/integrations/ai/`
- internal prompt templates
- Tauri commands for description generation, missing-info review, sub-task
  suggestions, and JQL generation

Goal:

- Maintain explicit user-triggered AI actions only.
- Keep prompts named and internal so they can become configurable later.
- Continue QA and targeted polish for implemented JQL drafting and Assisted
  Description generation/proposal review before adding broader AI planning.

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
5. Re-check sub-task creation and attachment upload in live QA against `JTFTEST`.
6. Continue backup/import and attachment filesystem hardening under the accepted ADR contracts.
7. Add categories/JQL favorites persistence if needed to support Jira read-only workflows.
8. Continue QA and polish for implemented AI-assisted descriptions and JQL
   generation; add hardcoded 3D sub-task suggestions as a separate follow-up.

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
- weaken the production Tauri CSP or add new frontend network permissions
- add update/installer behavior
- change branch protection, CI gates, release gates, or local Git guard behavior

Current E2E/check policy:

- PR-blocking checks should be fast, deterministic, and actionable.
- Unit/integration tests, builds, formatting, and stable local smoke checks may
  become blocking when they meet that bar.
- Live Jira E2E against `JTFTEST` remains advisory/manual for Personal v1 because
  it depends on credentials, network, remote Jira state, and rate limits.
- Before release or merge of Jira-write behavior, run focused live Jira QA
  manually or as an advisory check. Do not make it an automatic PR gate until it
  is stable enough to fail only on product regressions.

## AFK-Safe Work

These can usually run without interruption when acceptance criteria are clear:

- frontend-only prototype interactions using fake data
- component extraction and styling consistency
- non-destructive read-only domain helpers
- mock adapters and fixtures
- docs cleanup that does not change decisions
- docs refresh that reconciles stale text with accepted decisions on `main`
- initial Internal Release Readiness checklist
- backup/restore drill using realistic local data
- large-tray smoke scenario using 200 Local Tasks
- factual Settings privacy copy that does not change privacy/security policy
- tests for already accepted rules
- tests and coverage around existing behavior
- read-only Jira payload shape exploration without credentials
- real Jira write QA against `JTFTEST` for already accepted Jira sync flows

## Current AFK Batch Plan

Use visible Codex threads backed by separate WSL Git worktrees under
`/home/saimon/Development/...` for AFK implementation. Each slice should use its
own `codex/...` branch, commit its changes, push, and open a draft PR when
done. Do not use opaque in-thread subagents for implementation work.

Batch 1 status:

- `#92` + `#91` Jira Cloud Site URL validation and external Jira issue-link
  hardening: merged in PR #111. Personal v1 accepts only
  `https://<site>.atlassian.net`; custom domains require future HITL.
- `#89` + `#90` supply-chain audit tooling and frontend coverage reporting:
  merged in PR #107. `npm audit` is local/manual only and `npm audit fix`
  requires explicit review.
- `#99` keyring/token recovery docs: merged in PR #110.
- `#104` live QA evidence templates: merged in PR #108.
- `#93` Minimal Tauri Content Security Policy: merged in PR #124.
- `#88` Sync Audit Log detail allowlist and redaction: merged in PR #125.
- Assisted Description DTS-format polish: merged in PR #126.
- `#112` guided Jira Connection setup: landed in PR #128. `Set Connection` is
  now the user-facing path for Site URL, account email, and Jira project key
  setup. Settings shows those values as read-only connection state, the wizard
  saves only at review, manual project-key fallback exists when discovery is
  unavailable, API token management remains separate, and `Privacy &
  Diagnostics` is available inside the guide.

Roadmap cleanup status after PR #144 and issue review:

- Issue #102 visible Settings privacy copy: closed after PR #128 because
  `Privacy & Diagnostics` is the accepted setup-time explanation for Personal
  v1. Do not add a permanent main Settings privacy block unless product scope
  changes.
- Issue #135 Regularizacion flow: closed as not planned. Regularizacion is out
  of current JTF scope and should not appear as a pending roadmap dependency.
- Issue #136 Arquitectura templates and Issue #137 frequent task templates:
  closed after PR #144 because the official catalog now provides delivery
  formats, conditional Arquitectura Brief/Propuesta Final resolution, and
  Assisted Description template context.
- Issue #148 Notion private sync: closed after PR #144 because Notion API sync
  with an OS credential-store integration token is implemented.
- Issue #134 remains open because PR #144 added catalog delivery-format context,
  but the backend still uses one Story-shaped target Markdown template for
  Assisted Description validation.

Recommended AFK batches from the current open issues:

Batch 1: low-conflict AFK launch set.
Issues: Issue #152, Issue #140, Issue #103, and Issue #150.
Scope: route missing Notion setup directly from Categories Sync, fix tray
selector nested buttons, document local storage/cleanup inventory, and capture
the popup/modal screenshot audit. These can run in parallel because their file
ownership and validation paths should barely overlap.
Stop condition: Issue #150 stops at the visual inventory; choosing the final
modal pattern requires Saimon review before implementation standardization.

Batch 2: setup and overlay polish.
Issues: Issue #149, Issue #147, and Issue #146.
Scope: verify/fix Escape and nested overlay behavior, clarify Jira Verify/Token
setup ordering, and add the AI Provider setup modal using the Jira/Notion setup
visual family. Issue #146 should use a two-step flow: choose provider/model,
then set and test the API key.

Batch 3: workflow model slices.
Issues: Issue #134 and Issue #132, followed by Issue #138 and Issue #139.
Scope: first separate exact Story/Bug templates, then implement Epic Scope
modeling with the already-decided `[{Project}] [{Area}] {Scope}` rule. Only
after those behavior changes land should docs alignment and JTFTEST live
workflow QA be treated as closing candidates.

Final packaging slice.
Issue: Issue #153.
Scope: choose/apply the final app icon and package a Windows-ready build after
Issue #138 and Issue #139, so the app can be shared directly with the team
without `npm run tauri dev`.

Already landed from the earlier batch plan:

- `#100` Internal Release Readiness checklist: merged in PR #117.
- `#101` backup/restore drill with realistic local data: merged in PR #121.
- `#105` large-tray performance smoke scenario using 200 Local Tasks: merged in
  PR #119.

## Next Slice

Recommended next implementation slice:

Branch family:

- `codex/popup-surface-audit`

Deliverables:

- Issue #152: open Notion setup directly from Categories Sync when sync is
  blocked by missing Notion configuration.
- Issue #140: fix invalid nested tray selector button markup.
- Issue #103: document local storage/cleanup inventory.
- Issue #150: capture and document screenshots of the current popup/modal/setup
  surfaces before changing the design system.

Reason:

- These four tasks are independently executable, low-conflict, and already have
  enough scope to launch in separate WSL worktrees as visible AFK threads.

## Following Slice

Recommended following implementation slice:

Branch family:

- `codex/ui-correctness-small-fixes`

Deliverables:

- Issue #149: verify/fix Escape behavior for Settings, Categories, and nested
  modals.
- Issue #147: clarify Jira setup Verify/Token ordering and messages.
- Issue #146: add the AI Provider setup modal after the visual audit has a
  chosen pattern.

Reason:

- These are related setup/overlay polish tasks. They can run after Batch 1, with
  Issue #146 gated by the visual pattern decision from Issue #150.

Separate hardening follow-up:

- Keep remote correlation marker recovery and attachment source validation under
  regular native/live QA because both have landed and protect Jira write safety.
- Revisit broader Jira issue relationships only after the current popup/setup
  polish and workflow model issues are settled.

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
- Decide where the next useful test seams live before adding relationship sync,
  attachment cleanup/compression hardening, or additional AI provider calls.
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
   from small tests around accepted sync rules, and less risk when maintaining
   child-issue creation, attachment upload, and future Jira relationship sync.

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
