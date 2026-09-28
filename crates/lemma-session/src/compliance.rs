#![allow(clippy::unwrap_used)]
//! Shared compliance suite for [`TraceStore`] implementations.
//!
//! Every store (PostgreSQL on the server, SQLite on clients) must pass the
//! same scenarios; hosts wire these async functions into their own test
//! harnesses so the two implementations cannot drift semantically.

use lemma_core::{
    ContentBlock, Message, StopReason, TextContent, ThinkingContent, ToolCall, Usage,
};
use uuid::Uuid;

use crate::store::{LastModel, MessageStatus, MessageUpdate, StoredMessage, TraceStore};
use crate::tree::build_context_path;

fn text_block(text: &str) -> ContentBlock {
    ContentBlock::Text(TextContent {
        text: text.to_string(),
    })
}

fn user_message(text: &str) -> Message {
    Message::User {
        content: vec![text_block(text)],
    }
}

fn rich_assistant_message() -> Message {
    Message::Assistant {
        content: vec![
            ContentBlock::Thinking(ThinkingContent {
                thinking: "hidden reasoning".to_string(),
                signature: Some("sig-abc".to_string()),
            }),
            ContentBlock::ToolCall(ToolCall {
                id: "call-1".to_string(),
                name: "read_file".to_string(),
                arguments: serde_json::json!({"path": "a.rs"}),
            }),
            text_block("visible answer"),
        ],
        stop_reason: StopReason::ToolUse,
        usage: Some(Usage {
            input: 10,
            output: 5,
            cache_read: Some(3),
            cache_write: None,
        }),
    }
}

fn entry(
    id: Uuid,
    conversation_id: Uuid,
    parent_id: Option<Uuid>,
    message: Message,
    status: MessageStatus,
    created_at: i64,
) -> StoredMessage {
    StoredMessage {
        id,
        conversation_id,
        parent_id,
        message,
        status,
        model: Some("model-x".to_string()),
        provider_id: None,
        started_at: created_at,
        created_at,
    }
}

/// A message written through the store reads back byte-identical, including
/// thinking signatures, tool calls and usage.
pub async fn roundtrip_preserves_fidelity(store: &dyn TraceStore, provider_id: Uuid) {
    let conv = Uuid::new_v4();
    store
        .create_conversation(conv, "fidelity".to_string(), false)
        .await
        .unwrap();
    let id = Uuid::new_v4();
    let original = rich_assistant_message();

    let mut stored = entry(id, conv, None, original.clone(), MessageStatus::Done, 1000);
    stored.provider_id = Some(provider_id);
    store.append_message(stored).await.unwrap();

    let rows = store.list_messages(conv).await.unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].message, original);
    assert_eq!(rows[0].status, MessageStatus::Done);
    assert_eq!(rows[0].model.as_deref(), Some("model-x"));
    assert_eq!(rows[0].provider_id, Some(provider_id));
    assert_eq!(rows[0].started_at, 1000);
    assert_eq!(rows[0].created_at, 1000);
}

/// A streaming placeholder finalizes into its terminal status with timing
/// marks, without disturbing identity or creation time.
pub async fn status_lifecycle(store: &dyn TraceStore) {
    let conv = Uuid::new_v4();
    store
        .create_conversation(conv, "lifecycle".to_string(), false)
        .await
        .unwrap();
    let id = Uuid::new_v4();

    store
        .append_message(entry(
            id,
            conv,
            None,
            Message::Assistant {
                content: vec![text_block("")],
                stop_reason: StopReason::Stop,
                usage: None,
            },
            MessageStatus::Streaming,
            2000,
        ))
        .await
        .unwrap();
    assert_eq!(
        store.list_messages(conv).await.unwrap()[0].status,
        MessageStatus::Streaming
    );

    store
        .update_message(
            id,
            MessageUpdate {
                message: rich_assistant_message(),
                status: MessageStatus::Done,
                first_token_at: Some(2500),
                finished_at: 3000,
            },
        )
        .await
        .unwrap();

    let row = &store.list_messages(conv).await.unwrap()[0];
    assert_eq!(row.status, MessageStatus::Done);
    assert_eq!(row.message, rich_assistant_message());
    assert_eq!(row.created_at, 2000);
}

