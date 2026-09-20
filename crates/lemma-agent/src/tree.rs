use std::collections::HashMap;

use uuid::Uuid;

use crate::error::AgentError;
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
    pub fn get_path(&self, leaf_id: Uuid) -> Result<Vec<&StoredMessage>, AgentError> {
        let mut path = Vec::new();
        let mut current = Some(leaf_id);

        while let Some(id) = current {
            let msg = self
                .entries
                .get(&id)
                .ok_or_else(|| AgentError::NotFound(format!("node {id} missing in tree")))?;
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
) -> Result<Vec<lemma_core::Message>, AgentError> {
    let tree = SessionTree::from_entries(entries.to_vec());
    let path = tree.get_path(leaf_id)?;
    Ok(path.into_iter().map(|s| s.message.clone()).collect())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use lemma_core::{ContentBlock, Message, TextContent};

    fn dummy_msg(id: Uuid, parent_id: Option<Uuid>, text: &str) -> StoredMessage {
        StoredMessage {
            id,
            conversation_id: Uuid::nil(),
            parent_id,
            message: Message::User {
                content: vec![ContentBlock::Text(TextContent {
                    text: text.to_string(),
                })],
            },
            created_at: 0,
        }
    }

    #[test]
    fn tree_reconstructs_branch_path_correctly() {
        let root_id = Uuid::new_v4();
        let child1_id = Uuid::new_v4();
        let child2_branch_id = Uuid::new_v4();
        let leaf1_id = Uuid::new_v4();

        // Structure:
        // root
        // ├── child1 -> leaf1
        // └── child2_branch (divergent)
        let messages = vec![
            dummy_msg(root_id, None, "root"),
            dummy_msg(child1_id, Some(root_id), "turn 1"),
            dummy_msg(leaf1_id, Some(child1_id), "turn 2"),
            dummy_msg(child2_branch_id, Some(root_id), "branch turn 1"),
        ];

        let tree = SessionTree::from_entries(messages);

        // Path to leaf1: root -> child1 -> leaf1
        let path1 = tree.get_path(leaf1_id).unwrap();
        assert_eq!(path1.len(), 3);
        assert_eq!(path1[0].id, root_id);
        assert_eq!(path1[1].id, child1_id);
        assert_eq!(path1[2].id, leaf1_id);

        // Path to child2_branch: root -> child2_branch
        let path2 = tree.get_path(child2_branch_id).unwrap();
        assert_eq!(path2.len(), 2);
        assert_eq!(path2[0].id, root_id);
        assert_eq!(path2[1].id, child2_branch_id);
    }
}
