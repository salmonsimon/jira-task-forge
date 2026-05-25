# Coverage Report

Date: 2026-05-25

Scope: Rust/Tauri backend only. The React frontend still has no automated test
runner or coverage harness; frontend validation remains `npm run build` plus
manual/native QA.

## Commands

Install the coverage tool once in the WSL checkout:

```bash
rustup component add llvm-tools-preview
cargo install cargo-llvm-cov
```

Then measure backend coverage from the repo root:

```bash
npm run coverage:rust
```

Equivalent direct command:

```bash
cd src-tauri
${CARGO:-$HOME/.cargo/bin/cargo} llvm-cov --summary-only
```

## Current Baseline

Measured after PR #41, which added JQL Ask AI drafting and the OpenAI backend
integration, plus the recent backup/restore, audit log, progress, JQL recent
history, and settings work.

- Tests: 61 passed
- Line coverage: 73.60%
- Region coverage: 72.57%
- Function coverage: 59.03%

This is the baseline for the Personal v1 quality/security stabilization pass.
The target is to bring Rust/Tauri backend line coverage back above 80% before
continuing with larger Jira/AI feature expansion.

## Historical Baselines

After PR #27:

- Tests: 30 passed
- Line coverage: 71.56%
- Region coverage: 71.59%
- Function coverage: 54.33%

After the first coverage pass:

- Tests: 45 passed
- Line coverage: 76.22%
- Region coverage: 75.71%
- Function coverage: 61.34%

After the service coverage pass:

- Tests: 50 passed
- Line coverage: 80.67%
- Region coverage: 80.54%
- Function coverage: 67.22%

## Current Rust Coverage By File

| File | Line Coverage | Region Coverage | Function Coverage |
| --- | ---: | ---: | ---: |
| `src-tauri/src/backup.rs` | 73.14% | 65.13% | 68.57% |
| `src-tauri/src/commands.rs` | 20.11% | 27.73% | 10.57% |
| `src-tauri/src/db.rs` | 89.39% | 82.95% | 83.33% |
| `src-tauri/src/integrations/jira.rs` | 40.06% | 41.60% | 50.00% |
| `src-tauri/src/integrations/jira_mapping.rs` | 100.00% | 99.39% | 100.00% |
| `src-tauri/src/integrations/openai.rs` | 34.41% | 37.72% | 41.38% |
| `src-tauri/src/jira_sync.rs` | 86.53% | 85.25% | 85.29% |
| `src-tauri/src/main.rs` | 0.00% | 0.00% | 0.00% |
| `src-tauri/src/models.rs` | 100.00% | 100.00% | 100.00% |
| `src-tauri/src/repositories.rs` | 93.68% | 90.02% | 92.23% |
| `src-tauri/src/services.rs` | 60.46% | 57.39% | 41.79% |
| `src-tauri/src/sync_audit.rs` | 97.73% | 99.26% | 100.00% |
| **TOTAL** | **73.60%** | **72.57%** | **59.03%** |

## What Changed Since The Previous Report

- New modules and larger surfaces landed without a matching deep test pass:
  `backup.rs`, `integrations/openai.rs`, and expanded `services.rs` /
  `commands.rs`.
- Core persistence and sync remain strong: `repositories.rs`, `jira_sync.rs`,
  `jira_mapping.rs`, `models.rs`, and `sync_audit.rs` are still well covered.
- Overall line coverage dropped from 80.67% to 73.60% because the denominator
  grew faster than test coverage.

## Next Coverage Targets

Raise backend line coverage above 80% by focusing on:

- `integrations/openai.rs`: request payload shaping, response parsing, retry
  classification, JSON draft validation, and redaction expectations.
- `backup.rs`: merge/skip behavior, manifest counts, rejected secret-bearing
  backups, malformed files, and attachment metadata handling.
- `services.rs`: orchestration around backup/import, OpenAI/Jira settings
  validation, JQL favorites, and early-return behavior that avoids keyring or
  network work.
- `commands.rs`: command boundary helpers where behavior can be tested without
  depending on Tauri runtime state.

## Remaining Gaps

- The React frontend still has no automated test runner. The next stabilization
  PR should add a frontend test harness around workflow/domain behavior before
  chasing UI coverage percentages.
- `commands.rs` and `main.rs` are mostly glue/bootstrap. Do not chase high
  function coverage there unless useful seams are extracted or a Tauri
  integration smoke harness is added.
- OS keyring and real Jira/OpenAI network paths should stay behind explicit
  seams or live QA. Avoid brittle environment-dependent unit tests.
