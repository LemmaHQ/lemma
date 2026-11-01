//! The adapters and model listing through `HttpConnector`, over a transport
//! that records each request and replays a vendor response written in the
//! test.

use std::error::Error;
use std::sync::{Arc, Mutex, PoisonError};

use futures::{StreamExt, stream};
use lemma_adapter::{ByteStream, HttpConnector, HttpTransport};
use lemma_core::{
    ContentBlock, Message, StopReason, StreamEvent, TextContent, ThinkingContent, ToolCall,
    ToolSpec, Usage,
};
use lemma_model::{Adapter, Connector, Endpoint, ModelError, ModelRequest, ProviderKind};
use serde_json::{Value, json};

#[derive(Debug, Clone, PartialEq)]
struct Sent {
    url: String,
    headers: Vec<(String, String)>,
    body: Option<Value>,
}

#[derive(Clone, Default)]
struct ScriptedTransport {
    chunks: Vec<Result<String, String>>,
    listing: Value,
    sent: Arc<Mutex<Vec<Sent>>>,
}

impl ScriptedTransport {
    fn streaming(sse: &str) -> Self {
        Self {
            chunks: vec![Ok(sse.to_owned())],
            ..Self::default()
        }
    }

    fn listing(listing: Value) -> Self {
        Self {
            listing,
            ..Self::default()
        }
    }

    fn record(&self, sent: Sent) {
        self.sent
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .push(sent);
    }

    fn sent(&self) -> Vec<Sent> {
        self.sent
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }
}

impl HttpTransport for ScriptedTransport {
    async fn post_stream(
        &self,
        url: String,
        headers: Vec<(String, String)>,
        body: Value,
    ) -> Result<ByteStream, ModelError> {
        self.record(Sent {
            url,
            headers,
            body: Some(body),
        });
        let chunks = self
            .chunks
            .clone()
            .into_iter()
            .map(|chunk| chunk.map(String::into_bytes).map_err(ModelError::new));
        Ok(Box::pin(stream::iter(chunks)))
    }

    async fn get_json(
        &self,
        url: String,
        headers: Vec<(String, String)>,
    ) -> Result<Value, ModelError> {
        self.record(Sent {
            url,
            headers,
            body: None,
        });
        Ok(self.listing.clone())
    }
}

fn endpoint(kind: ProviderKind) -> Endpoint {
    Endpoint {
        kind,
        base_url: String::new(),
        api_path: String::new(),
        models_path: String::new(),
        api_key: "key".to_owned(),
    }
}

fn header(name: &str, value: &str) -> (String, String) {
    (name.to_owned(), value.to_owned())
}

fn text(text: &str) -> ContentBlock {
    ContentBlock::Text(TextContent {
        text: text.to_owned(),
    })
}

fn thinking(thinking: &str, signature: Option<&str>) -> ContentBlock {
    ContentBlock::Thinking(ThinkingContent {
        thinking: thinking.to_owned(),
        signature: signature.map(str::to_owned),
        started_at: None,
        finished_at: None,
    })
}

fn call(id: &str, name: &str, arguments: Value) -> ToolCall {
    ToolCall {
        id: id.to_owned(),
        name: name.to_owned(),
        arguments,
        started_at: None,
        finished_at: None,
    }
}

fn tool_result(id: &str, name: &str, output: &str, is_error: bool) -> Message {
    Message::ToolResult {
        tool_call_id: id.to_owned(),
        tool_name: name.to_owned(),
        content: vec![text(output)],
        is_error,
    }
}

fn assistant(content: Vec<ContentBlock>, stop_reason: StopReason) -> Message {
    Message::Assistant {
        content,
        stop_reason,
        usage: None,
    }
}

fn user(message: &str) -> Message {
    Message::User {
        content: vec![text(message)],
    }
}

