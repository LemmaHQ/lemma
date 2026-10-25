CREATE TABLE settings (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
);

CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    leaf_id TEXT,
    last_model TEXT,
    local_only INTEGER NOT NULL DEFAULT 0,
    archived_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_conversations_user ON conversations (user_id);

CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    parent_id TEXT,
    role TEXT NOT NULL,
    content_json TEXT NOT NULL,
    client_msg_id TEXT,
    model TEXT,
    provider_id TEXT REFERENCES providers(id),
    status TEXT NOT NULL DEFAULT 'done',
    error TEXT,
    token_usage TEXT,
    started_at INTEGER,
    first_token_at INTEGER,
    finished_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_messages_conv ON messages (conversation_id, created_at, id);
CREATE INDEX idx_messages_parent ON messages (parent_id);
CREATE UNIQUE INDEX messages_client_msg_id_unique ON messages (conversation_id, client_msg_id)
WHERE client_msg_id IS NOT NULL;
