use crate::Message;

/// One page of a conversation's messages, newest first.
#[derive(Debug, Clone)]
pub struct MessagePage {
    /// Messages on this page.
    pub messages: Vec<Message>,
    /// Whether older messages follow this page.
    pub has_more: bool,
}
