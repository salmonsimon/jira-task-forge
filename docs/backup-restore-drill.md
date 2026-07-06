# Backup/Restore Drill

Issue: [#101](https://github.com/salmonsimon/jira-task-forge/issues/101)

This drill proves the current Personal v1 JSON backup path with realistic local
Jira Task Forge data. It does not require live Jira and must not mutate `DTS`.
Live Jira checks against `JTFTEST` are advisory only.

## Scope

Covered by the implemented backup format:

- Preparation Trays and Local Tasks.
- Created-task Jira keys, Jira URLs, and epic keys.
- JQL Favorites.
- Non-secret Settings, including Jira Site URL, account email, Jira Creation
  Project Key, AI provider, and AI model.
- Attachment metadata and managed relative paths.
- Redacted Sync Audit Log summaries.
- Manifest-level secret exclusion with `secrets_included: false`.

Known implementation gaps to check explicitly:

- Attachment bytes are intentionally not copied by the Personal v1 JSON backup;
  the drill verifies metadata and managed paths only.
- Sync Audit Log summaries are exported and reviewed during import, but are not
  restored into `sync_audit_events` yet. Import reports them under
  `skipped_counts.auditSummaries` with a warning.
- Jira and AI credentials are intentionally excluded. Restored data should still
  require reconnecting integrations from Settings.

## Automated Seam

Run the focused backend test:

```bash
cargo test --manifest-path src-tauri/Cargo.toml realistic_backup_restore_drill_keeps_local_data_useful_without_secrets
```

The test seeds an in-memory database with a realistic recovery set:

- one tray named `Backup restore drill 2026-06-14`;
- one `Created` Bug linked to `JTFTEST-101`;
- one pending Story with `AI + Jira attachment` metadata;
- one JQL Favorite for `project = JTFTEST ORDER BY created DESC`;
- non-secret Jira and AI settings;
- one Sync Audit Log event whose detailed JSON contains secret-shaped values.

Expected result:

- export succeeds with `secrets_included: false`;
- serialized backup JSON does not contain the secret-shaped Jira token or AI key;
- restore imports the tray, both tasks, the JQL Favorite, settings, and
  attachment metadata;
- restored task data keeps the Jira key and Jira URL useful;
- audit summaries are skipped with the current explicit warning.

## Manual Native Drill

Use a fresh local tray and avoid live Jira unless you intentionally run the
advisory `JTFTEST` check.

1. Start the native app:

   ```bash
   npm run tauri dev
   ```

2. In Settings, set non-secret values:

   - Jira Site URL: `https://salmonsimondts.atlassian.net`
   - Jira Creation Project Key: `JTFTEST`
   - AI provider/model values if available

3. Create a tray named `Backup restore drill <YYYY-MM-DD>`.

4. Add realistic Local Tasks:

   - `STT` / `Bug` / `Preserve Jira-created bug link` / `High`
   - `PilotLab` / `3D` / `Keep local attachment metadata` / `Medium`

5. Create or preserve at least one Jira-linked task. Prefer using existing local
   data from a previous `JTFTEST` write smoke. If a live check is needed, use
   only `JTFTEST`; never mutate `DTS`.

6. Add a JQL Favorite:

   ```jql
   project = JTFTEST ORDER BY created DESC
   ```

7. Add or preserve an attachment metadata example on a local task. The current
   JSON drill checks filename, purpose, size, hash when present, and managed
   relative path. It does not require restoring duplicate attachment bytes after
   Jira upload.

8. Export a JSON backup through the app.

9. Inspect the backup file:

   - `manifest.app` is `jira-task-forge`;
   - `manifest.format_version` is `1`;
   - `manifest.secrets_included` is `false`;
   - `manifest.warning` says Jira and AI credentials are excluded;
   - `data.tasks` includes the expected Local Tasks and Jira link fields;
   - `data.jql_favorites` includes the saved favorite;
   - `data.attachment_metadata` includes expected metadata;
   - `data.audit_summaries` exists when sync audit history exists;
   - no Jira API token, OpenAI key, authorization header, or raw credential
     value appears anywhere in the JSON.

10. Import the backup into a clean or disposable app data profile.

11. Confirm restored data:

    - the tray appears and remains editable where expected;
    - Local Tasks retain project, area, title, priority, sync status, and
      content language;
    - created tasks still show useful Jira keys and links;
    - the JQL Favorite can be reused;
    - attachment metadata appears as metadata/history, with missing-byte
      warnings handled as a local preflight concern when applicable;
    - the import result reports audit summaries as skipped with the current
      warning instead of silently claiming they were restored;
    - Jira and AI credentials are absent and Settings requires reconnection.

## Remaining Manual-Only Checks

- Native dialog behavior for choosing export/import paths.
- Visual confirmation that restored links and attachment metadata are clear to
  the user.
- Any live Jira create/read verification, limited to `JTFTEST`.
- Attachment-byte restore is out of scope for the accepted Personal v1 backup
  format unless a future product review reopens it.
