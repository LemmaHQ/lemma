//! Connect RPC shell exposing `lemma_agent::Agent` as the AgentService.

use std::sync::Arc;

use buffa::MessageField;
use connectrpc::{
    ConnectError, RequestContext, Response, ServiceRequest, ServiceResult, ServiceStream,
};
use futures::stream;
use lemma_agent::{Agent, TurnEnd, TurnEvent, TurnRequest};
use lemma_auth_rpc::require_user;
use lemma_proto::app_error;
use lemma_proto::lemma::v1::{
    AbortMessageResponse, AgentAborted, AgentDelta, AgentDone, AgentError, AgentEvent,
    AgentStarted, AgentTurnStarted, ErrorReason, ResumeStreamResponse, SendMessageRequest,
    SendMessageResponse, TextDelta, ThinkingDelta, TokenUsage, ToolCallFinished, ToolCallStarted,
    agent_delta, agent_event,
};
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use uuid::Uuid;

/// Connect handler implementing the AgentService RPCs.
pub struct AgentRpc {
    agent: Arc<Agent>,
    jwt_secret: Arc<str>,
}

impl AgentRpc {
    /// Creates the handler over the agent.
    pub fn new(agent: Arc<Agent>, jwt_secret: impl Into<Arc<str>>) -> Self {
        Self {
            agent,
            jwt_secret: jwt_secret.into(),
        }
    }
}

fn prepare_error(e: lemma_agent::AgentError) -> ConnectError {
    match e {
        lemma_agent::AgentError::ContentRequired => {
            app_error(ErrorReason::ERROR_REASON_CONTENT_REQUIRED)
        }
        lemma_agent::AgentError::ModelRequired => {
            app_error(ErrorReason::ERROR_REASON_MODEL_REQUIRED)
        }
        lemma_agent::AgentError::ProviderNotFound => {
            app_error(ErrorReason::ERROR_REASON_PROVIDER_NOT_FOUND)
        }
        other => ConnectError::internal(other.to_string()),
    }
}

#[allow(refining_impl_trait)]
impl lemma_proto::lemma::v1::AgentService for AgentRpc {
    async fn send_message(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, SendMessageRequest>,
    ) -> ServiceResult<ServiceStream<SendMessageResponse>> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
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

        let (tx, rx) = mpsc::channel::<Result<SendMessageResponse, ConnectError>>(100);
        let client_msg_id = request.client_msg_id.to_string();
        tokio::spawn(async move {
            let send = |event: AgentEvent| {
                let _ = tx.try_send(Ok(SendMessageResponse {
                    event: MessageField::some(event),
                    ..Default::default()
                }));
            };
            match turn.run(|ev| send(turn_event(ev, &client_msg_id))).await {
                Ok(TurnEnd::Done) => {}
                Ok(TurnEnd::Aborted) => send(aborted_event()),
                Err(e) => send(error_event(&e.to_string())),
            }
        });

        Response::stream_ok(Box::pin(ReceiverStream::new(rx)))
    }

    async fn abort_message(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, lemma_proto::lemma::v1::AbortMessageRequest>,
    ) -> ServiceResult<AbortMessageResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        self.agent.abort(user_id, parse_uuid(request.message_id)?);
        Ok(Response::new(AbortMessageResponse {
            ..Default::default()
        }))
    }

    async fn resume_stream(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, lemma_proto::lemma::v1::ResumeStreamRequest>,
    ) -> ServiceResult<ServiceStream<ResumeStreamResponse>> {
        let _user_id = require_user(&self.jwt_secret, &ctx)?;
        Response::stream_ok(Box::pin(stream::empty()))
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
        } => tool_call_started_event(&id, &name, &arguments),
        TurnEvent::ToolFinished {
            id,
            name,
            content,
            is_error,
        } => tool_call_finished_event(&id, &name, &content, is_error),
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

fn done_event(usage: Option<lemma_core::Usage>) -> AgentEvent {
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

fn tool_call_started_event(call_id: &str, name: &str, arguments: &str) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::ToolCallStarted(Box::new(
            ToolCallStarted {
                call_id: call_id.to_string(),
                name: name.to_string(),
                arguments: arguments.to_string(),
                ..Default::default()
            },
        ))),
        ..Default::default()
    }
}

fn tool_call_finished_event(
    call_id: &str,
    name: &str,
    content: &str,
    is_error: bool,
) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::ToolCallFinished(Box::new(
            ToolCallFinished {
                call_id: call_id.to_string(),
                name: name.to_string(),
                content: content.to_string(),
                is_error,
                ..Default::default()
            },
        ))),
        ..Default::default()
    }
}

fn parse_uuid(s: &str) -> Result<Uuid, ConnectError> {
    Uuid::parse_str(s).map_err(|_| app_error(ErrorReason::ERROR_REASON_ID_INVALID))
}
