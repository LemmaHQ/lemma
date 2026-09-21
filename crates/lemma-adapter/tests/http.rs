#![allow(clippy::unwrap_used, missing_docs)]

use std::sync::Arc;

use axum::Router;
use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use futures::StreamExt;
use lemma_adapter::{
    AnthropicMessages, ChatRequest, DispatchProvider, GeminiGenerate, OpenAiCompatible, Provider,
    ProviderKind,
};
use lemma_core::{ContentBlock, Message, StopReason, StreamEvent, TextContent};
use parking_lot::Mutex;

#[derive(Default)]
struct Hits {
    method: String,
    path: String,
    bearer: String,
    x_api_key: String,
    goog_key: String,
    anthropic_version: String,
    body: serde_json::Value,
}
type SharedHits = Arc<Mutex<Option<Hits>>>;

fn h(headers: &axum::http::HeaderMap, name: &str) -> String {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_string()
}

async fn upstream(State(hits): State<SharedHits>, req: Request<Body>) -> Response {
    let method = req.method().to_string();
    let path = req.uri().path().to_string();
    let headers = req.headers().clone();
    let bytes = axum::body::to_bytes(req.into_body(), usize::MAX)
        .await
        .unwrap();
    *hits.lock() = Some(Hits {
        method,
        path: path.clone(),
        bearer: h(&headers, "authorization"),
        x_api_key: h(&headers, "x-api-key"),
        goog_key: h(&headers, "x-goog-api-key"),
        anthropic_version: h(&headers, "anthropic-version"),
        body: serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null),
    });

    if path == "/fail" {
        return (StatusCode::INTERNAL_SERVER_ERROR, "boom").into_response();
    }
    let sse = if path.contains("chat/completions") {
        concat(&[
            "data: {\"choices\":[{\"delta\":{\"content\":\"你\"}}]}\n\n",
            "data: {\"choices\":[{\"delta\":{\"content\":\"好\"}}]}\n\n",
            "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":12,\"completion_tokens\":3}}\n\n",
            "data: [DONE]\n\n",
        ])
    } else if path.contains("/messages") {
        concat(&[
            "data: {\"type\":\"message_start\",\"message\":{\"usage\":{\"input_tokens\":10}}}\n\n",
            "data: {\"type\":\"content_block_delta\",\"delta\":{\"text\":\"你\"}}\n\n",
            "data: {\"type\":\"content_block_delta\",\"delta\":{\"text\":\"好\"}}\n\n",
            "data: {\"type\":\"message_delta\",\"usage\":{\"output_tokens\":5}}\n\n",
            "data: {\"type\":\"message_stop\"}\n\n",
        ])
    } else {
        concat(&[
            "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"你\"}]}}]}\n\n",
            "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"好\"}]}}]}\n\n",
            "data: {\"candidates\":[],\"usageMetadata\":{\"promptTokenCount\":7,\"candidatesTokenCount\":8}}\n\n",
        ])
    };
    ([(header::CONTENT_TYPE, "text/event-stream")], sse).into_response()
}

fn concat(parts: &[&str]) -> String {
    parts.concat()
}

