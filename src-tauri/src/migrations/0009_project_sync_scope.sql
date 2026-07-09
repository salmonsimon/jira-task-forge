ALTER TABLE categories ADD COLUMN project_sync_jira_site_url TEXT;
ALTER TABLE categories ADD COLUMN project_sync_jira_account_email TEXT;
ALTER TABLE categories ADD COLUMN project_sync_jira_project_key TEXT;

CREATE TABLE project_sync_scoped_decisions (
    jira_site_url TEXT NOT NULL,
    jira_account_email TEXT NOT NULL,
    jira_project_key TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'ignored', 'archived')),
    jira_issue_keys_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (jira_site_url, jira_account_email, jira_project_key, normalized_name)
);
