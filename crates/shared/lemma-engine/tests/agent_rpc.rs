//! `AgentService` over Connect on an engine: turns against an
//! OpenAI-compatible vendor served on the loopback interface, their event
//! streams, workspace tools, and the messages they persist.

mod common;

use std::error::Error;
use std::fs;
use std::io;

use axum::Router;
use axum::body::Body;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use common::{DataDir, Frame, Frames, TestEngine, assert_reason, assert_stream_reason, serve};
use futures::{StreamExt, stream};
use lemma_proto::lemma::v1::ErrorReason;
use serde_json::{Value, json};

const SEND: &str = "/lemma.v1.AgentService/SendMessage";
const ABORT: &str = "/lemma.v1.AgentService/AbortMessage";
const RESUME: &str = "/lemma.v1.AgentService/ResumeStream";
const CREATE_PROVIDER: &str = "/lemma.v1.ProviderService/CreateCustomProvider";
const CREATE_SESSION: &str = "/lemma.v1.SessionService/CreateSession";
const LIST_SESSIONS: &str = "/lemma.v1.SessionService/ListSessions";
const SET_LEAF: &str = "/lemma.v1.SessionService/SetSessionLeaf";
const SET_LABEL: &str = "/lemma.v1.SessionService/SetMessageLabel";
const MESSAGES: &str = "/lemma.v1.SessionService/ListMessages";
const DELETE_SESSION: &str = "/lemma.v1.SessionService/DeleteSession";
const UPDATE_PROVIDER: &str = "/lemma.v1.ProviderService/UpdateCustomProvider";
#[cfg(windows)]
const WAIT_FOR_GO: &str = "for /L %i in (1,1,60) do @if not exist go ping -n 2 127.0.0.1 >nul";
#[cfg(not(windows))]
const WAIT_FOR_GO: &str =
    "i=0; while [ ! -e go ] && [ $i -lt 600 ]; do sleep 0.1; i=$((i+1)); done";

fn sse(chunks: &[Value]) -> String {
    let mut body: String = chunks
        .iter()
        .map(|chunk| format!("data: {chunk}\n\n"))
        .collect();
    body.push_str("data: [DONE]\n\n");
    body
}

fn delta(delta: &Value) -> Value {
    json!({ "choices": [{ "delta": delta }] })
}

fn finish(reason: &str) -> Value {
    json!({ "choices": [{ "delta": {}, "finish_reason": reason }] })
}

fn tool_call(index: usize, id: &str, name: &str, arguments: &Value) -> Value {
    delta(&json!({ "tool_calls": [{
        "index": index,
        "id": id,
        "function": { "name": name, "arguments": arguments.to_string() },
    }] }))
}

async fn completions(axum::Json(request): axum::Json<Value>) -> Response {
    let answered_tools = request["messages"]
        .as_array()
        .is_some_and(|messages| messages.iter().any(|m| m["role"] == "tool"));
    match request["model"].as_str().unwrap_or_default() {
        "answer" => sse(&[
            delta(&json!({ "reasoning_content": "thinking it over" })),
            delta(&json!({ "content": "pong" })),
            finish("stop"),
        ])
        .into_response(),
        "tools" if answered_tools => {
            sse(&[delta(&json!({ "content": "saved" })), finish("stop")]).into_response()
        }
        "tools" => sse(&[
            delta(&json!({ "reasoning_content": "use tools" })),
            tool_call(
                0,
                "c1",
                "write_file",
                &json!({ "content": "hi", "path": "notes.txt" }),
            ),
            tool_call(1, "c2", "read_file", &json!({ "path": "missing.txt" })),
            tool_call(2, "c3", "fly", &json!({})),
            finish("tool_calls"),
        ])
        .into_response(),
        "wait" => sse(&[
            tool_call(0, "w1", "bash", &json!({ "command": WAIT_FOR_GO })),
            finish("tool_calls"),
        ])
        .into_response(),
        "plain" => {
            let offered_tools = request.get("tools").is_some();
            let tool_history = request["messages"].as_array().is_some_and(|messages| {
                messages
                    .iter()
                    .any(|m| m["role"] == "tool" || m.get("tool_calls").is_some())
            });
            let seen = format!("tools:{offered_tools} history:{tool_history}");
            sse(&[delta(&json!({ "content": seen })), finish("stop")]).into_response()
        }
        "hang" => {
            let first = Ok::<_, io::Error>(format!(
                "data: {}\n\n",
                delta(&json!({ "content": "partial" }))
            ));
            Body::from_stream(stream::iter([first]).chain(stream::pending())).into_response()
        }
        _ => (StatusCode::INTERNAL_SERVER_ERROR, "boom").into_response(),
    }
}

