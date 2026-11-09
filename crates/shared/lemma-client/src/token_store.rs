use std::io;

use crate::connection::Connection;
use crate::token_pair::TokenPair;

/// Persists the tokens of each connection; the host application decides where and how they are sealed.
pub trait TokenStore: Send + Sync + 'static {
    /// The stored tokens of `connection`, or `None` when none are stored or they no longer open.
    fn load(&self, connection: &Connection) -> Option<TokenPair>;

    /// Replaces the stored tokens of `connection`.
    ///
    /// # Errors
    ///
    /// The I/O error when the tokens cannot be written.
    fn save(&self, connection: &Connection, tokens: &TokenPair) -> io::Result<()>;

    /// Removes the stored tokens of `connection`.
    ///
    /// # Errors
    ///
    /// The I/O error when the tokens cannot be removed.
    fn clear(&self, connection: &Connection) -> io::Result<()>;
}
