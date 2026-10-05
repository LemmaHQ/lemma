DROP INDEX IF EXISTS providers_user_identifier_unique;
ALTER TABLE providers DROP COLUMN identifier;
