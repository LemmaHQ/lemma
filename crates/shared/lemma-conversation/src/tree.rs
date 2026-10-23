//! The root-to-leaf path through the stored messages of a conversation.

use std::collections::HashMap;

use uuid::Uuid;

use crate::conversation_error::ConversationError;
use crate::record::Message;

/// Follows parent pointers from `leaf_id` to the root and returns the canonical
/// messages on that path, root first.
///
/// # Errors
///
/// [`ConversationError::Missing`] when a message on the path is absent from
/// `entries`.
pub fn build_context_path(
    entries: &[Message],
    leaf_id: Uuid,
) -> Result<Vec<lemma_core::Message>, ConversationError> {
    let by_id: HashMap<Uuid, &Message> = entries.iter().map(|m| (m.id, m)).collect();
    let mut path = Vec::new();
    let mut current = Some(leaf_id);
    while let Some(id) = current {
        let Some(entry) = by_id.get(&id) else {
            return Err(ConversationError::Missing(format!(
                "node {id} missing in tree"
            )));
        };
        path.push(entry.message.clone());
        current = entry.parent_id;
    }
    path.reverse();
    Ok(path)
}
