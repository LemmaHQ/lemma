use futures::StreamExt;
use uuid::Uuid;

use lemma_core::{ContentBlock, Message, TextContent};
use lemma_model::{Adapter, Connector, ModelRequest};

use crate::provider_error::ProviderError;

use super::providers::ProviderService;

const CHECK_PROMPT: &str = "ping";

impl<C: Connector> ProviderService<C> {
    /// Sends a one-message generation request for `model` through a stored
    /// provider and succeeds once the model starts answering.
    ///
    /// # Errors
    ///
    /// [`ProviderError::ModelRequired`] when `model` is blank,
    /// [`ProviderError::NotFound`] when no such provider exists,
    /// [`ProviderError::Crypto`] when opening the key fails,
    /// [`ProviderError::Check`] when the upstream call fails, and
    /// [`ProviderError::Store`] when the database fails.
    pub async fn check(&self, id: Uuid, model: &str) -> Result<(), ProviderError> {
        let model = model.trim();
        if model.is_empty() {
            return Err(ProviderError::ModelRequired);
        }
        let endpoint = self.endpoint(id).await?;
        let request = ModelRequest {
            model: model.to_owned(),
            system_prompt: None,
            messages: vec![Message::User {
                content: vec![ContentBlock::Text(TextContent {
                    text: CHECK_PROMPT.to_owned(),
                })],
            }],
            tools: Vec::new(),
        };
        let mut events = self
            .connector
            .connect(endpoint)
            .stream(request)
            .await
            .map_err(|e| ProviderError::Check(e.message))?;
        match events.next().await {
            Some(event) => event
                .map(|_| ())
                .map_err(|e| ProviderError::Check(e.message)),
            None => Err(ProviderError::Check(
                "stream ended without a response".to_owned(),
            )),
        }
    }
}
