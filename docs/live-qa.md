# Jira Task Forge Live QA

This checklist covers the native/manual validation path after the PR #47
stabilization work. It is intentionally focused on already-accepted behavior,
not new product decisions.

Use `docs/live-qa-results/live-qa-evidence-template.md` to record repeatable
evidence for PR or internal release QA runs.

## Safety Boundary

- `DTS` is read-only reference data. Agents may run JQL against `DTS`, but must
  not create, update, transition, comment on, or delete `DTS` issues.
- `JTFTEST` is the writable Jira QA sandbox. Agents may create, update, and
  otherwise mutate `JTFTEST` issues for implementation and QA.
- Settings should use `JTFTEST` as the Jira creation project key for any write
  smoke test.

## Automated Baseline

Run these before opening the native app:

```bash
npm install
npm run build
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

Optional coverage check:

```bash
npm run coverage:rust
```

## Native App Start

```bash
npm run tauri dev
```

The native run requires Rust/Cargo, Tauri system dependencies, and an available
desktop session from the WSL environment.

## Settings And Credentials

- Open `Settings`.
- Set Jira site URL, account email, and Jira creation project key `JTFTEST`.
- For Jira Site URL, confirm the field can be edited as a draft and only saves
  after pressing `Save`. Valid standard Atlassian Cloud roots such as
  `https://salmonsimondts.atlassian.net` should save; invalid paths, custom
  hosts, ports, credentials, query strings, or surrounding whitespace should
  show explicit feedback and not silently persist.
- Save a Jira API token and confirm the saved state.
- Delete the Jira API token and confirm the missing state.
- Re-save the Jira API token.
- Use `Test connection` and confirm the loading state resolves successfully.
- Save an OpenAI API key and confirm the saved state.
- Delete the OpenAI API key and confirm the missing state.
- Re-save the OpenAI API key.
- Use the OpenAI connection test and confirm the loading state resolves
  successfully.
- Restart the app and confirm non-secret settings persist.
- If saved-token state is unexpectedly missing after a Windows, WSL, Tauri, or
  worktree session change, follow the non-secret recovery steps in
  [Credential and Keyring Recovery](keyring-recovery.md).

## Read-Only Jira QA

Run direct JQL from the `JQL` tab:

```jql
project = DTS ORDER BY updated DESC
```

Expected result: issues render in the table. Do not perform any mutation against
returned `DTS` issues.

Then run:

```jql
project = JTFTEST ORDER BY created DESC
```

Expected result: issues render in the table.

## JQL Workflow

- Save a direct JQL query as a favorite.
- Rename the favorite.
- Reuse the favorite.
- Delete the favorite.
- Run a few direct JQL queries and confirm recent history updates for the
  current session.
- Switch to `Ask AI`, draft a JQL query from a natural-language prompt, and
  confirm the draft loads into Direct JQL without running automatically.

## Tray And Local Data QA

- Create a tray named with the QA date, for example `Live QA 2026-05-26`.
- Rename the tray.
- Add a task with Quick Capture and confirm it appears as `Pending`.
- Duplicate an editable task and confirm the copy appears after the original
  with `(copy)`.
- Delete `Pending`, `Failed`, or `Exported` tasks.
- Confirm `Created` tasks do not expose duplicate/delete actions.
- Open task detail and confirm it still feels like a focused Jira-style window.
- Edit project, area, and priority from task detail for editable tasks.
- Archive, restore, and delete trays, including risk-aware delete confirmation
  copy.

## Large Tray Smoke QA

Use this scenario for issue #105-style local performance and usability smoke
checks. It is a repeatable synthetic tray with 200 Local Tasks, including
sub-tasks, mixed sync statuses, Projects, Areas, priorities, descriptions,
draft notes, missing descriptions, JTFTEST-style created links, sync logs, and
attachment metadata only. It must not write to `DTS`.

Automated simulation:

```bash
npm test -- largeTraySmoke
```

Preview-mode UI simulation:

```bash
npm run dev
```

