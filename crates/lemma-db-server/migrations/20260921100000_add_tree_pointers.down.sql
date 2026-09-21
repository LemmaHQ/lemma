DROP INDEX IF EXISTS idx_messages_parent_id;
ALTER TABLE messages DROP COLUMN IF EXISTS parent_id;
ALTER TABLE conversations DROP COLUMN IF EXISTS leaf_id;
