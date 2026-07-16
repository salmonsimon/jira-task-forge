[English](catalog-sync.md) | [Español](catalog-sync.es.md) · [Back to README](../README.md)

# Catalog Sync Guide

Jira Task Forge uses an Area catalog to keep capture options, Jira labels, issue
types, and assisted-description delivery formats consistent. You can maintain
that catalog manually or synchronize it from Notion.

## Choose A Catalog Mode

Use **Manual** when you want the shortest setup, only need a small Area list, or
do not want to connect Notion. Manual Areas live in the local app data and are
included in JSON backups.

Use **Sync from Notion page** when you want a reusable catalog that can be
maintained outside the app or shared across installations.

## Manual Mode

1. Open `Categories`.
2. Keep the catalog mode set to `Manual`.
3. Add the Areas you want available during capture.
4. Review each Area before using it to create Jira issues.

Notion and OAuth are not required in this mode.

## Sync From Notion

The public example shows the expected catalog structure, but it cannot be used
directly as your OAuth source. The page selected through OAuth must belong to
your own Notion workspace and be accessible to the Jira Task Forge connection.

Start with these public references:

- [JTF Catalog Source Requirements](https://app.notion.com/p/salmonsimon-workflow/JTF-Catalog-Source-Requirements-395c335aece48144b2dbe2cc2e0de298)
- [JTF Sync Catalog Public Example](https://app.notion.com/p/salmonsimon-workflow/JTF-Sync-Catalog-Public-Example-397c335aece481818013f3fe51cd2030)

### Connect An Owned Catalog Page

1. Open `JTF Sync Catalog Public Example`.
2. Duplicate it, or copy its catalog content into your own Notion workspace.
3. Keep or move the copy to the top level of your workspace.
4. In Jira Task Forge, open `Categories` and choose `Sync from Notion page`.
5. Select `Connect Notion`.
6. On Notion's authorization page, select only your owned catalog page.
7. Return to Jira Task Forge and provide the selected page URL or page id.
8. Validate the catalog.
9. Review the detected Areas and delivery formats.
10. Save the catalog and run the sync.

## Why The Page Should Be Owned And Top-Level

The OAuth page picker controls which Notion content the Jira Task Forge
connection can read. A public page from another workspace is only a reference
and cannot be added automatically to your authorization grant.

A dedicated top-level page is also easier to find in the picker and keeps the
grant narrow. Avoid selecting a broad wiki or project parent: granting access to
a parent can also expose its child pages to the connection.

## What The App Reads

Jira Task Forge reads the machine-readable JSON code block in the selected page.
That contract defines:

- Area display names and safe aliases;
- Jira labels;
- enabled and disabled Areas;
- Story or Bug issue type mapping;
- default delivery formats;
- conditional delivery-format rules.

The app does not treat surrounding prose, examples, comments, or decorative
tables as authoritative catalog data.

## Troubleshooting

**The catalog page does not appear in Notion**

Confirm that the page is in your own workspace, that you can share it, and that
it is at the workspace top level. Restart the connection and select that page in
the OAuth picker.

**Validation fails**

Compare the JSON code block against the public source requirements. Confirm
there is one parseable catalog block and that required fields have not been
renamed.

**You no longer want Notion sync**

Switch the catalog mode back to `Manual` and maintain Areas inside Jira Task
Forge.
