//! `ConversationStore` implementation over the conversations queries.

use uuid::Uuid;

use lemma_conversation::{
    BoxConversationFuture, Conversation, ConversationError, ConversationStore, Message,
};

use crate::entity;
use crate::queries::conversations;

fn into_conversation(c: entity::Conversation) -> Conversation {
    Conversation {
        id: c.id,
        user_id: c.user_id,
        title: c.title,
        status: c.status,
        archived_at: c.archived_at,
        created_at: c.created_at,
        updated_at: c.updated_at,
    }
}

fn into_message(m: entity::Message) -> Message {
    Message {
        id: m.id,
        conversation_id: m.conversation_id,
        role: m.role,
        content_json: m.content_json.0,
        provider_id: m.provider_id,
        model: m.model,
        status: m.status,
        created_at: m.created_at,
        updated_at: m.updated_at,
    }
}

fn store_err(e: sqlx::Error) -> ConversationError {
    ConversationError::Store(e.to_string())
}

/// [`ConversationStore`] backed by a PostgreSQL pool.
pub struct PgConversationStore {
    pool: sqlx::PgPool,
}

impl PgConversationStore {
    /// Creates the store over a pool.
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }
}

impl ConversationStore for PgConversationStore {
    fn insert<'a>(&'a self, user_id: Uuid) -> BoxConversationFuture<'a, Conversation> {
        Box::pin(async move {
            conversations::insert(&self.pool, user_id)
                .await
                .map(into_conversation)
                .map_err(store_err)
        })
    }

    fn list_active_by_user<'a>(
        &'a self,
        user_id: Uuid,
    ) -> BoxConversationFuture<'a, Vec<Conversation>> {
        Box::pin(async move {
            conversations::list_active_by_user(&self.pool, user_id)
                .await
                .map(|rows| rows.into_iter().map(into_conversation).collect())
                .map_err(store_err)
        })
    }

    fn list_archived_by_user<'a>(
        &'a self,
        user_id: Uuid,
    ) -> BoxConversationFuture<'a, Vec<Conversation>> {
        Box::pin(async move {
            conversations::list_archived_by_user(&self.pool, user_id)
                .await
                .map(|rows| rows.into_iter().map(into_conversation).collect())
                .map_err(store_err)
        })
    }

    fn find_by_id_and_user<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
    ) -> BoxConversationFuture<'a, Option<Conversation>> {
        Box::pin(async move {
            conversations::find_by_id_and_user(&self.pool, id, user_id)
                .await
                .map(|row| row.map(into_conversation))
                .map_err(store_err)
        })
    }

    fn rename<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
        title: &'a str,
    ) -> BoxConversationFuture<'a, Option<Conversation>> {
        Box::pin(async move {
            conversations::rename(&self.pool, id, user_id, title)
                .await
                .map(|row| row.map(into_conversation))
                .map_err(store_err)
        })
    }

    fn archive<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
    ) -> BoxConversationFuture<'a, Option<Conversation>> {
        Box::pin(async move {
            conversations::archive(&self.pool, id, user_id)
                .await
                .map(|row| row.map(into_conversation))
                .map_err(store_err)
        })
    }

    fn restore<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
    ) -> BoxConversationFuture<'a, Option<Conversation>> {
        Box::pin(async move {
            conversations::restore(&self.pool, id, user_id)
                .await
                .map(|row| row.map(into_conversation))
                .map_err(store_err)
        })
    }

    fn delete_archived<'a>(&'a self, id: Uuid, user_id: Uuid) -> BoxConversationFuture<'a, bool> {
        Box::pin(async move {
            conversations::delete_archived(&self.pool, id, user_id)
                .await
                .map_err(store_err)
        })
    }

    fn list_messages<'a>(
        &'a self,
        conversation_id: Uuid,
        before_id: Option<Uuid>,
        limit: i64,
    ) -> BoxConversationFuture<'a, (Vec<Message>, bool)> {
        Box::pin(async move {
            conversations::list_messages(&self.pool, conversation_id, before_id, limit)
                .await
                .map(|(rows, has_more)| (rows.into_iter().map(into_message).collect(), has_more))
                .map_err(store_err)
        })
    }
}
