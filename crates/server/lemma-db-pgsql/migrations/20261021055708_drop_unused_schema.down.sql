ALTER TABLE messages ADD COLUMN finished_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN first_token_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN started_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN token_usage JSONB;
ALTER TABLE messages ADD COLUMN client_msg_id TEXT;
CREATE UNIQUE INDEX messages_client_msg_id_unique ON messages (conversation_id, client_msg_id)
WHERE client_msg_id IS NOT NULL;

ALTER TABLE conversations ADD COLUMN local_only BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE refresh_tokens ADD COLUMN label TEXT;

CREATE TABLE settings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (user_id, key)
);
