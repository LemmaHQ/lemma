ALTER TABLE messages ADD COLUMN label TEXT;
CREATE INDEX idx_messages_session_id_parent_id ON messages(session_id, parent_id);
