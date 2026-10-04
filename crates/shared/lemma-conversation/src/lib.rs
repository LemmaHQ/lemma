//! Conversation domain: lifecycle (create, rename, archive, restore,
//! delete) and message pagination, generic over a [`ConversationStore`]
//! backend.

mod error;
mod record;
mod service;
mod store;

pub use error::ConversationError;
pub use record::{Conversation, Message};
pub use service::{ConversationService, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT};
pub use store::{BoxConversationFuture, ConversationStore};
