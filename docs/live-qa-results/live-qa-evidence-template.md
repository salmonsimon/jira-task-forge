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
- Secret exclusion checked:
- Sub-task relationship evidence:
- Attachment metadata/file evidence:
- Evidence / notes:
- Follow-up:

## Settings And Credential Boundary

- Status: Pass / Fail / Blocked
- Jira site URL / account / creation project:
- Jira API token save/delete/test:
- AI provider/model/key save/delete/test:
- Backup secret exclusion notes:
- Keyring recovery needed:
- Evidence / notes:
- Follow-up:

## Assisted Descriptions

- Status: Pass / Fail / Blocked
- Provider/model:
- Draft/generate path:
- Clarification path:
- Manual edit / Markdown render:
- Proposal log / local-only evidence:
- Missing-description preflight evidence:
- Evidence / notes:
- Follow-up:

## Sub-Tasks

- Status: Pass / Fail / Blocked
- Parent task(s):
- Local sub-task create/delete evidence:
- Preflight grouping evidence:
- Jira sub-task issue keys:
- Parent relationship evidence:
- Backup/import evidence:
- Evidence / notes:
- Follow-up:

## Attachments

- Status: Pass / Fail / Blocked
- Files selected:
- Managed storage / metadata evidence:
- Purpose counts:
- Jira-ready preflight evidence:
- Jira uploaded attachment evidence:
- AI-only non-upload evidence:
- Local cleanup expectation observed:
- Evidence / notes:
- Follow-up:

## Preflight

- Status: Pass / Fail / Blocked
- Relevant settings:
- Blocking warning groups:
- Review warning groups:
- Missing-description choice:
- Exported task inclusion choice:
- Epic grouping evidence:
- Metadata blocker evidence:
- Evidence / notes:
- Follow-up:

## Live Jira Write QA

- Status: Pass / Fail / Blocked
- JTFTEST issue keys:
- Parent issue keys:
- Sub-task issue keys:
- Epic keys:
- Attachment upload evidence:
- Sync audit evidence:
- Recovery tray evidence:
- Evidence / notes:
- Follow-up:

## Screenshots Or Additional Notes

Screenshots are optional. Add them when they clarify a result, prove a native
state, or capture a failure that is hard to reconstruct from text.

- Screenshot links / paths:
- Additional notes:
