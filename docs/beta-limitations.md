[English](beta-limitations.md) | [Español](beta-limitations.es.md) · [Back to README](../README.md)

# Known Beta Limitations

Jira Task Forge is a public beta. Review these boundaries before relying on it
for important Jira work:

- Distribution is Windows-only.
- The installer is unsigned, so Windows SmartScreen may display a warning.
- Jira uses a user-provided API token; Jira OAuth is not implemented.
- AI providers use user-provided API keys; provider OAuth is not implemented.
- Jira `blocks` and `blocked by` relationship creation remains pending
  [Issue #200](https://github.com/salmonsimon/jira-task-forge/issues/200).
- Notion sync requires a catalog page owned by your workspace and selected in
  the OAuth flow. The public example cannot be used directly as the source.
- CSV export is a fallback for Jira admin import, not a replacement for the
  guarded Jira API creation flow.
- The installer has not completed final signed-distribution and automatic-update
  polish.

Verify created Jira issues and uploaded attachments before deleting important
source material.
