//! Connectivity check outcomes against scripted upstream answers.

use futures::executor::block_on;
use futures::stream;
use lemma_core::{StopReason, StreamEvent};
use lemma_model::{
    Adapter, BoxEventStream, Connector, Endpoint, ModelError, ModelRequest, ProviderKind,
};
use lemma_provider::{ProviderError, ProviderService};
use sea_orm::DatabaseConnection;

struct ScriptedAdapter;

impl Adapter for ScriptedAdapter {
    async fn stream(&self, req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        let events = match req.model.as_str() {
            "answers" => vec![
                Ok(StreamEvent::Start),
                Ok(StreamEvent::TextStart),
                Ok(StreamEvent::TextDelta {
                    delta: "pong".to_owned(),
                }),
            ],
            "errors-in-stream" => vec![
                Ok(StreamEvent::Start),
                Ok(StreamEvent::Error {
                    message: "model overloaded".to_owned(),
                }),
            ],
            "closes-early" => vec![Ok(StreamEvent::Start)],
            "finishes-empty" => vec![
                Ok(StreamEvent::Start),
                Ok(StreamEvent::Done {
                    stop_reason: StopReason::Stop,
                    usage: None,
                }),
            ],
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

fn check(model: &str) -> Result<(), ProviderError> {
    let service = ProviderService::new(DatabaseConnection::default(), None, ScriptedConnector);
    let endpoint = Endpoint {
        kind: ProviderKind::OpenAiCompatible,
        base_url: "https://api.example.com/v1".to_owned(),
        api_path: String::new(),
        models_path: String::new(),
        api_key: "sk-test".to_owned(),
    };
    block_on(service.check_adhoc(endpoint, model))
}

fn check_failure(model: &str) -> String {
    match check(model) {
        Err(ProviderError::Check(message)) => message,
        other => panic!("expected a check failure for {model}, got {other:?}"),
    }
}

#[test]
fn a_model_that_starts_answering_passes() {
    assert!(check("answers").is_ok());
}

#[test]
fn a_model_that_finishes_without_text_passes() {
    assert!(check("finishes-empty").is_ok());
}

#[test]
fn a_rejected_request_fails_with_the_upstream_message() {
    assert_eq!(check_failure("missing"), "HTTP 404: model not found");
}

#[test]
fn an_error_event_fails_with_its_message() {
    assert_eq!(check_failure("errors-in-stream"), "model overloaded");
}

#[test]
fn a_stream_that_closes_before_answering_fails() {
    assert_eq!(
        check_failure("closes-early"),
        "stream ended without a response"
    );
}
