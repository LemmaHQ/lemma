//! Connect RPC shell exposing `lemma-agent::AgentLoop` as the AgentService.

use std::str::FromStr;
use std::sync::Arc;

use buffa::MessageField;
use connectrpc::{
    ConnectError, RequestContext, Response, ServiceRequest, ServiceResult, ServiceStream,
};
use futures::stream;
use lemma_adapter::{Provider, ProviderKind};
use lemma_agent::{AgentConfig, AgentLoop, TurnEvent};
use lemma_auth_rpc::require_user;
use lemma_core::{ContentBlock, Message, TextContent};
use lemma_proto::app_error;
use lemma_proto::lemma::v1::{
    AbortMessageResponse, AgentDelta, AgentDone, AgentError, AgentEvent, AgentStarted, ErrorReason,
    ResumeStreamResponse, SendMessageRequest, SendMessageResponse, TokenUsage, agent_event,
};
use lemma_provider::{ProviderKind as DomainKind, ProviderStore};
use lemma_session::TraceStore;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use uuid::Uuid;

/// Maps the domain provider kind onto the adapter provider kind.
fn kind_of(kind: DomainKind) -> ProviderKind {
    match kind {
        DomainKind::Anthropic => ProviderKind::Anthropic,
        DomainKind::Gemini => ProviderKind::Gemini,
        DomainKind::OpenAiCompatible => ProviderKind::OpenAiCompatible,
    }
}

/// Factory producing a user-scoped trace store per request.
pub type TraceStoreFactory = Arc<dyn Fn(Uuid) -> Arc<dyn TraceStore> + Send + Sync>;

/// Connect handler implementing the AgentService RPCs.
pub struct AgentRpc {
    traces: TraceStoreFactory,
    providers: Arc<dyn ProviderStore>,
    jwt_secret: Arc<str>,
    secret_key: Arc<str>,
    provider: Arc<dyn Provider>,
}

impl AgentRpc {
    /// Creates the handler over injected stores with the given LLM provider.
    pub fn new(
        traces: TraceStoreFactory,
        providers: Arc<dyn ProviderStore>,
        jwt_secret: impl Into<Arc<str>>,
        secret_key: impl Into<Arc<str>>,
        provider: Arc<dyn Provider>,
    ) -> Self {
        Self {
            traces,
            providers,
            jwt_secret: jwt_secret.into(),
            secret_key: secret_key.into(),
            provider,
        }
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

        let conversation_id = parse_uuid(request.conversation_id)?;
        let provider_id = parse_uuid(request.provider_id)?;

        if request.content.trim().is_empty() {
            return Err(app_error(ErrorReason::ERROR_REASON_CONTENT_REQUIRED));
        }

        if request.model.trim().is_empty() {
            return Err(app_error(ErrorReason::ERROR_REASON_MODEL_REQUIRED));
        }

        let provider = self
            .providers
            .get(user_id, provider_id)
            .await
            .map_err(|e| ConnectError::internal(format!("provider store: {e}")))?
            .ok_or_else(|| app_error(ErrorReason::ERROR_REASON_PROVIDER_NOT_FOUND))?;

        let master_key = lemma_crypto::derive_key(&self.secret_key);
        let api_key = lemma_crypto::open(&master_key, &provider.api_key)
            .map_err(|_| ConnectError::internal("failed to decrypt API key"))?;

        let kind = DomainKind::from_str(&provider.kind).map_err(|()| {
            ConnectError::internal(format!("unknown provider kind: {}", provider.kind))
        })?;

        let agent_config = AgentConfig {
            kind: kind_of(kind),
            base_url: provider.base_url.clone(),
            api_path: provider.api_path.clone(),
            api_key,
            model: request.model.to_string(),
            provider_id: provider.id,
            thinking_effort: None,
        };

        let agent = AgentLoop::new((self.traces)(user_id), self.provider.clone());

        let user_msg = Message::User {
            content: vec![ContentBlock::Text(TextContent {
                text: request.content.to_string(),
            })],
        };

        let (tx, rx) = mpsc::channel::<Result<SendMessageResponse, ConnectError>>(100);

        let tx_clone = tx.clone();
        let client_msg_id = request.client_msg_id.to_string();
        tokio::spawn(async move {
            let observer: Arc<dyn Fn(TurnEvent) + Send + Sync> = Arc::new(move |ev| match ev {
                TurnEvent::UserAppended { id } => {
                    let _ = tx_clone.try_send(Ok(SendMessageResponse {
                        event: MessageField::some(started_event(id, client_msg_id.clone())),
                        ..Default::default()
                    }));
                }
                TurnEvent::Delta { delta } => {
                    let _ = tx_clone.try_send(Ok(SendMessageResponse {
                        event: MessageField::some(delta_event(delta)),
                        ..Default::default()
                    }));
                }
                TurnEvent::AssistantDone { usage, .. } => {
                    let _ = tx_clone.try_send(Ok(SendMessageResponse {
                        event: MessageField::some(done_event(usage)),
                        ..Default::default()
                    }));
                }
            });

            if let Err(e) = agent
                .run_turn_observed(
                    conversation_id,
                    user_msg,
                    None,
                    agent_config,
                    Some(observer),
                )
                .await
            {
                let _ = tx.try_send(Ok(SendMessageResponse {
                    event: MessageField::some(error_event(&e.to_string())),
                    ..Default::default()
                }));
            }
        });

        Response::stream_ok(Box::pin(ReceiverStream::new(rx)))
    }

    async fn abort_message(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, lemma_proto::lemma::v1::AbortMessageRequest>,
    ) -> ServiceResult<AbortMessageResponse> {
        let _user_id = require_user(&self.jwt_secret, &ctx)?;
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

fn delta_event(text: String) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::Delta(Box::new(AgentDelta {
            content: text,
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

fn parse_uuid(s: &str) -> Result<Uuid, ConnectError> {
    Uuid::parse_str(s).map_err(|_| app_error(ErrorReason::ERROR_REASON_ID_INVALID))
}
