//! Conversation domain: lifecycle (create, rename, archive, restore,
//! delete) and message pagination over the RPC boundary.

mod service;

pub use service::ConversationService;
