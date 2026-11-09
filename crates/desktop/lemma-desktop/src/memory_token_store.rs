use std::collections::HashMap;
use std::io;
use std::sync::{Mutex, MutexGuard, PoisonError};

use lemma_client::{Connection, TokenPair, TokenStore};

/// Keeps each connection's tokens in memory for the life of the process.
#[derive(Debug, Default)]
pub(crate) struct MemoryTokenStore {
    tokens: Mutex<HashMap<Connection, TokenPair>>,
}

impl MemoryTokenStore {
    fn tokens(&self) -> MutexGuard<'_, HashMap<Connection, TokenPair>> {
        self.tokens.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

impl TokenStore for MemoryTokenStore {
    fn load(&self, connection: &Connection) -> Option<TokenPair> {
        self.tokens().get(connection).cloned()
    }

    fn save(&self, connection: &Connection, tokens: &TokenPair) -> io::Result<()> {
        self.tokens().insert(connection.clone(), tokens.clone());
        Ok(())
    }

    fn clear(&self, connection: &Connection) -> io::Result<()> {
        self.tokens().remove(connection);
        Ok(())
    }
}
