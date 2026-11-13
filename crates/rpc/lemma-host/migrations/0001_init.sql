CREATE TABLE sessions (
    id BLOB PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    leaf_id BLOB,
    last_model TEXT,
    directory TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at);

CREATE TABLE messages (
    id BLOB PRIMARY KEY NOT NULL,
    session_id BLOB NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    parent_id BLOB,
    body TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    provider_id BLOB,
    model TEXT,
    api_format TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_messages_session_id_created_at_id ON messages(session_id, created_at, id);

CREATE TABLE providers (
    id BLOB PRIMARY KEY NOT NULL,
    api_format TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'custom',
    identifier TEXT NOT NULL,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    api_path TEXT NOT NULL,
    models_path TEXT NOT NULL,
    models TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (source, identifier)
);

CREATE TABLE web_providers (
    id BLOB PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL UNIQUE,
    api_key TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    search_rank INTEGER NOT NULL,
    fetch_rank INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
