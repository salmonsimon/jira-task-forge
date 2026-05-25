# Coverage Report

Date: 2026-05-25

Scope: Rust/Tauri backend coverage plus frontend test-harness status. The React
frontend now has a small Vitest harness for domain/workflow helpers, but it does
not yet have percentage coverage reporting.

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

Measured after the first Personal v1 stabilization coverage PRs:

- Rust tests: 82 passed
- Rust line coverage: 78.26%
- Rust region coverage: 77.56%
- Rust function coverage: 64.93%
- Frontend tests: 12 passed

This is the baseline for the Personal v1 quality/security stabilization pass.
The target remains bringing Rust/Tauri backend line coverage above 80% before
continuing with larger Jira/AI feature expansion, while growing frontend tests
around domain/workflow behavior before chasing broad UI coverage percentages.

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

Post-Ask-AI/backup/audit/progress baseline:

- Tests: 61 passed
- Line coverage: 73.60%
- Region coverage: 72.57%
- Function coverage: 59.03%

## Current Rust Coverage By File

| File | Line Coverage | Region Coverage | Function Coverage |
| --- | ---: | ---: | ---: |
| `src-tauri/src/backup.rs` | 84.16% | 79.91% | 85.71% |
| `src-tauri/src/commands.rs` | 20.11% | 27.73% | 10.57% |
| `src-tauri/src/db.rs` | 89.39% | 82.95% | 83.33% |
| `src-tauri/src/integrations/jira.rs` | 40.06% | 41.60% | 50.00% |
| `src-tauri/src/integrations/jira_mapping.rs` | 100.00% | 99.39% | 100.00% |
| `src-tauri/src/integrations/openai.rs` | 65.19% | 62.14% | 71.05% |
| `src-tauri/src/jira_sync.rs` | 86.53% | 85.25% | 85.29% |
| `src-tauri/src/main.rs` | 0.00% | 0.00% | 0.00% |
| `src-tauri/src/models.rs` | 100.00% | 100.00% | 100.00% |
| `src-tauri/src/repositories.rs` | 93.75% | 90.15% | 92.23% |
| `src-tauri/src/services.rs` | 83.28% | 80.40% | 65.75% |
| `src-tauri/src/sync_audit.rs` | 97.73% | 99.26% | 100.00% |
| **TOTAL** | **78.26%** | **77.56%** | **64.93%** |

## What Changed Since The Previous Report

- Added focused Rust tests for `integrations/openai.rs`, `backup.rs`, and
  `services.rs`.
- Added the first frontend Vitest harness with domain tests for task helpers,
  tray state, CSV export, and preflight warning classification.
- Core persistence and sync remain strong: `repositories.rs`, `jira_sync.rs`,
  `jira_mapping.rs`, `models.rs`, and `sync_audit.rs` are still well covered.
- Rust line coverage recovered from the 73.60% post-feature baseline to 78.26%.

## Next Coverage Targets

Raise backend line coverage above 80% by focusing on:

- `commands.rs`: command boundary helpers where behavior can be tested without
  depending on Tauri runtime state.
- `integrations/jira.rs`: pure URL, payload, retry/error, and mapping behavior
  that can be tested without real Jira network calls.
- Additional `services.rs` coverage only where it can avoid real keyring or
  provider network dependencies.
- Frontend domain/workflow tests around JQL recent history, backup notices,
  Settings state, and preflight/progress view models as seams become available.

## Remaining Gaps

- The React frontend has a test runner, but no coverage reporting and no
  component/DOM test strategy yet.
- `commands.rs` and `main.rs` are mostly glue/bootstrap. Do not chase high
  function coverage there unless useful seams are extracted or a Tauri
  integration smoke harness is added.
- OS keyring and real Jira/OpenAI network paths should stay behind explicit
  seams or live QA. Avoid brittle environment-dependent unit tests.
