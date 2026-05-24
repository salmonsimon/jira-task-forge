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

After this coverage pass:

- Tests: 45 passed
- Line coverage: 76.22%
- Region coverage: 75.71%
- Function coverage: 61.34%

Delta:

- +15 Rust tests
- +4.66 percentage points line coverage
- +4.12 percentage points region coverage
- +7.01 percentage points function coverage

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
| `src-tauri/src/services.rs` | 7.33% | 4.81% | 6.45% |
| **TOTAL** | **76.22%** | **75.71%** | **61.34%** |

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

The pass also fixed a small URL-normalization edge case: `https://` now reports
the useful host error instead of being transformed into a non-HTTPS-looking
string by trailing slash trimming.

## Remaining Gaps

- `services.rs` is intentionally low because most behavior touches OS keyring,
  Jira network calls, or shared database orchestration. Increasing this cleanly
  should come with an explicit service-level Adapter seam rather than brittle
  environment-dependent tests.
- `commands.rs` remains low because Tauri `State` command wrappers are mostly
  integration glue. More coverage would be easier after extracting command
  worker helpers or adding Tauri command integration tests.
- `main.rs` is untested app bootstrap. It is usually better covered by smoke
  tests or native launch checks than unit tests.
- Frontend coverage is still absent. The next useful step is to add a frontend
  test runner around domain helpers and workflow state before chasing UI
  percentage coverage.
