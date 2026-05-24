# Coverage Report

Date: 2026-05-24

Scope: Rust/Tauri backend only. The React frontend still has no automated test
runner or coverage harness; frontend validation remains `npm run build` plus
manual/native QA.

Tooling:

```bash
rustup component add llvm-tools-preview
cargo install cargo-llvm-cov
cd src-tauri
cargo llvm-cov --summary-only
```

## Summary

Baseline after PR #27:

- Tests: 30 passed
- Line coverage: 71.56%
- Region coverage: 71.59%
- Function coverage: 54.33%

After the first coverage pass:

- Tests: 45 passed
- Line coverage: 76.22%
- Region coverage: 75.71%
- Function coverage: 61.34%

Delta from baseline:

- +15 Rust tests
- +4.66 percentage points line coverage
- +4.12 percentage points region coverage
- +7.01 percentage points function coverage

After the service coverage pass:

- Tests: 50 passed
- Line coverage: 80.67%
- Region coverage: 80.54%
- Function coverage: 67.22%

Delta from the first coverage pass:

- +5 Rust tests
- +4.45 percentage points line coverage
- +4.83 percentage points region coverage
- +5.88 percentage points function coverage

## Final Rust Coverage By File

| File | Line Coverage | Region Coverage | Function Coverage |
| --- | ---: | ---: | ---: |
| `src-tauri/src/commands.rs` | 17.26% | 26.22% | 10.81% |
| `src-tauri/src/db.rs` | 86.36% | 80.18% | 77.78% |
| `src-tauri/src/integrations/jira.rs` | 65.06% | 62.19% | 73.33% |
| `src-tauri/src/jira_sync.rs` | 87.97% | 86.68% | 86.24% |
| `src-tauri/src/main.rs` | 0.00% | 0.00% | 0.00% |
| `src-tauri/src/models.rs` | 100.00% | 100.00% | 100.00% |
| `src-tauri/src/repositories.rs` | 94.87% | 92.13% | 92.54% |
| `src-tauri/src/services.rs` | 85.92% | 82.80% | 72.97% |
| **TOTAL** | **80.67%** | **80.54%** | **67.22%** |

## What Improved

- `commands.rs`: covered issue type derivation, CSV path validation, CSV write,
  and external-link command construction.
- `db.rs`: covered app database creation, parent directory creation, and
  idempotent migration recording.
- `integrations/jira.rs`: covered hostless URL handling, non-string Jira error
  payloads, JQL result mapping defaults, create-field mapping, encoded issue
  browse URLs, and Unicode path segment encoding.
- `models.rs`: covered tray state database values, unknown state rejection,
  default Jira creation project key, and the legacy
  `jiraSandboxProjectKey` alias.
- `repositories.rs`: covered sync attempt/audit event persistence.
- `services.rs`: covered local tray lifecycle, local task lifecycle, settings,
  recovery tray creation, and early Jira validation errors before keyring or
  network work.

The pass also fixed a small URL-normalization edge case: `https://` now reports
the useful host error instead of being transformed into a non-HTTPS-looking
string by trailing slash trimming.

## Remaining Gaps

- `services.rs` is now mostly covered for local-first behavior. Remaining gaps
  are primarily OS keyring and real Jira network paths; increasing those
  cleanly should come with explicit keyring/Jira Adapter seams rather than
  brittle environment-dependent tests.
- `commands.rs` remains low because Tauri `State` command wrappers are mostly
  integration glue. More coverage would be easier after extracting command
  worker helpers or adding Tauri command integration tests.
- `main.rs` is untested app bootstrap. It is usually better covered by smoke
  tests or native launch checks than unit tests.
- Function coverage remains below 80% because `commands.rs` and `main.rs`
  contain many wrapper/bootstrap functions that are not good unit-test targets.
  Raising all coverage dimensions to 80% should wait for a Tauri integration
  test harness or an explicit decision to exclude bootstrap/glue files from
  backend coverage gates.
- Frontend coverage is still absent. The next useful step is to add a frontend
  test runner around domain helpers and workflow state before chasing UI
  percentage coverage.
