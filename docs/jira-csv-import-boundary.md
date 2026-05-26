# Jira CSV Import Boundary

Jira Task Forge should keep CSV export as a manual fallback artifact, not as an
automated Jira API upload feature.

## Decision

- The app may export Jira-importable CSV files for pending, failed, or exported
  local tasks.
- The current fallback export shape is intentionally small: `Summary`,
  `Issue Type`, `Labels`, and `Description`.
- The CSV export omits local `Project` and local `Priority` because Saimon's
  tested Jira admin import mapping does not assign those fields.
- The CSV export writes local `Bug` and `Story` issue type values as Jira import
  values `Error` and `Historia`.
- The app should not try to upload a CSV file into Jira Cloud through REST API.
- If Saimon needs the fallback, the validation path is Jira's admin CSV importer
  UI, not an app-owned API call.
- The automated creation path remains Jira REST issue creation from structured
  JSON payloads.

## Evidence

Atlassian's CSV import documentation describes an admin UI flow under Jira
administration, specifically `Settings` -> `System` -> `External System Import`
-> `CSV`:

- [Import data from a CSV file](https://support.atlassian.com/jira-cloud-administration/docs/import-data-from-a-csv-file/)
- [Create work items using the CSV importer](https://support.atlassian.com/jira-software-cloud/docs/create-issues-using-the-csv-importer/)

Atlassian's Jira Cloud REST API supports JSON issue creation, including bulk
JSON issue creation with `POST /rest/api/3/issue/bulk`, but this is not a CSV
file import endpoint:

- [Jira Cloud REST API issues](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/)

## Product Consequence

CSV remains useful when Jira API auth/network/write flow is unavailable, but it
is a human/admin fallback. Jira Task Forge should focus automated effort on the
existing guarded Jira API creation flow and future narrow REST write slices such
as sub-task creation.
