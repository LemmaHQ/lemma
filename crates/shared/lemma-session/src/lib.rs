//! Session domain: lifecycle (create, rename, delete), message
//! pagination, and turn persistence over the sessions and messages
//! tables, which this crate defines and migrates. Contains the in-memory
//! message tree projection, branching navigation, and context assembly.

mod entity;
mod migration;
mod session_error;
mod session_service;
mod tree;

pub use entity::message::{MessageBody, MessageStatus, Model as Message};
pub use entity::session::{LastModel, Model as Session};
pub use migration::migrations;
pub use session_error::SessionError;
pub use session_service::{MessagePage, MessageUpdate, SessionService};
pub use tree::build_context_path;
