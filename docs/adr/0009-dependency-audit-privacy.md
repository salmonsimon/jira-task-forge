# ADR 0009: Allow local npm audit as an explicit dependency security check

## Status

Accepted

## Context

JavaScript dependency auditing helps catch known vulnerable packages, but `npm
audit` sends a dependency tree derived from `package-lock.json` to the configured
npm registry. For this private local-first app, that is external disclosure of
dependency metadata and should be an explicit project policy rather than an
accidental default.

## Proposal

Agents may run `npm audit` locally against the configured npm registry when
doing dependency, security, or release-readiness work. This disclosure is
acceptable for Jira Task Forge because it sends package metadata, not app data,
Jira content, local tasks, attachments, credentials, or secrets.

Do not run `npm audit fix` automatically. It changes dependency versions and
must be handled as an explicit dependency update with review.

Do not add `npm audit` as a CI or merge gate for Personal v1. Revisit CI gating
only when the project moves toward broader distribution or a formal release
process.

## Consequences

- AFK agents can use `npm audit` without re-asking during security work.
- Dependency metadata may leave the machine for the configured npm registry.
- Dependency remediation remains reviewable instead of automatic.
- CI remains focused on deterministic local checks until a broader distribution
  workflow exists.
