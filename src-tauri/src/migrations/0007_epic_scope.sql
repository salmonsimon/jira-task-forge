ALTER TABLE trays ADD COLUMN epic_scope TEXT;
ALTER TABLE trays ADD COLUMN transversal_epic_scope TEXT;

CREATE TABLE epic_mappings_v2 (
    id TEXT PRIMARY KEY,
    project_category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    area_category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    scope TEXT,
    jira_epic_key TEXT NOT NULL,
    jira_epic_url TEXT,
    synced_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO epic_mappings_v2 (
    id, project_category_id, area_category_id, scope, jira_epic_key, jira_epic_url,
    synced_at, created_at, updated_at
)
SELECT id, project_category_id, area_category_id, NULL, jira_epic_key, jira_epic_url,
       synced_at, created_at, updated_at
FROM epic_mappings;

DROP TABLE epic_mappings;
ALTER TABLE epic_mappings_v2 RENAME TO epic_mappings;

CREATE UNIQUE INDEX idx_epic_mappings_project_area_scope
ON epic_mappings (
    project_category_id,
    area_category_id,
    COALESCE(scope, '')
);
