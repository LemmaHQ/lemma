//! Turn streams against a local engine and an OpenAI-compatible vendor:
//! following a turn to its end, resuming after a break, and its limits.

mod common;

use std::error::Error;
use std::io;

use axum::Router;
use common::{Engine, MemoryStore, TestResult, breaking, refusing, vendor};
use lemma_client::{
    Client, ClientError, Connection, MessageItem, MessageRole, MessageStatus, OpenSession,
    TokenPair, Turn, TurnUpdate,
};
use lemma_proto::lemma::v1::{AgentEvent, agent_delta, agent_event};

fn shown(session: &OpenSession) -> Vec<(MessageRole, String, String, MessageStatus, Vec<String>)> {
    session
        .messages()
        .map(|item: &MessageItem| {
            let outputs = item
                .tool_calls
                .iter()
                .map(|call| call.output.clone())
                .collect();
            (
                item.role,
                item.content.clone(),
                item.thinking.clone(),
                item.status,
                outputs,
            )
        })
        .collect()
}

struct Setup {
    engine: Engine,
    client: Client<MemoryStore>,
    pair: TokenPair,
    provider_id: String,
    session_id: String,
}

async fn setup() -> Result<Setup, Box<dyn Error>> {
    let engine = Engine::open().await?;
    let (client, pair) = engine.signed_up("ada").await?;
    let provider_id = client.create_provider(vendor().await?).await?.id;
    let session_id = client.create_session().await?.id;
    Ok(Setup {
        engine,
        client,
        pair,
        provider_id,
        session_id,
    })
}

impl Setup {
    fn client_over(&self, router: Router) -> Client<MemoryStore> {
        Client::local(
            router,
            MemoryStore::with(&Connection::Local, self.pair.clone()),
        )
    }

    async fn send(
        &self,
        client: &Client<MemoryStore>,
        model: &str,
    ) -> Result<Turn<MemoryStore>, ClientError> {
        client
            .send_message(&self.session_id, &self.provider_id, model, "ping")
            .await
    }
}

fn label(event: &AgentEvent) -> &'static str {
    match &event.kind {
        Some(agent_event::Kind::Started(_)) => "started",
        Some(agent_event::Kind::TurnStarted(_)) => "turn_started",
        Some(agent_event::Kind::Delta(delta)) => match delta.part {
            Some(agent_delta::Part::Text(_)) => "text",
            _ => "thinking",
        },
        Some(agent_event::Kind::ToolCallStarted(_)) => "tool_call_started",
        Some(agent_event::Kind::ToolCallFinished(_)) => "tool_call_finished",
        Some(agent_event::Kind::Done(_)) => "done",
        Some(agent_event::Kind::Aborted(_)) => "aborted",
        Some(agent_event::Kind::Error(_)) => "error",
        None => "none",
    }
}

/// Follows `turn` to its end; once `release_after` arrives, runs `release`.
async fn follow(
    turn: &mut Turn<MemoryStore>,
    release_after: &str,
    release: impl Fn() -> io::Result<()>,
) -> Result<(Vec<&'static str>, Option<TurnUpdate>), Box<dyn Error>> {
    let mut labels = Vec::new();
    while let Some(update) = turn.next().await {
        let TurnUpdate::Event(event) = update else {
            return Ok((labels, Some(update)));
        };
        labels.push(label(&event));
        if labels.last() == Some(&release_after) {
            release()?;
        }
    }
    Ok((labels, None))
}

#[tokio::test]
async fn a_turn_streams_its_events_to_the_end() -> TestResult {
    let setup = setup().await?;
    let mut turn = setup.send(&setup.client, "answer").await?;
    assert_eq!(turn.message_id(), None, "unknown before started");
    let (labels, end) = follow(&mut turn, "", || Ok(())).await?;
    assert_eq!(
        labels,
        ["started", "turn_started", "thinking", "text", "done"],
        "whole turn"
    );
    assert!(end.is_none(), "clean end");
    let message_id = turn.message_id().ok_or("no message id after started")?;
    let debug = format!("{turn:?} {:?}", setup.client);
    assert!(debug.contains(message_id), "turn identified: {debug}");
    assert!(
        !debug.contains(&setup.pair.access_token),
        "token hidden: {debug}"
    );
    assert!(turn.next().await.is_none(), "stays ended");
    Ok(())
}

#[tokio::test]
async fn a_broken_stream_resumes_after_the_events_received() -> TestResult {
    let setup = setup().await?;
    let client = setup.client_over(breaking(setup.engine.router(), "/SendMessage", 2));
    let mut turn = setup.send(&client, "wait").await?;
    let session_id = setup.session_id.clone();
    let (labels, end) = follow(&mut turn, "tool_call_started", || {
        setup.engine.release(&session_id)
    })
    .await?;
    assert_eq!(
        labels,
        [
            "started",
            "turn_started",
            "tool_call_started",
            "tool_call_finished",
            "turn_started",
            "text",
            "done"
        ],
        "every event once"
    );
    assert!(end.is_none(), "clean end after resuming");
    Ok(())
}

#[tokio::test]
async fn resuming_gives_up_after_three_attempts() -> TestResult {
    let setup = setup().await?;
    let router = breaking(setup.engine.router(), "/SendMessage", 1);
    let client = setup.client_over(refusing(router, "/ResumeStream"));
    let mut turn = setup.send(&client, "answer").await?;
    let (labels, end) = follow(&mut turn, "", || Ok(())).await?;
    assert_eq!(labels, ["started"], "events before the break");
    assert!(
        matches!(end, Some(TurnUpdate::Failed(ClientError::Network))),
        "the last resume's error: {end:?}"
    );
    assert!(turn.next().await.is_none(), "stays ended");
    Ok(())
}

