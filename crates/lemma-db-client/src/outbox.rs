//! Offline change-queue outbox entities for sync.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// An item pending synchronization to the remote server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboxItem {
    /// Incremental queue ID.
    pub id: i64,
    /// Entity type ("conversation" or "message").
    pub entity_type: String,
    /// Target entity UUID.
    pub entity_id: Uuid,
    /// Serialized entity payload to send to remote.
    pub payload_json: String,
    /// Unix timestamp when the item was enqueued.
    pub created_at: i64,
}
