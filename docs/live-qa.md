# Jira Task Forge Live QA

This checklist covers the native/manual validation path for the current
`origin/main` capabilities. It is intentionally focused on already-accepted
behavior, not new product decisions.

Use `docs/live-qa-results/live-qa-evidence-template.md` to record repeatable
evidence for PR or internal release QA runs.

For the shorter daily-use release gate, start with
[`Internal Release Readiness`](internal-release-readiness.md) and use this file
for the detailed manual steps it links to.

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
- Confirm Jira site URL, account email, and Jira creation project key are shown
  as read-only connection state.
- Open `Set Jira Connection` or `Change Jira Connection`.
- Set Jira site URL, account email, and Jira creation project key `JTFTEST`
  through the guided flow.
- Confirm valid standard Atlassian Cloud roots such as
  `https://salmonsimondts.atlassian.net` are accepted, while invalid paths,
  custom hosts, ports, credentials, query strings, or surrounding whitespace
  show explicit feedback and do not silently persist.
- If project key discovery is unavailable, confirm the guided flow allows a
  warned manual `JTFTEST` project key fallback and saves only after the final
  confirmation.
- Save a Jira API token and confirm the saved state.
- Delete the Jira API token and confirm the missing state.
- Re-save the Jira API token.
- Use `Test connection` and confirm the loading state resolves successfully.
- Confirm supported AI provider/model settings are explicit. For Personal v1
  this may include OpenAI, Anthropic Claude, and Google Gemini depending on the
  current build.
- For each provider being smoke tested, save an API key and confirm the saved
  state, delete it and confirm the missing state, re-save it, and use the
  provider connection test when available.
- Restart the app and confirm non-secret connection state and AI provider
  settings persist.
- If saved-token state is unexpectedly missing after a Windows, WSL, Tauri, or
  worktree session change, follow the non-secret recovery steps in
  [Credential and Keyring Recovery](keyring-recovery.md).
- Export a backup after credentials are configured and confirm Jira and AI
  secrets are excluded. Non-secret settings may be present.

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
- Edit the task title from task detail and confirm the stored title does not
  duplicate the generated Jira summary prefix.
- Archive, restore, and delete trays, including risk-aware delete confirmation
  copy.

## Assisted Description QA

- Open an editable task detail window.
- Confirm empty assisted-description sections are editable and can be saved.
- Generate or draft an assisted description with enough context for a useful
  result. Confirm the final description uses the fixed Jira description shape
  and remains editable before sync.
- Generate or draft from sparse context and confirm the flow asks for targeted
  clarification instead of inventing missing details.
- Confirm the read view renders Markdown, while edit/review surfaces still allow
  direct manual changes.
- Confirm proposal/review history is local app state and is not presented as a
  Jira comment or separate Jira upload artifact.
- Confirm a task with `descriptionStatus = Missing` appears in preflight as a
  missing-description review item.

## Sub-Task QA

- Open a parent Story/Bug task detail window and add one or more sub-tasks.
- Confirm sub-tasks appear in the `Sub-tasks` section with sync status badges.
- Confirm a sub-task can be deleted while editable.
- Confirm created sub-tasks cannot be deleted from the local tray.
- Confirm a sub-task does not expose the add-sub-task control.
- Confirm JSON backup export/import preserves sub-task parent relationships.
- In Jira preflight, confirm the `Sub-task creation` summary groups sub-tasks
  under the correct parent task title, including when the parent is outside the
  currently filtered sub-task list.

## Attachment QA

- Open an editable task detail window and use `Attach files`.
- Confirm the desktop app uses a native file picker and copies selected files
  into managed attachment storage without typed manual paths.
- Confirm the attachment list shows file count, AI-context count, Jira-ready
  count, filename, size, and purpose.
- Change purpose between `AI only`, `Jira attachment`, and
  `AI + Jira attachment`; confirm counts and labels update.
- Delete an editable attachment and confirm the metadata disappears from the
  task.
- Confirm deleting a pending/failed/exported task also removes its attachment
  metadata and managed attachment files.
- Confirm backup export/import preserves attachment metadata and usable managed
  attachment files.
- Try a symbolic link or a file from Jira Task Forge internal app data only if
  the QA environment can do so safely. These should be rejected by Personal v1
  policy; record any accepted file as a follow-up.
- For Jira-ready attachments, run preflight and confirm Jira attachment settings
  are checked. Empty files, missing managed files, disabled Jira attachments, or
  files above Jira's reported upload limit should block creation.
- For `AI only` attachments, confirm Jira attachment settings are not required
  for sync and the files are not uploaded to Jira.
- For `Jira attachment` and `AI + Jira attachment` files, confirm a successful
  Jira run uploads them to the created or repaired Jira issue and records
  `jira.attachment.uploaded` audit events.
- Current implementation note: successful upload records metadata/audit results,
  but does not yet delete the local managed file after upload. If product
  cleanup policy is being tested, record that as a follow-up rather than a
  passing expectation.

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
  requires explicit selection: exclude parent tasks with missing descriptions or
  include them in the run.
- Confirm exported tasks are excluded from API creation by default and require
  explicit inclusion because of CSV duplicate risk.
- Confirm failed tasks are shown as retry candidates with their existing local
  identity.
- Confirm epic resolution warnings group by `[{Project}] {Area}` target and
  expand to task titles only when review is useful.
- Confirm metadata failures block before creating Jira issues when required
  issue types or fields are unavailable.

## JTFTEST Write QA

- Create a fresh tray with one Story-like task, one Bug task, at least one
  sub-task under a parent, one `AI only` attachment, and one Jira-ready
  attachment.
- Open `Create in Jira`.
- Confirm the preflight target is `JTFTEST`.
- Confirm missing descriptions require explicit acknowledgement.
- Confirm sub-task creation counts are visible before starting.
- Start creation.
- Verify required epics are resolved or created as `[{Project}] {Area}`.
- Verify parent Story/Bug issues are created in `JTFTEST`.
- Verify accepted/present sub-tasks are created after their parent issues and
  have the Jira parent relationship.
- Verify Jira-ready attachments are uploaded to the matching created Jira issue
  when upload is enabled and within size limits.
- Verify `AI only` attachments are not uploaded.
- Verify local tasks become `Created`.
- Verify Jira keys and links persist after app restart.
- Verify created tasks do not expose duplicate/delete actions.
- Verify task sync audit activity includes metadata preflight, epic resolution,
  parent issue creation, sub-task creation, attachment upload results, and any
  non-blocking warnings.

## Partial Failure QA

- Create a tray with one normal parent task and one intentionally invalid task,
  such as an overlong summary likely to exceed Jira validation limits. Include a
  child sub-task under the invalid parent if testing dependency behavior.
- Run `Create in Jira` against `JTFTEST`.
- Expected result: the valid task is `Created`, the invalid task is `Failed`,
  dependent sub-tasks without a parent Jira key fail or pause, and the result is
  partial.
- Move failed tasks to a recovery tray.
- Confirm the failed task is moved rather than copied, preserving the same
  local task identity where the UI exposes it.
- Confirm the original tray keeps successfully created tasks and the recovery
  tray contains only failed/paused problem tasks.
- Retry from the recovery tray after correcting the issue and confirm duplicate
  prevention uses the existing local identity and Jira links where available.

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
