use std::fmt;
use std::time::Duration;

use axum::body::Body;
use connectrpc::ConnectError;
use connectrpc::client::ServerStream;
use lemma_proto::lemma::v1::{
    AgentEvent, ErrorReason, ResumeStreamResponse, ResumeStreamResponseView, SendMessageRequest,
    SendMessageResponse, SendMessageResponseView, agent_event,
};
use tokio::time;

use crate::client::Client;
use crate::client_error::ClientError;
use crate::token_store::TokenStore;

const MAX_RESUMES: u32 = 3;
const RESUME_BACKOFF: Duration = Duration::from_millis(500);

/// The event stream of one turn; after a break it resumes from the events already received.
pub struct Turn<S> {
    client: Client<S>,
    request: SendMessageRequest,
    token: Option<String>,
    stream: Option<EventStream>,
    message_id: Option<String>,
    received: i64,
    resumes: u32,
    refreshed: bool,
}

/// What following a turn yields.
#[derive(Debug)]
pub enum TurnUpdate {
    /// The next event, to fold into the open session.
    Event(AgentEvent),
    /// The turn ended while the stream was away; read the newest messages instead.
    Settled,
    /// The stream broke and could not resume.
    Failed(ClientError),
}

impl<S: TokenStore> Turn<S> {
    /// Sends `request`, or follows the turn of `message_id` when it is known.
    pub(crate) async fn open(
        client: Client<S>,
        request: SendMessageRequest,
        message_id: Option<String>,
    ) -> Result<Self, ClientError> {
        let token = client.access_token();
        let stream = client
            .open_stream(&request, message_id.as_deref(), 0, token.as_deref())
            .await?;
        Ok(Self {
            client,
            request,
            token,
            stream: Some(stream),
            message_id,
            received: 0,
            resumes: 0,
            refreshed: false,
        })
    }

    /// The user message id that identifies the turn, known from its `started` event.
    #[must_use]
    pub fn message_id(&self) -> Option<&str> {
        self.message_id.as_deref()
    }

    /// The next update, or `None` once the stream has ended.
    ///
    /// A rejected access token is refreshed once. A broken stream resumes up to three times,
    /// waiting 500 ms longer before each attempt; a turn that has not reported its `started`
    /// event cannot resume.
    pub async fn next(&mut self) -> Option<TurnUpdate> {
        loop {
            let stream = self.stream.as_mut()?;
            let error = match stream.next_event().await {
                Ok(Some(event)) => return Some(self.receive(event)),
                Ok(None) => {
                    self.stream = None;
                    return None;
                }
                Err(error) => ClientError::from(error),
            };
            self.stream = None;
            if let Err(end) = self.recover(error).await {
                return Some(end);
            }
        }
    }

    /// Reopens the stream after `error`, or returns how the turn ends.
    async fn recover(&mut self, mut error: ClientError) -> Result<(), TurnUpdate> {
        loop {
            match error.reason() {
                Some(ErrorReason::TurnNotRunning) => return Err(TurnUpdate::Settled),
                Some(ErrorReason::TokenInvalid) if !self.refreshed => {
                    self.refreshed = true;
                    let token = self.client.refresh(self.token.as_deref()).await;
                    self.token = Some(token.map_err(TurnUpdate::Failed)?);
                }
                _ if self.message_id.is_none() || self.resumes == MAX_RESUMES => {
                    return Err(TurnUpdate::Failed(error));
                }
                _ => {
                    self.resumes += 1;
                    time::sleep(RESUME_BACKOFF * self.resumes).await;
                }
            }
            let reopened = self.client.open_stream(
                &self.request,
                self.message_id.as_deref(),
                self.received,
                self.token.as_deref(),
            );
            match reopened.await {
                Ok(stream) => {
                    self.stream = Some(stream);
                    return Ok(());
                }
                Err(next) => error = next,
            }
        }
    }

    fn receive(&mut self, event: AgentEvent) -> TurnUpdate {
        self.received += 1;
        if let Some(agent_event::Kind::Started(started)) = &event.kind {
            self.message_id = Some(started.message_id.clone());
        }
        TurnUpdate::Event(event)
    }
}

impl<S> fmt::Debug for Turn<S> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Turn")
            .field("message_id", &self.message_id)
            .field("received", &self.received)
            .field("resumes", &self.resumes)
            .finish_non_exhaustive()
    }
}

/// The open stream of a sent message or of a resumed turn.
pub(crate) enum EventStream {
    Send(ServerStream<Body, SendMessageResponseView<'static>>),
    Resume(ServerStream<Body, ResumeStreamResponseView<'static>>),
}

impl EventStream {
    async fn next_event(&mut self) -> Result<Option<AgentEvent>, ConnectError> {
        Ok(match self {
            Self::Send(stream) => stream
                .message::<SendMessageResponse>()
                .await?
                .map(|message| {
                    message
                        .to_owned_message()
                        .event
                        .into_option()
                        .unwrap_or_default()
                }),
            Self::Resume(stream) => {
                stream
                    .message::<ResumeStreamResponse>()
                    .await?
                    .map(|message| {
                        message
                            .to_owned_message()
                            .event
                            .into_option()
                            .unwrap_or_default()
                    })
            }
        })
    }
}
