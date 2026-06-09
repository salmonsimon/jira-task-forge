# Dependency Audit Checks

Date: 2026-06-09

This project keeps dependency auditing explicit and local for Personal v1. The
checks are useful before dependency updates, release-readiness reviews, and
security-focused work, but they are not CI or merge gates yet.

## JavaScript Dependencies

Run from the repo root:

```bash
npm run audit:js
```

This wraps:

```bash
npm audit
```

Policy:

- Manual/local check for Personal v1.
- Allowed by ADR 0009 because it sends dependency metadata from
  `package-lock.json` to the configured npm registry, not Jira data, local task
  content, attachments, credentials, or secrets.
- Not a CI or merge gate for Personal v1.
- Do not run `npm audit fix` automatically; remediation should be a reviewed
  dependency update.

Current baseline from 2026-06-09:

- `npm install` audit summary: 0 vulnerabilities.
- `npm run audit:js`: 0 vulnerabilities.

## Rust Dependencies

Install the audit tool once in the WSL checkout when needed:

```bash
cargo install cargo-audit
```

Then run from the repo root:

```bash
cd src-tauri
${CARGO:-$HOME/.cargo/bin/cargo} audit
```

Policy:

- Manual/local check for Personal v1.
- Not a CI or merge gate for Personal v1.
- Known informational RustSec warnings from transitive Tauri/WebKit/GTK and
  Tauri utility dependencies should be documented for follow-up, not treated as
  project failures unless a reviewed policy says to make them blocking.
- Do not auto-remediate dependency changes as part of audit runs.

Current baseline from 2026-06-09:

- Blocking vulnerabilities: none found.
- Audit exit status: passed with allowed warnings.
- Allowed warnings: 17 RustSec warnings from transitive desktop/runtime
  dependencies. These include unmaintained GTK3 binding crates through
  `gtk`/`webkit2gtk`/`wry`/`tauri`, unmaintained `proc-macro-error` through
  GTK macros, unmaintained `unic-*` crates through `tauri-utils`/`urlpattern`,
  and an allowed `glib` advisory through the GTK/WebKit stack.
- Follow-up posture: keep these warnings visible during dependency reviews, but
  do not fail the project on them unless a reviewed policy changes the Personal
  v1 audit rules.
