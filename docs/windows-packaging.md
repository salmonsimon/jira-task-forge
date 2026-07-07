# Windows Packaging

This is the shortest safe path for producing a Personal v1 Windows installer for Jira Task Forge. It intentionally covers a local/team installable build only; public store distribution, autoupdate, OAuth or enterprise auth, and a formal security review remain out of scope for Issue #153.

## Current Gate

Issue #153 packaging must stay draft / not merge-ready until Issue #179 is merged. Issue #179 provides the catalog-source maintenance reference that should ship with the packaged app.

## Icon Assets

The final app icon source is a transparent-background PNG and lives at:

```text
src-tauri/icons/icon.png
```

Tauri-generated bundle assets live in the same directory, including `icon.ico` for Windows installers and the `Square*Logo.png` / `StoreLogo.png` assets used by Windows packaging surfaces. Regenerate them after changing the source icon with:

```bash
npx tauri icon src-tauri/icons/icon.png
```

If the command creates mobile-only `src-tauri/icons/android` or `src-tauri/icons/ios` folders during this Windows packaging slice, remove those generated folders before committing unless mobile packaging becomes an explicit scope.

## Local Preflight

Run from the WSL checkout or WSL worktree being validated:

```bash
npm ci
npm run build
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

This validates the React app, TypeScript build, frontend tests, and Rust backend tests. It does not prove the Windows NSIS installer launches on Windows.

From WSL/Linux, Tauri may compile the release binary but cannot emit the Windows NSIS installer; the Linux CLI advertises Linux bundle choices such as `deb`, `rpm`, and `appimage`, not `nsis`. Treat that as expected host limitation, not a passing Windows package verification.

## Build The Windows Installer

The configured Windows package command is intended for a Windows packaging host:

```bash
npm run package:windows
```

The command maps to `tauri build --bundles nsis` and should produce an NSIS installer under:

```text
src-tauri/target/release/bundle/nsis/
```

The expected installer name follows Tauri's product/version naming, for example:

```text
Jira Task Forge_0.1.0_x64-setup.exe
```

If this command is run from WSL and no `.exe` appears under the NSIS bundle directory, run the same repository revision in a Windows packaging environment with Node, Rust, WebView2, and the Tauri Windows prerequisites installed. Do not use Windows Git as repo authority for normal development; preserve the branch and commit from the WSL worktree and treat Windows execution as the packaging host only.

## Install Smoke

After building the installer on Windows:

1. Install `Jira Task Forge_0.1.0_x64-setup.exe`.
2. Launch `Jira Task Forge` from the Start menu or installer completion action.
3. Confirm the app icon appears in the installer/start surface and app window.
4. Open Settings and confirm connection state is shown without exposing Jira or AI secrets.
5. Open Categories and the Notion catalog source setup entry point.
6. Open Trays, create or select a Preparation Tray, and navigate local tray/task flows without using `npm run tauri dev`.
7. Save a fake or dedicated test Jira API token, uninstall the app, reinstall
   it, and confirm Settings does not show a reusable saved Jira credential until
   a token is saved again. Repeat for any AI provider or Notion token included
   in the release smoke account.

Use JTFTEST for any optional Jira write smoke. DTS remains read-only reference data.

## Credential Cleanup On Uninstall

The NSIS package uses `src-tauri/nsis/credential-cleanup.nsh` as an uninstall
hook. Before the uninstaller removes app files, it asks Windows Credential
Manager to delete the app-owned generic credential targets used by the Rust
`keyring` crate:

- `api-token.jira-task-forge:jira`
- `api-key.jira-task-forge:openai`
- `api-key.jira-task-forge:claude`
- `api-key.jira-task-forge:gemini`
- `integration-token.jira-task-forge:notion`

The hook deletes by target name only. It does not enumerate, read, print, or
export credential values.

The backend also purges these same integration credentials when the app starts
with fresh or reset local app data and no persisted settings row. This prevents
a clean reinstall or app-data reset from silently reusing an old credential that
outlived the local settings database.
