//! Conversation domain: lifecycle (create, rename, delete), message
//! pagination, and turn persistence over the conversations and messages
//! tables, which this crate defines and migrates. Contains the in-memory
//! message tree projection, branching navigation, and context assembly.

mod conversation_error;
mod conversation_service;
mod entity;
mod migration;
mod tree;

pub use conversation_error::ConversationError;
pub use conversation_service::{ConversationService, MessagePage, MessageUpdate};
pub use entity::conversation::{LastModel, Model as Conversation};
pub use entity::message::{MessageBody, MessageStatus, Model as Message};
pub use migration::migrations;
pub use tree::build_context_path;
