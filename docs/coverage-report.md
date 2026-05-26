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

Measured after the command/Jira coverage target pass:

- Rust tests: 91 passed
- Rust line coverage: 80.23%
- Rust region coverage: 79.72%
- Rust function coverage: 67.52%
- Frontend tests: 20 passed

This is the baseline for the Personal v1 quality/security stabilization pass.
The Rust/Tauri backend is back above the 80% line-coverage target. Continue
growing tests around product-risk seams rather than chasing broad percentages,
and grow frontend tests around domain/workflow behavior before chasing UI
coverage percentages.

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

After the first Personal v1 stabilization coverage PRs:

- Tests: 82 passed
- Line coverage: 78.26%
- Region coverage: 77.56%
- Function coverage: 64.93%

## Current Rust Coverage By File

| File | Line Coverage | Region Coverage | Function Coverage |
| --- | ---: | ---: | ---: |
| `src-tauri/src/backup.rs` | 84.16% | 79.91% | 85.71% |
| `src-tauri/src/commands.rs` | 23.24% | 31.66% | 11.38% |
| `src-tauri/src/db.rs` | 89.39% | 82.95% | 83.33% |
| `src-tauri/src/integrations/jira.rs` | 75.06% | 79.12% | 86.05% |
| `src-tauri/src/integrations/jira_mapping.rs` | 100.00% | 99.39% | 100.00% |
| `src-tauri/src/integrations/openai.rs` | 65.19% | 62.14% | 71.05% |
| `src-tauri/src/jira_sync.rs` | 86.53% | 85.25% | 85.29% |
| `src-tauri/src/main.rs` | 0.00% | 0.00% | 0.00% |
| `src-tauri/src/models.rs` | 100.00% | 100.00% | 100.00% |
| `src-tauri/src/repositories.rs` | 93.75% | 90.15% | 92.23% |
| `src-tauri/src/services.rs` | 83.28% | 80.40% | 65.75% |
| `src-tauri/src/sync_audit.rs` | 97.73% | 99.26% | 100.00% |
| **TOTAL** | **80.23%** | **79.72%** | **67.52%** |

## What Changed Since The Previous Report

- Added focused Rust tests for Jira client request construction, early input
  validation, response parsing, REST error formatting, retry classification,
  and Jira issue URL validation.
- Added frontend workflow tests for JQL recent history, JQL messages, AI draft
  messages, backup timestamps, and backup count labels.
- Core persistence and sync remain strong: `repositories.rs`, `jira_sync.rs`,
  `jira_mapping.rs`, `models.rs`, and `sync_audit.rs` are still well covered.
- Rust line coverage moved from 78.26% to 80.23%.

## Next Coverage Targets

Keep backend line coverage above 80% by focusing on:

- `commands.rs`: command boundary helpers where behavior can be tested without
  depending on Tauri runtime state.
- `integrations/jira.rs`: any remaining pure payload or retry/error behavior
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
