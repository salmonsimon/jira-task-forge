PRAGMA foreign_keys = OFF;

CREATE TABLE categories_new (
    id TEXT PRIMARY KEY,
    category_type TEXT NOT NULL CHECK (category_type IN ('project', 'area')),
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('local', 'jira', 'catalog')),
    hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
    ignored INTEGER NOT NULL DEFAULT 0 CHECK (ignored IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    project_sync_jira_site_url TEXT,
    project_sync_jira_account_email TEXT,
    project_sync_jira_project_key TEXT,
    UNIQUE (category_type, normalized_name, source)
);

INSERT INTO categories_new (
    id, category_type, name, normalized_name, source, hidden, ignored, created_at, updated_at,
    project_sync_jira_site_url, project_sync_jira_account_email, project_sync_jira_project_key
)
SELECT
    id, category_type, name, normalized_name, source, hidden, ignored, created_at, updated_at,
    project_sync_jira_site_url, project_sync_jira_account_email, project_sync_jira_project_key
FROM categories;

DROP TABLE categories;
ALTER TABLE categories_new RENAME TO categories;

PRAGMA foreign_keys = ON;