fn history() -> ModelRequest {
    ModelRequest {
        model: "m".to_owned(),
        messages: vec![
            user("Hi"),
            assistant(
                vec![
                    thinking("plan", Some("sig")),
                    text("Let me look."),
                    ContentBlock::ToolCall(call("call-1", "read_file", json!({ "path": "a.txt" }))),
                ],
                StopReason::ToolUse,
            ),
            tool_result("call-1", "read_file", r#"{"lines":2}"#, false),
            assistant(
                vec![
                    thinking("retry", None),
                    ContentBlock::ToolCall(call("call-2", "bash", json!({ "command": "ls" }))),
                ],
                StopReason::ToolUse,
            ),
            tool_result("call-2", "bash", "denied", true),
            assistant(vec![text("Done.")], StopReason::Stop),
            user("Thanks"),
        ],
        tools: vec![ToolSpec {
            name: "read_file".to_owned(),
            description: "Reads a file.".to_owned(),
            parameters: json!({ "type": "object" }),
        }],
    }
}

fn ask() -> ModelRequest {
    ModelRequest {
        model: "m".to_owned(),
        messages: vec![user("Hi")],
        tools: Vec::new(),
    }
}

async fn collect(
    transport: &ScriptedTransport,
    endpoint: Endpoint,
    request: ModelRequest,
) -> Result<Vec<StreamEvent>, ModelError> {
    let adapter = HttpConnector::new(transport.clone()).connect(endpoint);
    let events = adapter.stream(request).await?;
    events.collect::<Vec<_>>().await.into_iter().collect()
}

fn done(stop_reason: StopReason, usage: Option<Usage>) -> StreamEvent {
    StreamEvent::Done { stop_reason, usage }
}

fn delta(text: &str) -> StreamEvent {
    StreamEvent::TextDelta {
        delta: text.to_owned(),
    }
}

#[tokio::test]
async fn openai_sends_history_tools_and_a_bearer_token() -> Result<(), Box<dyn Error>> {
    let transport = ScriptedTransport::streaming("data: [DONE]\n\n");

    let events = collect(
        &transport,
        endpoint(ProviderKind::OpenAiCompatible),
        history(),
    )
    .await?;

    let call_1 = json!({ "id": "call-1", "type": "function",
        "function": { "name": "read_file", "arguments": r#"{"path":"a.txt"}"# } });
    let call_2 = json!({ "id": "call-2", "type": "function",
        "function": { "name": "bash", "arguments": r#"{"command":"ls"}"# } });
    assert_eq!(
        transport.sent(),
        [Sent {
            url: "https://api.openai.com/v1/chat/completions".to_owned(),
            headers: vec![header("authorization", "Bearer key")],
            body: Some(json!({
                "model": "m",
                "messages": [
                    { "role": "user", "content": "Hi" },
                    { "role": "assistant", "content": "Let me look.", "tool_calls": [call_1] },
                    { "role": "tool", "tool_call_id": "call-1", "content": r#"{"lines":2}"# },
                    { "role": "assistant", "content": "", "tool_calls": [call_2] },
                    { "role": "tool", "tool_call_id": "call-2", "content": "denied" },
                    { "role": "assistant", "content": "Done." },
                    { "role": "user", "content": "Thanks" },
                ],
                "stream": true,
                "stream_options": { "include_usage": true },
                "tools": [{ "type": "function", "function": {
                    "name": "read_file",
                    "description": "Reads a file.",
                    "parameters": { "type": "object" },
                } }],
            })),
        }],
        "request"
    );
    assert_eq!(events, [done(StopReason::Stop, None)], "events");
    Ok(())
}

#[tokio::test]
async fn anthropic_replays_signed_thinking_and_tool_blocks() -> Result<(), Box<dyn Error>> {
    let transport = ScriptedTransport::streaming("data: {\"type\":\"message_stop\"}\n\n");

    let events = collect(&transport, endpoint(ProviderKind::Anthropic), history()).await?;

    assert_eq!(
        transport.sent(),
        [Sent {
            url: "https://api.anthropic.com/v1/messages".to_owned(),
            headers: vec![
                header("anthropic-version", "2023-06-01"),
                header("x-api-key", "key"),
            ],
            body: Some(json!({
                "model": "m",
                "max_tokens": 8192,
                "messages": [
                    { "role": "user", "content": "Hi" },
                    { "role": "assistant", "content": [
                        { "type": "thinking", "thinking": "plan", "signature": "sig" },
                        { "type": "text", "text": "Let me look." },
                        { "type": "tool_use", "id": "call-1", "name": "read_file",
                          "input": { "path": "a.txt" } },
                    ] },
                    { "role": "user", "content": [{ "type": "tool_result",
                        "tool_use_id": "call-1", "content": r#"{"lines":2}"#, "is_error": false }] },
                    { "role": "assistant", "content": [
                        { "type": "tool_use", "id": "call-2", "name": "bash",
                          "input": { "command": "ls" } },
                    ] },
                    { "role": "user", "content": [{ "type": "tool_result",
                        "tool_use_id": "call-2", "content": "denied", "is_error": true }] },
                    { "role": "assistant", "content": "Done." },
                    { "role": "user", "content": "Thanks" },
                ],
                "stream": true,
                "tools": [{
                    "name": "read_file",
                    "description": "Reads a file.",
                    "input_schema": { "type": "object" },
                }],
            })),
        }],
        "request"
    );
    assert_eq!(events, [done(StopReason::Stop, None)], "events");
    Ok(())
}

#[tokio::test]
async fn gemini_sends_function_calls_and_responses() -> Result<(), Box<dyn Error>> {
    let transport = ScriptedTransport::streaming("");

    let events = collect(&transport, endpoint(ProviderKind::Gemini), history()).await?;

    assert_eq!(
        transport.sent(),
        [Sent {
            url: "https://generativelanguage.googleapis.com/v1beta/models/m:streamGenerateContent?alt=sse"
                .to_owned(),
            headers: vec![header("x-goog-api-key", "key")],
            body: Some(json!({
                "contents": [
                    { "role": "user", "parts": [{ "text": "Hi" }] },
                    { "role": "model", "parts": [
                        { "text": "Let me look." },
                        { "functionCall": { "name": "read_file", "args": { "path": "a.txt" } } },
                    ] },
                    { "role": "user", "parts": [{ "functionResponse": {
                        "name": "read_file", "response": { "lines": 2 } } }] },
                    { "role": "model", "parts": [
                        { "functionCall": { "name": "bash", "args": { "command": "ls" } } },
                    ] },
                    { "role": "user", "parts": [{ "functionResponse": {
                        "name": "bash", "response": { "text": "denied" } } }] },
                    { "role": "model", "parts": [{ "text": "Done." }] },
                    { "role": "user", "parts": [{ "text": "Thanks" }] },
                ],
                "tools": [{ "functionDeclarations": [{
                    "name": "read_file",
                    "description": "Reads a file.",
                    "parameters": { "type": "object" },
                }] }],
            })),
        }],
        "request"
    );
    assert_eq!(events, [done(StopReason::Stop, None)], "events");
    Ok(())
}

#[tokio::test]
async fn base_url_and_api_path_override_the_vendor_defaults() -> Result<(), Box<dyn Error>> {
    let cases = [
        (
            ProviderKind::OpenAiCompatible,
            "/v2/chat",
            "https://proxy.example/api/v2/chat",
            Vec::new(),
        ),
        (
            ProviderKind::Anthropic,
            "/messages",
            "https://proxy.example/api/messages",
            vec![header("anthropic-version", "2023-06-01")],
        ),
        (
            ProviderKind::Gemini,
            "/models/{model}:stream",
            "https://proxy.example/api/models/m:stream",
            Vec::new(),
        ),
    ];
    for (kind, api_path, url, headers) in cases {
        let transport = ScriptedTransport::streaming("");
        let endpoint = Endpoint {
            base_url: "https://proxy.example/api/".to_owned(),
            api_path: api_path.to_owned(),
            api_key: String::new(),
            ..endpoint(kind)
        };

        collect(&transport, endpoint, ask()).await?;

        let sent = transport.sent();
        assert_eq!(
            sent.iter()
                .map(|s| (s.url.as_str(), s.headers.clone()))
                .collect::<Vec<_>>(),
            [(url, headers)],
            "{kind:?} request target"
        );
        assert!(
            sent.iter()
                .all(|s| s.body.as_ref().is_some_and(|b| b.get("tools").is_none())),
            "{kind:?} sends no tools when none are offered"
        );
    }
    Ok(())
}

#[tokio::test]
async fn openai_closes_open_blocks_when_the_stream_ends_without_done() -> Result<(), Box<dyn Error>>
{
    let sse = concat!(
        ": keep-alive\r\n",
        "data: {\"choices\":[{\"delta\":{\"reasoning\":\"hmm\"}}]}\r\n\r\n",
        "data: {\"choices\":[{\"delta\":{\"content\":\"Let me\"}}]}\n\n",
        "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"c1\",",
        "\"function\":{\"name\":\"bash\",\"arguments\":\"{\\\"command\\\":\"}}]}}]}\n\n",
        "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0}]}}]}\n\n",
        "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,",
        "\"function\":{\"arguments\":\"\\\"ls\\\"}\"}}]}}]}\n\n",
        "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":4}}",
    );
    let transport = ScriptedTransport::streaming(sse);

    let events = collect(&transport, endpoint(ProviderKind::OpenAiCompatible), ask()).await?;

    assert_eq!(
        events,
        [
            StreamEvent::ThinkingStart,
            StreamEvent::ThinkingDelta {
                delta: "hmm".to_owned()
            },
            StreamEvent::ThinkingEnd { signature: None },
            StreamEvent::TextStart,
            delta("Let me"),
            StreamEvent::TextEnd,
            StreamEvent::ToolCallStart {
                id: "c1".to_owned(),
                name: "bash".to_owned()
            },
            StreamEvent::ToolCallDelta {
                delta: r#"{"command":"#.to_owned()
            },
            StreamEvent::ToolCallDelta {
                delta: r#""ls"}"#.to_owned()
            },
            StreamEvent::ToolCallEnd {
                call: call("c1", "bash", json!({ "command": "ls" }))
            },
            done(
                StopReason::Stop,
                Some(Usage {
                    input: 3,
                    output: 4
                })
            ),
        ],
        "events"
    );
    Ok(())
}

#[tokio::test]
async fn anthropic_ignores_unknown_and_empty_stream_parts() -> Result<(), Box<dyn Error>> {
    let lines = [
        r#"{"type":"message_start","message":{"usage":{"input_tokens":5}}}"#,
        r#"{"type":"ping"}"#,
        r#"{"type":"content_block_start","index":0,"content_block":{"type":"redacted_thinking"}}"#,
        r#"{"type":"content_block_stop","index":0}"#,
        r#"{"type":"content_block_start","index":1}"#,
        r#"{"type":"content_block_start","index":1,"content_block":{"type":"thinking"}}"#,
        r#"{"type":"content_block_delta","index":1,"delta":{"type":"thinking_delta","thinking":""}}"#,
        r#"{"type":"content_block_delta","index":1,"delta":{"type":"thinking_delta","thinking":"hm"}}"#,
        r#"{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{}"}}"#,
        r#"{"type":"content_block_stop","index":1}"#,
        r#"{"type":"content_block_delta","index":2}"#,
        r#"{"type":"content_block_start","index":2,"content_block":{"type":"text"}}"#,
        r#"{"type":"content_block_delta","index":2,"delta":{"type":"text_delta","text":""}}"#,
        r#"{"type":"content_block_delta","index":2,"delta":{"type":"citations_delta"}}"#,
        r#"{"type":"content_block_delta","index":2,"delta":{"type":"text_delta","text":"Hi"}}"#,
        r#"{"type":"content_block_stop","index":2}"#,
        r#"{"type":"content_block_start","index":3,"content_block":{"type":"tool_use","id":"t1","name":"bash"}}"#,
        r#"{"type":"content_block_delta","index":3,"delta":{"type":"input_json_delta","partial_json":""}}"#,
        r#"{"type":"content_block_delta","index":3,"delta":{"type":"input_json_delta","partial_json":"{\"command\":\"ls\"}"}}"#,
        r#"{"type":"content_block_stop","index":3}"#,
    ];
    let sse: String = lines
        .iter()
        .map(|line| format!("data: {line}\n\n"))
        .collect();
    let transport = ScriptedTransport::streaming(&sse);

    let events = collect(&transport, endpoint(ProviderKind::Anthropic), ask()).await?;

    assert_eq!(
        events,
        [
            StreamEvent::ThinkingStart,
            StreamEvent::ThinkingDelta {
                delta: "hm".to_owned()
            },
            StreamEvent::ThinkingEnd { signature: None },
            StreamEvent::TextStart,
            delta("Hi"),
            StreamEvent::TextEnd,
            StreamEvent::ToolCallStart {
                id: "t1".to_owned(),
                name: "bash".to_owned()
            },
            StreamEvent::ToolCallDelta {
                delta: r#"{"command":"ls"}"#.to_owned()
            },
            StreamEvent::ToolCallEnd {
                call: call("t1", "bash", json!({ "command": "ls" }))
            },
            done(
                StopReason::Stop,
                Some(Usage {
                    input: 5,
                    output: 0
                })
            ),
        ],
        "events of a stream cut before message_stop"
    );
    Ok(())
}

#[tokio::test]
async fn an_anthropic_error_event_fails_the_stream_with_its_message() -> Result<(), Box<dyn Error>>
{
    let transport = ScriptedTransport::streaming(
        "data: {\"type\":\"error\",\"error\":{\"type\":\"overloaded_error\",\"message\":\"Overloaded\"}}\n\n",
    );

    let result = collect(&transport, endpoint(ProviderKind::Anthropic), ask()).await;

    assert_eq!(
        result.map_err(|e| e.to_string()),
        Err("anthropic error: Overloaded".to_owned()),
        "stream result"
    );
    Ok(())
}

#[tokio::test]
async fn gemini_maps_the_finish_reason_of_a_text_answer() -> Result<(), Box<dyn Error>> {
    for (reason, stop_reason) in [
        ("MAX_TOKENS", StopReason::Length),
        ("STOP", StopReason::Stop),
    ] {
        let sse = format!(
            "data: {}\n\ndata: {}\n\n",
            r#"{"candidates":[{"content":{"parts":[{"text":"","thought":true},{"text":"Hi"}]}}]}"#,
            json!({
                "candidates": [{ "content": { "parts": [{ "text": " there" }] }, "finishReason": reason }],
                "usageMetadata": { "candidatesTokenCount": 7 },
            }),
        );
        let transport = ScriptedTransport::streaming(&sse);

        let events = collect(&transport, endpoint(ProviderKind::Gemini), ask()).await?;

        assert_eq!(
            events,
            [
                StreamEvent::TextStart,
                delta("Hi"),
                delta(" there"),
                StreamEvent::TextEnd,
                done(
                    stop_reason,
                    Some(Usage {
                        input: 0,
                        output: 7
                    })
                ),
            ],
            "{reason} events"
        );
    }
    Ok(())
}

#[tokio::test]
async fn a_malformed_payload_fails_the_stream() -> Result<(), Box<dyn Error>> {
    for (kind, expected) in [
        (ProviderKind::OpenAiCompatible, "bad chunk: "),
        (ProviderKind::Anthropic, "bad event: "),
        (ProviderKind::Gemini, "bad chunk: "),
    ] {
        let transport = ScriptedTransport::streaming("data: {not json\n\n");

        let result = collect(&transport, endpoint(kind), ask()).await;

        let Err(error) = result else {
            return Err(format!("{kind:?} accepted a malformed payload").into());
        };
        assert!(error.message.starts_with(expected), "{kind:?}: {error}");
    }
    Ok(())
}

#[tokio::test]
async fn a_transport_failure_mid_stream_fails_the_stream() -> Result<(), Box<dyn Error>> {
    let transport = ScriptedTransport {
        chunks: vec![
            Ok("data: {\"choices\":[{\"delta\":{\"content\":\"Hi\"}}]}\n\n".to_owned()),
            Err("connection reset".to_owned()),
        ],
        ..ScriptedTransport::default()
    };
    let adapter = HttpConnector::new(transport).connect(endpoint(ProviderKind::OpenAiCompatible));

    let events: Vec<_> = adapter.stream(ask()).await?.collect().await;

    let outcomes: Vec<Result<StreamEvent, String>> = events
        .into_iter()
        .map(|e| e.map_err(|e| e.message))
        .collect();
    assert_eq!(
        outcomes,
        [
            Ok(StreamEvent::TextStart),
            Ok(delta("Hi")),
            Err("connection reset".to_owned()),
        ],
        "events before the failure, then the failure"
    );
    Ok(())
}

#[tokio::test]
async fn models_are_listed_from_each_vendor_format() -> Result<(), Box<dyn Error>> {
    let cases = [
        (
            Endpoint {
                api_key: String::new(),
                ..endpoint(ProviderKind::OpenAiCompatible)
            },
            json!({ "data": [{ "id": "gpt-x" }] }),
            "https://api.openai.com/v1/models",
            Vec::new(),
            vec!["gpt-x"],
        ),
        (
            Endpoint {
                base_url: "https://api.anthropic.com/".to_owned(),
                ..endpoint(ProviderKind::Anthropic)
            },
            json!({ "data": [{ "id": "claude-x" }] }),
            "https://api.anthropic.com/v1/models",
            vec![
                header("anthropic-version", "2023-06-01"),
                header("x-api-key", "key"),
            ],
            vec!["claude-x"],
        ),
        (
            Endpoint {
                models_path: "/v1/models".to_owned(),
                ..endpoint(ProviderKind::Gemini)
            },
            json!({ "models": [{ "name": "models/gemini-x" }, { "name": "tuned" }] }),
            "https://generativelanguage.googleapis.com/v1/models",
            vec![header("x-goog-api-key", "key")],
            vec!["gemini-x", "tuned"],
        ),
    ];
    for (endpoint, listing, url, headers, expected) in cases {
        let kind = endpoint.kind;
        let transport = ScriptedTransport::listing(listing);

        let models = HttpConnector::new(transport.clone())
            .list_models(endpoint)
            .await?;

        assert_eq!(models, expected, "{kind:?} models");
        assert_eq!(
            transport.sent(),
            [Sent {
                url: url.to_owned(),
                headers,
                body: None,
            }],
            "{kind:?} request"
        );
    }
    Ok(())
}

#[tokio::test]
async fn a_model_list_in_another_format_is_rejected() -> Result<(), Box<dyn Error>> {
    for kind in [ProviderKind::OpenAiCompatible, ProviderKind::Gemini] {
        let transport = ScriptedTransport::listing(json!({ "items": [] }));

        let result = HttpConnector::new(transport)
            .list_models(endpoint(kind))
            .await;

        let Err(error) = result else {
            return Err(format!("{kind:?} accepted an unknown list format").into());
        };
        assert!(
            error.message.starts_with("bad model list: "),
            "{kind:?}: {error}"
        );
    }
    Ok(())
}

#[tokio::test]
async fn anthropic_streams_signed_thinking_text_and_a_tool_call() -> Result<(), Box<dyn Error>> {
    let sse = "\
event: message_start\n\
data: {\"type\":\"message_start\",\"message\":{\"usage\":{\"input_tokens\":25,\"output_tokens\":1}}}\n\
event: content_block_start\n\
data: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"thinking\",\"thinking\":\"\"}}\n\
event: content_block_delta\n\
data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"thinking_delta\",\"thinking\":\"让我想想\"}}\n\
event: content_block_delta\n\
data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"signature_delta\",\"signature\":\"sig_abc\"}}\n\
event: content_block_stop\n\
data: {\"type\":\"content_block_stop\",\"index\":0}\n\
event: content_block_start\n\
data: {\"type\":\"content_block_start\",\"index\":1,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}\n\
event: content_block_delta\n\
data: {\"type\":\"content_block_delta\",\"index\":1,\"delta\":{\"type\":\"text_delta\",\"text\":\"答案\"}}\n\
event: content_block_stop\n\
data: {\"type\":\"content_block_stop\",\"index\":1}\n\
event: content_block_start\n\
data: {\"type\":\"content_block_start\",\"index\":2,\"content_block\":{\"type\":\"tool_use\",\"id\":\"toolu_1\",\"name\":\"get_weather\"}}\n\
event: content_block_delta\n\
data: {\"type\":\"content_block_delta\",\"index\":2,\"delta\":{\"type\":\"input_json_delta\",\"partial_json\":\"{\\\"city\\\": \\\"北京\\\"}\"}}\n\
event: content_block_stop\n\
data: {\"type\":\"content_block_stop\",\"index\":2}\n\
event: message_delta\n\
data: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"tool_use\"},\"usage\":{\"output_tokens\":40}}\n\
event: message_stop\n\
data: {\"type\":\"message_stop\"}\n";
    let transport = ScriptedTransport::streaming(sse);

    let events = collect(&transport, endpoint(ProviderKind::Anthropic), ask()).await?;

    assert_eq!(
        events,
        [
            StreamEvent::ThinkingStart,
            StreamEvent::ThinkingDelta {
                delta: "让我想想".to_owned()
            },
            StreamEvent::ThinkingEnd {
                signature: Some("sig_abc".to_owned())
            },
            StreamEvent::TextStart,
            delta("答案"),
            StreamEvent::TextEnd,
            StreamEvent::ToolCallStart {
                id: "toolu_1".to_owned(),
                name: "get_weather".to_owned()
            },
            StreamEvent::ToolCallDelta {
                delta: "{\"city\": \"北京\"}".to_owned()
            },
            StreamEvent::ToolCallEnd {
                call: call("toolu_1", "get_weather", json!({ "city": "北京" }))
            },
            done(
                StopReason::ToolUse,
                Some(Usage {
                    input: 25,
                    output: 40
                })
            ),
        ],
        "events"
    );
    Ok(())
}

#[tokio::test]
async fn anthropic_maps_its_stop_reasons() -> Result<(), Box<dyn Error>> {
    for (reason, stop_reason) in [
        ("max_tokens", StopReason::Length),
        ("end_turn", StopReason::Stop),
    ] {
        let sse = format!(
            "data: {}\n\ndata: {{\"type\":\"message_stop\"}}\n\n",
            json!({ "type": "message_delta", "delta": { "stop_reason": reason } }),
        );
        let transport = ScriptedTransport::streaming(&sse);

        let events = collect(&transport, endpoint(ProviderKind::Anthropic), ask()).await?;

        assert_eq!(events, [done(stop_reason, None)], "{reason}");
    }
    Ok(())
}

#[tokio::test]
async fn openai_streams_text_and_reports_usage() -> Result<(), Box<dyn Error>> {
    let sse = "\
data: {\"choices\":[{\"delta\":{\"content\":\"你好\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"content\":\"世界\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\
data: {\"choices\":[],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":4}}\n\
data: [DONE]\n";
    let transport = ScriptedTransport::streaming(sse);

    let events = collect(&transport, endpoint(ProviderKind::OpenAiCompatible), ask()).await?;

    assert_eq!(
        events,
        [
            StreamEvent::TextStart,
            delta("你好"),
            delta("世界"),
            StreamEvent::TextEnd,
            done(
                StopReason::Stop,
                Some(Usage {
                    input: 10,
                    output: 4
                })
            ),
        ],
        "events"
    );
    Ok(())
}

#[tokio::test]
async fn openai_streams_reasoning_text_and_a_tool_call() -> Result<(), Box<dyn Error>> {
    let sse = "\
data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"让我\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"reasoning\":\"想想\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"content\":\"答案\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",\"function\":{\"name\":\"get_weather\",\"arguments\":\"\"}}]},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"{\\\"city\\\":\"}}]},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"\\\"北京\\\"}\"}}]},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"tool_calls\"}]}\n\
data: [DONE]\n";
    let transport = ScriptedTransport::streaming(sse);

    let events = collect(&transport, endpoint(ProviderKind::OpenAiCompatible), ask()).await?;

    assert_eq!(
        events,
        [
            StreamEvent::ThinkingStart,
            StreamEvent::ThinkingDelta {
                delta: "让我".to_owned()
            },
            StreamEvent::ThinkingDelta {
                delta: "想想".to_owned()
            },
            StreamEvent::ThinkingEnd { signature: None },
            StreamEvent::TextStart,
            delta("答案"),
            StreamEvent::TextEnd,
            StreamEvent::ToolCallStart {
                id: "call_1".to_owned(),
                name: "get_weather".to_owned()
            },
            StreamEvent::ToolCallDelta {
                delta: "{\"city\":".to_owned()
            },
            StreamEvent::ToolCallDelta {
                delta: "\"北京\"}".to_owned()
            },
            StreamEvent::ToolCallEnd {
                call: call("call_1", "get_weather", json!({ "city": "北京" }))
            },
            done(StopReason::ToolUse, None),
        ],
        "events"
    );
    Ok(())
}

#[tokio::test]
async fn openai_keeps_the_raw_arguments_of_a_call_cut_off_by_the_length_limit()
-> Result<(), Box<dyn Error>> {
    let transport = ScriptedTransport::streaming(concat!(
        "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"c1\",",
        "\"function\":{\"name\":\"bash\",\"arguments\":\"{\\\"comm\"}}]}}]}\n\n",
        "data: {\"choices\":[{\"finish_reason\":\"length\"}]}\n\n",
        "data: [DONE]\n\n",
    ));

    let events = collect(&transport, endpoint(ProviderKind::OpenAiCompatible), ask()).await?;

    assert_eq!(
        events,
        [
            StreamEvent::ToolCallStart {
                id: "c1".to_owned(),
                name: "bash".to_owned()
            },
            StreamEvent::ToolCallDelta {
                delta: "{\"comm".to_owned()
            },
            StreamEvent::ToolCallEnd {
                call: call("c1", "bash", json!("{\"comm"))
            },
            done(StopReason::Length, None),
        ],
        "events"
    );
    Ok(())
}

#[tokio::test]
async fn text_is_closed_before_reasoning_that_follows_it() -> Result<(), Box<dyn Error>> {
    let transport = ScriptedTransport::streaming(concat!(
        "data: {\"choices\":[{\"delta\":{\"content\":\"A\"}}]}\n\n",
        "data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"B\"}}]}\n\n",
    ));

    let events = collect(&transport, endpoint(ProviderKind::OpenAiCompatible), ask()).await?;

    assert_eq!(
        events,
        [
            StreamEvent::TextStart,
            delta("A"),
            StreamEvent::TextEnd,
            StreamEvent::ThinkingStart,
            StreamEvent::ThinkingDelta {
                delta: "B".to_owned()
            },
            StreamEvent::ThinkingEnd { signature: None },
            done(StopReason::Stop, None),
        ],
        "events"
    );
    Ok(())
}

#[tokio::test]
async fn gemini_streams_signed_thoughts_text_and_a_function_call() -> Result<(), Box<dyn Error>> {
    let sse = "\
data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"想想\",\"thought\":true}]}}]}\n\
data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"一下\",\"thought\":true,\"thoughtSignature\":\"sig_xyz\"}]}}]}\n\
data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"答案\"}]}}]}\n\
data: {\"candidates\":[{\"content\":{\"parts\":[{\"functionCall\":{\"name\":\"get_weather\",\"args\":{\"city\":\"北京\"}}}]},\"finishReason\":\"STOP\"}],\"usageMetadata\":{\"promptTokenCount\":5,\"candidatesTokenCount\":10}}\n";
    let transport = ScriptedTransport::streaming(sse);

    let events = collect(&transport, endpoint(ProviderKind::Gemini), ask()).await?;

    assert_eq!(
        events,
        [
            StreamEvent::ThinkingStart,
            StreamEvent::ThinkingDelta {
                delta: "想想".to_owned()
            },
            StreamEvent::ThinkingDelta {
                delta: "一下".to_owned()
            },
            StreamEvent::ThinkingEnd {
                signature: Some("sig_xyz".to_owned())
            },
            StreamEvent::TextStart,
            delta("答案"),
            StreamEvent::TextEnd,
            StreamEvent::ToolCallStart {
                id: "call_0".to_owned(),
                name: "get_weather".to_owned()
            },
            StreamEvent::ToolCallEnd {
                call: call("call_0", "get_weather", json!({ "city": "北京" }))
            },
            done(
                StopReason::ToolUse,
                Some(Usage {
                    input: 5,
                    output: 10
                })
            ),
        ],
        "events"
    );
    Ok(())
}

#[tokio::test]
async fn gemini_closes_a_thought_left_open_at_the_end_of_the_stream() -> Result<(), Box<dyn Error>>
{
    let transport = ScriptedTransport::streaming(
        "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"hm\",\"thought\":true}]}}]}\n\n",
    );

    let events = collect(&transport, endpoint(ProviderKind::Gemini), ask()).await?;

    assert_eq!(
        events,
        [
            StreamEvent::ThinkingStart,
            StreamEvent::ThinkingDelta {
                delta: "hm".to_owned()
            },
            StreamEvent::ThinkingEnd { signature: None },
            done(StopReason::Stop, None),
        ],
        "events"
    );
    Ok(())
}
