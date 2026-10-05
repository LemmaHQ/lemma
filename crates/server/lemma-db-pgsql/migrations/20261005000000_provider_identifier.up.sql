ALTER TABLE providers ADD COLUMN identifier TEXT NOT NULL DEFAULT '';
UPDATE providers SET identifier = kind || '-' || substr(id::text, 1, 8) WHERE identifier = '';
CREATE UNIQUE INDEX providers_user_identifier_unique ON providers (user_id, identifier);
