#![allow(clippy::unwrap_used, missing_docs)]

use lemma_core::{ContentBlock, Message, StopReason, TextContent};
use lemma_db_sqlite::SqliteTraceStore;
use lemma_session::{MessageStatus, StoredMessage, TraceStore};
use uuid::Uuid;

fn user_msg(id: Uuid, conv: Uuid, parent: Option<Uuid>, text: &str) -> StoredMessage {
    StoredMessage {
        id,
        conversation_id: conv,
        parent_id: parent,
        message: Message::User {
            content: vec![ContentBlock::Text(TextContent {
                text: text.to_string(),
            })],
        },
        status: MessageStatus::Done,
        model: None,
        provider_id: None,
        started_at: 1,
        created_at: 1,
    }
}

#[tokio::test]
async fn smoke_migrate_append_branch_finalize() {
    let pool = lemma_db_sqlite::connect_in_memory().await.unwrap();
    lemma_db_sqlite::migrate(&pool).await.unwrap();
    let store = SqliteTraceStore::new(pool);

    let conv = Uuid::new_v4();
    let meta = store
        .create_conversation(conv, "t".into(), false)
        .await
        .unwrap();
    assert_eq!(meta.leaf_id, None);

    let (a, b, c) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    store
        .append_message(user_msg(a, conv, None, "A"))
        .await
        .unwrap();
    store
        .append_message(user_msg(b, conv, Some(a), "B"))
        .await
        .unwrap();
    store
        .append_message(user_msg(c, conv, Some(b), "C"))
        .await
        .unwrap();
    store.update_leaf(conv, c).await.unwrap();

    let assistant_id = Uuid::new_v4();
    store
        .append_message(StoredMessage {
            id: assistant_id,
            conversation_id: conv,
            parent_id: Some(a),
            message: Message::Assistant {
                content: vec![],
                stop_reason: StopReason::Stop,
                usage: None,
            },
            status: MessageStatus::Streaming,
            model: Some("m".into()),
            provider_id: Some(Uuid::new_v4()),
            started_at: 2,
            created_at: 2,
        })
        .await
        .unwrap();
    store
        .update_message(
            assistant_id,
            lemma_session::MessageUpdate {
                message: Message::Assistant {
                    content: vec![ContentBlock::Text(TextContent {
                        text: "done".into(),
                    })],
                    stop_reason: StopReason::Stop,
                    usage: None,
                },
                status: MessageStatus::Done,
                first_token_at: Some(3),
                finished_at: 4,
            },
        )
        .await
        .unwrap();

    let all = store.list_messages(conv).await.unwrap();
    assert_eq!(all.len(), 4);
    let finalized = all.iter().find(|m| m.id == assistant_id).unwrap();
    assert_eq!(finalized.status, MessageStatus::Done);
    assert_eq!(finalized.message.visible_text(), "done");

    let meta = store.get_conversation(conv).await.unwrap().unwrap();
    assert_eq!(meta.leaf_id, Some(c));
}
