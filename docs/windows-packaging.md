# Windows Packaging

This is the shortest safe path for producing a Personal v1 Windows installer for Jira Task Forge. It intentionally covers a local/team installable build only; public store distribution, autoupdate, Jira OAuth or enterprise auth, and a formal security review remain out of scope for Issue #153.

## Current Status

The prerequisite workflow/docs gates for Issue #153 are complete:

- Issue #138 documentation alignment is closed.
- Issue #139 JTFTEST live workflow QA is closed.
- Issue #179 catalog-source maintenance reference is closed.
- The approved final icon set is present in `src-tauri/icons/`.

The remaining Issue #153 acceptance work is final install smoke on Windows.
The installer itself can now be produced from WSL through the cross-packaging
command below, or from a native Windows packaging host.

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

From WSL/Linux, the plain `npm run package:windows` command compiles the local
Linux release binary, not the Windows installer. Use the cross-packaging command
below when building the Windows NSIS installer from WSL.

Current WSL evidence:

- `npm run package:windows` completed successfully on WSL.
- The command produced `src-tauri/target/release/jira-task-forge`.
- That artifact is an ELF Linux executable, not a Windows installer.
- No `.exe`, `.msi`, or `src-tauri/target/release/bundle/nsis/` artifact was emitted.
- `npm run package:windows:cross` completed successfully on WSL.
- The cross-packaging command produced
  `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Jira Task Forge_0.1.0_x64-setup.exe`.
- The installer artifact is a PE/Windows Nullsoft Installer self-extracting archive.

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

To build the NSIS installer from WSL instead, run:

```bash
npm run package:windows:cross
```

This command prepares portable build tools under `/tmp/codex-windows-packaging-tools`,
adds the `x86_64-pc-windows-msvc` Rust target when missing, installs
`cargo-xwin` when missing, and runs:

```bash
npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis
```

The expected cross-build output path is:

```text
src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Jira Task Forge_0.1.0_x64-setup.exe
```

Cross-compilation is still experimental in Tauri and the generated installer is
unsigned. Treat the installer as suitable for local final-user smoke, not as a
signed public distribution artifact.

## Install Smoke

After building the installer:

1. Install `Jira Task Forge_0.1.0_x64-setup.exe`.
2. Launch `Jira Task Forge` from the Start menu or installer completion action.
3. Confirm the app icon appears in the installer/start surface and app window.
4. Open Settings and confirm connection state is shown without exposing Jira or AI secrets.
5. Open Categories and the Notion catalog source setup entry point, including the `Connect Notion` OAuth flow entry point.
6. Open Trays, create or select a Preparation Tray, and navigate local tray/task flows without using `npm run tauri dev`.
7. Save a fake or dedicated test Jira API token, uninstall the app, reinstall
   it, and confirm Settings does not show a reusable saved Jira credential until
   a token is saved again. Repeat for any AI provider key or Notion OAuth access
   token included in the release smoke account.

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
- `integration-token.jira-task-forge:notion` for the saved Notion OAuth access token

The hook deletes by target name only. It does not enumerate, read, print, or
export credential values.

Opening the app with fresh or manually reset local app data does not delete
credential-store entries by itself. Credential cleanup is tied to the packaged
Windows uninstall path so it runs during an explicit uninstall instead of an
ordinary app launch.
