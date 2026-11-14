use std::sync::Arc;

use buffa::MessageField;
use connectrpc::{
    ConnectError, RequestContext, Response, ServiceRequest, ServiceResult, ServiceStream,
};
use lemma_agent::{Agent, AgentError as TurnError, BranchTarget, TurnRequest};
use lemma_model::Connector;
use lemma_proto::lemma::v1;
use lemma_proto::lemma::v1::{
    AbortMessageRequest, AbortMessageResponse, ErrorReason, ResumeStreamRequest,
    ResumeStreamResponse, SendMessageRequest, SendMessageResponse,
};

use crate::agent_event::turn_event;
use crate::parse_id::parse_id;

#[derive(Debug)]
pub(crate) struct AgentRpc<C> {
    agent: Arc<Agent<C>>,
}

impl<C: Connector> AgentRpc<C> {
    #[must_use]
    pub(crate) fn new(agent: Arc<Agent<C>>) -> Self {
        Self { agent }
    }
}

fn start_error(e: TurnError) -> ConnectError {
    match e {
        TurnError::ContentRequired => lemma_proto::app_error(ErrorReason::ContentRequired),
        TurnError::ModelRequired => lemma_proto::app_error(ErrorReason::ModelRequired),
        TurnError::ProviderNotFound => lemma_proto::app_error(ErrorReason::ProviderNotFound),
        TurnError::SessionNotFound => lemma_proto::app_error(ErrorReason::SessionNotFound),
        TurnError::MessageNotFound => lemma_proto::app_error(ErrorReason::MessageNotFound),
        TurnError::InvalidBranchPoint => lemma_proto::app_error(ErrorReason::InvalidBranchPoint),
        TurnError::SessionBusy => lemma_proto::app_error(ErrorReason::SessionBusy),
        TurnError::DirectoryNotFound(_) => lemma_proto::app_error(ErrorReason::DirectoryNotFound),
        other @ (TurnError::Provider(_) | TurnError::Store(_) | TurnError::Workspace(_)) => {
            ConnectError::internal(other.to_string())
        }
    }
}

#[allow(refining_impl_trait)]
impl<C: Connector> v1::AgentService for AgentRpc<C> {
    async fn send_message(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, SendMessageRequest>,
    ) -> ServiceResult<ServiceStream<SendMessageResponse>> {
        use futures::StreamExt;

        let branch = match request.parent_id {
            None => BranchTarget::ActiveLeaf,
            Some("") => BranchTarget::Root,
            Some(id) => BranchTarget::Message(parse_id(id)?),
        };
        let events = self
            .agent
            .start(TurnRequest {
                session_id: parse_id(request.session_id)?,
                provider_id: parse_id(request.provider_id)?,
                model: request.model.to_string(),
                content: request.content.to_string(),
                branch,
            })
            .await
            .map_err(start_error)?;

        Response::stream_ok(Box::pin(events.map(|event| {
            Ok(SendMessageResponse {
                event: MessageField::some(turn_event(event)),
                ..Default::default()
            })
        })))
    }

    async fn abort_message(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, AbortMessageRequest>,
    ) -> ServiceResult<AbortMessageResponse> {
        self.agent.abort(parse_id(request.message_id)?);
        Ok(Response::new(AbortMessageResponse::default()))
    }

    async fn resume_stream(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, ResumeStreamRequest>,
    ) -> ServiceResult<ServiceStream<ResumeStreamResponse>> {
        use futures::StreamExt;

        let offset = usize::try_from(request.offset)
            .map_err(|_| ConnectError::invalid_argument("offset is negative"))?;
        let events = self
            .agent
            .resume(parse_id(request.message_id)?, offset)
            .ok_or_else(|| lemma_proto::app_error(ErrorReason::TurnNotRunning))?;

        Response::stream_ok(Box::pin(events.map(|event| {
            Ok(ResumeStreamResponse {
                event: MessageField::some(turn_event(event)),
                ..Default::default()
            })
        })))
    }
}
