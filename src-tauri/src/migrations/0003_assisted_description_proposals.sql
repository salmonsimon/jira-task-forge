CREATE TABLE assisted_description_proposals (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Accepted', 'Rejected', 'Partial')),
    provider TEXT,
    model TEXT,
    user_comment TEXT,
    sections_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    decided_at TEXT
);

CREATE INDEX idx_assisted_description_proposals_task ON assisted_description_proposals (task_id, created_at);
CREATE INDEX idx_assisted_description_proposals_status ON assisted_description_proposals (status, updated_at);

CREATE TABLE description_proposal_log_entries (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    proposal_id TEXT REFERENCES assisted_description_proposals(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Accepted', 'Rejected', 'Partial')),
    provider TEXT,
    model TEXT,
    user_comment TEXT,
    detail_json TEXT NOT NULL,
    occurred_at TEXT NOT NULL
);

CREATE INDEX idx_description_proposal_log_task ON description_proposal_log_entries (task_id, occurred_at);
CREATE INDEX idx_description_proposal_log_proposal ON description_proposal_log_entries (proposal_id, occurred_at);
