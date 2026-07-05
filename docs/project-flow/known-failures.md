# Known Failures

## Chrome plugin and Computer Use can fail before JavaScript starts

Observed on 2026-07-03 in `/home/saimon/Development/jira-task-forge`.

Both `chrome:control-chrome` and `computer-use:computer-use` route through the
`node_repl` JavaScript tool. In this thread, even a minimal `node_repl` call
failed before user JavaScript ran:

```text
codex/sandbox-state-meta: sandboxCwd is not a local file URI:
file:///home/saimon/Development/jira-task-forge
```

A separate projectless thread created for PR #223 preview validation reproduced
the same failure from a Windows-mounted cwd:

```text
Mcp error: -32602: js: codex/sandbox-state-meta: sandboxCwd is not a local file URI:
file:///mnt/c/Users/Saimon/Documents/Codex/2026-07-03/pr223-preview-validation
```

Changing from WSL-local to `/mnt/c` is therefore not a sufficient fix. This is
a tool/runtime failure, not a missing plugin file. The plugin scripts
existed at:

- `/mnt/c/Users/Saimon/.codex/plugins/cache/openai-bundled/chrome/26.623.81905/scripts/browser-client.mjs`
- `/mnt/c/Users/Saimon/.codex/plugins/cache/openai-bundled/computer-use/26.623.81905/scripts/computer-use-client.mjs`

Working fallback for browser-only tasks is now captured in:

- `scripts/windows-chrome-cdp.sh`
- `scripts/windows-cdp-client.mjs`

Use it like this:

1. Launch a dedicated Windows Chrome instance with Chrome DevTools Protocol:

   ```bash
   scripts/windows-chrome-cdp.sh launch
   ```

2. Verify CDP from Windows:

   ```bash
   scripts/windows-chrome-cdp.sh version
   ```

3. Inspect the current page:

   ```bash
   scripts/windows-chrome-cdp.sh inspect
   ```

4. Prefer the bounded commands over raw `eval`/`inspect` when working on
   authenticated pages:

   ```bash
   scripts/windows-chrome-cdp.sh info
   scripts/windows-chrome-cdp.sh open https://app.notion.com/p/<page-id>
   scripts/windows-chrome-cdp.sh controls-top --target <target-id>
   scripts/windows-chrome-cdp.sh controls --target <target-id> share
   scripts/windows-chrome-cdp.sh click-text --target <target-id> share
   scripts/windows-chrome-cdp.sh key --target <target-id> Escape
   scripts/windows-chrome-cdp.sh close <target-id>
   scripts/windows-chrome-cdp.sh quit
   ```

   `open` creates a fresh target through Chrome's `/json/new` endpoint and is
   useful when an existing Notion tab still appears in `/json/list` but times
   out on `Runtime.enable` or `Page.enable`. Use the returned target id with
   `--target`; it may be placed before or after command-specific arguments,
   e.g. `controls --target <target-id> share` or
   `controls share --target <target-id>`, so multiple Notion tabs do not cause
   the helper to operate the wrong page. `controls` and `controls-top`
   redact token-looking strings before printing output, but they still must not
   be used on pages where the surrounding authenticated UI is itself sensitive
   unless Saimon has explicitly approved that risk.

5. Use `click`, `type`, or `screenshot` for narrow browser-control actions when
   coordinates are already known:

   ```bash
   scripts/windows-chrome-cdp.sh click 840 168
   scripts/windows-chrome-cdp.sh type 465 367 "Jira Task Forge"
   ```

Windows Node was available (`v24.15.0`) and could drive the dedicated Chrome
session even when WSL could not connect to the CDP port.

Constraints:

- Keep Git, repo reads/edits, tests, and PR decisions in WSL.
- Use Windows only for the dedicated browser-control process.
- Do not automate login credentials.
- Confirm immediately before persistent browser-side changes such as creating
  API tokens, changing cloud permissions, or sharing pages with integrations.

2026-07-03 follow-up: the fallback successfully created a dedicated Chrome
Notion Developers connection named `Jira Task Forge` and safely opened the
`JTF Sync Catalog` Notion page. A newly created Notion connection page can show
secret-bearing token UI; broad DOM inspection of that page was rejected and
should stay blocked unless the user explicitly accepts credential-disclosure
risk for that specific action. Safer commands (`info`, `open`, `controls`,
`controls-top`, `click-text`, `key`, `close`, and `quit`) were added so future
agents can navigate authenticated Chrome state without defaulting to raw page
dumps. A follow-up
validated explicit target selection with both
`controls --target <target-id> share` and
`controls share --target <target-id>`, and validated
`close <target-id>` against a duplicate `JTF Sync Catalog` tab. Use `quit` to
close the dedicated Chrome CDP window after the agent flow finishes.
