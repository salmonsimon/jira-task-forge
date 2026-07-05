CREATE TABLE catalog_area_details (
    area_display_name TEXT PRIMARY KEY,
    normalized_name TEXT NOT NULL UNIQUE,
    jira_label TEXT NOT NULL,
    issue_type TEXT NOT NULL CHECK (issue_type IN ('Story', 'Bug')),
    default_delivery_format TEXT NOT NULL,
    safe_aliases_json TEXT NOT NULL,
    notes TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE catalog_delivery_formats (
    format_name TEXT PRIMARY KEY,
    normalized_name TEXT NOT NULL UNIQUE,
    issue_type TEXT NOT NULL CHECK (issue_type IN ('Story', 'Bug')),
    story_headings_json TEXT NOT NULL,
    minimum_deliverable TEXT NOT NULL,
    review_checklist_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE catalog_area_format_rules (
    id TEXT PRIMARY KEY,
    area_display_name TEXT NOT NULL,
    normalized_area_name TEXT NOT NULL,
    priority INTEGER NOT NULL,
    condition TEXT NOT NULL,
    normalized_condition TEXT NOT NULL,
    delivery_format TEXT NOT NULL,
    blocking INTEGER NOT NULL CHECK (blocking IN (0, 1)),
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_catalog_area_format_rules_area
ON catalog_area_format_rules (normalized_area_name, priority ASC);
