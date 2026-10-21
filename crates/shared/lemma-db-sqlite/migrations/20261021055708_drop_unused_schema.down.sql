ALTER TABLE messages ADD COLUMN finished_at INTEGER;
ALTER TABLE messages ADD COLUMN first_token_at INTEGER;
ALTER TABLE messages ADD COLUMN started_at INTEGER;
ALTER TABLE messages ADD COLUMN token_usage TEXT;
ALTER TABLE messages ADD COLUMN client_msg_id TEXT;
CREATE UNIQUE INDEX messages_client_msg_id_unique ON messages (conversation_id, client_msg_id)
WHERE client_msg_id IS NOT NULL;

ALTER TABLE conversations ADD COLUMN local_only INTEGER NOT NULL DEFAULT 0;

ALTER TABLE refresh_tokens ADD COLUMN label TEXT;

CREATE TABLE settings (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
);
