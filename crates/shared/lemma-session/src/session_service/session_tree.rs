use uuid::Uuid;

use crate::Message;

/// Complete message tree snapshot for one session.
#[derive(Debug, Clone, PartialEq)]
pub struct SessionTree {
    /// Active leaf message id of the session, when set.
    pub leaf_id: Option<Uuid>,
    /// Every message in the session tree, ordered oldest first.
    pub messages: Vec<Message>,
}

/// Target parent selection when starting or branching a turn.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BranchTarget {
    /// Continues from the session's current `leaf_id`.
    ActiveLeaf,
    /// Starts a new root branch (`parent_id = None`).
    Root,
    /// Appends under the given message id.
    Message(Uuid),
}
