# Known Beta Limitations

Jira Task Forge is a public beta. These limitations are intentional or still in
progress.

- Windows-only distribution.
- Unsigned installer; Windows SmartScreen may warn.
- Jira relationship-link creation is pending Issue #200.
- Jira OAuth is not implemented; Jira uses bring-your-own API token storage.
- AI provider OAuth is not implemented; AI providers use bring-your-own API key
  storage.
- Notion catalog sync requires a user-owned catalog page selected through the
  OAuth picker. The public example is not a direct OAuth source.
- CSV export is a fallback artifact for Jira admin import, not a full Jira sync
  replacement.
- Manual final video/demo footage is not included in the repo. The checked-in
  video kit contains reusable visual inserts only.

## Resumen En Espanol

La beta actual es solo para Windows, usa un instalador sin firma y todavia no
crea enlaces Jira `blocks` / `blocked by` hasta que se cierre Issue #200. El
ejemplo publico de Notion sirve como referencia, pero cada usuario debe copiarlo
a su propio workspace para sincronizarlo por OAuth.
