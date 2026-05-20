CREATE TABLE trays (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('Active', 'Needs attention', 'Completed', 'Archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT
);

CREATE INDEX idx_trays_state ON trays (state);
CREATE INDEX idx_trays_updated_at ON trays (updated_at);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    tray_id TEXT NOT NULL REFERENCES trays(id) ON DELETE CASCADE,
    project TEXT NOT NULL,
    area TEXT NOT NULL,
    title TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('Lowest', 'Low', 'Medium', 'High', 'Highest')),
    issue_type TEXT NOT NULL CHECK (issue_type IN ('Story', 'Bug', 'Sub-task')),
    sync_status TEXT NOT NULL CHECK (sync_status IN ('Pending', 'Failed', 'Exported', 'Created')),
    description_status TEXT NOT NULL CHECK (description_status IN ('Ready', 'Missing', 'Draft')),
    content_language TEXT NOT NULL,
    jira_key TEXT,
    jira_url TEXT,
    epic_key TEXT,
    parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    task_order INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_tasks_tray_order ON tasks (tray_id, task_order);
CREATE INDEX idx_tasks_sync_status ON tasks (sync_status);
CREATE INDEX idx_tasks_jira_key ON tasks (jira_key);

CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    category_type TEXT NOT NULL CHECK (category_type IN ('project', 'area')),
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('local', 'jira')),
    hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
    ignored INTEGER NOT NULL DEFAULT 0 CHECK (ignored IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (category_type, normalized_name)
);

CREATE TABLE epic_mappings (
    id TEXT PRIMARY KEY,
    project_category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    area_category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    jira_epic_key TEXT NOT NULL,
    jira_epic_url TEXT,
    synced_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (project_category_id, area_category_id)
);

CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    display_filename TEXT NOT NULL,
    mime_type TEXT,
    purpose TEXT NOT NULL CHECK (purpose IN ('AI only', 'Jira attachment', 'AI + Jira attachment')),
    original_size_bytes INTEGER NOT NULL,
    original_relative_path TEXT NOT NULL,
    file_hash TEXT,
    restore_status TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE attachment_variants (
    id TEXT PRIMARY KEY,
    attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
    profile TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER NOT NULL,
    relative_path TEXT NOT NULL,
    accepted_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE jql_favorites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    jql TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE sync_attempts (
    id TEXT PRIMARY KEY,
    tray_id TEXT REFERENCES trays(id) ON DELETE SET NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
    trigger TEXT NOT NULL
);

CREATE TABLE sync_audit_events (
    id TEXT PRIMARY KEY,
    sync_attempt_id TEXT REFERENCES sync_attempts(id) ON DELETE SET NULL,
    tray_id TEXT REFERENCES trays(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    outcome TEXT NOT NULL,
    provider TEXT,
    operation TEXT,
    detail_json TEXT NOT NULL
);

CREATE INDEX idx_sync_audit_events_tray ON sync_audit_events (tray_id, occurred_at);
CREATE INDEX idx_sync_audit_events_task ON sync_audit_events (task_id, occurred_at);
