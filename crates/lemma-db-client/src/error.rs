use std::fmt;

/// Errors produced during SQLite storage operations.
#[derive(Debug)]
pub enum SqliteStoreError {
    /// Failure from the underlying SQLite driver.
    Database(String),
    /// JSON serialization or deserialization failure.
    Serialization(String),
}

impl fmt::Display for SqliteStoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Database(e) => write!(f, "sqlite error: {e}"),
            Self::Serialization(e) => write!(f, "serialization error: {e}"),
        }
    }
}

impl std::error::Error for SqliteStoreError {}

impl From<rusqlite::Error> for SqliteStoreError {
    fn from(err: rusqlite::Error) -> Self {
        Self::Database(err.to_string())
    }
}

impl From<serde_json::Error> for SqliteStoreError {
    fn from(err: serde_json::Error) -> Self {
        Self::Serialization(err.to_string())
    }
}

impl From<SqliteStoreError> for lemma_agent::AgentError {
    fn from(err: SqliteStoreError) -> Self {
        Self::Store(err.to_string())
    }
}
