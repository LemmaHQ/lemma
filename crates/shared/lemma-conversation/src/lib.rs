//! Conversation domain: lifecycle (create, rename, archive, restore,
//! delete), message pagination, and turn persistence, generic over a
//! [`ConversationStore`] backend. Contains the in-memory message tree
//! projection, branching navigation, and context assembly. Zero I/O and
//! zero runtime bindings: hosts (server, desktop, mobile) supply concrete
//! store implementations.

mod error;
mod record;
mod service;
mod store;
mod tree;

pub use error::ConversationError;
pub use record::{Conversation, LastModel, Message, MessageStatus, MessageUpdate};
pub use service::{ConversationService, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT};
pub use store::{BoxConversationFuture, ConversationStore};
pub use tree::{MessageTree, build_context_path};
