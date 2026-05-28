CREATE TABLE task_issue_relationships (
    id TEXT PRIMARY KEY,
    source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('blocks', 'blocked_by')),
    target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (source_task_id, relationship_type, target_task_id)
);

CREATE INDEX idx_task_issue_relationships_source ON task_issue_relationships (source_task_id);
CREATE INDEX idx_task_issue_relationships_target ON task_issue_relationships (target_task_id);
