use std::path::Path;

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

use crate::parse_id::parse_id;

#[derive(Debug)]
pub(crate) struct SessionRpc {
    domain: SessionService,
}

impl SessionRpc {
    #[must_use]
    pub(crate) fn new(domain: SessionService) -> Self {
        Self { domain }
    }
}

fn session_to_proto(c: &DomainSession) -> Session {
    Session {
        id: c.id.to_string(),
        title: c.title.clone(),
        updated_at: Timestamp::from(c.updated_at).into(),
        directory: c.directory.clone(),
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

fn map_domain(e: SessionError) -> ConnectError {
    match e {
        SessionError::TitleRequired => lemma_proto::app_error(ErrorReason::TitleRequired),
        SessionError::NotFound => lemma_proto::app_error(ErrorReason::SessionNotFound),
        SessionError::DirectoryNotFound(_) => {
            lemma_proto::app_error(ErrorReason::DirectoryNotFound)
        }
        e @ (SessionError::Missing(_) | SessionError::Store(_)) => {
            ConnectError::internal(e.to_string())
        }
    }
}

#[allow(refining_impl_trait)]
impl v1::SessionService for SessionRpc {
    async fn list_sessions(
        &self,
        _ctx: RequestContext,
        _request: ServiceRequest<'_, ListSessionsRequest>,
    ) -> ServiceResult<ListSessionsResponse> {
        let list = self.domain.list_sessions().await.map_err(map_domain)?;
        Response::ok(ListSessionsResponse {
            sessions: list.iter().map(session_to_proto).collect(),
            ..Default::default()
        })
    }

    async fn create_session(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, CreateSessionRequest>,
    ) -> ServiceResult<CreateSessionResponse> {
        let directory = request.directory.map(Path::new);
        let c = self.domain.create(directory).await.map_err(map_domain)?;
        Response::ok(CreateSessionResponse {
            session: session_to_proto(&c).into(),
            ..Default::default()
        })
    }

    async fn rename_session(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, RenameSessionRequest>,
    ) -> ServiceResult<RenameSessionResponse> {
        let id = parse_id(request.id)?;
        let c = self
            .domain
            .rename(id, request.title)
            .await
            .map_err(map_domain)?;
        Response::ok(RenameSessionResponse {
            session: session_to_proto(&c).into(),
            ..Default::default()
        })
    }

    async fn list_messages(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, ListMessagesRequest>,
    ) -> ServiceResult<ListMessagesResponse> {
        let session_id = parse_id(request.session_id)?;
        let before_id = if request.before_id.is_empty() {
            None
        } else {
            Some(parse_id(request.before_id)?)
        };
        let page = self
            .domain
            .list_messages(session_id, before_id, request.limit)
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
        _ctx: RequestContext,
        request: ServiceRequest<'_, DeleteSessionRequest>,
    ) -> ServiceResult<DeleteSessionResponse> {
        let id = parse_id(request.id)?;
        self.domain.delete(id).await.map_err(map_domain)?;
        Response::ok(DeleteSessionResponse::default())
    }
}
