#![allow(clippy::unwrap_used, missing_docs)]

use std::sync::Arc;

use futures::stream;
use lemma_adapter::{BoxChatFuture, BoxEventStream, ChatRequest, Provider, ProviderKind};
use lemma_agent::AgentConfig;
use lemma_client::{ClientEngine, EngineMode, LocalClientEngine};
use lemma_core::{ContentBlock, Message, StopReason, StreamEvent, TextContent};
use tempfile::NamedTempFile;
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
                    delta: format!("local reply to: {last_prompt}"),
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
async fn client_facade_local_mode_persists_across_reopen() {
    let tmp = NamedTempFile::new().unwrap();
    let db_path = tmp.path().to_path_buf();
    let conv_id = Uuid::new_v4();

    // 1. First run: open engine facade, run a turn through ClientEngine trait
    {
        let provider = Arc::new(MockEchoProvider);
        let engine = LocalClientEngine::open(&db_path, provider).unwrap();
        assert_eq!(engine.mode(), EngineMode::Local);

        let meta = engine
            .create_conversation(conv_id, "Offline Project".to_string())
            .await
            .unwrap();
        assert_eq!(meta.title, "Offline Project");
        assert!(meta.local_only);
        assert_eq!(meta.leaf_id, None);

        let config = AgentConfig {
            kind: ProviderKind::OpenAiCompatible,
            base_url: "http://local".to_string(),
            api_path: "".to_string(),
            api_key: "offline".to_string(),
            model: "local-coder".to_string(),
        };

        let user_msg = Message::User {
            content: vec![ContentBlock::Text(TextContent {
                text: "Refactor this function".to_string(),
            })],
        };

        let (_asst_id, reply) = engine
            .run_turn(conv_id, user_msg, None, config, None)
            .await
            .unwrap();

        assert_eq!(reply, "local reply to: Refactor this function");
    }

    // 2. Second run: simulate app restart, reopen same SQLite file through facade
    {
        let provider = Arc::new(MockEchoProvider);
        let engine = LocalClientEngine::open(&db_path, provider).unwrap();

        let meta = engine.get_conversation(conv_id).await.unwrap().unwrap();
        assert_eq!(meta.title, "Offline Project");
        assert!(meta.local_only);
        assert!(meta.leaf_id.is_some());

        let messages = engine.list_messages(conv_id).await.unwrap();
        assert_eq!(messages.len(), 2); // 1 User + 1 Assistant

        // Verify FTS search survives restart
        let results = engine.store().search_history("Refactor", 5).unwrap();
        assert_eq!(results.len(), 2);
    }
}
