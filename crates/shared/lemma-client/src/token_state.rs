use std::sync::{PoisonError, RwLock};

use tokio::sync::{Mutex, MutexGuard};

use crate::client_error::ClientError;
use crate::connection::Connection;
use crate::token_pair::TokenPair;
use crate::token_store::TokenStore;

/// One connection's tokens: the stored pair, mirrored in memory, and the gate that lets one refresh run at a time.
pub(crate) struct TokenState<S> {
    store: S,
    connection: Connection,
    pair: RwLock<Option<TokenPair>>,
    refresh: Mutex<()>,
}

impl<S: TokenStore> TokenState<S> {
    pub(crate) fn load(store: S, connection: Connection) -> Self {
        let pair = store.load(&connection);
        Self {
            store,
            connection,
            pair: RwLock::new(pair),
            refresh: Mutex::new(()),
        }
    }

    pub(crate) fn connection(&self) -> &Connection {
        &self.connection
    }

    pub(crate) fn pair(&self) -> Option<TokenPair> {
        self.pair
            .read()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    pub(crate) fn access_token(&self) -> Option<String> {
        self.pair().map(|pair| pair.access_token)
    }

    pub(crate) fn keep(&self, pair: TokenPair) -> Result<(), ClientError> {
        self.store
            .save(&self.connection, &pair)
            .map_err(ClientError::Storage)?;
        self.replace(Some(pair));
        Ok(())
    }

    pub(crate) fn clear(&self) -> Result<(), ClientError> {
        self.replace(None);
        self.store
            .clear(&self.connection)
            .map_err(ClientError::Storage)
    }

    pub(crate) async fn refresh_gate(&self) -> MutexGuard<'_, ()> {
        self.refresh.lock().await
    }

    fn replace(&self, pair: Option<TokenPair>) {
        *self.pair.write().unwrap_or_else(PoisonError::into_inner) = pair;
    }
}
