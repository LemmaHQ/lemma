//! The root-to-leaf path and turn-boundary checks over a session's message tree.

use std::collections::HashMap;

use uuid::Uuid;

use lemma_core::Message as CoreMessage;

use crate::message::{Message, MessageStatus};
use crate::session_error::SessionError;

/// Follows parent pointers from `leaf_id` to the root and returns the canonical
/// messages on that path, root first.
///
/// # Errors
///
/// [`SessionError::Missing`] when a message on the path is absent from
/// `entries`.
pub fn build_context_path(
    entries: &[Message],
    leaf_id: Uuid,
) -> Result<Vec<CoreMessage>, SessionError> {
    let by_id: HashMap<Uuid, &Message> = entries.iter().map(|m| (m.id, m)).collect();
    let mut path = Vec::new();
    let mut current = Some(leaf_id);
    while let Some(id) = current {
        let Some(entry) = by_id.get(&id) else {
            return Err(SessionError::Missing(format!("node {id} missing in tree")));
        };
        path.push(entry.body.0.clone());
        current = entry.parent_id;
    }
    path.reverse();
    Ok(path)
}

/// Validates whether `target_id` is a valid turn boundary for branching or
/// setting a session's active leaf.
///
/// # Errors
///
/// [`SessionError::MessageNotFound`] when `target_id` is absent from `entries`,
/// and [`SessionError::InvalidBranchPoint`] when the message is still streaming,
/// is a user message, or has a `ToolResult` child that would split a tool call
/// or sibling tool results.
pub fn is_valid_turn_boundary(target_id: Uuid, entries: &[Message]) -> Result<(), SessionError> {
    let Some(entry) = entries.iter().find(|m| m.id == target_id) else {
        return Err(SessionError::MessageNotFound);
    };
    if entry.status == MessageStatus::Streaming {
        return Err(SessionError::InvalidBranchPoint);
    }
    match &entry.body.0 {
        CoreMessage::Assistant { .. } | CoreMessage::ToolResult { .. } => {
            let has_tool_result_child = entries.iter().any(|child| {
                child.parent_id == Some(target_id)
                    && matches!(child.body.0, CoreMessage::ToolResult { .. })
            });
            if has_tool_result_child {
                return Err(SessionError::InvalidBranchPoint);
            }
            Ok(())
        }
        CoreMessage::User { .. } => Err(SessionError::InvalidBranchPoint),
    }
}
