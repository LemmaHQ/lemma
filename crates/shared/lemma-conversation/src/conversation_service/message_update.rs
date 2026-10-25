use crate::entity::message::{MessageBody, MessageStatus};

/// Finalization payload applied to a placeholder message when its
/// generation settles.
#[derive(Debug, Clone)]
pub struct MessageUpdate {
    /// Final canonical message body.
    pub body: MessageBody,
    /// Terminal lifecycle status.
    pub status: MessageStatus,
    /// Failure reason when status is `Error`; `None` otherwise.
    pub error: Option<String>,
}