Open `http://127.0.0.1:1420` in a browser without native Tauri persistence.
Select `Large tray smoke - 200 Local Tasks` from the tray list. Native persisted
data replaces preview fixtures, so use the automated simulation above if the
desktop app already has local data.

Workflow checks:

- List/render: open the large tray and confirm project groups, status badges,
  priority controls, created links, and attachment indicators remain readable.
- Search/filter: search for terms from titles, descriptions, Projects, Areas,
  Jira keys, and sub-task titles such as `referencias`; matching parent tasks
  should remain in original tray order.
- Task detail: open a pending task, a failed task, an exported task, and a
  created task. Confirm editable/read-only behavior, descriptions, notes,
  attachments, and sync log sections are understandable.
- Preflight open: open `Create in Jira` only as a local preflight review unless
  deliberately testing against `JTFTEST`. Confirm missing descriptions, missing
  epics, failed retries, and exported duplicate-risk warnings are grouped well
  enough to review.
- Tray save/restore: export a backup, import it, and confirm the restored large
  tray keeps task counts, created JTFTEST links, sub-task parent relationships,
  attachment metadata, and audit/sync history useful.

Record observed behavior or rough timings in QA evidence when useful, but do
not invent or enforce a formal performance budget from this smoke scenario.

## Export And Backup QA

- Export CSV from a tray through the native save dialog.
- Confirm exported local tasks move to `Exported`.
- Inspect the CSV enough to confirm it remains plausible for Jira admin import.
- Export a JSON backup.
- Confirm the backup excludes Jira and OpenAI secrets.
- Import the JSON backup.
- Confirm restored trays, tasks, Jira links, JQL favorites, and audit history
  remain useful.

## Preflight QA

- Remove or omit required settings and confirm `Create in Jira` shows blocking
  warnings for missing credentials and missing creation project.
- Add a local task with a missing project, area, or title and confirm blocking
  warnings.
- Restore settings to target `JTFTEST`.
- Add a task without a description and confirm missing-description upload
  requires explicit confirmation.

## JTFTEST Write QA

- Create a fresh tray with one Story-like task and one Bug task.
- Open `Create in Jira`.
- Confirm the preflight target is `JTFTEST`.
- Confirm missing descriptions require explicit acknowledgement.
- Start creation.
- Verify required epics are resolved or created as `[{Project}] {Area}`.
- Verify parent Story/Bug issues are created in `JTFTEST`.
- Verify local tasks become `Created`.
- Verify Jira keys and links persist after app restart.
- Verify created tasks do not expose duplicate/delete actions.

## Partial Failure QA

- Create a tray with one normal task and one intentionally invalid task, such as
  an overlong summary likely to exceed Jira validation limits.
- Run `Create in Jira` against `JTFTEST`.
- Expected result: the valid task is `Created`, the invalid task is `Failed`,
  and the result is partial.
- Move failed tasks to a recovery tray.
- Confirm the failed task is moved rather than copied, preserving the same
  local task identity where the UI exposes it.

## Known Environment Notes

- Native QA may be blocked by missing Tauri/WebKit system packages in WSL.
- Playwright screenshots have previously been blocked by missing Chromium
  runtime library `libnspr4.so`.
- Jira CSV import is a manual/admin fallback; Jira Cloud does not expose a CSV
  file import endpoint equivalent to the admin UI import flow.

## External Jira Issue-Link Hardening

Use a tray such as `QA - Jira URL hardening links` when available. With the
configured Jira site set to `https://salmonsimondts.atlassian.net`:

- `https://salmonsimondts.atlassian.net/browse/JTFTEST-1` may open.
- `https://evil.atlassian.net/browse/JTFTEST-1` must be rejected.
- `https://salmonsimondts.atlassian.net/browse/JTFTEST-1?x=1` must be rejected.
- `https://salmonsimondts.atlassian.net/jira/software` must be rejected.
- `https://salmonsimondts.atlassian.net/browse/JTFTEST` must be rejected.

The app must not mutate DTS during this QA. JTFTEST remains the only allowed
write sandbox.
