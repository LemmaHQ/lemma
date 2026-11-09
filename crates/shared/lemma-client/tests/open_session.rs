//! Behavioral tests for stored messages and open-session event reduction.

use buffa_types::google::protobuf::Timestamp;
use chrono::{DateTime, Duration, Utc};
use lemma_client::{
    ClientError, MessageError, MessageItem, MessageRole, MessageStatus, OpenSession,
};
use lemma_proto::lemma::v1::{
    AgentDelta, AgentError, AgentEvent, AgentStarted, AgentTurnStarted, ListMessagesResponse,
    Message, MessageStatus as ProtoMessageStatus, TextDelta, ThinkingDelta, ToolCall,
    ToolCallFinished, ToolCallStarted, ToolResultMeta, agent_delta, agent_event,
};

fn at(seconds: i64) -> DateTime<Utc> {
    DateTime::UNIX_EPOCH + Duration::seconds(seconds)
}

fn stored(id: &str, role: &str, status: ProtoMessageStatus) -> Message {
    Message {
        id: id.to_owned(),
        role: role.to_owned(),
        status: status.into(),
        ..Default::default()
    }
}

fn page(messages: Vec<Message>, has_more: bool) -> ListMessagesResponse {
    ListMessagesResponse {
        messages,
        has_more,
        ..Default::default()
    }
}

fn event(kind: agent_event::Kind) -> AgentEvent {
    AgentEvent {
        kind: Some(kind),
        ..Default::default()
    }
}

fn event_at(kind: agent_event::Kind, seconds: i64) -> AgentEvent {
    AgentEvent {
        occurred_at: Timestamp::from(at(seconds)).into(),
        ..event(kind)
    }
}

fn text(text: &str, seconds: i64) -> AgentEvent {
    event_at(
        agent_event::Kind::Delta(Box::new(AgentDelta {
            part: Some(agent_delta::Part::Text(Box::new(TextDelta {
                content: text.to_owned(),
                ..Default::default()
            }))),
            ..Default::default()
        })),
        seconds,
    )
}

fn thinking(text: &str, seconds: i64) -> AgentEvent {
    event_at(
        agent_event::Kind::Delta(Box::new(AgentDelta {
            part: Some(agent_delta::Part::Thinking(Box::new(ThinkingDelta {
                content: text.to_owned(),
                ..Default::default()
            }))),
            ..Default::default()
        })),
        seconds,
    )
}

fn turn_started(id: &str) -> AgentEvent {
    event(agent_event::Kind::TurnStarted(Box::new(AgentTurnStarted {
        message_id: id.to_owned(),
        ..Default::default()
    })))
}

fn last_reply(session: &OpenSession) -> &MessageItem {
    let Some(reply) = session.messages().last() else {
        panic!("reply present");
    };
    reply
}

fn finish_turn(session: &mut OpenSession) {
    session.apply(&event(agent_event::Kind::Done(Box::default())));
}

