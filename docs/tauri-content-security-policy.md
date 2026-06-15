# Tauri Content Security Policy

Jira Task Forge uses a minimal Tauri CSP so the production WebView loads only
the bundled app, local Tauri asset protocols, and Tauri IPC. The production
policy keeps `script-src` on `'self'` and does not allow arbitrary `https:`,
Jira, or AI provider hosts from the React frontend.

Jira and AI network access stays behind Rust/Tauri commands. React calls those
commands through the Tauri IPC bridge, and the backend owns credential access,
provider requests, redaction, and Jira URL validation. This keeps API tokens
and provider keys out of browser fetch paths and avoids widening the WebView
network surface when adding integrations.

Development uses `devCsp` for the Vite server on `localhost:1420`, including
the websocket connection Vite needs for hot module reload. Those allowances are
dev-only and are not present in the production CSP.
