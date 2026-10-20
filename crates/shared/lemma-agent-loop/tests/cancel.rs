//! Turn cancellation through `CancelToken`.

use std::sync::{Arc, Mutex, PoisonError};

use futures::stream;
use lemma_agent_loop::{AgentConfig, AgentLoop, CancelToken, TurnEnd, TurnEvent, TurnInput};
use lemma_core::{ContentBlock, Message, StopReason, StreamEvent, TextContent};
use lemma_model::{Adapter, BoxModelFuture, ModelRequest};
use lemma_session::{
    BoxStoreFuture, ConversationMeta, LastModel, MessageStatus, MessageUpdate, SessionError,
    StoredMessage, TraceStore,
};
use tokio::sync::mpsc;
use uuid::Uuid;

#[derive(Default)]
struct MemoryStore {
    meta: Mutex<Option<ConversationMeta>>,
    messages: Mutex<Vec<StoredMessage>>,
}

impl MemoryStore {
    fn messages(&self) -> Vec<StoredMessage> {
        self.messages
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    fn leaf(&self) -> Option<Uuid> {
        self.meta
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .as_ref()
            .and_then(|m| m.leaf_id)
    }
}

impl TraceStore for MemoryStore {
    fn create_conversation<'a>(
        &'a self,
        id: Uuid,
        title: String,
        local_only: bool,
    ) -> BoxStoreFuture<'a, ConversationMeta> {
        let meta = ConversationMeta {
            id,
            title,
            leaf_id: None,
            local_only,
            last_model: None,
            created_at: 0,
            updated_at: 0,
        };
        *self.meta.lock().unwrap_or_else(PoisonError::into_inner) = Some(meta.clone());
        Box::pin(async move { Ok(meta) })
    }

    fn get_conversation<'a>(&'a self, id: Uuid) -> BoxStoreFuture<'a, Option<ConversationMeta>> {
        let meta = self
            .meta
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
            .filter(|m| m.id == id);
        Box::pin(async move { Ok(meta) })
    }

    fn update_leaf<'a>(&'a self, _id: Uuid, leaf_id: Uuid) -> BoxStoreFuture<'a, ()> {
        if let Some(meta) = self
            .meta
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .as_mut()
        {
            meta.leaf_id = Some(leaf_id);
        }
        Box::pin(async { Ok(()) })
    }

    fn update_message<'a>(&'a self, id: Uuid, update: MessageUpdate) -> BoxStoreFuture<'a, ()> {
        let mut messages = self.messages.lock().unwrap_or_else(PoisonError::into_inner);
        let Some(entry) = messages.iter_mut().find(|m| m.id == id) else {
            return Box::pin(async move { Err(SessionError::NotFound(id.to_string())) });
        };
        entry.message = update.message;
        entry.status = update.status;
        entry.error = update.error;
        Box::pin(async { Ok(()) })
    }

    fn update_conversation_model<'a>(
        &'a self,
        _id: Uuid,
        last_model: LastModel,
    ) -> BoxStoreFuture<'a, ()> {
        if let Some(meta) = self
            .meta
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .as_mut()
        {
            meta.last_model = Some(last_model);
        }
        Box::pin(async { Ok(()) })
    }

    fn append_message<'a>(&'a self, entry: StoredMessage) -> BoxStoreFuture<'a, ()> {
        self.messages
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .push(entry);
        Box::pin(async { Ok(()) })
    }

    fn list_messages<'a>(
        &'a self,
        _conversation_id: Uuid,
    ) -> BoxStoreFuture<'a, Vec<StoredMessage>> {
        let messages = self.messages();
        Box::pin(async move { Ok(messages) })
    }
}

/// Streams one text delta, then waits forever for more.
struct StalledAdapter;

impl Adapter for StalledAdapter {
    fn stream(&self, _req: ModelRequest) -> BoxModelFuture {
        Box::pin(async {
            let head = stream::iter([
                Ok(StreamEvent::Start),
                Ok(StreamEvent::TextDelta {
                    delta: "partial".into(),
                }),
            ]);
            Ok(Box::pin(futures::StreamExt::chain(head, stream::pending())) as _)
        })
    }
}

fn input(conversation_id: Uuid) -> TurnInput {
    TurnInput {
        conversation_id,
        user_message_id: Uuid::new_v4(),
        user_message: Message::User {
            content: vec![ContentBlock::Text(TextContent {
                text: "hello".into(),
            })],
        },
        config: AgentConfig {
            model: "m".into(),
            provider_id: Uuid::new_v4(),
            thinking_effort: None,
        },
    }
}

#[tokio::test]
async fn cancel_mid_stream_settles_placeholder_as_aborted() -> Result<(), Box<dyn std::error::Error>>
{
    let store = Arc::new(MemoryStore::default());
    let conversation_id = Uuid::new_v4();
    store
        .create_conversation(conversation_id, String::new(), true)
        .await?;
    let agent_loop = AgentLoop::new(store.clone(), Arc::new(StalledAdapter));
    let cancel = CancelToken::new();
    let (tx, mut rx) = mpsc::unbounded_channel();
    let observer = move |ev: TurnEvent| {
        let _ = tx.send(ev);
    };

    let run = agent_loop.run_turn(input(conversation_id), &observer, &cancel);
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
    let messages = store.messages();
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
    assert_eq!(store.leaf(), Some(assistant.id));
    Ok(())
}

#[tokio::test]
async fn cancel_before_run_appends_only_the_user_message() -> Result<(), Box<dyn std::error::Error>>
{
    let store = Arc::new(MemoryStore::default());
    let conversation_id = Uuid::new_v4();
    store
        .create_conversation(conversation_id, String::new(), true)
        .await?;
    let agent_loop = AgentLoop::new(store.clone(), Arc::new(StalledAdapter));
    let cancel = CancelToken::new();
    cancel.cancel();

    let turn = input(conversation_id);
    let user_id = turn.user_message_id;
    let end = agent_loop.run_turn(turn, &|_| {}, &cancel).await?;

    assert_eq!(end, TurnEnd::Aborted);
    let messages = store.messages();
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].id, user_id);
    assert_eq!(store.leaf(), Some(user_id));
    Ok(())
}