#[test]
fn stored_messages_convert_and_hydrate_tool_results() {
    let mut assistant = stored("assistant", "assistant", ProtoMessageStatus::Error);
    assistant.content = "answer".to_owned();
    assistant.thinking = "reasoning".to_owned();
    assistant.provider_id = "provider".to_owned();
    assistant.model = "model".to_owned();
    assistant.error = "server failure".to_owned();
    assistant.thinking_started_at = Timestamp::from(at(1)).into();
    assistant.thinking_finished_at = Timestamp::from(at(2)).into();
    assistant.tool_calls = vec![
        ToolCall {
            id: "call-1".to_owned(),
            name: "read".to_owned(),
            arguments: "{}".to_owned(),
            started_at: Timestamp::from(at(3)).into(),
            finished_at: Timestamp::from(at(4)).into(),
            ..Default::default()
        },
        ToolCall {
            id: "call-2".to_owned(),
            started_at: Timestamp {
                seconds: 0,
                nanos: -1,
                ..Default::default()
            }
            .into(),
            ..Default::default()
        },
    ];
    let mut result = stored("tool", "tool", ProtoMessageStatus::Done);
    result.content = "file text".to_owned();
    result.tool_result = ToolResultMeta {
        tool_call_id: "call-1".to_owned(),
        is_error: true,
        ..Default::default()
    }
    .into();
    let without_meta = stored("other-tool", "tool", ProtoMessageStatus::Done);
    let user = stored("user", "user", ProtoMessageStatus::Done);

    let session = OpenSession::new(
        "session",
        page(vec![without_meta, result, assistant, user], true),
    );

    assert_eq!(session.session_id(), "session", "session id retained");
    assert!(session.has_older(), "initial has_more retained");
    assert_eq!(session.oldest_id(), Some("user"), "oldest item id returned");
    let items: Vec<_> = session.messages().collect();
    assert_eq!(items.len(), 2, "tool rows hidden");
    assert_eq!(items[0].id, "user", "history reversed to oldest first");
    let reply = items[1];
    assert_eq!(reply.role, MessageRole::Assistant, "assistant role mapped");
    assert_eq!(reply.content, "answer", "content mapped");
    assert_eq!(reply.thinking, "reasoning", "thinking mapped");
    assert_eq!(reply.status, MessageStatus::Error, "error status mapped");
    assert_eq!(reply.provider_id, "provider", "provider mapped");
    assert_eq!(reply.model, "model", "model mapped");
    assert_eq!(
        reply.thinking_started_at,
        Some(at(1)),
        "thinking start mapped"
    );
    assert_eq!(
        reply.thinking_finished_at,
        Some(at(2)),
        "thinking end mapped"
    );
    assert!(
        matches!(reply.error.as_ref(), Some(MessageError::Server(error)) if error == "server failure"),
        "service error retained verbatim"
    );
    assert_eq!(reply.tool_calls.len(), 2, "both calls mapped");
    let call = &reply.tool_calls[0];
    assert_eq!(call.name, "read", "tool name mapped");
    assert_eq!(call.arguments, "{}", "arguments mapped");
    assert_eq!(call.output, "file text", "tool result hydrated");
    assert!(call.is_error, "tool failure hydrated");
    assert!(!call.running, "history calls are not running");
    assert_eq!(call.started_at, Some(at(3)), "tool start mapped");
    assert_eq!(call.finished_at, Some(at(4)), "tool finish mapped");
    assert_eq!(reply.tool_calls[1].output, "", "unknown result left empty");
    assert!(!reply.tool_calls[1].is_error, "unknown result not failed");
    assert_eq!(
        reply.tool_calls[1].started_at, None,
        "invalid timestamp omitted"
    );
}

#[test]
fn message_conversion_covers_role_status_and_empty_defaults() {
    for (role, expected) in [
        ("user", MessageRole::User),
        ("tool", MessageRole::Tool),
        ("assistant", MessageRole::Assistant),
        ("system", MessageRole::Assistant),
        ("unknown", MessageRole::Assistant),
    ] {
        let item = MessageItem::from(stored("id", role, ProtoMessageStatus::Done));
        assert_eq!(item.role, expected, "role {role} mapped");
        assert!(item.error.is_none(), "empty error omitted");
    }

    for (status, expected) in [
        (ProtoMessageStatus::Streaming, MessageStatus::Streaming),
        (ProtoMessageStatus::Done, MessageStatus::Done),
        (ProtoMessageStatus::Aborted, MessageStatus::Aborted),
        (ProtoMessageStatus::Error, MessageStatus::Error),
        (ProtoMessageStatus::Unspecified, MessageStatus::Done),
    ] {
        let item = MessageItem::from(stored("id", "assistant", status));
        assert_eq!(item.status, expected, "status {status:?} mapped");
        assert_eq!(item.thinking_started_at, None, "absent start omitted");
        assert_eq!(item.thinking_finished_at, None, "absent finish omitted");
    }

    let mut unknown = stored("id", "assistant", ProtoMessageStatus::Done);
    unknown.status = 99.into();
    assert_eq!(
        MessageItem::from(unknown).status,
        MessageStatus::Done,
        "unknown proto status settles"
    );
}

