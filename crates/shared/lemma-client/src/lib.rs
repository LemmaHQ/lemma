//! The client core shared by Lemma's native clients: calls to the local
//! engine in process or to a remote server over HTTP, per-connection tokens
//! with refresh, turn streams that resume after a break, and the state of
//! an open session folded from its pages and events. It holds no interface
//! code and no interface text.

mod client;
mod client_error;
mod connection;
mod message_item;
mod model_choice;
mod open_session;
mod session_group;
mod token_pair;
mod token_state;
mod token_store;
mod transport;
mod turn;

pub use client::Client;
pub use client_error::ClientError;
pub use connection::Connection;
pub use message_item::{MessageError, MessageItem, MessageRole, MessageStatus, ToolCallItem};
pub use model_choice::{ModelChoice, model_choices, resolve_model};
pub use open_session::OpenSession;
pub use session_group::{SessionGroup, SessionPeriod, group_sessions};
pub use token_pair::TokenPair;
pub use token_store::TokenStore;
pub use turn::{Turn, TurnUpdate};