#[tokio::test]
async fn a_stream_that_breaks_before_the_turn_starts_fails_at_once() -> TestResult {
    let setup = setup().await?;
    let client = setup.client_over(breaking(setup.engine.router(), "/SendMessage", 0));
    let mut turn = setup.send(&client, "answer").await?;
    let (labels, end) = follow(&mut turn, "", || Ok(())).await?;
    assert!(labels.is_empty(), "no events");
    assert!(
        matches!(end, Some(TurnUpdate::Failed(_))),
        "failed: {end:?}"
    );
    assert!(turn.next().await.is_none(), "stays ended");
    Ok(())
}

#[tokio::test]
async fn a_turn_that_ended_while_the_stream_was_away_settles() -> TestResult {
    let setup = setup().await?;
    let client = setup.client_over(breaking(setup.engine.router(), "/SendMessage", 1));
    let mut turn = setup.send(&client, "answer").await?;
    let (labels, end) = follow(&mut turn, "", || Ok(())).await?;
    assert_eq!(labels, ["started"], "events before the break");
    assert!(matches!(end, Some(TurnUpdate::Settled)), "settled: {end:?}");
    Ok(())
}

#[tokio::test]
async fn an_aborted_turn_ends_with_its_aborted_event() -> TestResult {
    let setup = setup().await?;
    let mut turn = setup.send(&setup.client, "wait").await?;
    let mut labels = Vec::new();
    while let Some(TurnUpdate::Event(event)) = turn.next().await {
        labels.push(label(&event));
        if labels.last() == Some(&"tool_call_started") {
            let message_id = turn.message_id().ok_or("no message id")?.to_owned();
            setup.client.abort_message(&message_id).await?;
            setup.engine.release(&setup.session_id)?;
        }
    }
    assert_eq!(labels.last(), Some(&"aborted"), "ends aborted: {labels:?}");
    Ok(())
}

#[tokio::test]
async fn a_running_turn_is_followed_from_its_first_event() -> TestResult {
    let setup = setup().await?;
    let mut first = setup.send(&setup.client, "wait").await?;
    while let Some(TurnUpdate::Event(event)) = first.next().await {
        if label(&event) == "tool_call_started" {
            break;
        }
    }
    let message_id = first.message_id().ok_or("no message id")?.to_owned();
    drop(first);

    let mut again = setup.client.resume_turn(&message_id).await?;
    assert_eq!(
        again.message_id(),
        Some(message_id.as_str()),
        "known up front"
    );
    let session_id = setup.session_id.clone();
    let (labels, end) = follow(&mut again, "tool_call_started", || {
        setup.engine.release(&session_id)
    })
    .await?;
    assert_eq!(
        labels.first(),
        Some(&"started"),
        "replayed from the start: {labels:?}"
    );
    assert_eq!(labels.last(), Some(&"done"), "followed to the end");
    assert!(end.is_none(), "clean end");

    let mut ended = setup.client.resume_turn(&message_id).await?;
    let end = ended.next().await;
    assert!(
        matches!(end, Some(TurnUpdate::Settled)),
        "an ended turn settles: {end:?}"
    );
    Ok(())
}

#[tokio::test]
async fn a_turn_sent_with_an_expired_access_token_refreshes_first() -> TestResult {
    let setup = setup().await?;
    let expired = TokenPair {
        access_token: "expired".to_owned(),
        refresh_token: setup.pair.refresh_token.clone(),
    };
    let client = Client::local(
        setup.engine.router(),
        MemoryStore::with(&Connection::Local, expired),
    );
    let mut turn = setup.send(&client, "answer").await?;
    let (labels, end) = follow(&mut turn, "", || Ok(())).await?;
    assert_eq!(labels.last(), Some(&"done"), "turn ran: {labels:?} {end:?}");
    Ok(())
}

#[tokio::test]
async fn a_resumed_turn_folds_into_the_messages_the_host_stores() -> TestResult {
    let setup = setup().await?;
    let client = setup.client_over(breaking(setup.engine.router(), "/SendMessage", 2));
    let page = client.list_messages(&setup.session_id, None).await?;
    let mut session = OpenSession::new(&setup.session_id, page);
    session.begin_turn("ping", &setup.provider_id, "wait");
    let mut turn = setup.send(&client, "wait").await?;
    while let Some(update) = turn.next().await {
        let TurnUpdate::Event(event) = update else {
            return Err(format!("turn ended early: {update:?}").into());
        };
        session.apply(&event);
        if label(&event) == "tool_call_started" {
            setup.engine.release(&setup.session_id)?;
        }
    }
    assert!(!session.turn_running(), "turn over");

    let stored = OpenSession::new(
        &setup.session_id,
        client.list_messages(&setup.session_id, None).await?,
    );
    assert_eq!(shown(&session), shown(&stored), "live fold equals history");
    let ids: Vec<_> = session.messages().map(|m| m.id.clone()).collect();
    let stored_ids: Vec<_> = stored.messages().map(|m| m.id.clone()).collect();
    assert_eq!(ids, stored_ids, "live ids are the host's ids");
    Ok(())
}