struct Setup {
    engine: TestEngine,
    provider_id: String,
    session_id: String,
}

async fn setup() -> Result<Setup, Box<dyn Error>> {
    let engine = TestEngine::open().await?;
    let base_url = serve(Router::new().route("/v1/chat/completions", post(completions))).await?;
    let provider = engine
        .call(
            CREATE_PROVIDER,
            &json!({
                "apiFormat": "API_FORMAT_OPENAI",
                "identifier": "vendor",
                "baseUrl": format!("{base_url}/v1"),
                "apiKey": "sk-1",
            }),
        )
        .await?;
    let session = engine.call(CREATE_SESSION, &json!({})).await?;
    let id = |reply: &Value, field: &str| {
        reply[field]["id"]
            .as_str()
            .map(str::to_owned)
            .ok_or_else(|| format!("no {field} id in {reply}"))
    };
    Ok(Setup {
        provider_id: id(&provider.body, "provider")?,
        session_id: id(&session.body, "session")?,
        engine,
    })
}

impl Setup {
    async fn send(&self, model: &str) -> Result<Frames, Box<dyn Error>> {
        self.engine
            .stream(
                SEND,
                &json!({
                    "sessionId": self.session_id,
                    "providerId": self.provider_id,
                    "model": model,
                    "content": "hi",
                }),
            )
            .await
    }

    async fn send_with_parent(
        &self,
        model: &str,
        content: &str,
        parent_id: Option<&str>,
    ) -> Result<Frames, Box<dyn Error>> {
        let mut body = json!({
            "sessionId": self.session_id,
            "providerId": self.provider_id,
            "model": model,
            "content": content,
        });
        if let Some(parent_id) = parent_id {
            body["parentId"] = json!(parent_id);
        }
        self.engine.stream(SEND, &body).await
    }

    async fn tree(&self) -> Result<Value, Box<dyn Error>> {
        Ok(self
            .engine
            .call(MESSAGES, &json!({ "sessionId": self.session_id }))
            .await?
            .body)
    }
    async fn messages(&self) -> Result<Vec<Value>, Box<dyn Error>> {
        let reply = self
            .engine
            .call(MESSAGES, &json!({ "sessionId": self.session_id }))
            .await?;
        Ok(reply.body["messages"]
            .as_array()
            .cloned()
            .unwrap_or_default())
    }

    async fn until_tool_started(&self, frames: &mut Frames) -> Result<Vec<Value>, Box<dyn Error>> {
        let mut seen: Vec<Value> = Vec::new();
        while !seen
            .last()
            .is_some_and(|event| event["event"].get("toolCallStarted").is_some())
        {
            match self.engine.next_frame(frames).await? {
                Some(Frame::Message(event)) => seen.push(event),
                other => return Err(format!("turn ended before the tool ran: {other:?}").into()),
            }
        }
        Ok(seen)
    }

    fn release_tool(&self) -> io::Result<()> {
        fs::write(
            self.engine
                .data_dir()
                .join("workspaces")
                .join(&self.session_id)
                .join("go"),
            "",
        )
    }
}

fn label(event: &Value) -> String {
    let event = &event["event"];
    if let Some(text) = event["delta"]["text"]["content"].as_str() {
        return format!("text:{text}");
    }
    if let Some(thinking) = event["delta"]["thinking"]["content"].as_str() {
        return format!("thinking:{thinking}");
    }
    if let Some(call) = event.get("toolCallStarted") {
        return format!("toolCallStarted:{}:{}", call["name"], call["arguments"]);
    }
    if let Some(call) = event.get("toolCallFinished") {
        let is_error = call["isError"].as_bool().unwrap_or(false);
        return format!("toolCallFinished:{}:{is_error}", call["callId"]);
    }
    if let Some(error) = event.get("error") {
        return format!("error:{}", error["message"].as_str().unwrap_or_default());
    }
    ["started", "turnStarted", "done", "aborted"]
        .into_iter()
        .find(|kind| event.get(*kind).is_some())
        .unwrap_or("unknown")
        .to_owned()
}