#[test]
fn older_pages_and_reload_preserve_the_expected_state() {
    let mut result = stored("result", "tool", ProtoMessageStatus::Done);
    result.content = "older output".to_owned();
    result.tool_result = ToolResultMeta {
        tool_call_id: "old-call".to_owned(),
        is_error: false,
        ..Default::default()
    }
    .into();
    let mut old = stored("old", "assistant", ProtoMessageStatus::Done);
    old.tool_calls = vec![ToolCall {
        id: "old-call".to_owned(),
        ..Default::default()
    }];
    let mut session = OpenSession::new(
        "session",
        page(
            vec![stored("new", "assistant", ProtoMessageStatus::Done), result],
            true,
        ),
    );
    session.prepend_older(page(vec![old], false));
    assert!(!session.has_older(), "older page updates has_more");
    assert_eq!(session.oldest_id(), Some("old"), "prepended oldest id");

    session.begin_turn("question", "provider", "model");
    session.prepend_older(page(
        vec![stored("older", "assistant", ProtoMessageStatus::Done)],
        true,
    ));
    session.apply(&event(agent_event::Kind::Started(Box::new(AgentStarted {
        message_id: "server-user".to_owned(),
        ..Default::default()
    }))));
    session.apply(&turn_started("server-reply"));
    session.apply(&text("answer", 10));
    let items: Vec<_> = session.messages().collect();
    let ids: Vec<_> = items.iter().map(|item| item.id.as_str()).collect();
    assert_eq!(
        ids,
        ["older", "old", "new", "server-user", "server-reply"],
        "paging keeps order and live indices"
    );
    assert_eq!(items[4].content, "answer", "event targets shifted reply");
    assert_eq!(
        items[1].tool_calls[0].output, "older output",
        "prepend hydrates calls using results already loaded"
    );

    session.reload(page(
        vec![stored("fresh", "assistant", ProtoMessageStatus::Done)],
        true,
    ));
    assert!(!session.turn_running(), "reload ends current turn");
    assert!(session.has_older(), "reload replaces has_more");
    assert_eq!(
        session.oldest_id(),
        Some("fresh"),
        "reload replaces history"
    );
    assert_eq!(session.messages().count(), 1, "reload drops other items");
    session.begin_turn("again", "provider-2", "model-2");
    let ids: Vec<_> = session.messages().map(|item| item.id.as_str()).collect();
    assert_eq!(
        ids,
        ["fresh", "local-2", "local-3"],
        "local ids stay unique across reload"
    );
}

#[test]
fn empty_and_inactive_sessions_ignore_turn_operations() {
    let mut session = OpenSession::new("empty", ListMessagesResponse::default());
    assert_eq!(session.oldest_id(), None, "empty history has no anchor");
    assert!(!session.has_older(), "empty page has no older history");
    assert_eq!(
        session.messages().count(),
        0,
        "empty history has no messages"
    );
    assert_eq!(session.running_turn(), None, "no user turn to resume");
    assert_eq!(
        session.resume_turn(),
        None,
        "resume without a turn is a no-op"
    );
    session.apply(&AgentEvent::default());
    session.apply(&event(agent_event::Kind::Done(Box::default())));
    session.fail(ClientError::Timeout);
    session.cancel_turn();
    assert!(!session.turn_running(), "no turn became active");
}

#[test]
fn started_and_first_turn_started_reconcile_local_ids() {
    let mut session = OpenSession::new("session", ListMessagesResponse::default());
    session.begin_turn("question", "provider", "model");
    assert!(session.turn_running(), "begin_turn starts a turn");
    assert_eq!(session.running_turn(), None, "live turn is not interrupted");
    let initial: Vec<_> = session.messages().collect();
    assert_eq!(initial[0].id, "local-0", "user receives local id");
    assert_eq!(initial[0].role, MessageRole::User, "optimistic user role");
    assert_eq!(initial[0].content, "question", "optimistic user content");
    assert_eq!(initial[0].status, MessageStatus::Done, "user is settled");
    assert_eq!(initial[1].id, "local-1", "reply receives local id");
    assert_eq!(initial[1].status, MessageStatus::Streaming, "reply streams");
    assert_eq!(initial[1].provider_id, "provider", "reply provider set");
    assert_eq!(initial[1].model, "model", "reply model set");

    let started = event(agent_event::Kind::Started(Box::new(AgentStarted {
        message_id: "server-user".to_owned(),
        ..Default::default()
    })));
    session.apply(&started);
    session.apply(&started);
    session.apply(&turn_started("server-reply"));
    session.apply(&event(agent_event::Kind::Delta(Box::default())));
    session.apply(&text("answer", 10));
    finish_turn(&mut session);
    session.apply(&text("ignored", 20));

    let items: Vec<_> = session.messages().collect();
    assert_eq!(items.len(), 2, "empty placeholder renamed in place");
    assert_eq!(
        items[0].id, "server-user",
        "optimistic user reconciled once"
    );
    assert_eq!(items[1].id, "server-reply", "empty reply reconciled");
    assert_eq!(items[1].content, "answer", "post-turn event ignored");
    assert_eq!(items[1].status, MessageStatus::Done, "done status applied");
    assert!(!session.turn_running(), "done ends turn");
    assert_eq!(session.running_turn(), None, "settled turn not resumable");
}

