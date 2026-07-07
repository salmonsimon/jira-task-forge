CREATE TABLE project_sync_decisions (
    normalized_name TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'ignored', 'archived')),
    jira_issue_keys_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
);
