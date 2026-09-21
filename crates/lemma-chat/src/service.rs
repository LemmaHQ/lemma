//! Handler for the ChatService RPCs, driven by `lemma-agent::AgentLoop`.

use std::sync::Arc;

use buffa::MessageField;
use connectrpc::{
    ConnectError, RequestContext, Response, ServiceRequest, ServiceResult, ServiceStream,
};
use futures::stream;
use lemma_adapter::Provider;
use lemma_agent::{AgentConfig, AgentLoop, TurnEvent};
use lemma_auth::require_user;
use lemma_conversations::PgTraceStore;
use lemma_core::{ContentBlock, Message, TextContent};
use lemma_proto::app_error;
use lemma_proto::lemma::v1::{
    AbortMessageResponse, ChatDelta, ChatDone, ChatError, ChatEvent, ChatStarted, ErrorReason,
    ResumeStreamResponse, SendMessageRequest, SendMessageResponse, TokenUsage, chat_event,
};
use sqlx::PgPool;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use uuid::Uuid;

/// Connect handler implementing the ChatService RPCs.
pub struct ChatService {
    pool: PgPool,
    jwt_secret: Arc<str>,
    secret_key: Arc<str>,
    provider: Arc<dyn Provider>,
}

impl ChatService {
    /// Creates the handler with the given LLM provider.
    pub fn new(
        pool: PgPool,
        jwt_secret: impl Into<Arc<str>>,
        secret_key: impl Into<Arc<str>>,
        provider: Arc<dyn Provider>,
    ) -> Self {
        Self {
            pool,
            jwt_secret: jwt_secret.into(),
            secret_key: secret_key.into(),
            provider,
        }
    }
}

#[allow(refining_impl_trait)]
impl lemma_proto::lemma::v1::ChatService for ChatService {
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

        let provider =
            lemma_providers::providers::find_by_id_and_user(&self.pool, provider_id, user_id)
                .await
                .map_err(map_db)?
                .ok_or_else(|| app_error(ErrorReason::ERROR_REASON_PROVIDER_NOT_FOUND))?;

        let master_key = lemma_crypto::derive_key(&self.secret_key);
        let api_key = lemma_crypto::open(&master_key, &provider.api_key)
            .map_err(|_| ConnectError::internal("failed to decrypt API key"))?;

        let agent_config = AgentConfig {
            kind: crate::upstream::kind_of(lemma_providers::kind_to_proto(&provider.kind)),
            base_url: provider.base_url.clone(),
            api_path: provider.api_path.clone(),
            api_key,
            model: request.model.to_string(),
        };

        let store = Arc::new(PgTraceStore::new(self.pool.clone(), user_id));
        let agent = AgentLoop::new(store, self.provider.clone());

        let user_msg = Message::User {
            content: vec![ContentBlock::Text(TextContent {
                text: request.content.to_string(),
            })],
        };

        let (tx, rx) = mpsc::channel::<Result<SendMessageResponse, ConnectError>>(100);

        let tx_clone = tx.clone();
        tokio::spawn(async move {
            let observer: Arc<dyn Fn(TurnEvent) + Send + Sync> = Arc::new(move |ev| match ev {
                TurnEvent::UserAppended { id } => {
                    let _ = tx_clone.try_send(Ok(SendMessageResponse {
                        event: MessageField::some(started_event(id)),
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

fn started_event(id: Uuid) -> ChatEvent {
    ChatEvent {
        kind: Some(chat_event::Kind::Started(Box::new(ChatStarted {
            message_id: id.to_string(),
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn delta_event(text: String) -> ChatEvent {
    ChatEvent {
        kind: Some(chat_event::Kind::Delta(Box::new(ChatDelta {
            content: text,
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn done_event(usage: Option<lemma_core::Usage>) -> ChatEvent {
    ChatEvent {
        kind: Some(chat_event::Kind::Done(Box::new(ChatDone {
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

fn error_event(message: &str) -> ChatEvent {
    ChatEvent {
        kind: Some(chat_event::Kind::Error(Box::new(ChatError {
            message: message.to_string(),
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn parse_uuid(s: &str) -> Result<Uuid, ConnectError> {
    Uuid::parse_str(s).map_err(|_| app_error(ErrorReason::ERROR_REASON_ID_INVALID))
}

fn map_db(err: sqlx::Error) -> ConnectError {
    ConnectError::internal(format!("database error: {err}"))
}