fn labels(events: &[Value]) -> Vec<String> {
    events.iter().map(label).collect()
}

fn by_role<'list>(messages: &'list [Value], role: &str) -> Vec<&'list Value> {
    messages.iter().filter(|m| m["role"] == role).collect()
}

#[tokio::test]
async fn a_turn_streams_thinking_and_text_and_persists_the_answer() -> Result<(), Box<dyn Error>> {
    let mut setup = setup().await?;

    let mut frames = setup.send("answer").await?;
    let (events, end) = setup.engine.finish(&mut frames).await?;
    let messages = setup.messages().await?;

    assert_eq!(
        labels(&events),
        [
            "started",
            "turnStarted",
            "thinking:thinking it over",
            "text:pong",
            "done"
        ],
        "events"
    );
    assert!(
        events.iter().all(|e| e["event"]["occurredAt"].is_string()),
        "every event carries its time: {events:?}"
    );
    assert!(
        events[0]["event"]["started"].get("parentId").is_none(),
        "root AgentStarted omits parentId: {events:?}"
    );
    assert_eq!(
        events[1]["event"]["turnStarted"]["parentId"], events[0]["event"]["started"]["messageId"],
        "AgentTurnStarted references user message: {events:?}"
    );
    assert_eq!(end, json!({}), "clean end of stream");
    let assistant = by_role(&messages, "assistant");
    let [answer] = assistant.as_slice() else {
        return Err(format!("one assistant message expected: {messages:?}").into());
    };
    assert_eq!(
        (
            &answer["content"],
            &answer["thinking"],
            &answer["model"],
            &answer["providerId"],
            &answer["status"],
        ),
        (
            &json!("pong"),
            &json!("thinking it over"),
            &json!("answer"),
            &json!(setup.provider_id),
            &json!("MESSAGE_STATUS_DONE"),
        ),
        "persisted answer"
    );
    assert!(
        answer["thinkingStartedAt"].is_string() && answer["thinkingFinishedAt"].is_string(),
        "thinking interval: {answer}"
    );
    assert_eq!(
        by_role(&messages, "user")[0]["content"],
        "hi",
        "user message"
    );
    setup.engine.close().await;
    Ok(())
}

#[tokio::test]
async fn tool_calls_run_in_the_session_workspace() -> Result<(), Box<dyn Error>> {
    let mut setup = setup().await?;

    let mut frames = setup.send("tools").await?;
    let (events, _) = setup.engine.finish(&mut frames).await?;
    let messages = setup.messages().await?;
    let written = fs::read_to_string(
        setup
            .engine
            .data_dir()
            .join("workspaces")
            .join(&setup.session_id)
            .join("notes.txt"),
    )?;

    assert_eq!(
        labels(&events),
        [
            "started",
            "turnStarted",
            "thinking:use tools",
            r#"toolCallStarted:"write_file":"{\"content\":\"hi\",\"path\":\"notes.txt\"}""#,
            "toolCallFinished:\"c1\":false",
            r#"toolCallStarted:"read_file":"{\"path\":\"missing.txt\"}""#,
            "toolCallFinished:\"c2\":true",
            r#"toolCallStarted:"fly":"{}""#,
            "toolCallFinished:\"c3\":true",
            "turnStarted",
            "text:saved",
            "done",
        ],
        "events"
    );
    assert_eq!(written, "hi", "file written by the tool");
    let results: Vec<(&Value, &Value)> = by_role(&messages, "tool")
        .into_iter()
        .map(|m| (&m["toolResult"]["toolCallId"], &m["toolResult"]["isError"]))
        .collect();
    assert_eq!(results.len(), 3, "tool results: {messages:?}");
    assert!(
        results.contains(&(&json!("c3"), &json!(true))),
        "unknown tool result: {results:?}"
    );
    let calls: Vec<&Value> = by_role(&messages, "assistant")
        .into_iter()
        .filter_map(|m| m["toolCalls"].as_array())
        .flatten()
        .collect();
    assert_eq!(calls.len(), 3, "persisted tool calls: {messages:?}");
    assert!(
        calls
            .iter()
            .all(|c| c["startedAt"].is_string() && c["finishedAt"].is_string()),
        "tool call timing: {calls:?}"
    );
    assert_eq!(
        calls[0]["arguments"], r#"{"content":"hi","path":"notes.txt"}"#,
        "arguments"
    );
    setup.engine.close().await;
    Ok(())
}

