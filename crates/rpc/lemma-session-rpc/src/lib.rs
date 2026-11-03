//! Connect RPC shell for the `SessionService`: JWT authentication
//! and proto mapping. All behavior lives in `lemma-session`.

use std::fmt::{self, Debug};

use buffa::MessageField;
use buffa_types::google::protobuf::Timestamp;
use connectrpc::{ConnectError, RequestContext, Response, ServiceRequest, ServiceResult};
use lemma_core::ContentBlock;
use lemma_proto::lemma::v1;
use lemma_proto::lemma::v1::{
    CreateSessionRequest, CreateSessionResponse, DeleteSessionRequest, DeleteSessionResponse,
    ErrorReason, ListMessagesRequest, ListMessagesResponse, ListSessionsRequest,
    ListSessionsResponse, Message, MessageStatus, RenameSessionRequest, RenameSessionResponse,
    Session, ToolCall, ToolResultMeta,
};
use lemma_session::{
    Message as DomainMessage, MessageStatus as DomainMessageStatus, Session as DomainSession,
    SessionError, SessionService,
};
use uuid::Uuid;

/// Connect handler implementing the `SessionService` RPCs.
pub struct SessionRpc {
    domain: SessionService,
    jwt_secret: String,
}

impl Debug for SessionRpc {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SessionRpc")
            .field("domain", &self.domain)
            .finish_non_exhaustive()
    }
}

impl SessionRpc {
    /// Creates the handler over the session domain service, which the
    /// agent shares.
    #[must_use]
    pub fn new(domain: SessionService, jwt_secret: String) -> Self {
        Self { domain, jwt_secret }
    }
}

fn session_to_proto(c: &DomainSession) -> Session {
    Session {
        id: c.id.to_string(),
        title: c.title.clone(),
        updated_at: Timestamp::from(c.updated_at).into(),
        ..Default::default()
    }
}

fn message_to_proto(m: &DomainMessage) -> Message {
    let core_msg = &m.body.0;
    Message {
        id: m.id.to_string(),
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
        thinking_started_at: core_msg
            .content()
            .iter()
            .find_map(|b| match b {
                ContentBlock::Thinking(t) => t.started_at.map(Timestamp::from),
                _ => None,
            })
            .into(),
        thinking_finished_at: core_msg
            .content()
            .iter()
            .rev()
            .find_map(|b| match b {
                ContentBlock::Thinking(t) => t.finished_at.map(Timestamp::from),
                _ => None,
            })
            .into(),
        provider_id: m.provider_id.map(|p| p.to_string()).unwrap_or_default(),
        model: m.model.clone().unwrap_or_default(),
        tool_calls: core_msg
            .tool_calls()
            .map(|c| ToolCall {
                id: c.id.clone(),
                name: c.name.clone(),
                arguments: serde_json::to_string(&c.arguments).unwrap_or_default(),
                started_at: c.started_at.map(Timestamp::from).into(),
                finished_at: c.finished_at.map(Timestamp::from).into(),
                ..Default::default()
            })
            .collect(),
        tool_result: match core_msg {
            lemma_core::Message::ToolResult {
                tool_call_id,
                is_error,
                ..
            } => MessageField::some(ToolResultMeta {
                tool_call_id: tool_call_id.clone(),
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

fn map_domain(e: SessionError) -> ConnectError {
    match e {
        SessionError::TitleRequired => lemma_proto::app_error(ErrorReason::TitleRequired),
        SessionError::NotFound => lemma_proto::app_error(ErrorReason::SessionNotFound),
        e @ (SessionError::Missing(_) | SessionError::Store(_)) => {
            ConnectError::internal(e.to_string())
        }
    }
}

#[allow(refining_impl_trait)]
impl v1::SessionService for SessionRpc {
    async fn list_sessions(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, ListSessionsRequest>,
    ) -> ServiceResult<ListSessionsResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let list = self
            .domain
            .list_sessions(user_id)
            .await
            .map_err(map_domain)?;
        Response::ok(ListSessionsResponse {
            sessions: list.iter().map(session_to_proto).collect(),
            ..Default::default()
        })
    }

    async fn create_session(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, CreateSessionRequest>,
    ) -> ServiceResult<CreateSessionResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let c = self.domain.create(user_id).await.map_err(map_domain)?;
        Response::ok(CreateSessionResponse {
            session: session_to_proto(&c).into(),
            ..Default::default()
        })
    }

    async fn rename_session(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, RenameSessionRequest>,
    ) -> ServiceResult<RenameSessionResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let id = parse_id(request.id)?;
        let c = self
            .domain
            .rename(user_id, id, request.title)
            .await
            .map_err(map_domain)?;
        Response::ok(RenameSessionResponse {
            session: session_to_proto(&c).into(),
            ..Default::default()
        })
    }

    async fn list_messages(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, ListMessagesRequest>,
    ) -> ServiceResult<ListMessagesResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let session_id = parse_id(request.session_id)?;
        let before_id = if request.before_id.is_empty() {
            None
        } else {
            Some(parse_id(request.before_id)?)
        };
        let page = self
            .domain
            .list_messages(user_id, session_id, before_id, request.limit)
            .await
            .map_err(map_domain)?;
        Response::ok(ListMessagesResponse {
            messages: page.messages.iter().map(message_to_proto).collect(),
            has_more: page.has_more,
            ..Default::default()
        })
    }

    async fn delete_session(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, DeleteSessionRequest>,
    ) -> ServiceResult<DeleteSessionResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let id = parse_id(request.id)?;
        self.domain.delete(user_id, id).await.map_err(map_domain)?;
        Response::ok(DeleteSessionResponse::default())
    }
}
