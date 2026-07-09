# Notion Catalog Source Requirements

Stable Notion reference:
https://app.notion.com/p/395c335aece48144b2dbe2cc2e0de298

This reference explains how to configure or recreate the catalog source used by
`Set Catalog Source` when the mode is `Sync from Notion page`.

Authorization is handled through the Notion public connection OAuth contract in
[`notion-oauth-public-connection.md`](notion-oauth-public-connection.md). The
catalog source still needs the machine-readable JSON contract below after the
OAuth connection grants page access.

Notion source placement and sharing:

- Prefer a dedicated top-level Notion page for the sync source, such as
  `JTF Sync Catalog`, outside sensitive parent page trees. In the Notion OAuth
  picker, nested pages may not appear as selectable entries even when the user
  can open them in Notion, so keep the catalog page at the workspace/home
  top level before connecting Jira Task Forge.
- Personal users can create their own page in their own Notion workspace and
  copy the JSON contract into it.
- Teams can share one catalog page, but every user who connects through OAuth
  must have enough Notion access to select that page in the OAuth picker.
  Notion's picker expects the user to be able to share the page with the
  connection, so read-only access may be insufficient; use `Full access` on the
  dedicated catalog page when a teammate needs to authorize it.
- During OAuth, select only the dedicated catalog page. Selecting a broad parent
  page can also share child pages with the connection.
- Selecting the dedicated child catalog page should not grant the connection
  access to its parent page, but keeping the sync source outside sensitive page
  trees reduces accidental parent-page selection risk.

Saimon's current `JTF Sync Catalog` page is the Personal v1 example source. The
portable contract is the machine-readable JSON block inside that source, not the
surrounding Notion layout. If the source later moves to Obsidian, Markdown,
another database, or a versioned file, preserve the parseable JSON contract.

Minimum sync contract:

- one JSON code block that the app can parse without scraping prose;
- `areas` with `areaDisplayName`, `jiraLabel`, `enabledInJTF`, `issueType`,
  `defaultDeliveryFormat`, and explicit `safeAliases`;
- `deliveryFormats` with `formatName`, `issueType`, `storyHeadings`,
  `minimumDeliverable`, and `reviewChecklist`;
- `areaFormatRules` for conditional delivery-format behavior, using `order` to
  sort or prioritize rule evaluation;
- schema/version/freshness metadata where applicable;
- human examples and notes that remain clearly separate from machine fields.

Do not infer official areas, Jira labels, delivery formats, aliases, rules, or
version metadata from free text, ambiguous tables, headings, comments, or
examples. Examples are only authoritative when the same values appear in the
JSON contract.