#[tokio::test]
async fn a_failing_model_ends_the_turn_with_its_error() -> Result<(), Box<dyn Error>> {
    let mut setup = setup().await?;

    let mut frames = setup.send("fail").await?;
    let (events, _) = setup.engine.finish(&mut frames).await?;
    let messages = setup.messages().await?;

    assert_eq!(
        labels(&events),
        ["started", "turnStarted", "error:upstream 500: boom"],
        "events"
    );
    let assistant = by_role(&messages, "assistant");
    assert_eq!(
        (&assistant[0]["status"], &assistant[0]["error"]),
        (&json!("MESSAGE_STATUS_ERROR"), &json!("upstream 500: boom")),
        "settled placeholder"
    );
    setup.engine.close().await;
    Ok(())
}

#[tokio::test]
async fn a_running_turn_resumes_from_an_offset_and_aborts() -> Result<(), Box<dyn Error>> {
    let mut setup = setup().await?;
    let mut frames = setup.send("hang").await?;
    let mut seen = Vec::new();
    while seen.len() < 3 {
        match setup.engine.next_frame(&mut frames).await? {
            Some(Frame::Message(event)) => seen.push(event),
            other => return Err(format!("turn ended early: {other:?}").into()),
        }
    }
    let message_id = seen[0]["event"]["started"]["messageId"].clone();

    let streaming_tree = setup.tree().await?;
    let streaming = streaming_tree["messages"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let sessions = setup.engine.call(LIST_SESSIONS, &json!({})).await?;
    let busy_leaf = setup
        .engine
        .call(SET_LEAF, &json!({ "sessionId": setup.session_id }))
        .await?;
    let mut busy_send = setup.send("answer").await?;
    let (_, busy_end) = setup.engine.finish(&mut busy_send).await?;
    let mut resumed = setup
        .engine
        .stream(RESUME, &json!({ "messageId": message_id, "offset": 1 }))
        .await?;
    let aborted = setup
        .engine
        .call(ABORT, &json!({ "messageId": message_id }))
        .await?;
    let (rest, end) = setup.engine.finish(&mut frames).await?;
    let (replayed, resumed_end) = setup.engine.finish(&mut resumed).await?;
    let after = setup.messages().await?;
    let mut ended = setup
        .engine
        .stream(RESUME, &json!({ "messageId": message_id }))
        .await?;
    let (_, ended_end) = setup.engine.finish(&mut ended).await?;
    assert_eq!(
        labels(&seen),
        ["started", "turnStarted", "text:partial"],
        "first events"
    );
    assert_eq!(
        by_role(&streaming, "assistant")[0]["status"],
        "MESSAGE_STATUS_STREAMING",
        "placeholder while streaming"
    );
    assert_eq!(
        streaming_tree["activeMessageId"], message_id,
        "ListMessages reports activeMessageId while running"
    );
    assert_eq!(
        sessions.body["sessions"][0]["activeMessageId"], message_id,
        "ListSessions reports activeMessageId while running"
    );
    assert_reason(&busy_leaf, ErrorReason::SessionBusy);
    assert_stream_reason(&busy_end, ErrorReason::SessionBusy);
    assert_eq!(aborted.status, 200, "{aborted:?}");
    assert_eq!(labels(&rest), ["aborted"], "events after the abort");
    assert_eq!(end, json!({}), "clean end of stream");
    assert_eq!(
        labels(&replayed),
        ["turnStarted", "text:partial", "aborted"],
        "resumed from offset 1"
    );
    assert_eq!(resumed_end, json!({}), "clean end of the resumed stream");
    assert_eq!(
        by_role(&after, "assistant")[0]["status"],
        "MESSAGE_STATUS_ABORTED",
        "settled placeholder"
    );
    assert_stream_reason(&ended_end, ErrorReason::TurnNotRunning);
    let idle_tree = setup.tree().await?;
    assert!(
        idle_tree.get("activeMessageId").is_none(),
        "activeMessageId clears once turn ends: {idle_tree}"
    );
    setup.engine.close().await;
    Ok(())
}

#[tokio::test]
async fn aborting_while_a_tool_runs_keeps_its_result_and_calls_the_model_no_more()
-> Result<(), Box<dyn Error>> {
    let mut setup = setup().await?;
    let mut frames = setup.send("wait").await?;
    let seen = setup.until_tool_started(&mut frames).await?;
    let message_id = seen[0]["event"]["started"]["messageId"].clone();

    let aborted = setup
        .engine
        .call(ABORT, &json!({ "messageId": message_id }))
        .await?;
    setup.release_tool()?;
    let (rest, end) = setup.engine.finish(&mut frames).await?;
    let messages = setup.messages().await?;

    assert_eq!(aborted.status, 200, "{aborted:?}");
    assert_eq!(
        labels(&rest),
        [r#"toolCallFinished:"w1":false"#, "aborted"],
        "events after the abort"
    );
    assert_eq!(end, json!({}), "clean end of stream");
    assert_eq!(
        by_role(&messages, "assistant").len(),
        1,
        "no model call after the abort: {messages:?}"
    );
    let answered: Vec<&Value> = by_role(&messages, "tool")
        .into_iter()
        .map(|m| &m["toolResult"]["toolCallId"])
        .collect();
    assert_eq!(
        answered,
        [&json!("w1")],
        "the tool call keeps its result: {messages:?}"
    );
    setup.engine.close().await;
    Ok(())
}

#[tokio::test]
async fn deleting_the_session_while_a_tool_runs_ends_the_turn_with_an_error_event()
-> Result<(), Box<dyn Error>> {
    let mut setup = setup().await?;
    let mut frames = setup.send("wait").await?;
    setup.until_tool_started(&mut frames).await?;

    let deleted = setup
        .engine
        .call(DELETE_SESSION, &json!({ "id": setup.session_id }))
        .await?;
    setup.release_tool()?;
    let (rest, end) = setup.engine.finish(&mut frames).await?;

    assert_eq!(deleted.status, 200, "{deleted:?}");
    assert!(
        rest.last()
            .is_some_and(|event| label(event).starts_with("error:")),
        "the turn ends with an error event: {:?}",
        labels(&rest)
    );
    assert_eq!(end, json!({}), "clean end of stream");
    setup.engine.close().await;
    Ok(())
}

#[tokio::test]
async fn a_model_without_tool_calling_sees_no_tools_and_no_earlier_tool_calls()
-> Result<(), Box<dyn Error>> {
    let mut setup = setup().await?;
    let mut with_tools = setup.send("tools").await?;
    setup.engine.finish(&mut with_tools).await?;
    let updated = setup
        .engine
        .call(
            UPDATE_PROVIDER,
            &json!({
                "id": setup.provider_id,
                "models": { "models": [{ "id": "plain", "toolCalling": false }] },
            }),
        )
        .await?;

    let mut plain = setup.send("plain").await?;
    let (events, _) = setup.engine.finish(&mut plain).await?;

    assert_eq!(updated.status, 200, "{updated:?}");
    assert!(
        labels(&events).contains(&"text:tools:false history:false".to_owned()),
        "the request carries neither tools nor tool history: {:?}",
        labels(&events)
    );
    setup.engine.close().await;
    Ok(())
}

#[tokio::test]
async fn a_turn_fails_before_it_starts_once_the_bound_directory_is_gone()
-> Result<(), Box<dyn Error>> {
    let mut setup = setup().await?;
    let dir = DataDir::new();
    fs::create_dir_all(&dir.0)?;
    let session = setup
        .engine
        .call(CREATE_SESSION, &json!({ "directory": dir.0 }))
        .await?;
    drop(dir);

    let mut frames = setup
        .engine
        .stream(
            SEND,
            &json!({
                "sessionId": session.body["session"]["id"],
                "providerId": setup.provider_id,
                "model": "answer",
                "content": "hi",
            }),
        )
        .await?;
    let (events, end) = setup.engine.finish(&mut frames).await?;

    assert!(events.is_empty(), "{events:?}");
    assert_stream_reason(&end, ErrorReason::DirectoryNotFound);
    setup.engine.close().await;
    Ok(())
}

#[tokio::test]
async fn a_database_failure_during_a_turn_ends_it_with_an_error_event() -> Result<(), Box<dyn Error>>
{
    let mut setup = setup().await?;
    let mut frames = setup.send("wait").await?;
    loop {
        match setup.engine.next_frame(&mut frames).await? {
            Some(Frame::Message(event)) if event["event"].get("toolCallStarted").is_some() => {
                break;
            }
            Some(Frame::Message(_)) => {}
            other => return Err(format!("turn ended before the tool ran: {other:?}").into()),
        }
    }

    setup.engine.close().await;
    fs::write(
        setup
            .engine
            .data_dir()
            .join("workspaces")
            .join(&setup.session_id)
            .join("go"),
        "",
    )?;
    let (rest, end) = setup.engine.finish(&mut frames).await?;

    let last = rest.last().map(label).unwrap_or_default();
    assert!(last.starts_with("error:store error: "), "{rest:?}");
    assert_eq!(end, json!({}), "clean end of stream");
    Ok(())
}

#[tokio::test]
async fn invalid_requests_carry_their_reasons() -> Result<(), Box<dyn Error>> {
    let mut setup = setup().await?;
    let unknown = "00000000-0000-4000-8000-000000000000";
    let send = |session: &str, provider: &str, model: &str, content: &str| {
        json!({
            "sessionId": session,
            "providerId": provider,
            "model": model,
            "content": content,
        })
    };
    let (session, provider) = (setup.session_id.clone(), setup.provider_id.clone());
    let cases = [
        (
            SEND,
            send("x", &provider, "m", "hi"),
            ErrorReason::IdInvalid,
        ),
        (SEND, send(&session, "x", "m", "hi"), ErrorReason::IdInvalid),
        (
            SEND,
            send(&session, &provider, "m", " "),
            ErrorReason::ContentRequired,
        ),
        (
            SEND,
            send(&session, &provider, " ", "hi"),
            ErrorReason::ModelRequired,
        ),
        (
            SEND,
            send(unknown, &provider, "m", "hi"),
            ErrorReason::SessionNotFound,
        ),
        (
            SEND,
            send(&session, unknown, "m", "hi"),
            ErrorReason::ProviderNotFound,
        ),
        (RESUME, json!({ "messageId": "x" }), ErrorReason::IdInvalid),
        (
            RESUME,
            json!({ "messageId": unknown }),
            ErrorReason::TurnNotRunning,
        ),
        (
            SEND,
            json!({
                "sessionId": session,
                "providerId": provider,
                "model": "answer",
                "content": "hi",
                "parentId": "x",
            }),
            ErrorReason::IdInvalid,
        ),
        (
            SEND,
            json!({
                "sessionId": session,
                "providerId": provider,
                "model": "answer",
                "content": "hi",
                "parentId": unknown,
            }),
            ErrorReason::MessageNotFound,
        ),
    ];

    for (path, body, reason) in cases {
        let mut frames = setup.engine.stream(path, &body).await?;
        let (events, end) = setup.engine.finish(&mut frames).await?;
        assert!(events.is_empty(), "{path} {body}: {events:?}");
        assert_stream_reason(&end, reason);
    }
    let mut negative = setup
        .engine
        .stream(RESUME, &json!({ "messageId": unknown, "offset": -1 }))
        .await?;
    let (_, negative_end) = setup.engine.finish(&mut negative).await?;
    assert_eq!(
        negative_end["error"]["code"], "invalid_argument",
        "negative offset: {negative_end}"
    );
    assert_reason(
        &setup
            .engine
            .call(ABORT, &json!({ "messageId": "x" }))
            .await?,
        ErrorReason::IdInvalid,
    );
    let unknown_abort = setup
        .engine
        .call(ABORT, &json!({ "messageId": unknown }))
        .await?;
    assert_eq!(unknown_abort.status, 200, "{unknown_abort:?}");
    setup.engine.close().await;
    Ok(())
}

#[tokio::test]
async fn turns_that_cannot_be_prepared_fail_as_internal_errors() -> Result<(), Box<dyn Error>> {
    let mut setup = setup().await?;
    fs::write(
        setup.engine.data_dir().join("workspaces"),
        "not a directory",
    )?;

    let mut without_workspace = setup.send("answer").await?;
    let (_, workspace_end) = setup.engine.finish(&mut without_workspace).await?;
    setup.engine.reopen_with_secret_key("rotated").await?;
    let mut with_rotated_key = setup.send("answer").await?;
    let (_, key_end) = setup.engine.finish(&mut with_rotated_key).await?;

    assert_eq!(without_workspace.status, 200, "streaming status");
    for (case, end, prefix) in [
        ("workspace", &workspace_end, "create workspace: "),
        ("rotated key", &key_end, "provider: crypto: decrypt failed"),
    ] {
        assert_eq!(end["error"]["code"], "internal", "{case}: {end}");
        assert!(
            end["error"]["message"]
                .as_str()
                .is_some_and(|m| m.starts_with(prefix)),
            "{case}: {end}"
        );
    }
    setup.engine.close().await;
    Ok(())
}

#[tokio::test]
async fn branching_labels_and_leaf_updates_operate_on_the_message_tree()
-> Result<(), Box<dyn Error>> {
    let mut setup = setup().await?;

    let mut turn1 = setup.send_with_parent("answer", "first", None).await?;
    setup.engine.finish(&mut turn1).await?;
    let tree1 = setup.tree().await?;
    let msgs1 = tree1["messages"].as_array().ok_or("missing messages")?;
    let user1_id = msgs1[0]["id"].as_str().ok_or("no user1 id")?.to_owned();
    let assistant1_id = msgs1[1]["id"]
        .as_str()
        .ok_or("no assistant1 id")?
        .to_owned();
    assert_eq!(tree1["leafId"], assistant1_id, "leafId after first turn");
    assert!(msgs1[0].get("parentId").is_none(), "root has no parentId");
    assert_eq!(
        msgs1[1]["parentId"], user1_id,
        "assistant parentId points to user"
    );

    let labeled = setup
        .engine
        .call(
            SET_LABEL,
            &json!({
                "sessionId": setup.session_id,
                "messageId": assistant1_id,
                "label": " main branch ",
            }),
        )
        .await?;
    assert_eq!(
        labeled.body["message"]["label"], "main branch",
        "label trimmed and stored"
    );
    let labeled_tree = setup.tree().await?;
    assert_eq!(
        labeled_tree["messages"][1]["label"], "main branch",
        "ListMessages includes message label"
    );
    let cleared = setup
        .engine
        .call(
            SET_LABEL,
            &json!({
                "sessionId": setup.session_id,
                "messageId": assistant1_id,
                "label": "   ",
            }),
        )
        .await?;
    assert!(
        cleared.body["message"].get("label").is_none(),
        "blank label clears field"
    );

    let mut root_branch = setup
        .send_with_parent("answer", "fresh root", Some(""))
        .await?;
    let (root_events, _) = setup.engine.finish(&mut root_branch).await?;
    assert!(
        root_events[0]["event"]["started"].get("parentId").is_none(),
        "Root branch omits parentId: {root_events:?}"
    );

    let mut sub_branch = setup
        .send_with_parent("answer", "forked", Some(&assistant1_id))
        .await?;
    let (sub_events, _) = setup.engine.finish(&mut sub_branch).await?;
    assert_eq!(
        sub_events[0]["event"]["started"]["parentId"], assistant1_id,
        "Message branch carries parentId: {sub_events:?}"
    );

    let rewound = setup
        .engine
        .call(
            SET_LEAF,
            &json!({
                "sessionId": setup.session_id,
                "leafId": assistant1_id,
            }),
        )
        .await?;
    assert_eq!(
        rewound.body["session"]["leafId"], assistant1_id,
        "SetSessionLeaf updates session leafId"
    );

    let bad_leaf = setup
        .engine
        .call(
            SET_LEAF,
            &json!({
                "sessionId": setup.session_id,
                "leafId": user1_id,
            }),
        )
        .await?;
    assert_reason(&bad_leaf, ErrorReason::InvalidBranchPoint);

    let mut bad_branch = setup
        .send_with_parent("answer", "bad", Some(&user1_id))
        .await?;
    let (_, bad_branch_end) = setup.engine.finish(&mut bad_branch).await?;
    assert_stream_reason(&bad_branch_end, ErrorReason::InvalidBranchPoint);

    setup.engine.close().await;
    Ok(())
}
