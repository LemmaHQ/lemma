#![allow(clippy::unwrap_used, missing_docs)]

use futures::stream;
use lemma_adapter::{BoxChatFuture, BoxEventStream, ChatRequest, Provider, ProviderKind};
use lemma_agent::{
    AgentConfig, AgentLoop, BoxStoreFuture, ConversationMeta, StoredMessage, TraceStore,
};
use lemma_trace::{ContentBlock, Message, StopReason, StreamEvent, TextContent};
use parking_lot::Mutex;
use std::sync::Arc;
use uuid::Uuid;

struct MemoryStore {
    conversations: Mutex<std::collections::HashMap<Uuid, ConversationMeta>>,
    messages: Mutex<Vec<StoredMessage>>,
}

impl MemoryStore {
    fn new() -> Self {
        Self {
            conversations: Mutex::new(std::collections::HashMap::new()),
            messages: Mutex::new(Vec::new()),
        }
    }
}

impl TraceStore for MemoryStore {
    fn create_conversation<'a>(
        &'a self,
        id: Uuid,
        title: String,
        local_only: bool,
    ) -> BoxStoreFuture<'a, ConversationMeta> {
        Box::pin(async move {
            let meta = ConversationMeta {
                id,
                title,
                leaf_id: None,
                local_only,
                created_at: 0,
                updated_at: 0,
            };
            self.conversations.lock().insert(id, meta.clone());
            Ok(meta)
        })
    }

    fn get_conversation<'a>(&'a self, id: Uuid) -> BoxStoreFuture<'a, Option<ConversationMeta>> {
        Box::pin(async move { Ok(self.conversations.lock().get(&id).cloned()) })
    }

    fn update_leaf<'a>(&'a self, id: Uuid, leaf_id: Uuid) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            if let Some(c) = self.conversations.lock().get_mut(&id) {
                c.leaf_id = Some(leaf_id);
            }
            Ok(())
        })
    }

    fn append_message<'a>(&'a self, entry: StoredMessage) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            self.messages.lock().push(entry);
            Ok(())
        })
    }

    fn list_messages<'a>(
        &'a self,
        conversation_id: Uuid,
    ) -> BoxStoreFuture<'a, Vec<StoredMessage>> {
        Box::pin(async move {
            let list = self
                .messages
                .lock()
                .iter()
                .filter(|m| m.conversation_id == conversation_id)
                .cloned()
                .collect();
            Ok(list)
        })
    }
}

struct EchoProvider;

impl Provider for EchoProvider {
    fn stream(&self, req: ChatRequest) -> BoxChatFuture {
        let last_text = match req.messages.last() {
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
                    delta: format!("echo: {last_text}"),
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
async fn agent_loop_executes_turn_and_maintains_leaf() {
    let store = Arc::new(MemoryStore::new());
    let provider = Arc::new(EchoProvider);
    let agent = AgentLoop::new(store.clone(), provider);

    let conv_id = Uuid::new_v4();
    store
        .create_conversation(conv_id, "Test Conv".to_string(), false)
        .await
        .unwrap();

    let config = AgentConfig {
        kind: ProviderKind::OpenAiCompatible,
        base_url: "http://fake".to_string(),
        api_path: "".to_string(),
        api_key: "key".to_string(),
        model: "m1".to_string(),
    };

    let user_msg = Message::User {
        content: vec![ContentBlock::Text(TextContent {
            text: "Hello world".to_string(),
        })],
    };

    // First turn
    let (asst_id, reply) = agent
        .run_turn(conv_id, user_msg, None, config.clone())
        .await
        .unwrap();
    assert_eq!(reply, "echo: Hello world");

    // Verify leaf pointer moved to assistant
    let meta = store.get_conversation(conv_id).await.unwrap().unwrap();
    assert_eq!(meta.leaf_id, Some(asst_id));

    // Branching turn: branch from root (None as parent)
    let branch_user_msg = Message::User {
        content: vec![ContentBlock::Text(TextContent {
            text: "Alternative hello".to_string(),
        })],
    };

    let (branch_asst_id, branch_reply) = agent
        .run_turn(conv_id, branch_user_msg, None, config)
        .await
        .unwrap();
    assert_eq!(branch_reply, "echo: Alternative hello");

    let meta2 = store.get_conversation(conv_id).await.unwrap().unwrap();
    assert_eq!(meta2.leaf_id, Some(branch_asst_id));
}
