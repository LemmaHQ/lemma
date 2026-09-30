#![allow(clippy::unwrap_used, missing_docs)]

use std::sync::Arc;

use futures::stream;
use lemma_adapter::{BoxChatFuture, BoxEventStream, ChatRequest, Provider, ProviderKind};
use lemma_agent::{AgentConfig, AgentLoop, TurnEvent};
use lemma_core::{ContentBlock, Message, StopReason, StreamEvent, TextContent};
use lemma_session::TraceStore;
use parking_lot::Mutex;
use sqlx::PgPool;
use uuid::Uuid;

struct MockEchoProvider;

impl Provider for MockEchoProvider {
    fn stream(&self, req: ChatRequest) -> BoxChatFuture {
        let last_prompt = match req.messages.last() {
            Some(Message::User { content }) => content
                .iter()
                .filter_map(|b| match b {
                    ContentBlock::Text(t) => Some(t.text.clone()),
                    _ => None,
                })
                .collect::<String>(),
            _ => String::new(),
        };

        Box::pin(async move {
            let events = vec![
                Ok(StreamEvent::Start),
                Ok(StreamEvent::TextDelta {
                    delta: format!("echo: {last_prompt}"),
                }),
                Ok(StreamEvent::Done {
                    stop_reason: StopReason::Stop,
                    usage: None,
                }),
            ];
            let stream: BoxEventStream = Box::pin(stream::iter(events));
            Ok(stream)
        })
    }
}

#[sqlx::test(migrations = "../lemma-db-pgsql/migrations")]
async fn pg_trace_store_and_agent_loop_end_to_end_observed(pool: PgPool) {
    let user_id = Uuid::new_v4();
    // Seed user record
    sqlx::query(
        r#"
        INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
        VALUES ($1, 'testuser', 'test@example.com', 'hash', 'owner', NOW(), NOW())
        "#,
    )
    .bind(user_id)
    .execute(&pool)
    .await
    .unwrap();

    let provider_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO providers (id, user_id, kind, name, base_url, api_key, models, created_at, updated_at)
        VALUES ($1, $2, 'openai_compatible', 'mock', 'http://mock', 'k', '[]', NOW(), NOW())
        "#,
    )
    .bind(provider_id)
    .bind(user_id)
    .execute(&pool)
    .await
    .unwrap();

    let store = Arc::new(lemma_db_pgsql::PgTraceStore::new(pool.clone(), user_id));
    let provider = Arc::new(MockEchoProvider);
    let agent = AgentLoop::new(store.clone(), provider);

    let conv_id = Uuid::new_v4();
    let meta = store
        .create_conversation(conv_id, "PG Test".to_string(), false)
        .await
        .unwrap();
    assert_eq!(meta.title, "PG Test");
    assert_eq!(meta.leaf_id, None);

    let config = AgentConfig {
        kind: ProviderKind::OpenAiCompatible,
        base_url: "http://mock".to_string(),
        api_path: "".to_string(),
        api_key: "k".to_string(),
        model: "m".to_string(),
        provider_id,
        thinking_effort: None,
    };

    let user_msg = Message::User {
        content: vec![ContentBlock::Text(TextContent {
            text: "Hello from PgTraceStore".to_string(),
        })],
    };

    let events_collected = Arc::new(Mutex::new(Vec::new()));
    let ec_clone = events_collected.clone();
    let observer: Arc<dyn Fn(TurnEvent) + Send + Sync> = Arc::new(move |ev| {
        ec_clone.lock().push(ev);
    });

    let (asst_id, reply) = agent
        .run_turn_observed(conv_id, user_msg, None, config.clone(), Some(observer))
        .await
        .unwrap();

    assert_eq!(reply, "echo: Hello from PgTraceStore");

    // Drop lock before next async call
    let (event_count, first_is_user, last_is_asst) = {
        let events = events_collected.lock();
        (
            events.len(),
            matches!(&events[0], TurnEvent::UserAppended { .. }),
            matches!(&events[events.len() - 1], TurnEvent::AssistantDone { .. }),
        )
    };
    assert!(event_count >= 3);
    assert!(first_is_user);
    assert!(last_is_asst);

    // Verify messages persisted in PostgreSQL and linked via parent_id
    let messages = store.list_messages(conv_id).await.unwrap();
    assert_eq!(messages.len(), 2);
    assert_eq!(messages[1].id, asst_id);
    assert_eq!(messages[1].parent_id, Some(messages[0].id));

    // Verify leaf pointer advanced to assistant message in DB
    let updated_conv = store.get_conversation(conv_id).await.unwrap().unwrap();
    assert_eq!(updated_conv.leaf_id, Some(asst_id));

    // Archive metadata written by the turn: model selection and lifecycle.
    let refreshed = store.get_conversation(conv_id).await.unwrap().unwrap();
    let last_model = refreshed.last_model.unwrap();
    assert_eq!(last_model.provider_id, config.provider_id);
    assert_eq!(last_model.model, "m");

    let assistant = &messages[1];
    assert_eq!(assistant.status, lemma_session::MessageStatus::Done);
    assert_eq!(assistant.model.as_deref(), Some("m"));
    assert_eq!(assistant.provider_id, Some(config.provider_id));
    assert!(assistant.started_at > 0);
    assert!(messages[0].status == lemma_session::MessageStatus::Done);
}
