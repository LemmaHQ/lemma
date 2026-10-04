//! Connect RPC shell for the ConversationService: JWT authentication
//! and proto mapping. All behavior lives in `lemma-conversation`.

use std::sync::Arc;

use buffa::MessageField;
use buffa_types::google::protobuf::Timestamp;
use connectrpc::{ConnectError, RequestContext, Response, ServiceRequest, ServiceResult};
use lemma_auth_rpc::require_user;
use lemma_conversation::{
    Conversation as DomainConversation, ConversationError, ConversationService as DomainService,
    ConversationStore, Message as DomainMessage,
};
use lemma_proto::app_error;
use lemma_proto::lemma::v1::{
    ArchiveConversationResponse, Conversation, ConversationStatus, CreateConversationResponse,
    DeleteArchivedResponse, ErrorReason, ListArchivedResponse, ListConversationsResponse,
    ListMessagesResponse, Message, MessageStatus, RenameConversationResponse,
    RestoreConversationResponse,
};
use uuid::Uuid;

/// Connect handler implementing the ConversationService RPCs.
pub struct ConversationRpc {
    domain: DomainService,
    jwt_secret: Arc<str>,
}

impl ConversationRpc {
    /// Creates the handler over a conversation store backend.
    pub fn new(store: Arc<dyn ConversationStore>, jwt_secret: impl Into<Arc<str>>) -> Self {
        Self {
            domain: DomainService::new(store),
            jwt_secret: jwt_secret.into(),
        }
    }
}

fn conversation_to_proto(c: &DomainConversation) -> Conversation {
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

fn message_to_proto(m: &DomainMessage) -> Message {
    let core_msg = serde_json::from_value::<lemma_core::Message>(m.content_json.clone()).ok();
    Message {
        id: m.id.to_string(),
        conversation_id: m.conversation_id.to_string(),
        parent_id: m.parent_id.map(|p| p.to_string()).unwrap_or_default(),
        role: m.role.clone(),
        content: core_msg
            .as_ref()
            .map(|msg| msg.visible_text())
            .unwrap_or_default(),
        thinking: core_msg
            .as_ref()
            .map(|msg| {
                msg.content()
                    .iter()
                    .filter_map(|b| match b {
                        lemma_core::ContentBlock::Thinking(t) => Some(t.thinking.as_str()),
                        _ => None,
                    })
                    .collect::<String>()
            })
            .unwrap_or_default(),
        provider_id: m.provider_id.map(|p| p.to_string()).unwrap_or_default(),
        model: m.model.clone().unwrap_or_default(),
        status: match m.status.as_str() {
            "streaming" => MessageStatus::Streaming,
            "aborted" => MessageStatus::Aborted,
            "error" => MessageStatus::Error,
            _ => MessageStatus::Done,
        }
        .into(),
        error: m.error.clone().unwrap_or_default(),
        created_at: Timestamp::from(m.created_at).into(),
        updated_at: Timestamp::from(m.updated_at).into(),
        ..Default::default()
    }
}

fn parse_id(id: &str) -> Result<Uuid, ConnectError> {
    Uuid::parse_str(id).map_err(|_| app_error(ErrorReason::IdInvalid))
}

fn map_domain(e: ConversationError) -> ConnectError {
    match e {
        ConversationError::TitleRequired => app_error(ErrorReason::TitleRequired),
        ConversationError::NotFound => app_error(ErrorReason::ConversationNotFound),
        ConversationError::NotActive => app_error(ErrorReason::ConversationNotActive),
        ConversationError::NotArchived => app_error(ErrorReason::ConversationNotArchived),
        ConversationError::ArchivedNotFound => app_error(ErrorReason::ArchivedConversationNotFound),
        ConversationError::Store(m) => ConnectError::internal(format!("db: {m}")),
    }
}

#[allow(refining_impl_trait)]
impl lemma_proto::lemma::v1::ConversationService for ConversationRpc {
    async fn list_conversations(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, lemma_proto::lemma::v1::ListConversationsRequest>,
    ) -> ServiceResult<ListConversationsResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        let list = self
            .domain
            .list_conversations(user_id)
            .await
            .map_err(map_domain)?;
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
        let c = self.domain.create(user_id).await.map_err(map_domain)?;
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
        let c = self
            .domain
            .rename(user_id, id, request.title)
            .await
            .map_err(map_domain)?;
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
        let before_id = if request.before_id.is_empty() {
            None
        } else {
            Some(parse_id(request.before_id)?)
        };
        let (messages, has_more) = self
            .domain
            .list_messages(user_id, conversation_id, before_id, request.limit)
            .await
            .map_err(map_domain)?;
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
        let conversation = self.domain.archive(user_id, id).await.map_err(map_domain)?;
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
        let conversation = self.domain.restore(user_id, id).await.map_err(map_domain)?;
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
        let list = self
            .domain
            .list_archived(user_id)
            .await
            .map_err(map_domain)?;
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
        self.domain
            .delete_archived(user_id, id)
            .await
            .map_err(map_domain)?;
        Response::ok(DeleteArchivedResponse::default())
    }
}
