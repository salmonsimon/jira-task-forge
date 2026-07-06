# Local Data Storage Inventory

Issue: [Issue #103](https://github.com/salmonsimon/jira-task-forge/issues/103)

Jira Task Forge is local-first. Local data lives under the app data directory
resolved by Tauri and the operating system, not under a hard-coded project or
Windows path. Development runs, packaged builds, different app identifiers, WSL
sessions, and Windows user profiles may resolve to different app data roots.
Use the app/Tauri platform APIs as the source of truth for the actual root.

Do not manually delete app data while a tray, sync, import, backup, or
attachment operation is active. If local cleanup is needed before a reviewed
cleanup feature exists, first export a backup and close the app.

## Storage Areas

### SQLite data

The normal local database is stored under the app data root at the conceptual
path:

```text
data/jira-task-forge.sqlite3
```

SQLite owns Preparation Trays, Local Tasks, task details, sub-tasks, local issue
relationships, categories, epic mappings, JQL favorites, non-secret settings,
attachment metadata, assisted description proposals/logs, sync attempts, and
Sync Audit Log events.

SQLite does not store attachment file bytes or integration secrets. The database
may create SQLite sidecar files such as WAL or shared-memory files while the app
is running. Treat those sidecars as part of the database and do not delete them
manually.

### Settings

Non-secret settings live in SQLite. Examples include theme, Jira Site URL,
account email/display metadata, Jira Creation Project Key, selected AI provider,
model names, credential-present flags, and last connection check metadata.

Jira API tokens and AI provider keys do not live in SQLite or backups. They are
stored through the operating system credential store via the Rust/Tauri backend.
After restoring a backup, reconnect Jira and AI providers from Settings.

### Backups and exports

Current implemented backups are JSON files chosen by the user through the native
save dialog. They include local trays/tasks, categories, epic mappings, JQL
favorites, non-secret settings, attachment metadata, and redacted audit
summaries where available. They exclude Jira and AI credentials.

ADR 0006 now defines the Personal v1 backup format as a versioned JSON file
without secrets or attachment bytes. Earlier archive-based backup notes are no
longer planned for the current roadmap.

Backup files selected by the user are portable artifacts. They are not an
automatic cleanup mechanism and should not be edited in place as a substitute
for app import/export flows.

### Logs and diagnostics

Sync Audit Log entries are stored as structured, redacted SQLite records. They
are retained while the related tray exists. Archived trays keep their audit
history. Deleting a tray removes local tray data and related audit history.

Temporary diagnostic logs, when explicitly enabled for development/debugging,
belong under the conceptual area:

```text
logs/diagnostics/
```

Diagnostics must remain redacted, off by default, excluded from backups, and
must not include secrets, raw authorization headers, full Jira/AI request
bodies, full AI prompts, attachment bytes, or raw credential values.

### Managed attachments

Attachment bytes are filesystem files managed by the app under the app data
root. SQLite stores metadata and managed relative paths only.

The accepted conceptual layout is:

```text
attachments/
  originals/
  compressed/
  staging/
```

The current implementation stores managed attachment files under relative paths
rooted at `attachments/` and validates that stored paths cannot escape managed
storage. Backup import staging uses:

```text
attachments/staging/imports/{operation_id}/
```

The import operation copies the selected backup into this operation directory,
removes the operation directory after a successful import, and removes staged
file bytes on import failure while leaving a small sanitized `import-error.txt`
evidence file. On app startup, interrupted active staging operations older than
the conservative stale threshold are removed. Cleanup rejects a symlinked
staging root and only removes paths inside app-managed staging.

Files inside app data areas such as `data/`, `settings/`, `credentials/`,
`logs/`, `logs/diagnostics/`, `backups/`, and `attachments/` should not be used
as attachment sources. Choose an external original file instead.

### Generated files

Generated local artifacts include user-selected JSON backups, CSV exports, build
outputs, and test/QA evidence. These are not the primary app store unless a
document says so explicitly.

Repo-local generated folders such as frontend build output, Rust build output,
coverage output, and temporary QA artifacts are development artifacts. Do not
confuse them with the Tauri app data root used by the running app.

## Automatic Cleanup

Implemented behavior:

- Deleting an editable Local Task removes its attachment metadata and managed
  attachment files for that task graph.
- Deleting a Preparation Tray removes managed attachment files for tasks in that
  tray, then removes the local tray/task data.
- Deleting a single task attachment removes the managed file and attachment
  metadata when the task is not `Created`.
- If creating attachment metadata fails after a file copy, the copied managed
  file is removed.
- Successful backup imports remove their managed staging operation directory.
- Failed backup imports remove staged file bytes and retain only a small
  sanitized failure-evidence file under `attachments/staging/imports/`.
- App startup removes stale interrupted attachment staging operations from
  app-managed `attachments/staging/` only.
- Attachment source validation blocks symbolic links, empty files, app-data
  internal sources, unsafe relative paths, and Jira-ready files over the Personal
  v1 100 MB product limit.

Implemented post-sync lifecycle rules:

- After a Jira-ready attachment uploads successfully, Jira Task Forge deletes
  the local managed bytes and keeps metadata/audit history.
- `AI only` attachment bytes are removed when the Local Task becomes `Created`,
  leaving metadata/audit history needed to explain what was prepared.
- Personal v1 JSON backups include attachment metadata and managed relative
  paths, but do not copy attachment bytes.

## Manual Or Pending Cleanup

Manual cleanup is currently limited to existing product actions such as deleting
tasks, deleting trays, clearing individual attachments from editable tasks, or
exporting/importing backups through reviewed flows.

Do not manually delete these while work is active:

- the SQLite database or SQLite sidecar files;
- managed attachment files for active, failed, exported, or unsynced tasks;
- logs needed to diagnose a failed sync;
- backups before confirming a newer backup can be read;
- operating system credential-store entries unless intentionally resetting Jira
  or AI connection state.

The following cleanup ideas remain future HITL work and should not be
implemented without a reviewed product decision:

- an in-app storage inventory view with size breakdowns;
- a confirmed command or UI action to clear old diagnostics;
- a stale attachment/staging file repair tool;
- a tray-level audit log clear action;
- a safe app-data reset workflow that creates or recommends a backup first;
- a post-upload attachment cleanup verifier for Issue #95.

## Windows And WSL Caveats

The repository normally lives in WSL for development, but the running Tauri app
uses an operating-system app data directory. A WSL checkout path, a Windows view
of that checkout, and the app data root are different concepts.

Do not hard-code a Windows user profile path, WSL path, or temporary Codex
worktree path as implementation truth. The app should resolve storage through
Tauri/platform APIs, and documentation should describe conceptual areas relative
to the app data root.

Credentials are especially environment-sensitive. A credential saved in one
Windows user, app profile, packaged build, development run, or worktree session
may not be readable from another. Diagnose credential issues by checking
presence and connection-test status only; never print or copy secret values.
