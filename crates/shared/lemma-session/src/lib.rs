//! Session domain: lifecycle (create, rename, delete), message
//! pagination, and turn persistence over the `sessions` and `messages`
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
pub use session_service::{MessagePage, MessageUpdate, SessionService};
pub use tree::build_context_path;
