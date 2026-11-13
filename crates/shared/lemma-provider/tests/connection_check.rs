//! Connectivity check outcomes against scripted upstream answers.

use std::error::Error;

use futures::stream;

use lemma_core::{StopReason, StreamEvent};
use lemma_model::{
    Adapter, ApiFormat, BoxEventStream, Connector, Endpoint, ModelError, ModelRequest,
};
use lemma_provider::{CreateCustomInput, ProviderError, ProviderService};

struct ScriptedAdapter;

impl Adapter for ScriptedAdapter {
    async fn stream(&self, req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        let events = match req.model.as_str() {
            "answers" => vec![
                Ok(StreamEvent::TextStart),
                Ok(StreamEvent::TextDelta {
                    delta: "pong".to_owned(),
                }),
            ],
            "errors-in-stream" => vec![Err(ModelError::new("model overloaded".to_owned()))],
            "closes-early" => Vec::new(),
            "finishes-empty" => vec![Ok(StreamEvent::Done {
                stop_reason: StopReason::Stop,
                usage: None,
            })],
            _ => return Err(ModelError::new("HTTP 404: model not found".to_owned())),
        };
        Ok(Box::pin(stream::iter(events)))
    }
}

struct ScriptedConnector;

impl Connector for ScriptedConnector {
    type Adapter = ScriptedAdapter;

    fn connect(&self, _endpoint: Endpoint) -> ScriptedAdapter {
        ScriptedAdapter
    }

    async fn list_models(&self, _endpoint: Endpoint) -> Result<Vec<String>, ModelError> {
        Ok(vec![])
    }
}

async fn check(model: &str) -> Result<(), ProviderError> {
    let db = lemma_db::in_memory().await?;
    let service = ProviderService::new(db, "test-secret-key", ScriptedConnector);
    let created = service
        .create_custom(CreateCustomInput {
            api_format: ApiFormat::OpenAiCompatible,
            identifier: "main".to_owned(),
            name: "Main".to_owned(),
            base_url: "https://api.example.com/v1".to_owned(),
            api_key: "sk-test".to_owned(),
            api_path: String::new(),
            models_path: String::new(),
            models: Vec::new(),
        })
        .await?;
    service.check(created.id, model).await
}

async fn check_failure(model: &str) -> String {
    match check(model).await {
        Err(ProviderError::Check(message)) => message,
        other => panic!("expected a check failure for {model}, got {other:?}"),
    }
}

#[tokio::test]
async fn a_model_that_starts_answering_passes() {
    assert!(
        check("answers").await.is_ok(),
        "answering model should pass"
    );
}

#[tokio::test]
async fn a_model_that_finishes_without_text_passes() {
    assert!(
        check("finishes-empty").await.is_ok(),
        "empty completion should pass"
    );
}

#[tokio::test]
async fn a_rejected_request_fails_with_the_upstream_message() {
    assert_eq!(
        check_failure("missing").await,
        "HTTP 404: model not found",
        "rejected model error message"
    );
}

#[tokio::test]
async fn a_stream_error_fails_with_its_message() {
    assert_eq!(
        check_failure("errors-in-stream").await,
        "model overloaded",
        "stream error message"
    );
}

#[tokio::test]
async fn a_stream_that_closes_before_answering_fails() {
    assert_eq!(
        check_failure("closes-early").await,
        "stream ended without a response",
        "early stream close message"
    );
}

#[tokio::test]
async fn a_blank_model_fails_before_connecting() -> Result<(), Box<dyn Error>> {
    let result = check("   ").await;
    assert!(
        matches!(result, Err(ProviderError::ModelRequired)),
        "blank model must require model: {result:?}"
    );
    Ok(())
}
