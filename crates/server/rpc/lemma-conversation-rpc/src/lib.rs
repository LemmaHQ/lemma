//! Connect RPC shell for the `ConversationService`: JWT authentication
//! and proto mapping. All behavior lives in `lemma-conversation`.

use std::fmt::{self, Debug};

use buffa::MessageField;
use buffa_types::google::protobuf::Timestamp;
use connectrpc::{ConnectError, RequestContext, Response, ServiceRequest, ServiceResult};
use lemma_conversation::{
    Conversation as DomainConversation, ConversationError, ConversationService, ConversationStore,
    Message as DomainMessage, MessageStatus as DomainMessageStatus,
};
use lemma_core::ContentBlock;
use lemma_proto::lemma::v1;
use lemma_proto::lemma::v1::{
    Conversation, CreateConversationRequest, CreateConversationResponse, DeleteConversationRequest,
    DeleteConversationResponse, ErrorReason, ListConversationsRequest, ListConversationsResponse,
    ListMessagesRequest, ListMessagesResponse, Message, MessageStatus, RenameConversationRequest,
    RenameConversationResponse, ToolCall, ToolResultMeta,
};
use uuid::Uuid;

/// Connect handler implementing the `ConversationService` RPCs.
pub struct ConversationRpc<S> {
    domain: ConversationService<S>,
    jwt_secret: String,
}

impl<S: Debug> Debug for ConversationRpc<S> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ConversationRpc")
            .field("domain", &self.domain)
            .finish_non_exhaustive()
    }
}

impl<S: ConversationStore> ConversationRpc<S> {
    /// Creates the handler over a conversation store backend.
    pub fn new(store: S, jwt_secret: String) -> Self {
        Self {
            domain: ConversationService::new(store),
            jwt_secret,
        }
    }
}

fn conversation_to_proto(c: &DomainConversation) -> Conversation {
    Conversation {
        id: c.id.to_string(),
        title: c.title.clone(),
        created_at: Timestamp::from(c.created_at).into(),
        updated_at: Timestamp::from(c.updated_at).into(),
        ..Default::default()
    }
}

fn message_to_proto(m: &DomainMessage) -> Message {
    let core_msg = &m.message;
    Message {
        id: m.id.to_string(),
        conversation_id: m.conversation_id.to_string(),
        parent_id: m.parent_id.map(|p| p.to_string()).unwrap_or_default(),
        role: m.role().to_string(),
        content: core_msg.visible_text(),
        thinking: core_msg
            .content()
            .iter()
            .filter_map(|b| match b {
                ContentBlock::Thinking(t) => Some(t.thinking.as_str()),
                _ => None,
            })
            .collect::<String>(),
        provider_id: m.provider_id.map(|p| p.to_string()).unwrap_or_default(),
        model: m.model.clone().unwrap_or_default(),
        tool_calls: core_msg
            .tool_calls()
            .map(|c| ToolCall {
                id: c.id.clone(),
                name: c.name.clone(),
                arguments: serde_json::to_string(&c.arguments).unwrap_or_default(),
                ..Default::default()
            })
            .collect(),
        tool_result: match core_msg {
            lemma_core::Message::ToolResult {
                tool_call_id,
                tool_name,
                is_error,
                ..
            } => MessageField::some(ToolResultMeta {
                tool_call_id: tool_call_id.clone(),
                name: tool_name.clone(),
                is_error: *is_error,
                ..Default::default()
            }),
            _ => MessageField::none(),
        },
        status: match m.status {
            DomainMessageStatus::Streaming => MessageStatus::Streaming,
            DomainMessageStatus::Aborted => MessageStatus::Aborted,
            DomainMessageStatus::Error => MessageStatus::Error,
            DomainMessageStatus::Done => MessageStatus::Done,
        }
        .into(),
        error: m.error.clone().unwrap_or_default(),
        created_at: Timestamp::from(m.created_at).into(),
        updated_at: Timestamp::from(m.updated_at).into(),
        ..Default::default()
    }
}

fn parse_id(id: &str) -> Result<Uuid, ConnectError> {
    Uuid::parse_str(id).map_err(|_| lemma_proto::app_error(ErrorReason::IdInvalid))
}

fn map_domain(e: ConversationError) -> ConnectError {
    match e {
        ConversationError::TitleRequired => lemma_proto::app_error(ErrorReason::TitleRequired),
        ConversationError::NotFound => lemma_proto::app_error(ErrorReason::ConversationNotFound),
        ConversationError::Missing(m) => ConnectError::internal(format!("not found: {m}")),
        ConversationError::Store(m) => ConnectError::internal(format!("db: {m}")),
    }
}

#[allow(refining_impl_trait)]
impl<S: ConversationStore> v1::ConversationService for ConversationRpc<S> {
    async fn list_conversations(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, ListConversationsRequest>,
    ) -> ServiceResult<ListConversationsResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
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
        _request: ServiceRequest<'_, CreateConversationRequest>,
    ) -> ServiceResult<CreateConversationResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let c = self.domain.create(user_id).await.map_err(map_domain)?;
        Response::ok(CreateConversationResponse {
            conversation: conversation_to_proto(&c).into(),
            ..Default::default()
        })
    }

    async fn rename_conversation(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, RenameConversationRequest>,
    ) -> ServiceResult<RenameConversationResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
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
        request: ServiceRequest<'_, ListMessagesRequest>,
    ) -> ServiceResult<ListMessagesResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let conversation_id = parse_id(request.conversation_id)?;
        let before_id = if request.before_id.is_empty() {
            None
        } else {
            Some(parse_id(request.before_id)?)
        };
        let page = self
            .domain
            .list_messages(user_id, conversation_id, before_id, request.limit)
            .await
            .map_err(map_domain)?;
        Response::ok(ListMessagesResponse {
            messages: page.messages.iter().map(message_to_proto).collect(),
            has_more: page.has_more,
            ..Default::default()
        })
    }

    async fn delete_conversation(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, DeleteConversationRequest>,
    ) -> ServiceResult<DeleteConversationResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let id = parse_id(request.id)?;
        self.domain.delete(user_id, id).await.map_err(map_domain)?;
        Response::ok(DeleteConversationResponse::default())
    }
}
