//! Handler for the `AgentService` RPCs.

use std::fmt::{self, Debug};
use std::sync::Arc;

use buffa::MessageField;
use connectrpc::{
    ConnectError, RequestContext, Response, ServiceRequest, ServiceResult, ServiceStream,
};
use lemma_agent::{Agent, AgentError as TurnError, TurnEnd, TurnEvent, TurnRequest};
use lemma_conversation::ConversationStore;
use lemma_core::Usage;
use lemma_model::Connector;
use lemma_proto::lemma::v1;
use lemma_proto::lemma::v1::{
    AbortMessageRequest, AbortMessageResponse, AgentAborted, AgentDelta, AgentDone, AgentError,
    AgentEvent, AgentStarted, AgentTurnStarted, ErrorReason, ResumeStreamRequest,
    ResumeStreamResponse, SendMessageRequest, SendMessageResponse, TextDelta, ThinkingDelta,
    TokenUsage, ToolCallFinished, ToolCallStarted, agent_delta, agent_event,
};
use lemma_provider::ProviderStore;
use uuid::Uuid;

use crate::live_turns::LiveTurns;

/// Connect handler implementing the `AgentService` RPCs.
///
/// A turn runs to its end independently of its streams: a client that loses
/// the `SendMessage` stream resumes it with `ResumeStream`, and only
/// `AbortMessage` stops the turn early.
pub struct AgentRpc<S, P, C> {
    agent: Agent<S, P, C>,
    jwt_secret: String,
    live: Arc<LiveTurns>,
}

impl<S: Debug, P: Debug, C: Debug> Debug for AgentRpc<S, P, C> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AgentRpc")
            .field("agent", &self.agent)
            .field("live", &self.live)
            .finish_non_exhaustive()
    }
}

impl<S: ConversationStore, P: ProviderStore, C: Connector> AgentRpc<S, P, C> {
    /// Creates the handler over the agent.
    pub fn new(agent: Agent<S, P, C>, jwt_secret: String) -> Self {
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
impl<S: ConversationStore, P: ProviderStore, C: Connector> v1::AgentService for AgentRpc<S, P, C> {
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
                Ok(TurnEnd::Done) => {}
                Ok(TurnEnd::Aborted) => writer.push(aborted_event()),
                Err(e) => writer.push(error_event(&e.to_string())),
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

fn turn_event(ev: TurnEvent, client_msg_id: &str) -> AgentEvent {
    match ev {
        TurnEvent::UserAppended { id } => started_event(id, client_msg_id.to_string()),
        TurnEvent::AssistantStarted { id } => turn_started_event(id),
        TurnEvent::Delta { delta } => text_delta_event(delta),
        TurnEvent::ThinkingDelta { delta } => thinking_delta_event(delta),
        TurnEvent::ToolStarted {
            id,
            name,
            arguments,
        } => tool_call_started_event(id, name, arguments),
        TurnEvent::ToolFinished {
            id,
            name,
            content,
            is_error,
        } => tool_call_finished_event(id, name, content, is_error),
        TurnEvent::AssistantDone { usage, .. } => done_event(usage),
    }
}

fn aborted_event() -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::Aborted(Box::new(AgentAborted {
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn started_event(id: Uuid, client_msg_id: String) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::Started(Box::new(AgentStarted {
            message_id: id.to_string(),
            client_msg_id,
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn text_delta_event(text: String) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::Delta(Box::new(AgentDelta {
            part: Some(agent_delta::Part::Text(Box::new(TextDelta {
                content: text,
                ..Default::default()
            }))),
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn thinking_delta_event(thinking: String) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::Delta(Box::new(AgentDelta {
            part: Some(agent_delta::Part::Thinking(Box::new(ThinkingDelta {
                content: thinking,
                ..Default::default()
            }))),
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn done_event(usage: Option<Usage>) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::Done(Box::new(AgentDone {
            usage: usage
                .map(|u| {
                    MessageField::some(TokenUsage {
                        prompt_tokens: u.input as i32,
                        completion_tokens: u.output as i32,
                        total_tokens: (u.input + u.output) as i32,
                        ..Default::default()
                    })
                })
                .unwrap_or_default(),
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn error_event(message: &str) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::Error(Box::new(AgentError {
            message: message.to_string(),
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn turn_started_event(id: Uuid) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::TurnStarted(Box::new(AgentTurnStarted {
            message_id: id.to_string(),
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn tool_call_started_event(call_id: String, name: String, arguments: String) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::ToolCallStarted(Box::new(
            ToolCallStarted {
                call_id,
                name,
                arguments,
                ..Default::default()
            },
        ))),
        ..Default::default()
    }
}

fn tool_call_finished_event(
    call_id: String,
    name: String,
    content: String,
    is_error: bool,
) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::ToolCallFinished(Box::new(
            ToolCallFinished {
                call_id,
                name,
                content,
                is_error,
                ..Default::default()
            },
        ))),
        ..Default::default()
    }
}

fn parse_uuid(s: &str) -> Result<Uuid, ConnectError> {
    Uuid::parse_str(s).map_err(|_| lemma_proto::app_error(ErrorReason::ERROR_REASON_ID_INVALID))
}
