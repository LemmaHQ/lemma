#![allow(clippy::unwrap_used, missing_docs)]

use std::sync::Arc;

use futures::stream;
use lemma_adapter::{BoxChatFuture, BoxEventStream, ChatRequest, Provider, ProviderKind};
use lemma_agent::{AgentConfig, AgentLoop};
use lemma_client::SyncEngine;
use lemma_core::{ContentBlock, Message, StopReason, StreamEvent, TextContent};
use lemma_db_client::SqliteTraceStore;
use lemma_session::TraceStore;
use tempfile::NamedTempFile;
use uuid::Uuid;

struct MockEchoProvider;

impl Provider for MockEchoProvider {
    fn stream(&self, _req: ChatRequest) -> BoxChatFuture {
        Box::pin(async move {
            let events = vec![
                Ok(StreamEvent::Start),
                Ok(StreamEvent::TextDelta {
                    delta: "offline reply".to_string(),
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

#[tokio::test]
async fn sync_engine_offline_turn_generates_outbox_and_syncs_cursor() {
    let tmp = NamedTempFile::new().unwrap();
    let db_path = tmp.path().to_path_buf();
    let conv_id = Uuid::new_v4();

    // 1. Offline: generate conversations and messages locally
    let store = Arc::new(SqliteTraceStore::open(&db_path).unwrap());
    let agent = AgentLoop::new(store.clone(), Arc::new(MockEchoProvider));

    store
        .create_conversation(conv_id, "Offline Work".to_string(), false)
        .await
        .unwrap();

    let config = AgentConfig {
        kind: ProviderKind::OpenAiCompatible,
        base_url: "http://local".to_string(),
        api_path: "".to_string(),
        api_key: "key".to_string(),
        model: "model".to_string(),
    };

    let user_msg = Message::User {
        content: vec![ContentBlock::Text(TextContent {
            text: "Offline prompt".to_string(),
        })],
    };

    let (_asst_id, reply) = agent
        .run_turn(conv_id, user_msg, None, config)
        .await
        .unwrap();
    assert_eq!(reply, "offline reply");

    // 2. Verify outbox captured exactly 1 conversation + 2 messages
    let engine = SyncEngine::new(store.clone());
    let outbox = engine.get_pending_outbox(100).unwrap();
    assert_eq!(outbox.len(), 3);
    assert_eq!(outbox[0].entity_type, "conversation");
    assert_eq!(outbox[0].entity_id, conv_id);
    assert_eq!(outbox[1].entity_type, "message");
    assert_eq!(outbox[2].entity_type, "message");

    // 3. Simulate pushing to remote: ack the outbox
    let max_id = outbox.last().unwrap().id;
    engine.ack_outbox(max_id).unwrap();
    assert_eq!(engine.get_pending_outbox(100).unwrap().len(), 0);

    // 4. Simulate pulling updates from remote: apply a dummy PullResponse
    let response = lemma_proto::lemma::v1::PullResponse {
        next_after: 42,
        has_more: false,
        ..Default::default()
    };
    engine.apply_pull_batch(response).unwrap();

    // 5. Verify local sync cursor advanced
    assert_eq!(engine.get_sync_cursor().unwrap(), 42);
}
