use std::collections::HashMap;

use uuid::Uuid;

use crate::error::SessionError;
use crate::store::StoredMessage;

/// In-memory graph projection of a conversation tree.
///
/// Every message has an `id` and an optional `parent_id`.
/// Branching moves the active `leaf_id` rather than rewriting past records.
pub struct SessionTree {
    entries: HashMap<Uuid, StoredMessage>,
    children: HashMap<Option<Uuid>, Vec<Uuid>>,
}

impl SessionTree {
    /// Builds a tree graph from an unordered collection of stored messages.
    pub fn from_entries(messages: Vec<StoredMessage>) -> Self {
        let mut entries = HashMap::with_capacity(messages.len());
        let mut children: HashMap<Option<Uuid>, Vec<Uuid>> = HashMap::new();

        for msg in messages {
            let id = msg.id;
            let parent_id = msg.parent_id;
            entries.insert(id, msg);
            children.entry(parent_id).or_default().push(id);
        }

        Self { entries, children }
    }

    /// Returns direct children ids of a given parent node.
    pub fn get_children(&self, parent_id: Option<Uuid>) -> &[Uuid] {
        self.children
            .get(&parent_id)
            .map(Vec::as_slice)
            .unwrap_or(&[])
    }

    /// Traverses parent pointers from `leaf_id` back to the root,
    /// returning messages in chronological order (root to leaf).
    pub fn get_path(&self, leaf_id: Uuid) -> Result<Vec<&StoredMessage>, SessionError> {
        let mut path = Vec::new();
        let mut current = Some(leaf_id);

        while let Some(id) = current {
            let msg = self
                .entries
                .get(&id)
                .ok_or_else(|| SessionError::NotFound(format!("node {id} missing in tree")))?;
            path.push(msg);
            current = msg.parent_id;
        }

        path.reverse();
        Ok(path)
    }
}

/// Convenience helper to extract a linear message context list from root to leaf.
pub fn build_context_path(
    entries: &[StoredMessage],
    leaf_id: Uuid,
) -> Result<Vec<lemma_core::Message>, SessionError> {
    let tree = SessionTree::from_entries(entries.to_vec());
    let path = tree.get_path(leaf_id)?;
    Ok(path.into_iter().map(|s| s.message.clone()).collect())
}
