ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'normal';
UPDATE users SET role = 'owner'
WHERE id = (SELECT id FROM users ORDER BY created_at, id LIMIT 1);
CREATE UNIQUE INDEX users_owner_unique ON users (role)
WHERE role = 'owner';
