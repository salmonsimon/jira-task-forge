# Live QA Evidence Template

Use this template for live QA runs that need repeatable evidence without
requiring screenshots for every step. Keep DTS read-only. Use JTFTEST for any
live Jira write validation.

## Run Metadata

- Date:
- Branch / PR:
- Tester:
- Environment:
  - OS:
  - App build:
  - Jira site / project:
- Commands:
  - Automated baseline:
  - Native smoke:
  - Other:
- App start path:
- Relevant settings:
  - Jira mode / project:
  - Backup path:
  - Import source:
  - Feature flags or config notes:

## Jira Safety And Issue Evidence

- DTS reminder: DTS is read-only. Do not create, update, delete, transition,
  comment on, or otherwise mutate DTS issues during this run.
- JTFTEST issue keys created:
  - None
- JTFTEST issue keys touched:
  - None
- Jira write notes:

## Automated Baseline

- Status: Pass / Fail / Blocked
- Commands run:
- Evidence / notes:
- Follow-up:

## Native Smoke

- Status: Pass / Fail / Blocked
- App start path:
- Evidence / notes:
- Follow-up:

## Backup And Import

- Status: Pass / Fail / Blocked
- Backup path:
- Import source:
- Evidence / notes:
- Follow-up:

## Preflight

- Status: Pass / Fail / Blocked
- Relevant settings:
- Evidence / notes:
- Follow-up:

## Live Jira Write QA

- Status: Pass / Fail / Blocked
- JTFTEST issue keys:
- Evidence / notes:
- Follow-up:

## Screenshots Or Additional Notes

Screenshots are optional. Add them when they clarify a result, prove a native
state, or capture a failure that is hard to reconstruct from text.

- Screenshot links / paths:
- Additional notes:
