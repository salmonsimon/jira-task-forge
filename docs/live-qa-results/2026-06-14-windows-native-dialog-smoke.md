# 2026-06-14 Windows-Native Dialog Smoke

## Scope

Goal: verify the Windows-native Jira Task Forge app can open Settings, export a JSON backup through the native Save dialog, import that backup through the native Open dialog, and remain usable after import.

This smoke was requested from a projectless Windows-local Codex thread against the temporary native app copy at C:/Users/Saimon/AppData/Local/Temp/jtf-native-tauri-smoke. Vite was already running at http://127.0.0.1:1422 and jira-task-forge.exe was already alive.

Safety boundary: no credentials entered, no Jira live writes, and no DTS mutations.

## Result

Status: passed by HITL confirmation, partially covered by Codex automation.

Saimon confirmed export and import work without problems after the delegated Computer Use run. Codex automation did not complete the native Save/Open dialog path because Computer Use could not capture screenshots for this Tauri window in that session.

## Codex / Computer Use Evidence

Worked:

- Computer Use found the native Windows process at C:/Users/Saimon/AppData/Local/Temp/jtf-native-tauri-smoke/src-tauri/target/debug/jira-task-forge.exe.
- Computer Use confirmed the target window title was Jira Task Forge.
- UI Automation text was readable from the native app.
- The app exposed Jira Task Forge, Local-first Jira preparation, Settings, Backup and restore, Export backup, and Import backup through accessibility text.
- Keyboard navigation opened Settings.
- Settings showed the backup/restore copy saying JSON backups include trays, tasks, categories, epic mappings, JQL favorites, settings, and attachment metadata, and that secrets are excluded.
- Settings also exposed credential-boundary text: Jira/API and AI keys are stored through the OS credential store and are never included in backups.
- The app remained alive and usable after the attempted automation.

Did not work:

- Computer Use screenshot capture for the Tauri window failed with: SetIsBorderRequired failed: Interfaz no compatible (0x80004002).
- Because screenshot-backed state was unavailable, Computer Use rejected coordinate and element-index clicks with: call get_window_state before issuing coordinate input.
- Codex could not click Export backup, could not verify the native Save dialog directly, could not save the backup file itself, and could not drive Import backup / native Open dialog.
- Keyboard probing changed local UI state while trying to reach controls; one JQL favorite removal message was observed. No Jira query was run and no Jira write occurred.

Tools installed during the delegated Computer Use smoke: none. The smoke used the already-available Computer Use plugin via node_repl. The native app and Vite server were already running before the delegated thread began.

## Host Setup Evidence

Before the delegated Computer Use smoke, Codex prepared a Windows-native Tauri runtime because the normal WSL `npm run tauri dev` app was not enough to automate native Windows Save/Open dialogs:

- Confirmed Windows Node and npm were available: `node v24.15.0` and `npm.cmd 11.17.0`.
- Avoided `npm.ps1` because Windows PowerShell execution policy blocked it; used `npm.cmd` instead.
- Confirmed Visual Studio Build Tools were installed at `C:/Program Files/Microsoft Visual Studio/2022/Community`.
- Installed Rustup for Windows through `winget install --id Rustlang.Rustup --accept-package-agreements --accept-source-agreements --silent` because Windows `cargo`, `rustc`, and `rustup` were not initially on `PATH`.
- Verified the resulting Windows toolchain: `cargo 1.96.0`, `rustc 1.96.0`, and `rustup 1.29.0`.
- Created a temporary native-app copy at `C:/Users/Saimon/AppData/Local/Temp/jtf-native-tauri-smoke`, excluding `.git`, `node_modules`, `target`, `src-tauri/target`, and `dist`.
- Ran `npm.cmd install` and `npm.cmd run build` in the temporary copy.
- Avoided the existing Vite port conflict on `1420` by running the temporary native app on `127.0.0.1:1422`.
- Added a temporary `src-tauri/icons/icon.ico` only inside the temp copy because the Windows Tauri build required it; this file was not added to the repo.
- Used a temporary Tauri config file at `C:/Users/Saimon/AppData/Local/Temp/jtf-tauri-1422.json` to point the native shell at `http://localhost:1422`.
- Launched `C:/Users/Saimon/AppData/Local/Temp/jtf-native-tauri-smoke/src-tauri/target/debug/jira-task-forge.exe` for Computer Use.

This setup was intentionally outside the repo working tree. It was used to make the app a true Windows-native Tauri process while keeping repository changes limited to this evidence file.

## Reusable Smoke-Test Notes

- Start by proving whether the app under test is a WSLg/Wayland window or a true Windows-native process. Computer Use could see the Windows-native `jira-task-forge.exe`; the earlier WSLg route exposed only limited window state and was not suitable for native dialog automation.
- For Windows-native Tauri smokes, prefer a Windows-local temporary copy when the repo lives in WSL and the task specifically requires native Save/Open dialogs.
- Use `npm.cmd` from PowerShell or `cmd.exe` when `npm.ps1` is blocked by execution policy.
- If Tauri/Vite port `1420` is already occupied by another PR smoke, override the dev server port and Tauri dev URL instead of stopping unrelated work.
- Keep temporary build-only files, such as a generated `icon.ico`, out of the repo unless the product actually needs them.
- Run a Computer Use preflight before attempting native dialog clicks: process/window discovery, UI Automation text read, and screenshot capture.
- If Computer Use cannot capture screenshots for a Tauri window, treat it as text-verification only and record that direct native Save/Open dialog automation remains uncovered.

## Manual Confirmation

Saimon later confirmed that Export backup and Import backup work without problems in the Windows-native app.

Backup path produced by Codex: none. Codex did not create the temporary backup JSON because native dialog automation blocked before Save.

## Future Smoke Guidance

Before relying on Computer Use for Windows-native Tauri dialog automation, run this preflight:

1. list_apps and confirm jira-task-forge.exe plus the Jira Task Forge window.
2. get_window_state with include_text true and verify Settings / Backup and restore text.
3. get_window_state with include_screenshot true.

If screenshot capture fails, treat Computer Use as text-verification only for this app session. Use keyboard-accessible flows where possible and ask for HITL confirmation for native Save/Open dialogs instead of spending time on coordinate clicks.

Native dialog coverage still needed from automation: direct Save dialog verification, direct Open dialog verification, and proof of the exported backup path. Product behavior itself was manually confirmed working.
