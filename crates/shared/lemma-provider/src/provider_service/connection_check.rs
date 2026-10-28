use futures::StreamExt;
use lemma_core::{ContentBlock, Message, StreamEvent, TextContent};
use lemma_model::{Adapter, Connector, Endpoint, ModelRequest};
use uuid::Uuid;

use crate::provider_error::ProviderError;

use super::providers::ProviderService;

const CHECK_PROMPT: &str = "ping";

impl<C: Connector> ProviderService<C> {
    /// Sends a one-message generation request for `model` through a stored
    /// provider and succeeds once the model starts answering.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when the user owns no such provider,
    /// [`ProviderError::Crypto`] when opening the key fails,
    /// [`ProviderError::Check`] when the upstream call fails, and
    /// [`ProviderError::Store`] when the database fails.
    pub async fn check_for(
        &self,
        user_id: Uuid,
        id: Uuid,
        model: &str,
    ) -> Result<(), ProviderError> {
        let endpoint = self.endpoint(user_id, id).await?;
        self.check(endpoint, model).await
    }

    /// Sends a one-message generation request for `model` through ad-hoc
    /// connection details and succeeds once the model starts answering.
    ///
    /// # Errors
    ///
    /// [`ProviderError::Check`] when the upstream call fails.
    pub async fn check_adhoc(&self, endpoint: Endpoint, model: &str) -> Result<(), ProviderError> {
        let endpoint = Endpoint {
            base_url: endpoint.base_url.trim().trim_end_matches('/').to_owned(),
            api_path: endpoint.api_path.trim().to_owned(),
            ..endpoint
        };
        self.check(endpoint, model).await
    }

    async fn check(&self, endpoint: Endpoint, model: &str) -> Result<(), ProviderError> {
        let request = ModelRequest {
            model: model.to_owned(),
            messages: vec![Message::User {
                content: vec![ContentBlock::Text(TextContent {
                    text: CHECK_PROMPT.to_owned(),
                })],
            }],
            tools: Vec::new(),
            thinking_effort: None,
        };
        let mut events = self
            .connector
            .connect(endpoint)
            .stream(request)
            .await
            .map_err(|e| ProviderError::Check(e.message))?;
        while let Some(event) = events.next().await {
            match event.map_err(|e| ProviderError::Check(e.message))? {
                StreamEvent::Start => {}
                StreamEvent::Error { message } => return Err(ProviderError::Check(message)),
                _ => return Ok(()),
            }
        }
        Err(ProviderError::Check(
            "stream ended without a response".to_owned(),
        ))
    }
}
