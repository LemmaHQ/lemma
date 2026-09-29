//! Handler for the ConversationService RPCs.

use buffa::MessageField;
use buffa_types::google::protobuf::Timestamp;
use connectrpc::{ConnectError, RequestContext, Response, ServiceRequest, ServiceResult};
use lemma_auth::require_user;
use lemma_db_server::entity::{Conversation as DbConversation, Message as DbMessage};
use lemma_proto::app_error;
use lemma_proto::lemma::v1::{
    ArchiveConversationResponse, Conversation, ConversationStatus, CreateConversationResponse,
    DeleteArchivedResponse, ErrorReason, ListArchivedResponse, ListConversationsResponse,
    ListMessagesResponse, Message, MessageStatus, RenameConversationResponse,
    RestoreConversationResponse,
};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use crate::store;

const DEFAULT_PAGE_LIMIT: i32 = 50;
const MAX_PAGE_LIMIT: i32 = 100;

/// Connect handler implementing the ConversationService RPCs.
///
/// Archiving is a database-only status flip; messages stay in place.
pub struct ConversationService {
    pool: PgPool,
    jwt_secret: Arc<str>,
}

impl ConversationService {
    /// Creates the handler.
    pub fn new(pool: PgPool, jwt_secret: impl Into<Arc<str>>) -> Self {
        Self {
            pool,
            jwt_secret: jwt_secret.into(),
        }
    }
}

fn conversation_to_proto(c: &DbConversation) -> Conversation {
    Conversation {
        id: c.id.to_string(),
        title: c.title.clone(),
        status: match c.status.as_str() {
            "archived" => ConversationStatus::Archived,
            _ => ConversationStatus::Active,
        }
        .into(),
        archived_at: match c.archived_at {
            Some(t) => MessageField::some(Timestamp::from(t)),
            None => MessageField::none(),
        },
        created_at: Timestamp::from(c.created_at).into(),
        updated_at: Timestamp::from(c.updated_at).into(),
        ..Default::default()
    }
}

fn message_to_proto(m: &DbMessage) -> Message {
    Message {
        id: m.id.to_string(),
        conversation_id: m.conversation_id.to_string(),
        role: m.role.clone(),
        content: serde_json::from_value::<lemma_core::Message>(m.content_json.0.clone())
            .map(|msg| msg.visible_text())
            .unwrap_or_default(),
        provider_id: m.provider_id.map(|p| p.to_string()).unwrap_or_default(),
        model: m.model.clone().unwrap_or_default(),
        status: match m.status.as_str() {
            "streaming" => MessageStatus::Streaming,
            "aborted" => MessageStatus::Aborted,
            "error" => MessageStatus::Error,
            // Stored values predate the enum; anything unrecognized is a
            // completed message.
            _ => MessageStatus::Done,
        }
        .into(),
        created_at: Timestamp::from(m.created_at).into(),
        updated_at: Timestamp::from(m.updated_at).into(),
        seq: 0,
        ..Default::default()
    }
}

fn parse_id(id: &str) -> Result<Uuid, ConnectError> {
    Uuid::parse_str(id).map_err(|_| app_error(ErrorReason::IdInvalid))
}

fn map_db(e: sqlx::Error) -> ConnectError {
    ConnectError::internal(format!("db: {e}"))
}