#[test]
fn thinking_and_tool_calls_fold_with_their_timestamps() {
    let mut session = OpenSession::new("session", ListMessagesResponse::default());
    session.begin_turn("question", "provider", "model");
    session.apply(&thinking("first", 10));
    session.apply(&thinking(" second", 11));
    session.apply(&text("answer", 20));
    session.apply(&thinking(" later", 21));
    session.apply(&event_at(
        agent_event::Kind::ToolCallStarted(Box::new(ToolCallStarted {
            call_id: "call".to_owned(),
            name: "read".to_owned(),
            arguments: "{}".to_owned(),
            ..Default::default()
        })),
        30,
    ));
    session.apply(&event_at(
        agent_event::Kind::ToolCallFinished(Box::new(ToolCallFinished {
            call_id: "unknown".to_owned(),
            content: "ignored".to_owned(),
            is_error: true,
            ..Default::default()
        })),
        31,
    ));
    session.apply(&event_at(
        agent_event::Kind::ToolCallFinished(Box::new(ToolCallFinished {
            call_id: "call".to_owned(),
            content: "output".to_owned(),
            is_error: true,
            ..Default::default()
        })),
        40,
    ));
    session.apply(&event_at(agent_event::Kind::Done(Box::default()), 50));

    let reply = last_reply(&session);
    assert_eq!(reply.content, "answer", "text deltas appended");
    assert_eq!(reply.thinking, "first second later", "thinking appended");
    assert_eq!(reply.thinking_started_at, Some(at(10)), "first start kept");
    assert_eq!(
        reply.thinking_finished_at,
        Some(at(20)),
        "first text closes thinking"
    );
    assert_eq!(reply.tool_calls.len(), 1, "one tool call appended");
    let call = &reply.tool_calls[0];
    assert_eq!(call.id, "call", "tool id mapped");
    assert_eq!(call.name, "read", "tool name mapped");
    assert_eq!(call.arguments, "{}", "tool arguments mapped");
    assert_eq!(call.output, "output", "known call finished");
    assert!(call.is_error, "tool failure mapped");
    assert!(!call.running, "finished call not running");
    assert_eq!(call.started_at, Some(at(30)), "tool start timestamp");
    assert_eq!(call.finished_at, Some(at(40)), "tool finish timestamp");
}

#[test]
fn a_nonempty_reply_settles_before_the_next_step() {
    let mut session = OpenSession::new("session", ListMessagesResponse::default());
    session.begin_turn("question", "provider", "model");
    session.apply(&turn_started("reply-1"));
    session.apply(&text("first", 10));
    session.apply(&turn_started("reply-2"));
    session.apply(&text("second", 20));
    finish_turn(&mut session);

    let items: Vec<_> = session.messages().collect();
    assert_eq!(items.len(), 3, "new step appends a reply");
    assert_eq!(items[1].id, "reply-1", "first reply id");
    assert_eq!(items[1].status, MessageStatus::Done, "first step settled");
    assert_eq!(items[1].content, "first", "first content retained");
    assert_eq!(items[2].id, "reply-2", "second reply id");
    assert_eq!(items[2].content, "second", "second reply current");
    assert_eq!(items[2].provider_id, "provider", "turn provider retained");
    assert_eq!(items[2].model, "model", "turn model retained");
}

#[test]
fn terminal_events_and_local_failures_end_turns() {
    let mut session = OpenSession::new("session", ListMessagesResponse::default());

    session.begin_turn("abort", "provider", "model");
    session.apply(&thinking("thinking", 10));
    session.apply(&event_at(agent_event::Kind::Aborted(Box::default()), 20));
    let reply = last_reply(&session);
    assert_eq!(
        reply.status,
        MessageStatus::Aborted,
        "aborted status applied"
    );
    assert_eq!(
        reply.thinking_finished_at,
        Some(at(20)),
        "abort closes thinking"
    );
    assert!(!session.turn_running(), "aborted event ends turn");

    session.begin_turn("error", "provider", "model");
    session.apply(&event_at(
        agent_event::Kind::Error(Box::new(AgentError {
            message: "service failed".to_owned(),
            ..Default::default()
        })),
        30,
    ));
    let reply = last_reply(&session);
    assert_eq!(reply.status, MessageStatus::Error, "error status applied");
    assert!(
        matches!(reply.error.as_ref(), Some(MessageError::Server(error)) if error == "service failed"),
        "service failure retained"
    );
    assert!(!session.turn_running(), "error event ends turn");

    session.begin_turn("failure", "provider", "model");
    session.apply(&thinking("thinking", 40));
    session.fail(ClientError::Network);
    let reply = last_reply(&session);
    assert_eq!(reply.status, MessageStatus::Error, "client failure status");
    assert!(
        matches!(
            reply.error.as_ref(),
            Some(MessageError::Client(ClientError::Network))
        ),
        "client failure retained"
    );
    assert_eq!(
        reply.thinking_finished_at, None,
        "failure has no event time"
    );
    assert!(!session.turn_running(), "failure ends turn");

    session.begin_turn("cancel", "provider", "model");
    session.apply(&thinking("thinking", 50));
    session.cancel_turn();
    let reply = last_reply(&session);
    assert_eq!(reply.status, MessageStatus::Aborted, "local cancel status");
    assert_eq!(reply.thinking_finished_at, None, "cancel has no event time");
    assert!(!session.turn_running(), "cancel ends turn");
}

