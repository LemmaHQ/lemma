//! Session domain: lifecycle (create, rename, delete), message tree
//! loading, and turn persistence over the `sessions` and `messages`
//! tables. Contains the in-memory message tree projection, branching
//! navigation, and context assembly.

mod message;
mod session;
mod session_error;
mod session_service;
mod tree;

pub use message::{Message, MessageBody, MessageStatus};
pub use session::{LastModel, Session};
pub use session_error::SessionError;
pub use session_service::{BranchTarget, MessageUpdate, SessionService, SessionTree};
pub use tree::{build_context_path, is_valid_turn_boundary};
