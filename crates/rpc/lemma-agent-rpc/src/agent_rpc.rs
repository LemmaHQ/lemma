//! Handler for the `AgentService` RPCs.

use std::fmt::{self, Debug};
use std::sync::Arc;

use buffa::MessageField;
use chrono::Utc;
use connectrpc::{
    ConnectError, RequestContext, Response, ServiceRequest, ServiceResult, ServiceStream,
};
use lemma_agent::{Agent, AgentError as TurnError, TurnEnd, TurnRequest};
use lemma_agent_loop::LoopError;
use lemma_model::Connector;
use lemma_proto::lemma::v1;
use lemma_proto::lemma::v1::{
    AbortMessageRequest, AbortMessageResponse, ErrorReason, ResumeStreamRequest,
    ResumeStreamResponse, SendMessageRequest, SendMessageResponse,
};
use uuid::Uuid;

use crate::agent_event::{error_event, turn_event};
use crate::live_turns::LiveTurns;

/// Connect handler implementing the `AgentService` RPCs.
///
/// A turn runs to its end independently of its streams: a client that loses
/// the `SendMessage` stream resumes it with `ResumeStream`, and only
/// `AbortMessage` stops the turn early.
pub struct AgentRpc<C> {
    agent: Agent<C>,
    jwt_secret: String,
    live: Arc<LiveTurns>,
}

impl<C: Debug> Debug for AgentRpc<C> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AgentRpc")
            .field("agent", &self.agent)
            .field("live", &self.live)
            .finish_non_exhaustive()
    }
}

impl<C: Connector> AgentRpc<C> {
    /// Creates the handler over the agent.
    #[must_use]
    pub fn new(agent: Agent<C>, jwt_secret: String) -> Self {
        Self {
            agent,
            jwt_secret,
            live: Arc::default(),
        }
    }
}

fn prepare_error(e: TurnError) -> ConnectError {
    match e {
        TurnError::ContentRequired => {
            lemma_proto::app_error(ErrorReason::ERROR_REASON_CONTENT_REQUIRED)
        }
        TurnError::ModelRequired => {
            lemma_proto::app_error(ErrorReason::ERROR_REASON_MODEL_REQUIRED)
        }
        TurnError::ProviderNotFound => {
            lemma_proto::app_error(ErrorReason::ERROR_REASON_PROVIDER_NOT_FOUND)
        }
        other => ConnectError::internal(other.to_string()),
    }
}

#[allow(refining_impl_trait)]
impl<C: Connector> v1::AgentService for AgentRpc<C> {
    async fn send_message(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, SendMessageRequest>,
    ) -> ServiceResult<ServiceStream<SendMessageResponse>> {
        use futures::StreamExt;

        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let turn = self
            .agent
            .prepare(TurnRequest {
                user_id,
                conversation_id: parse_uuid(request.conversation_id)?,
                provider_id: parse_uuid(request.provider_id)?,
                model: request.model.to_string(),
                content: request.content.to_string(),
                thinking_effort: Some(request.thinking_effort.to_string()),
            })
            .await
            .map_err(prepare_error)?;

        let user_message_id = turn.user_message_id();
        let (writer, events) = self.live.start(user_id, user_message_id);
        let client_msg_id = request.client_msg_id.to_string();
        tokio::spawn(async move {
            match turn
                .run(|ev| writer.push(turn_event(ev, &client_msg_id)))
                .await
            {
                Ok(TurnEnd::Done) | Ok(TurnEnd::Aborted) => {}
                Err(e) => {
                    if !matches!(&e, TurnError::Loop(LoopError::Model(_))) {
                        writer.push(error_event(&e.to_string(), Utc::now()));
                    }
                }
            }
        });

        Response::stream_ok(Box::pin(events.map(|event| {
            Ok(SendMessageResponse {
                event: MessageField::some(event),
                ..Default::default()
            })
        })))
    }

    async fn abort_message(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, AbortMessageRequest>,
    ) -> ServiceResult<AbortMessageResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        self.agent.abort(user_id, parse_uuid(request.message_id)?);
        Ok(Response::new(AbortMessageResponse {
            ..Default::default()
        }))
    }

    async fn resume_stream(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, ResumeStreamRequest>,
    ) -> ServiceResult<ServiceStream<ResumeStreamResponse>> {
        use futures::StreamExt;

        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let offset = usize::try_from(request.offset)
            .map_err(|_| ConnectError::invalid_argument("offset is negative"))?;
        let events = self
            .live
            .follow(user_id, parse_uuid(request.message_id)?, offset)
            .ok_or_else(|| lemma_proto::app_error(ErrorReason::ERROR_REASON_TURN_NOT_RUNNING))?;
        Response::stream_ok(Box::pin(events.map(|event| {
            Ok(ResumeStreamResponse {
                event: MessageField::some(event),
                ..Default::default()
            })
        })))
    }
}

fn parse_uuid(s: &str) -> Result<Uuid, ConnectError> {
    Uuid::parse_str(s).map_err(|_| lemma_proto::app_error(ErrorReason::ERROR_REASON_ID_INVALID))
}