async fn spawn_fake() -> (String, SharedHits) {
    let hits: SharedHits = Arc::new(Mutex::new(None));
    let app = Router::new()
        .fallback(post(upstream))
        .with_state(hits.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    (format!("http://{addr}"), hits)
}

fn text(s: &str) -> ContentBlock {
    ContentBlock::Text(TextContent {
        text: s.to_string(),
    })
}

fn chat_request(kind: ProviderKind, base: &str, api_path: &str, model: &str) -> ChatRequest {
    ChatRequest {
        kind,
        base_url: base.into(),
        api_path: api_path.into(),
        api_key: "sk-live-123456".into(),
        model: model.into(),
        messages: vec![
            Message::User {
                content: vec![text("hi")],
            },
            Message::Assistant {
                content: vec![text("yo")],
                stop_reason: StopReason::Stop,
                usage: None,
            },
        ],
    }
}

async fn collect(provider: &dyn Provider, req: ChatRequest) -> Vec<StreamEvent> {
    provider
        .stream(req)
        .await
        .unwrap()
        .map(|r| r.unwrap())
        .collect()
        .await
}

fn take_hits(hits: &SharedHits) -> Hits {
    hits.lock().take().unwrap()
}

fn assert_text_lifecycle(events: &[StreamEvent], expected_total: i64) {
    assert_eq!(events.len(), 6, "got: {events:?}");
    assert!(matches!(&events[0], StreamEvent::Start));
    assert!(matches!(&events[1], StreamEvent::TextStart));
    assert!(matches!(&events[2], StreamEvent::TextDelta { delta } if delta == "你"));
    assert!(matches!(&events[3], StreamEvent::TextDelta { delta } if delta == "好"));
    assert!(matches!(&events[4], StreamEvent::TextEnd));
    assert!(
        matches!(&events[5], StreamEvent::Done { stop_reason: StopReason::Stop, usage: Some(u) } if u.input + u.output == expected_total)
    );
}

#[tokio::test]
async fn openai_streams_over_http() {
    let (base, hits) = spawn_fake().await;
    let events = collect(
        &OpenAiCompatible::new(),
        chat_request(ProviderKind::OpenAiCompatible, &base, "", "gpt-x"),
    )
    .await;

    assert_text_lifecycle(&events, 15);

    let hit = take_hits(&hits);
    assert_eq!(hit.method, "POST");
    assert_eq!(hit.path, "/chat/completions");
    assert_eq!(hit.bearer, "Bearer sk-live-123456");
    assert_eq!(hit.body["model"], "gpt-x");
    assert_eq!(hit.body["stream"], true);
    assert_eq!(hit.body["messages"][0]["content"], "hi");
}

#[tokio::test]
async fn anthropic_streams_over_http() {
    let (base, hits) = spawn_fake().await;
    let events = collect(
        &AnthropicMessages::new(),
        chat_request(ProviderKind::Anthropic, &base, "", "claude-x"),
    )
    .await;

    assert_text_lifecycle(&events, 15);

    let hit = take_hits(&hits);
    assert_eq!(hit.path, "/messages");
    assert_eq!(hit.x_api_key, "sk-live-123456");
    assert_eq!(hit.anthropic_version, "2023-06-01");
    assert_eq!(hit.body["max_tokens"], 8192);
}

#[tokio::test]
async fn gemini_streams_over_http_and_model_in_path() {
    let (base, hits) = spawn_fake().await;
    let events = collect(
        &GeminiGenerate::new(),
        chat_request(ProviderKind::Gemini, &base, "", "gemini-x"),
    )
    .await;

    assert_text_lifecycle(&events, 15);

    let hit = take_hits(&hits);
    assert_eq!(hit.path, "/models/gemini-x:streamGenerateContent");
    assert_eq!(hit.goog_key, "sk-live-123456");
    assert_eq!(hit.body["contents"][1]["role"], "model");
    assert_eq!(hit.body["contents"][0]["parts"][0]["text"], "hi");
}

#[tokio::test]
async fn upstream_error_maps_to_provider_error() {
    let (base, _hits) = spawn_fake().await;
    let err = OpenAiCompatible::new()
        .stream(chat_request(
            ProviderKind::OpenAiCompatible,
            &base,
            "/fail",
            "gpt-x",
        ))
        .await
        .err()
        .unwrap();
    assert!(
        err.message.starts_with("upstream 500"),
        "got: {}",
        err.message
    );
    assert!(err.message.contains("boom"));
}

#[tokio::test]
async fn dispatch_routes_by_kind() {
    let (base, hits) = spawn_fake().await;
    let events = collect(
        &DispatchProvider::new(),
        chat_request(ProviderKind::Gemini, &base, "", "gemini-x"),
    )
    .await;

    assert_eq!(events.len(), 6);
    let hit = take_hits(&hits);
    assert!(hit.path.contains("streamGenerateContent"));
}
