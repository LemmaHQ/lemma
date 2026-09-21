use std::sync::Arc;

use lemma_core::{ContentBlock, Message, StopReason, TextContent};
use lemma_db_client::SqliteTraceStore;
use lemma_proto::lemma::v1::{PullResponse, SyncMessage as ProtoSyncMessage};
use uuid::Uuid;

use crate::error::ClientError;

/// Synchronization engine that bridges local on-device SQLite and the remote gateway.
pub struct SyncEngine {
    store: Arc<SqliteTraceStore>,
}

impl SyncEngine {
    /// Creates a new sync engine bound to a local SQLite store.
    pub fn new(store: Arc<SqliteTraceStore>) -> Self {
        Self { store }
    }

    /// Returns pending outbox items for pushing to remote.
    pub fn get_pending_outbox(
        &self,
        limit: usize,
    ) -> Result<Vec<lemma_db_client::outbox::OutboxItem>, ClientError> {
        self.store.list_outbox(limit).map_err(ClientError::from)
    }

    /// Acknowledges pushed items and clears them from outbox.
    pub fn ack_outbox(&self, max_id: i64) -> Result<(), ClientError> {
        self.store.ack_outbox(max_id).map_err(ClientError::from)
    }

    /// Current local synchronization cursor.
    pub fn get_sync_cursor(&self) -> Result<i64, ClientError> {
        self.store.get_sync_cursor().map_err(ClientError::from)
    }

    /// Advances local cursor after successful pull application.
    pub fn update_sync_cursor(&self, seq: i64) -> Result<(), ClientError> {
        self.store
            .update_sync_cursor(seq)
            .map_err(ClientError::from)
    }

    /// Applies a batch of pulled remote changes atomically to the local trace store.
    pub fn apply_pull_batch(&self, response: PullResponse) -> Result<(), ClientError> {
        // 1. Update conversations
        for sc in response.conversations {
            if let Some(conv) = sc.conversation.into_option() {
                self.upsert_conversation(&conv)?;
            }
        }

        // 2. Append messages
        for sm in response.messages {
            if let Some(msg) = sm.message.clone().into_option() {
                self.upsert_message(&sm, &msg)?;
            }
        }

        // 3. Advance local cursor
        self.update_sync_cursor(response.next_after)?;

        Ok(())
    }

    fn upsert_conversation(
        &self,
        conv: &lemma_proto::lemma::v1::Conversation,
    ) -> Result<(), ClientError> {
        let conv_id =
            Uuid::parse_str(&conv.id).map_err(|e| ClientError::InvalidInput(e.to_string()))?;
        let now = conv
            .created_at
            .as_option()
            .map(|t| t.seconds * 1000)
            .unwrap_or(0);

        let conn = self.store.conn_handle();
        let c = conn.lock();
        c.execute(
            r#"
            INSERT INTO conversations (id, title, leaf_id, local_only, created_at, updated_at)
            VALUES (?1, ?2, NULL, 0, ?3, ?4)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                updated_at = excluded.updated_at
            "#,
            rusqlite::params![conv_id.to_string(), conv.title, now, now],
        )
        .map_err(lemma_db_client::SqliteStoreError::from)?;

        Ok(())
    }

    fn upsert_message(
        &self,
        _sync_msg: &ProtoSyncMessage,
        msg: &lemma_proto::lemma::v1::Message,
    ) -> Result<(), ClientError> {
        let msg_id =
            Uuid::parse_str(&msg.id).map_err(|e| ClientError::InvalidInput(e.to_string()))?;
        let conv_id = Uuid::parse_str(&msg.conversation_id)
            .map_err(|e| ClientError::InvalidInput(e.to_string()))?;

        let block = ContentBlock::Text(TextContent {
            text: msg.content.clone(),
        });
        let trace_msg = if msg.role == "user" {
            Message::User {
                content: vec![block],
            }
        } else {
            Message::Assistant {
                content: vec![block],
                stop_reason: StopReason::Stop,
                usage: None,
            }
        };

        let json_str =
            serde_json::to_string(&trace_msg).map_err(|e| ClientError::Session(e.to_string()))?;

        let created_at = msg
            .created_at
            .as_option()
            .map(|t| t.seconds * 1000)
            .unwrap_or(0);

        let conn = self.store.conn_handle();
        let c = conn.lock();
        c.execute(
            r#"
            INSERT INTO messages (id, conversation_id, parent_id, content_json, created_at)
            VALUES (?1, ?2, NULL, ?3, ?4)
            ON CONFLICT(id) DO UPDATE SET
                content_json = excluded.content_json
            "#,
            rusqlite::params![
                msg_id.to_string(),
                conv_id.to_string(),
                json_str,
                created_at
            ],
        )
        .map_err(lemma_db_client::SqliteStoreError::from)?;

        // Also update conversations leaf pointer if applicable
        c.execute(
            r#"
            UPDATE conversations
            SET leaf_id = ?1, updated_at = ?2
            WHERE id = ?3 AND (leaf_id IS NULL OR updated_at < ?2)
            "#,
            rusqlite::params![msg_id.to_string(), created_at, conv_id.to_string()],
        )
        .map_err(lemma_db_client::SqliteStoreError::from)?;

        Ok(())
    }
}
