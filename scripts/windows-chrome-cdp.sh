#!/usr/bin/env bash
set -euo pipefail

PORT="${JTF_CDP_PORT:-9335}"
WINDOWS_TEMP="/mnt/c/Users/Saimon/AppData/Local/Temp"
WINDOWS_CLIENT_PATH="$WINDOWS_TEMP/jtf-windows-cdp-client.mjs"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_SOURCE="$REPO_ROOT/scripts/windows-cdp-client.mjs"
CHROME_EXE='C:\Program Files\Google\Chrome\Application\chrome.exe'
PROFILE_DIR="C:\\Users\\Saimon\\AppData\\Local\\Temp\\codex-jtf-chrome-$PORT"

usage() {
  cat >&2 <<'USAGE'
Usage: scripts/windows-chrome-cdp.sh <command> [args...]

Commands:
  launch
  version
  list
  inspect
  eval <javascript-expression>
  click <x> <y>
  type <x> <y> <text>
  screenshot <windows-output-path>

Environment:
  JTF_CDP_PORT defaults to 9335.
USAGE
}

if [[ $# -lt 1 ]]; then
  usage
  exit 2
fi

command_name="$1"
shift

if [[ "$command_name" == "launch" ]]; then
  /mnt/c/Windows/System32/cmd.exe /d /s /c start "" "$CHROME_EXE" \
    --remote-debugging-address=0.0.0.0 \
    --remote-debugging-port="$PORT" \
    --user-data-dir="$PROFILE_DIR" \
    --new-window about:blank
  exit 0
fi

cp "$CLIENT_SOURCE" "$WINDOWS_CLIENT_PATH"
/mnt/c/Windows/System32/cmd.exe /d /s /c node "%TEMP%\\jtf-windows-cdp-client.mjs" "$command_name" "$PORT" "$@"
