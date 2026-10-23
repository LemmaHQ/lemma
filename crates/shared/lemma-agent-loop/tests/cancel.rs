//! Turn cancellation through `CancelToken`.

use std::error::Error;
use std::sync::Arc;

use chrono::DateTime;
use futures::stream;
use lemma_agent_loop::{AgentLoop, CancelToken, TurnEnd, TurnEvent, TurnInput};
use lemma_conversation::{
    Conversation, ConversationError, ConversationStore, LastModel, Message as StoredMessage,
    MessagePage, MessageStatus, MessageUpdate,
};
use lemma_core::{ContentBlock, Message, StopReason, StreamEvent, TextContent};
use lemma_model::{Adapter, BoxEventStream, ModelError, ModelRequest};
use lemma_tools::LocalExecEnv;
use tokio::sync::{Mutex, mpsc};
use uuid::Uuid;

#[derive(Clone, Default)]
struct MemoryStore {
    meta: Arc<Mutex<Option<Conversation>>>,
    messages: Arc<Mutex<Vec<StoredMessage>>>,
}

impl MemoryStore {
    async fn messages(&self) -> Vec<StoredMessage> {
        self.messages.lock().await.clone()
    }

    async fn leaf(&self) -> Option<Uuid> {
        self.meta.lock().await.as_ref().and_then(|m| m.leaf_id)
    }
}

impl ConversationStore for MemoryStore {
    async fn insert(&self, user_id: Uuid) -> Result<Conversation, ConversationError> {
        let meta = Conversation {
            id: Uuid::new_v4(),
            user_id,
            title: String::new(),
            leaf_id: None,
            last_model: None,
            created_at: DateTime::UNIX_EPOCH,
            updated_at: DateTime::UNIX_EPOCH,
        };
        *self.meta.lock().await = Some(meta.clone());
        Ok(meta)
    }

    async fn list_by_user(&self, _user_id: Uuid) -> Result<Vec<Conversation>, ConversationError> {
        Ok(vec![])
    }

    async fn find_by_id_and_user(
        &self,
        id: Uuid,
        _user_id: Uuid,
    ) -> Result<Option<Conversation>, ConversationError> {
        Ok(self.meta.lock().await.clone().filter(|m| m.id == id))
    }

    async fn rename(
        &self,
        _id: Uuid,
        _user_id: Uuid,
        _title: &str,
    ) -> Result<Option<Conversation>, ConversationError> {
        Ok(None)
    }

    async fn delete(&self, _id: Uuid, _user_id: Uuid) -> Result<bool, ConversationError> {
        Ok(false)
    }

    async fn update_leaf(
        &self,
        _id: Uuid,
        _user_id: Uuid,
        leaf_id: Uuid,
    ) -> Result<(), ConversationError> {
        if let Some(meta) = self.meta.lock().await.as_mut() {
            meta.leaf_id = Some(leaf_id);
        }
        Ok(())
    }

    async fn update_last_model(
        &self,
        _id: Uuid,
        _user_id: Uuid,
        last_model: &LastModel,
    ) -> Result<(), ConversationError> {
        if let Some(meta) = self.meta.lock().await.as_mut() {
            meta.last_model = Some(last_model.clone());
        }
        Ok(())
    }

    async fn append_message(&self, entry: &StoredMessage) -> Result<(), ConversationError> {
        self.messages.lock().await.push(entry.clone());
        Ok(())
    }

    async fn update_message(
        &self,
        id: Uuid,
        update: &MessageUpdate,
    ) -> Result<(), ConversationError> {
        let mut messages = self.messages.lock().await;
        let Some(entry) = messages.iter_mut().find(|m| m.id == id) else {
            return Err(ConversationError::Missing(id.to_string()));
        };
        entry.message = update.message.clone();
        entry.status = update.status;
        entry.error.clone_from(&update.error);
        Ok(())
    }

    async fn list_messages(
        &self,
        _conversation_id: Uuid,
    ) -> Result<Vec<StoredMessage>, ConversationError> {
        Ok(self.messages().await)
    }

    async fn list_messages_page(
        &self,
        _conversation_id: Uuid,
        _before_id: Option<Uuid>,
        _limit: i64,
    ) -> Result<MessagePage, ConversationError> {
        Ok(MessagePage {
            messages: vec![],
            has_more: false,
        })
    }
}

/// Streams one text delta, then waits forever for more.
struct StalledAdapter;

impl Adapter for StalledAdapter {
    async fn stream(&self, _req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        use futures::StreamExt;

        let head = stream::iter([
            Ok(StreamEvent::Start),
            Ok(StreamEvent::TextDelta {
                delta: "partial".into(),
            }),
        ]);
        Ok(Box::pin(head.chain(stream::pending())))
    }
}

fn input(user_id: Uuid, conversation_id: Uuid) -> TurnInput {
    TurnInput {
        user_id,
        conversation_id,
        user_message_id: Uuid::new_v4(),
        user_message: Message::User {
            content: vec![ContentBlock::Text(TextContent {
                text: "hello".into(),
            })],
        },
        model: LastModel {
            provider_id: Uuid::new_v4(),
            model: "m".into(),
            thinking_effort: None,
        },
    }
}

#[tokio::test]
async fn cancel_mid_stream_settles_placeholder_as_aborted() -> Result<(), Box<dyn Error>> {
    let store = MemoryStore::default();
    let user_id = Uuid::new_v4();
    let conversation_id = store.insert(user_id).await?.id;
    let agent_loop: AgentLoop<_, _, LocalExecEnv> = AgentLoop::new(store.clone(), StalledAdapter);
    let cancel = CancelToken::new();
    let (tx, mut rx) = mpsc::unbounded_channel();
    let observer = move |ev: TurnEvent| {
        let _ = tx.send(ev);
    };

    let run = agent_loop.run_turn(input(user_id, conversation_id), &observer, &cancel);
    let watch = async {
        while let Some(ev) = rx.recv().await {
            if matches!(ev, TurnEvent::Delta { .. }) {
                cancel.cancel();
            }
        }
    };
    let end = tokio::select! {
        end = run => end?,
        () = watch => return Err("observer closed before the turn ended".into()),
    };

    assert_eq!(end, TurnEnd::Aborted);
    let messages = store.messages().await;
    assert_eq!(messages.len(), 2);
    let assistant = &messages[1];
    assert_eq!(assistant.status, MessageStatus::Aborted);
    assert_eq!(
        assistant.message,
        Message::Assistant {
            content: vec![ContentBlock::Text(TextContent {
                text: "partial".into()
            })],
            stop_reason: StopReason::Aborted,
            usage: None,
        }
    );
    assert_eq!(store.leaf().await, Some(assistant.id));
    Ok(())
}

#[tokio::test]
async fn cancel_before_run_appends_only_the_user_message() -> Result<(), Box<dyn Error>> {
    let store = MemoryStore::default();
    let user_id = Uuid::new_v4();
    let conversation_id = store.insert(user_id).await?.id;
    let agent_loop: AgentLoop<_, _, LocalExecEnv> = AgentLoop::new(store.clone(), StalledAdapter);
    let cancel = CancelToken::new();
    cancel.cancel();

    let turn = input(user_id, conversation_id);
    let user_message_id = turn.user_message_id;
    let end = agent_loop.run_turn(turn, &|_| {}, &cancel).await?;

    assert_eq!(end, TurnEnd::Aborted);
    let messages = store.messages().await;
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].id, user_message_id);
    assert_eq!(store.leaf().await, Some(user_message_id));
    Ok(())
}
