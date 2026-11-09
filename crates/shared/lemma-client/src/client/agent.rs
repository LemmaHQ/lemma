use lemma_proto::lemma::v1::{AbortMessageRequest, ResumeStreamRequest, SendMessageRequest};

use super::auth::bearer;
use crate::client::Client;
use crate::client_error::ClientError;
use crate::token_store::TokenStore;
use crate::turn::{EventStream, Turn};

impl<S: TokenStore> Client<S> {
    /// Sends a user message with a model choice and starts its turn.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`] when the stream cannot be opened.
    pub async fn send_message(
        &self,
        session_id: &str,
        provider_id: &str,
        model: &str,
        content: &str,
    ) -> Result<Turn<S>, ClientError> {
        let request = SendMessageRequest {
            session_id: session_id.to_owned(),
            content: content.to_owned(),
            provider_id: provider_id.to_owned(),
            model: model.to_owned(),
            ..Default::default()
        };
        Turn::open(self.clone(), request, None).await
    }

    /// Follows the running turn of user message `message_id` from its first event;
    /// a turn that has already ended yields [`TurnUpdate::Settled`](crate::TurnUpdate::Settled).
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`] when the stream cannot be opened.
    pub async fn resume_turn(&self, message_id: &str) -> Result<Turn<S>, ClientError> {
        let request = SendMessageRequest::default();
        Turn::open(self.clone(), request, Some(message_id.to_owned())).await
    }

    /// Stops the running turn of user message `message_id`; its stream then ends with an aborted event.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`].
    pub async fn abort_message(&self, message_id: &str) -> Result<(), ClientError> {
        let agent = &self.inner.agent;
        self.authorized(async |options| {
            let request = AbortMessageRequest {
                message_id: message_id.to_owned(),
                ..Default::default()
            };
            agent.abort_message_with_options(request, options).await
        })
        .await?;
        Ok(())
    }

    /// Opens the stream of a turn with `token`: resumed after `offset` events once its message id is known, else sent.
    pub(crate) async fn open_stream(
        &self,
        request: &SendMessageRequest,
        message_id: Option<&str>,
        offset: i64,
        token: Option<&str>,
    ) -> Result<EventStream, ClientError> {
        let agent = &self.inner.agent;
        let options = bearer(token);
        let Some(message_id) = message_id else {
            let stream = agent.send_message_with_options(request.clone(), options);
            return Ok(EventStream::Send(stream.await?));
        };
        let request = ResumeStreamRequest {
            message_id: message_id.to_owned(),
            offset,
            ..Default::default()
        };
        Ok(EventStream::Resume(
            agent.resume_stream_with_options(request, options).await?,
        ))
    }
}
