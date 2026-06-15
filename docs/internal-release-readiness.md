# Internal Release Readiness

Use this checklist after a batch of PRs lands to decide whether Jira Task Forge
is safe enough for Saimon's daily internal use. It is a release gate, not the
full manual QA script; use [Live QA](live-qa.md) for detailed procedures and
[the evidence template](live-qa-results/live-qa-evidence-template.md) when a run
needs repeatable notes.

## Required Local Baseline

Run from the WSL checkout or worktree being tested:

```bash
npm install
npm run build
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

Also run these when the touched area makes the signal relevant:

```bash
npm run coverage:rust
npm run coverage:frontend
```

The app is not ready for internal release if build, unit/integration tests, or
directly relevant coverage checks fail without a documented reason.

## Native Smoke

Start the native app:

```bash
npm run tauri dev
```

Confirm the app opens and the core local-first workflow still works:

- create or open a Preparation Tray;
- add, edit, duplicate, and delete an editable Local Task;
- open task detail and confirm created/read-only states still make sense;
- open `Create in Jira` and confirm preflight blocks missing credentials,
  missing creation project, and missing required task fields before any Jira
  write.

Native launch can be blocked by local WSL/Tauri desktop dependencies. If that
happens, record the blocker and do not treat browser-only validation as a full
internal release pass.

## Settings And Credentials

Before real use, verify Settings with the live account Saimon intends to use:

- Jira Site URL saves only a valid Atlassian Cloud root.
- Account email and Jira Creation Project Key persist after restart.
- Jira API token can be saved, deleted, re-saved, and tested successfully.
- AI provider key can be saved, deleted, re-saved, and tested successfully when
  AI-assisted features are part of the release.
- Backups and logs still exclude Jira and AI secrets.

If saved credentials disappear after a Windows, WSL, Tauri, or worktree change,
use [Credential and Keyring Recovery](keyring-recovery.md) before release.

## Backup, Export, And Import

Prove the local escape hatches before daily use:

- export a tray CSV and confirm eligible Local Tasks move to `Exported`;
- export a JSON backup and confirm it excludes Jira and AI secrets;
- import the backup and confirm trays, Local Tasks, Jira links, JQL favorites,
  and sync audit history remain useful;
- keep CSV import into Jira as a manual/admin fallback only, per
  [Jira CSV Import Boundary](jira-csv-import-boundary.md).

## Advisory Live Jira QA

Live Jira QA is advisory for internal readiness but should be run before relying
on the app for real daily Jira creation. Follow [Live QA](live-qa.md) instead of
duplicating the full procedure here.

Minimum live boundary checks:

- `DTS` is read-only reference data. It may be queried for real work patterns,
  but must not be created, updated, transitioned, commented on, or deleted.
- `JTFTEST` is the only Jira write sandbox for smoke tests.
- Settings should target `JTFTEST` before any `Create in Jira` write smoke.
- Run bounded read-only JQL against `DTS` and `JTFTEST`.
- Run the `JTFTEST` write smoke only when credentials, preflight, and local
  backup/export checks have passed.

## Release Decision

Treat the internal release as ready only when:

- required local commands pass;
- the native smoke opens the app and covers tray/task/preflight basics;
- Settings and credential tests pass with no secret leakage into backups;
- backup/export/import gives Saimon a recovery path;
- live Jira QA is either passed against `JTFTEST` or explicitly deferred with
  the remaining risk recorded;
- known environment limitations are documented in the release notes or QA
  evidence.
