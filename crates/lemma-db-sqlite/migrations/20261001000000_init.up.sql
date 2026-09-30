CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    leaf_id TEXT,
    local_only INTEGER NOT NULL DEFAULT 0,
    last_model TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    parent_id TEXT,
    content_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'done',
    model TEXT,
    provider_id TEXT,
    token_usage TEXT,
    started_at INTEGER NOT NULL DEFAULT 0,
    first_token_at INTEGER,
    finished_at INTEGER,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_messages_conv ON messages (conversation_id);
CREATE INDEX idx_messages_parent ON messages (parent_id);
