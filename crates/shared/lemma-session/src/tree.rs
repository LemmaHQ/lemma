//! The root-to-leaf path through the stored messages of a session.

use std::collections::HashMap;

use uuid::Uuid;

use crate::Message;
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
) -> Result<Vec<lemma_core::Message>, SessionError> {
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