#[test]
fn interrupted_turn_resumes_from_the_last_user_message() {
    let mut first = stored("reply-1", "assistant", ProtoMessageStatus::Streaming);
    first.provider_id = "old-provider".to_owned();
    first.model = "old-model".to_owned();
    let mut second = stored("reply-2", "assistant", ProtoMessageStatus::Streaming);
    second.provider_id = "new-provider".to_owned();
    second.model = "new-model".to_owned();
    let user = stored("user", "user", ProtoMessageStatus::Done);
    let discarded = stored("later", "assistant", ProtoMessageStatus::Done);
    let mut session =
        OpenSession::new("session", page(vec![discarded, second, first, user], false));

    assert_eq!(session.running_turn(), Some("user"), "running user found");
    assert_eq!(
        session.resume_turn().as_deref(),
        Some("user"),
        "resume returns user id"
    );
    assert!(session.turn_running(), "resume starts local turn");
    assert_eq!(session.running_turn(), None, "resumed turn is live");
    session.apply(&event(agent_event::Kind::Started(Box::new(AgentStarted {
        message_id: "ignored".to_owned(),
        ..Default::default()
    }))));
    let items: Vec<_> = session.messages().collect();
    assert_eq!(items.len(), 2, "items after user replaced");
    assert_eq!(items[0].id, "user", "resumed user id unchanged");
    assert_eq!(items[1].id, "local-0", "fresh local reply appended");
    assert_eq!(
        items[1].status,
        MessageStatus::Streaming,
        "fresh reply streams"
    );
    assert_eq!(
        items[1].provider_id, "new-provider",
        "last streaming provider used"
    );
    assert_eq!(items[1].model, "new-model", "last streaming model used");

    let mut earlier = stored("reply", "assistant", ProtoMessageStatus::Streaming);
    earlier.provider_id = "provider".to_owned();
    let later_user = stored("later-user", "user", ProtoMessageStatus::Done);
    let mut inactive = OpenSession::new("inactive", page(vec![later_user, earlier], false));
    assert_eq!(
        inactive.running_turn(),
        None,
        "streaming before last user ignored"
    );
    assert_eq!(inactive.resume_turn(), None, "inactive resume is a no-op");
}

#[test]
fn absent_and_invalid_event_timestamps_are_omitted() {
    let mut session = OpenSession::new("session", ListMessagesResponse::default());
    session.begin_turn("question", "provider", "model");
    let invalid = AgentEvent {
        kind: Some(agent_event::Kind::Delta(Box::new(AgentDelta {
            part: Some(agent_delta::Part::Thinking(Box::new(ThinkingDelta {
                content: "thinking".to_owned(),
                ..Default::default()
            }))),
            ..Default::default()
        }))),
        occurred_at: Timestamp {
            seconds: 0,
            nanos: 1_000_000_000,
            ..Default::default()
        }
        .into(),
        ..Default::default()
    };
    session.apply(&invalid);
    session.apply(&event(agent_event::Kind::Delta(Box::new(AgentDelta {
        part: Some(agent_delta::Part::Text(Box::new(TextDelta {
            content: "answer".to_owned(),
            ..Default::default()
        }))),
        ..Default::default()
    }))));
    let reply = last_reply(&session);
    assert_eq!(reply.thinking_started_at, None, "invalid start omitted");
    assert_eq!(reply.thinking_finished_at, None, "absent finish omitted");
    assert_eq!(reply.content, "answer", "content still folds");
}