#[allow(refining_impl_trait)]
impl lemma_proto::lemma::v1::ConversationService for ConversationService {
    async fn list_conversations(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, lemma_proto::lemma::v1::ListConversationsRequest>,
    ) -> ServiceResult<ListConversationsResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        let list = store::list_active_by_user(&self.pool, user_id)
            .await
            .map_err(map_db)?;
        Response::ok(ListConversationsResponse {
            conversations: list.iter().map(conversation_to_proto).collect(),
            ..Default::default()
        })
    }

    async fn create_conversation(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, lemma_proto::lemma::v1::CreateConversationRequest>,
    ) -> ServiceResult<CreateConversationResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        let c = store::insert(&self.pool, user_id).await.map_err(map_db)?;
        Response::ok(CreateConversationResponse {
            conversation: conversation_to_proto(&c).into(),
            ..Default::default()
        })
    }

    async fn rename_conversation(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, lemma_proto::lemma::v1::RenameConversationRequest>,
    ) -> ServiceResult<RenameConversationResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        let id = parse_id(request.id)?;
        let title = request.title.trim();
        if title.is_empty() {
            return Err(app_error(ErrorReason::TitleRequired));
        }
        let c = store::rename(&self.pool, id, user_id, title)
            .await
            .map_err(map_db)?
            .ok_or_else(|| app_error(ErrorReason::ConversationNotFound))?;
        Response::ok(RenameConversationResponse {
            conversation: conversation_to_proto(&c).into(),
            ..Default::default()
        })
    }

    async fn list_messages(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, lemma_proto::lemma::v1::ListMessagesRequest>,
    ) -> ServiceResult<ListMessagesResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        let conversation_id = parse_id(request.conversation_id)?;
        store::find_by_id_and_user(&self.pool, conversation_id, user_id)
            .await
            .map_err(map_db)?
            .ok_or_else(|| app_error(ErrorReason::ConversationNotFound))?;
        let before_id = if request.before_id.is_empty() {
            None
        } else {
            Some(parse_id(request.before_id)?)
        };
        let limit = if request.limit <= 0 {
            DEFAULT_PAGE_LIMIT
        } else {
            request.limit.min(MAX_PAGE_LIMIT)
        };
        let (messages, has_more) =
            store::list_messages(&self.pool, conversation_id, before_id, limit as i64)
                .await
                .map_err(map_db)?;
        Response::ok(ListMessagesResponse {
            messages: messages.iter().map(message_to_proto).collect(),
            has_more,
            ..Default::default()
        })
    }

    async fn archive_conversation(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, lemma_proto::lemma::v1::ArchiveConversationRequest>,
    ) -> ServiceResult<ArchiveConversationResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        let id = parse_id(request.id)?;
        let conversation = store::archive(&self.pool, id, user_id)
            .await
            .map_err(map_db)?
            .ok_or_else(|| app_error(ErrorReason::ConversationNotActive))?;
        Response::ok(ArchiveConversationResponse {
            conversation: conversation_to_proto(&conversation).into(),
            ..Default::default()
        })
    }

    async fn restore_conversation(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, lemma_proto::lemma::v1::RestoreConversationRequest>,
    ) -> ServiceResult<RestoreConversationResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        let id = parse_id(request.id)?;
        let conversation = store::restore(&self.pool, id, user_id)
            .await
            .map_err(map_db)?
            .ok_or_else(|| app_error(ErrorReason::ConversationNotArchived))?;
        Response::ok(RestoreConversationResponse {
            conversation: conversation_to_proto(&conversation).into(),
            ..Default::default()
        })
    }

    async fn list_archived(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, lemma_proto::lemma::v1::ListArchivedRequest>,
    ) -> ServiceResult<ListArchivedResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        let list = store::list_archived_by_user(&self.pool, user_id)
            .await
            .map_err(map_db)?;
        Response::ok(ListArchivedResponse {
            conversations: list.iter().map(conversation_to_proto).collect(),
            ..Default::default()
        })
    }

    async fn delete_archived(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, lemma_proto::lemma::v1::DeleteArchivedRequest>,
    ) -> ServiceResult<DeleteArchivedResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        let id = parse_id(request.id)?;
        let deleted = store::delete_archived(&self.pool, id, user_id)
            .await
            .map_err(map_db)?;
        if !deleted {
            return Err(app_error(ErrorReason::ArchivedConversationNotFound));
        }
        Response::ok(DeleteArchivedResponse::default())
    }
}
