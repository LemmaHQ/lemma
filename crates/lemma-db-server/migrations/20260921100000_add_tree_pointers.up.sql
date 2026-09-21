ALTER TABLE conversations ADD COLUMN leaf_id UUID;
ALTER TABLE messages ADD COLUMN parent_id UUID;

CREATE INDEX idx_messages_parent_id ON messages (parent_id);
