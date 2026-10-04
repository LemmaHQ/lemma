//! `ConversationStore` implementation over the conversations queries.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use lemma_conversation::{
    BoxConversationFuture, Conversation, ConversationError, ConversationStore, Message,
};

use crate::entity;
use crate::queries::conversations;

fn timestamp(ms: i64) -> Result<DateTime<Utc>, ConversationError> {
    DateTime::from_timestamp_millis(ms)
        .ok_or_else(|| ConversationError::Store(format!("timestamp out of range: {ms}")))
}

fn into_conversation(c: entity::Conversation) -> Result<Conversation, ConversationError> {
    Ok(Conversation {
        id: c.id,
        user_id: c.user_id,
        title: c.title,
        status: c.status,
        archived_at: c.archived_at.map(timestamp).transpose()?,
        created_at: timestamp(c.created_at)?,
        updated_at: timestamp(c.updated_at)?,
    })
}

fn into_message(m: entity::Message) -> Result<Message, ConversationError> {
    Ok(Message {
        id: m.id,
        conversation_id: m.conversation_id,
        role: m.role,
        content_json: m.content_json.0,
        provider_id: m.provider_id,
        model: m.model,
        status: m.status,
        created_at: timestamp(m.created_at)?,
        updated_at: timestamp(m.updated_at)?,
    })
}

fn store_err(e: sqlx::Error) -> ConversationError {
    ConversationError::Store(e.to_string())
}

/// [`ConversationStore`] backed by a SQLite pool.
pub struct SqliteConversationStore {
    pool: sqlx::SqlitePool,
}

impl SqliteConversationStore {
    /// Creates the store over a pool.
    pub fn new(pool: sqlx::SqlitePool) -> Self {
        Self { pool }
    }
}

impl ConversationStore for SqliteConversationStore {
    fn insert<'a>(&'a self, user_id: Uuid) -> BoxConversationFuture<'a, Conversation> {
        Box::pin(async move {
            conversations::insert(&self.pool, user_id)
                .await
                .map_err(store_err)
                .and_then(into_conversation)
        })
    }

    fn list_active_by_user<'a>(
        &'a self,
        user_id: Uuid,
    ) -> BoxConversationFuture<'a, Vec<Conversation>> {
        Box::pin(async move {
            conversations::list_active_by_user(&self.pool, user_id)
                .await
                .map_err(store_err)?
                .into_iter()
                .map(into_conversation)
                .collect()
        })
    }

    fn list_archived_by_user<'a>(
        &'a self,
        user_id: Uuid,
    ) -> BoxConversationFuture<'a, Vec<Conversation>> {
        Box::pin(async move {
            conversations::list_archived_by_user(&self.pool, user_id)
                .await
                .map_err(store_err)?
                .into_iter()
                .map(into_conversation)
                .collect()
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
                .map_err(store_err)?
                .map(into_conversation)
                .transpose()
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
                .map_err(store_err)?
                .map(into_conversation)
                .transpose()
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
                .map_err(store_err)?
                .map(into_conversation)
                .transpose()
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
                .map_err(store_err)?
                .map(into_conversation)
                .transpose()
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
            let (rows, has_more) =
                conversations::list_messages(&self.pool, conversation_id, before_id, limit)
                    .await
                    .map_err(store_err)?;
            let messages = rows
                .into_iter()
                .map(into_message)
                .collect::<Result<Vec<_>, _>>()?;
            Ok((messages, has_more))
        })
    }
}
