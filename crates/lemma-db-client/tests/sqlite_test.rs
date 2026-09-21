#![allow(clippy::unwrap_used, missing_docs)]

use lemma_core::{ContentBlock, Message, StopReason, TextContent};
use lemma_db_client::SqliteTraceStore;
use lemma_session::{StoredMessage, TraceStore};
use uuid::Uuid;

#[tokio::test]
async fn sqlite_store_persists_conversations_and_branches() {
    let store = SqliteTraceStore::in_memory().unwrap();

    let conv_id = Uuid::new_v4();
    let meta = store
        .create_conversation(conv_id, "Local Session".to_string(), true)
        .await
        .unwrap();
    assert_eq!(meta.title, "Local Session");
    assert!(meta.local_only);
    assert_eq!(meta.leaf_id, None);

    // Append root user message
    let root_msg_id = Uuid::new_v4();
    store
        .append_message(StoredMessage {
            id: root_msg_id,
            conversation_id: conv_id,
            parent_id: None,
            message: Message::User {
                content: vec![ContentBlock::Text(TextContent {
                    text: "How does the SQLite storage work?".to_string(),
                })],
            },
            created_at: 10,
        })
        .await
        .unwrap();

    store.update_leaf(conv_id, root_msg_id).await.unwrap();

    // Append assistant reply
    let asst_msg_id = Uuid::new_v4();
    store
        .append_message(StoredMessage {
            id: asst_msg_id,
            conversation_id: conv_id,
            parent_id: Some(root_msg_id),
            message: Message::Assistant {
                content: vec![ContentBlock::Text(TextContent {
                    text: "It uses WAL mode and full-text index.".to_string(),
                })],
                stop_reason: StopReason::Stop,
                usage: None,
            },
            created_at: 20,
        })
        .await
        .unwrap();

    store.update_leaf(conv_id, asst_msg_id).await.unwrap();

    let updated = store.get_conversation(conv_id).await.unwrap().unwrap();
    assert_eq!(updated.leaf_id, Some(asst_msg_id));

    // Test FTS5 search
    let search_results = store.search_history("WAL", 10).unwrap();
    assert_eq!(search_results.len(), 1);
    assert_eq!(search_results[0].0, asst_msg_id);
    assert!(search_results[0].2.contains("WAL mode"));
}
