//! Conversation domain: lifecycle (create, rename, delete), message
//! pagination, and turn persistence, generic over a
//! [`ConversationStore`] backend. Contains the in-memory message tree
//! projection, branching navigation, and context assembly. Zero I/O and
//! zero runtime bindings: hosts (server, desktop, mobile) supply concrete
//! store implementations.

mod conversation_error;
mod conversation_service;
mod conversation_store;
mod record;
mod tree;

pub use conversation_error::ConversationError;
pub use conversation_service::{ConversationService, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT};
pub use conversation_store::ConversationStore;
pub use record::{Conversation, LastModel, Message, MessagePage, MessageStatus, MessageUpdate};
pub use tree::build_context_path;
