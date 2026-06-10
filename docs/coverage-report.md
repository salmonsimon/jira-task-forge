# Coverage Report

Date: 2026-06-09

Scope: Rust/Tauri backend coverage plus React/Vitest frontend coverage
reporting. Frontend thresholds are advisory-only for Personal v1; use the
baseline to guide useful domain/workflow coverage instead of blocking merges on
broad UI percentages.

## Commands

Install the Rust coverage tool once in the WSL checkout:

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

Measure frontend coverage from the repo root:

```bash
npm run coverage:frontend
```

The frontend command uses Vitest with the V8 coverage provider. It writes HTML
and JSON summary output under `coverage/frontend/`, which is intentionally a
local artifact and should not be committed.

## Current Baseline

Measured during the frontend coverage and supply-chain tooling pass:

- Frontend tests: 93 passed across 23 files
- Frontend statement coverage: 20.47%
- Frontend branch coverage: 19.99%
- Frontend function coverage: 23.63%
- Frontend line coverage: 20.53%
- Rust tests: 168 passed
- Rust line coverage: 80.40%
- Rust region coverage: 79.80%
- Rust function coverage: 70.13%

The frontend all-files percentage is low because coverage now includes the full
React surface, including large app-shell and feature UI files that are not yet
covered by DOM/component tests. The more useful Personal v1 signal is the
existing domain/workflow helper coverage: `src/lib/domain` reports 93.48% line
coverage, with `trayWorkspace.ts` at 86.66% line coverage and focused component
coverage starting around task relationships, attachments, categories, and tray
grouping. Keep the first frontend threshold advisory-only until the project has
a deliberate component/DOM strategy.

This remains the Personal v1 quality/security stabilization baseline. Continue
growing tests around product-risk behavior, local-first state transitions, and
Jira workflow helpers before chasing broad app-shell coverage.

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

After the command/Jira coverage target pass:

- Rust tests: 91 passed
- Rust line coverage: 80.23%
- Rust region coverage: 79.72%
- Rust function coverage: 67.52%
- Frontend tests: 20 passed

## Current Rust Coverage Summary

The current backend report is more granular than older single-file module
summaries because several modules have been split into submodules. The latest
`npm run coverage:rust` total is:

| Metric | Coverage |
| --- | ---: |
| Regions | 79.80% |
| Functions | 70.13% |
| Lines | 80.40% |

Strong areas include backup import/export helpers, Jira sync planning and
attempt recording, Jira mapping, repositories, redaction, sync audit helpers,
and many local-first service paths. Lower-coverage areas remain mostly command
wrappers, credential/keyring paths, provider transport edges, app bootstrap, and
large integration-facing service modules where live dependencies should stay
behind explicit seams. Run `npm run coverage:rust` for the full current file
table.

## Current Frontend Coverage By Area

| Area | Line Coverage | Notes |
| --- | ---: | --- |
| `src/lib/domain` | 93.48% | Strong domain/workflow helper baseline. |
| `src/features/trays/trayWorkspace.ts` | 86.66% | Good local tray workspace behavior coverage. |
| `src/lib/adapters/tauriContracts.ts` | 80.76% | Useful Tauri payload normalization coverage. |
| `src/components/ui` | 33.33% | Early shared UI coverage only. |
| `src/features/task-detail` | 8.07% | Focused component tests exist, but broad detail UI remains mostly unmeasured. |
| `src/features/trays` | 10.60% | Domain workspace is covered; large React tray views remain mostly unmeasured. |
| `src/App.tsx` and app-shell files | 0.00% | App composition is not covered by the current harness. |
| **TOTAL** | **20.53%** | Advisory all-files baseline. |

## What Changed Since The Previous Report

- Added frontend coverage reporting through `npm run coverage:frontend` using
  `@vitest/coverage-v8`.
- Recorded the first all-files frontend baseline instead of only saying the
  React test runner exists.
- Kept frontend coverage advisory-only because broad UI coverage is still low
  and a deliberate component/DOM strategy is not in place.
- The frontend test suite has grown from 20 to 93 passing tests across 23 files.

## Next Coverage Targets

Keep backend line coverage above 80% by focusing on:

- `commands.rs`: command boundary helpers where behavior can be tested without
  depending on Tauri runtime state.
- `integrations/jira.rs`: any remaining pure payload or retry/error behavior
  that can be tested without real Jira network calls.
- Additional `services.rs` coverage only where it can avoid real keyring or
  provider network dependencies.

Grow frontend coverage around behavior that reduces product risk:

- JQL recent history, backup notices, Settings state, and preflight/progress
  view models as more seams become available.
- Component tests for bounded UI behavior in task detail, tray grouping,
  categories, and settings.
- Avoid brittle broad app-shell snapshots; test domain/workflow helpers and
  stable component contracts first.

## Remaining Gaps

- Frontend coverage reporting now exists, but there is no enforced frontend
  threshold yet.
- `App.tsx`, app-shell composition, JQL view, Settings view, and the large Jira
  preflight dialog remain mostly or entirely uncovered by the current frontend
  harness.
- `commands.rs` and `main.rs` are mostly glue/bootstrap. Do not chase high
  function coverage there unless useful seams are extracted or a Tauri
  integration smoke harness is added.
- OS keyring and real Jira/OpenAI network paths should stay behind explicit
  seams or live QA. Avoid brittle environment-dependent unit tests.
