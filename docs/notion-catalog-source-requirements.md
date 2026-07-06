# Notion Catalog Source Requirements

Stable Notion reference:
https://app.notion.com/p/395c335aece48144b2dbe2cc2e0de298

This reference explains how to configure or recreate the catalog source used by
`Set Catalog Source` when the mode is `Sync from Notion page`.

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
- `areaFormatRules` for conditional delivery-format behavior;
- schema/version/freshness metadata where applicable;
- human examples and notes that remain clearly separate from machine fields.

Do not infer official areas, Jira labels, delivery formats, aliases, rules, or
version metadata from free text, ambiguous tables, headings, comments, or
examples. Examples are only authoritative when the same values appear in the
JSON contract.
