//! Turn cancellation through `CancelToken`.

use std::sync::{Arc, Mutex, PoisonError};

use chrono::DateTime;
use futures::stream;
use lemma_agent_loop::{AgentConfig, AgentLoop, CancelToken, TurnEnd, TurnEvent, TurnInput};
use lemma_conversation::{
    BoxConversationFuture, Conversation, ConversationError, ConversationStore, LastModel,
    Message as StoredMessage, MessageStatus, MessageUpdate,
};
use lemma_core::{ContentBlock, Message, StopReason, StreamEvent, TextContent};
use lemma_model::{Adapter, BoxModelFuture, ModelRequest};
use tokio::sync::mpsc;
use uuid::Uuid;

#[derive(Default)]
struct MemoryStore {
    meta: Mutex<Option<Conversation>>,
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

impl ConversationStore for MemoryStore {
    fn insert<'a>(&'a self, user_id: Uuid) -> BoxConversationFuture<'a, Conversation> {
        Box::pin(async move {
            self.create(user_id, Uuid::new_v4(), String::new(), false)
                .await
        })
    }

    fn create<'a>(
        &'a self,
        user_id: Uuid,
        id: Uuid,
        title: String,
        local_only: bool,
    ) -> BoxConversationFuture<'a, Conversation> {
        let meta = Conversation {
            id,
            user_id,
            title,
            status: "active".into(),
            leaf_id: None,
            last_model: None,
            local_only,
            archived_at: None,
            created_at: DateTime::UNIX_EPOCH,
            updated_at: DateTime::UNIX_EPOCH,
        };
        *self.meta.lock().unwrap_or_else(PoisonError::into_inner) = Some(meta.clone());
        Box::pin(async move { Ok(meta) })
    }

    fn list_active_by_user<'a>(
        &'a self,
        _user_id: Uuid,
    ) -> BoxConversationFuture<'a, Vec<Conversation>> {
        Box::pin(async { Ok(vec![]) })
    }

    fn list_archived_by_user<'a>(
        &'a self,
        _user_id: Uuid,
    ) -> BoxConversationFuture<'a, Vec<Conversation>> {
        Box::pin(async { Ok(vec![]) })
    }

    fn find_by_id_and_user<'a>(
        &'a self,
        id: Uuid,
        _user_id: Uuid,
    ) -> BoxConversationFuture<'a, Option<Conversation>> {
        let meta = self
            .meta
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
            .filter(|m| m.id == id);
        Box::pin(async move { Ok(meta) })
    }

    fn rename<'a>(
        &'a self,
        _id: Uuid,
        _user_id: Uuid,
        _title: &'a str,
    ) -> BoxConversationFuture<'a, Option<Conversation>> {
        Box::pin(async { Ok(None) })
    }

    fn archive<'a>(
        &'a self,
        _id: Uuid,
        _user_id: Uuid,
    ) -> BoxConversationFuture<'a, Option<Conversation>> {
        Box::pin(async { Ok(None) })
    }

    fn restore<'a>(
        &'a self,
        _id: Uuid,
        _user_id: Uuid,
    ) -> BoxConversationFuture<'a, Option<Conversation>> {
        Box::pin(async { Ok(None) })
    }

    fn delete_archived<'a>(&'a self, _id: Uuid, _user_id: Uuid) -> BoxConversationFuture<'a, bool> {
        Box::pin(async { Ok(false) })
    }

    fn update_leaf<'a>(
        &'a self,
        _id: Uuid,
        _user_id: Uuid,
        leaf_id: Uuid,
    ) -> BoxConversationFuture<'a, ()> {
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

    fn update_last_model<'a>(
        &'a self,
        _id: Uuid,
        _user_id: Uuid,
        last_model: LastModel,
    ) -> BoxConversationFuture<'a, ()> {
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

    fn append_message<'a>(&'a self, entry: StoredMessage) -> BoxConversationFuture<'a, ()> {
        self.messages
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .push(entry);
        Box::pin(async { Ok(()) })
    }

    fn update_message<'a>(
        &'a self,
        id: Uuid,
        update: MessageUpdate,
    ) -> BoxConversationFuture<'a, ()> {
        let mut messages = self.messages.lock().unwrap_or_else(PoisonError::into_inner);
        let Some(entry) = messages.iter_mut().find(|m| m.id == id) else {
            return Box::pin(async move { Err(ConversationError::Missing(id.to_string())) });
        };
        entry.message = update.message;
        entry.status = update.status;
        entry.error = update.error;
        Box::pin(async { Ok(()) })
    }

    fn list_messages<'a>(
        &'a self,
        _conversation_id: Uuid,
    ) -> BoxConversationFuture<'a, Vec<StoredMessage>> {
        let messages = self.messages();
        Box::pin(async move { Ok(messages) })
    }

    fn list_messages_page<'a>(
        &'a self,
        _conversation_id: Uuid,
        _before_id: Option<Uuid>,
        _limit: i64,
    ) -> BoxConversationFuture<'a, (Vec<StoredMessage>, bool)> {
        Box::pin(async { Ok((vec![], false)) })
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
    let user_id = Uuid::new_v4();
    let conversation_id = Uuid::new_v4();
    store
        .create(user_id, conversation_id, String::new(), true)
        .await?;
    let agent_loop = AgentLoop::new(store.clone(), Arc::new(StalledAdapter));
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
    let user_id = Uuid::new_v4();
    let conversation_id = Uuid::new_v4();
    store
        .create(user_id, conversation_id, String::new(), true)
        .await?;
    let agent_loop = AgentLoop::new(store.clone(), Arc::new(StalledAdapter));
    let cancel = CancelToken::new();
    cancel.cancel();

    let turn = input(user_id, conversation_id);
    let user_message_id = turn.user_message_id;
    let end = agent_loop.run_turn(turn, &|_| {}, &cancel).await?;

    assert_eq!(end, TurnEnd::Aborted);
    let messages = store.messages();
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].id, user_message_id);
    assert_eq!(store.leaf(), Some(user_message_id));
    Ok(())
}
