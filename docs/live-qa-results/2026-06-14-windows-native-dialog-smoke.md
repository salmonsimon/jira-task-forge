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

Tools installed during this smoke: none. The smoke used the already-available Computer Use plugin via node_repl. The native app and Vite server were already running before the delegated thread began.

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