/// Parent pointers survive storage and the root-to-leaf path reconstructs in
/// chronological order.
pub async fn tree_chain_integrity(store: &dyn TraceStore) {
    let conv = Uuid::new_v4();
    store
        .create_conversation(conv, "tree".to_string(), false)
        .await
        .unwrap();
    let root = Uuid::new_v4();
    let child = Uuid::new_v4();
    let leaf = Uuid::new_v4();

    store
        .append_message(entry(
            root,
            conv,
            None,
            user_message("r"),
            MessageStatus::Done,
            1,
        ))
        .await
        .unwrap();
    store
        .append_message(entry(
            child,
            conv,
            Some(root),
            user_message("c"),
            MessageStatus::Done,
            2,
        ))
        .await
        .unwrap();
    store
        .append_message(entry(
            leaf,
            conv,
            Some(child),
            user_message("l"),
            MessageStatus::Done,
            3,
        ))
        .await
        .unwrap();
    store.update_leaf(conv, leaf).await.unwrap();

    let rows = store.list_messages(conv).await.unwrap();
    let path = build_context_path(&rows, leaf).unwrap();
    assert_eq!(path.len(), 3);
    assert_eq!(path[0], user_message("r"));
    assert_eq!(path[2], user_message("l"));

    let meta = store.get_conversation(conv).await.unwrap().unwrap();
    assert_eq!(meta.leaf_id, Some(leaf));
}

/// The conversation records the model selection of the latest turn and
/// starts without one.
pub async fn last_model_refresh(store: &dyn TraceStore) {
    let conv = Uuid::new_v4();
    store
        .create_conversation(conv, "model".to_string(), false)
        .await
        .unwrap();
    assert_eq!(
        store
            .get_conversation(conv)
            .await
            .unwrap()
            .unwrap()
            .last_model,
        None
    );

    let selection = LastModel {
        provider_id: Uuid::new_v4(),
        model: "claude-x".to_string(),
        thinking_effort: Some("high".to_string()),
    };
    store
        .update_conversation_model(conv, selection.clone())
        .await
        .unwrap();

    assert_eq!(
        store
            .get_conversation(conv)
            .await
            .unwrap()
            .unwrap()
            .last_model,
        Some(selection)
    );
}

/// Tool result messages survive the roundtrip with their call reference
/// and error flag intact.
pub async fn tool_result_roundtrip(store: &dyn TraceStore) {
    let conv = Uuid::new_v4();
    store
        .create_conversation(conv, "tool".to_string(), false)
        .await
        .unwrap();
    let call_id = Uuid::new_v4();
    let result_id = Uuid::new_v4();
    let tool_result = Message::ToolResult {
        tool_call_id: "call-9".to_string(),
        tool_name: "run_shell".to_string(),
        content: vec![text_block("exit 0")],
        is_error: false,
    };

    store
        .append_message(entry(
            call_id,
            conv,
            None,
            rich_assistant_message(),
            MessageStatus::Done,
            1,
        ))
        .await
        .unwrap();
    store
        .append_message(entry(
            result_id,
            conv,
            Some(call_id),
            tool_result.clone(),
            MessageStatus::Done,
            2,
        ))
        .await
        .unwrap();

    let rows = store.list_messages(conv).await.unwrap();
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[1].message, tool_result);
    assert_eq!(rows[1].parent_id, Some(call_id));
}

/// Runs the full compliance suite against one store instance.
pub async fn run_suite(store: &dyn TraceStore, provider_id: Uuid) {
    roundtrip_preserves_fidelity(store, provider_id).await;
    status_lifecycle(store).await;
    tree_chain_integrity(store).await;
    last_model_refresh(store).await;
    tool_result_roundtrip(store).await;
}
