# Known Failures

## Chrome plugin and Computer Use can fail from the WSL repo cwd

Observed on 2026-07-03 in `/home/saimon/Development/jira-task-forge`.

Both `chrome:control-chrome` and `computer-use:computer-use` route through the
`node_repl` JavaScript tool. In this thread, even a minimal `node_repl` call
failed before user JavaScript ran:

```text
codex/sandbox-state-meta: sandboxCwd is not a local file URI:
file:///home/saimon/Development/jira-task-forge
```

This is a tool/runtime failure, not a missing plugin file. The plugin scripts
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

4. Use `eval`, `click`, `type`, or `screenshot` for narrow browser-control
   actions:

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
