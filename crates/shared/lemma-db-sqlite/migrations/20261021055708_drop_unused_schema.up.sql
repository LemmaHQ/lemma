DROP TABLE settings;

ALTER TABLE refresh_tokens DROP COLUMN label;

ALTER TABLE conversations DROP COLUMN local_only;

DROP INDEX messages_client_msg_id_unique;
ALTER TABLE messages DROP COLUMN client_msg_id;
ALTER TABLE messages DROP COLUMN token_usage;
ALTER TABLE messages DROP COLUMN started_at;
ALTER TABLE messages DROP COLUMN first_token_at;
ALTER TABLE messages DROP COLUMN finished_at;
