//! Conversation business flows over a database: lifecycle (create, rename,
//! delete), message pagination, and the reads and writes a turn needs.

mod conversations;
mod message_page;
mod message_update;
mod messages;

pub use self::conversations::ConversationService;
pub use self::message_page::MessagePage;
pub use self::message_update::MessageUpdate;
