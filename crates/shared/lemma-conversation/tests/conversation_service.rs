//! Conversation flows against a migrated database.

use std::error::Error;

use chrono::{DateTime, Utc};
use lemma_adapter::{HttpConnector, ReqwestTransport};
use lemma_auth::AuthService;
use lemma_conversation::{
    ConversationError, ConversationService, LastModel, Message, MessageBody, MessagePage,
    MessageStatus, MessageUpdate, build_context_path,
};
use lemma_core::{ContentBlock, Message as CoreMessage, StopReason, TextContent};
use lemma_model::ProviderKind;
use lemma_provider::{CreateInput, ProviderService};
use lemma_test_db::on_each_database;
use sea_orm::{ConnectionTrait, DatabaseConnection};
use sea_orm_migration::{MigrationTrait, MigratorTrait};
use uuid::Uuid;

struct Migrator;

impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        let mut all: Vec<_> = [
            lemma_auth::migrations(),
            lemma_conversation::migrations(),
            lemma_provider::migrations(),
        ]
        .into_iter()
        .flatten()
        .collect();
        all.sort_by(|a, b| a.name().cmp(b.name()));
        all
    }
}

async fn sign_up(db: &DatabaseConnection, username: &str) -> Result<Uuid, Box<dyn Error>> {
    let signed_in = AuthService::new(db.clone(), "test-jwt-secret".to_owned())
        .sign_up(
            username,
            &format!("{username}@example.com"),
            "correct-horse",
        )
        .await?;
    Ok(signed_in.user.id)
}

fn at(millis: i64) -> DateTime<Utc> {
    DateTime::from_timestamp_millis(1_700_000_000_000 + millis).unwrap_or_default()
}

fn entry(
    conversation_id: Uuid,
    parent_id: Option<Uuid>,
    text: &str,
    created_at: DateTime<Utc>,
) -> Message {
    Message {
        id: Uuid::new_v4(),
        conversation_id,
        parent_id,
        body: MessageBody(CoreMessage::User {
            content: vec![ContentBlock::Text(TextContent {
                text: text.to_owned(),
            })],
        }),
        status: MessageStatus::Done,
        error: None,
        provider_id: None,
        model: None,
        created_at,
        updated_at: created_at,
    }
}

async fn append_chain(
    conversations: &ConversationService,
    conversation_id: Uuid,
    count: i64,
) -> Result<Vec<Uuid>, Box<dyn Error>> {
    let mut ids = Vec::new();
    let mut parent_id = None;
    for n in 0..count {
        let message = entry(conversation_id, parent_id, &format!("m{n}"), at(n));
        parent_id = Some(message.id);
        ids.push(message.id);
        conversations.append_message(message).await?;
    }
    Ok(ids)
}

#[tokio::test]
async fn a_user_cannot_see_or_change_another_users_conversation() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let bob = sign_up(&db, "bob").await?;
        let conversations = ConversationService::new(db);
        let created = conversations.create(ada).await?;
        let ids = append_chain(&conversations, created.id, 1).await?;
        let model = LastModel {
            provider_id: Uuid::new_v4(),
            model: "m".to_owned(),
        };

        let listed = conversations.list_conversations(bob).await?;
        let found = conversations.find(bob, created.id).await?;
        let renamed = conversations.rename(bob, created.id, "Hijacked").await;
        let page = conversations.list_messages(bob, created.id, None, 10).await;
        let deleted = conversations.delete(bob, created.id).await;
        conversations
            .update_leaf(bob, created.id, Uuid::new_v4())
            .await?;
        conversations
            .update_last_model(bob, created.id, &model)
            .await?;
        let own = conversations.find(ada, created.id).await?;

        assert!(listed.is_empty(), "bob's conversations: {listed:?}");
        assert!(found.is_none(), "bob's find: {found:?}");
        assert!(
            matches!(renamed, Err(ConversationError::NotFound)),
            "bob's rename: {renamed:?}"
        );
        assert!(
            matches!(page, Err(ConversationError::NotFound)),
            "bob's message page: {page:?}"
        );
        assert!(
            matches!(deleted, Err(ConversationError::NotFound)),
            "bob's delete: {deleted:?}"
        );
        let own = own.ok_or("ada lost her conversation")?;
        assert_eq!(own.title, "", "title survives bob's rename");
        assert_eq!(own.leaf_id, None, "leaf survives bob's update");
        assert_eq!(own.last_model, None, "last model survives bob's update");
        assert_eq!(
            conversations.all_messages(created.id).await?.len(),
            ids.len(),
            "ada's messages"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn deleting_a_conversation_deletes_only_its_messages() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let conversations = ConversationService::new(db);
        let doomed = conversations.create(ada).await?;
        let kept = conversations.create(ada).await?;
        append_chain(&conversations, doomed.id, 3).await?;
        append_chain(&conversations, kept.id, 2).await?;

        conversations.delete(ada, doomed.id).await?;
        let again = conversations.delete(ada, doomed.id).await;

        assert!(
            conversations.all_messages(doomed.id).await?.is_empty(),
            "deleted conversation's messages"
        );
        assert_eq!(
            conversations.all_messages(kept.id).await?.len(),
            2,
            "other conversation's messages"
        );
        assert_eq!(
            conversations.list_conversations(ada).await?.len(),
            1,
            "remaining conversations"
        );
        assert!(
            matches!(again, Err(ConversationError::NotFound)),
            "second delete: {again:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn messages_page_newest_first_across_the_boundaries() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let conversations = ConversationService::new(db);
        let conversation = conversations.create(ada).await?;
        let other = conversations.create(ada).await?;
        let ids = append_chain(&conversations, conversation.id, 5).await?;
        let foreign = append_chain(&conversations, other.id, 1).await?;

        let first = conversations
            .list_messages(ada, conversation.id, None, 2)
            .await?;
        let second = conversations
            .list_messages(ada, conversation.id, Some(ids[3]), 2)
            .await?;
        let last = conversations
            .list_messages(ada, conversation.id, Some(ids[1]), 2)
            .await?;
        let exact = conversations
            .list_messages(ada, conversation.id, Some(ids[2]), 2)
            .await?;
        let unknown = conversations
            .list_messages(ada, conversation.id, Some(Uuid::new_v4()), 2)
            .await?;
        let foreign_cursor = conversations
            .list_messages(ada, conversation.id, Some(foreign[0]), 2)
            .await?;

        let page_ids =
            |page: &MessagePage| -> Vec<Uuid> { page.messages.iter().map(|m| m.id).collect() };
        assert_eq!(page_ids(&first), [ids[4], ids[3]], "first page");
        assert!(first.has_more, "first page has more");
        assert_eq!(page_ids(&second), [ids[2], ids[1]], "second page");
        assert!(second.has_more, "second page has more");
        assert_eq!(page_ids(&last), [ids[0]], "last page");
        assert!(!last.has_more, "last page has no more");
        assert_eq!(
            page_ids(&exact),
            [ids[1], ids[0]],
            "page ending at the oldest"
        );
        assert!(
            !exact.has_more,
            "a page that ends at the oldest has no more"
        );
        assert!(unknown.messages.is_empty(), "unknown cursor: {unknown:?}");
        assert!(!unknown.has_more, "unknown cursor has no more");
        assert!(
            foreign_cursor.messages.is_empty(),
            "another conversation's cursor: {foreign_cursor:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn messages_sharing_a_timestamp_page_without_gaps_or_repeats() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let conversations = ConversationService::new(db);
        let conversation = conversations.create(ada).await?;
        let mut expected = Vec::new();
        for n in 0..4 {
            let message = entry(conversation.id, None, &format!("m{n}"), at(0));
            expected.push(message.id);
            conversations.append_message(message).await?;
        }
        expected.sort_unstable_by(|a, b| b.cmp(a));

        let mut seen = Vec::new();
        let mut before_id = None;
        let mut has_more = true;
        for _ in &expected {
            let page = conversations
                .list_messages(ada, conversation.id, before_id, 1)
                .await?;
            before_id = page.messages.last().map(|m| m.id);
            has_more = page.has_more;
            seen.extend(page.messages.iter().map(|m| m.id));
        }

        assert_eq!(seen, expected, "ids newest first, ties broken by id");
        assert!(!has_more, "the last page has no more");
        Ok(())
    })
    .await
}

#[tokio::test]
async fn an_omitted_limit_returns_fifty_messages() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let conversations = ConversationService::new(db);
        let conversation = conversations.create(ada).await?;
        append_chain(&conversations, conversation.id, 60).await?;

        let mut pages = Vec::new();
        for limit in [0, -5, i32::MAX] {
            let page = conversations
                .list_messages(ada, conversation.id, None, limit)
                .await?;
            pages.push((page.messages.len(), page.has_more));
        }

        assert_eq!(
            pages,
            [(50, true), (50, true), (60, false)],
            "pages for 0, -5, i32::MAX"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn finalizing_a_placeholder_replaces_only_its_body_status_and_error()
-> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let conversations = ConversationService::new(db);
        let conversation = conversations.create(ada).await?;
        let provider_id = Uuid::new_v4();
        let parent = entry(conversation.id, None, "question", at(0));
        let mut placeholder = entry(conversation.id, Some(parent.id), "", at(1));
        placeholder.body = MessageBody(CoreMessage::Assistant {
            content: Vec::new(),
            stop_reason: StopReason::Stop,
            usage: None,
        });
        placeholder.status = MessageStatus::Streaming;
        placeholder.provider_id = Some(provider_id);
        placeholder.model = Some("m".to_owned());
        let (parent_id, placeholder_id) = (parent.id, placeholder.id);
        conversations.append_message(parent).await?;
        conversations.append_message(placeholder).await?;

        let settled = MessageBody(CoreMessage::Assistant {
            content: vec![ContentBlock::Text(TextContent {
                text: "partial".to_owned(),
            })],
            stop_reason: StopReason::Aborted,
            usage: None,
        });
        conversations
            .update_message(
                placeholder_id,
                MessageUpdate {
                    body: settled.clone(),
                    status: MessageStatus::Error,
                    error: Some("upstream closed".to_owned()),
                },
            )
            .await?;

        let messages = conversations.all_messages(conversation.id).await?;
        let [question, answer] = messages.as_slice() else {
            return Err(format!("expected two messages: {messages:?}").into());
        };
        assert_eq!(question.id, parent_id, "oldest first");
        assert_eq!(question.status, MessageStatus::Done, "parent untouched");
        assert_eq!(answer.body, settled, "settled body");
        assert_eq!(answer.status, MessageStatus::Error, "settled status");
        assert_eq!(answer.error.as_deref(), Some("upstream closed"), "error");
        assert_eq!(answer.parent_id, Some(parent_id), "parent link");
        assert_eq!(answer.provider_id, Some(provider_id), "provider");
        assert_eq!(answer.model.as_deref(), Some("m"), "model");
        assert_eq!(answer.role(), "assistant", "role");
        Ok(())
    })
    .await
}

#[tokio::test]
async fn leaf_and_last_model_follow_the_turn_and_recent_conversations_come_first()
-> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let conversations = ConversationService::new(db);
        let older = conversations.create(ada).await?;
        let newer = conversations.create(ada).await?;
        let leaf_id = Uuid::new_v4();
        let first_model = LastModel {
            provider_id: Uuid::new_v4(),
            model: "model-a".to_owned(),
        };
        let second_model = LastModel {
            provider_id: Uuid::new_v4(),
            model: "model-b".to_owned(),
        };

        conversations.update_leaf(ada, older.id, leaf_id).await?;
        conversations
            .update_last_model(ada, older.id, &first_model)
            .await?;
        let with_first = conversations.find(ada, older.id).await?;
        conversations
            .update_last_model(ada, older.id, &second_model)
            .await?;
        let with_second = conversations.find(ada, older.id).await?;
        let renamed = conversations.rename(ada, older.id, "  Renamed  ").await?;
        let listed = conversations.list_conversations(ada).await?;

        let with_first = with_first.ok_or("conversation vanished")?;
        assert_eq!(with_first.leaf_id, Some(leaf_id), "leaf");
        assert_eq!(with_first.last_model, Some(first_model), "first model");
        let with_second = with_second.ok_or("conversation vanished")?;
        assert_eq!(with_second.last_model, Some(second_model), "second model");
        assert_eq!(renamed.title, "Renamed", "trimmed title");
        let order: Vec<Uuid> = listed.iter().map(|c| c.id).collect();
        assert_eq!(order, [older.id, newer.id], "most recently updated first");
        let blank = conversations.rename(ada, older.id, "   ").await;
        assert!(
            matches!(blank, Err(ConversationError::TitleRequired)),
            "blank title: {blank:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn deleting_a_provider_keeps_the_messages_and_conversations_that_used_it()
-> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = ProviderService::new(
            db.clone(),
            "test-secret-key".to_owned(),
            HttpConnector::new(ReqwestTransport::new()),
        );
        let conversations = ConversationService::new(db);
        let provider = providers
            .create(
                ada,
                CreateInput {
                    kind: ProviderKind::OpenAiCompatible,
                    identifier: "main".to_owned(),
                    name: "Main".to_owned(),
                    base_url: "https://api.example.com/v1".to_owned(),
                    api_key: "sk-original".to_owned(),
                    api_path: String::new(),
                    models_path: String::new(),
                    models: vec!["model-a".to_owned()],
                },
            )
            .await?;
        let conversation = conversations.create(ada).await?;
        let mut answer = entry(conversation.id, None, "", at(0));
        answer.body = MessageBody(CoreMessage::Assistant {
            content: vec![ContentBlock::Text(TextContent {
                text: "hello".to_owned(),
            })],
            stop_reason: StopReason::Stop,
            usage: None,
        });
        answer.provider_id = Some(provider.id);
        answer.model = Some("model-a".to_owned());
        let answer_id = answer.id;
        conversations.append_message(answer).await?;
        let last_model = LastModel {
            provider_id: provider.id,
            model: "model-a".to_owned(),
        };
        conversations
            .update_last_model(ada, conversation.id, &last_model)
            .await?;

        providers.delete(ada, provider.id).await?;

        let page = conversations
            .list_messages(ada, conversation.id, None, 10)
            .await?;
        let [kept] = page.messages.as_slice() else {
            return Err(format!("expected one message: {page:?}").into());
        };
        assert_eq!(kept.id, answer_id, "message survives");
        assert_eq!(kept.provider_id, Some(provider.id), "message provider id");
        assert_eq!(kept.model.as_deref(), Some("model-a"), "message model");
        let reread = conversations.find(ada, conversation.id).await?;
        assert_eq!(
            reread.and_then(|c| c.last_model),
            Some(last_model),
            "conversation last model"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn the_context_path_runs_from_the_root_to_the_leaf() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let conversations = ConversationService::new(db);
        let conversation_id = conversations.create(ada).await?.id;
        let ids = append_chain(&conversations, conversation_id, 3).await?;
        let stored = conversations.all_messages(conversation_id).await?;
        let Some(&leaf) = ids.last() else {
            return Err("no messages appended".into());
        };

        let path = build_context_path(&stored, leaf)?;
        let without_root = build_context_path(&stored[1..], leaf);

        let texts: Vec<String> = path.iter().map(CoreMessage::visible_text).collect();
        assert_eq!(texts, ["m0", "m1", "m2"], "root-first path");
        assert!(
            matches!(&without_root, Err(ConversationError::Missing(m)) if m == &format!("node {} missing in tree", ids[0])),
            "path through an absent node: {without_root:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn the_conversation_tables_roll_back_and_reapply() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let conversations = ConversationService::new(db.clone());
        let id = conversations.create(ada).await?.id;
        let last_model = LastModel {
            provider_id: Uuid::new_v4(),
            model: "model-a".to_owned(),
        };

        Migrator::down(&db, None).await?;
        let listed = conversations.list_conversations(ada).await;
        let found = conversations.find(ada, id).await;
        let renamed = conversations.rename(ada, id, "Plans").await;
        let created = conversations.create(ada).await;
        let deleted = conversations.delete(ada, id).await;
        let page = conversations.list_messages(ada, id, None, 2).await;
        let appended = conversations
            .append_message(entry(id, None, "message", at(0)))
            .await;
        let message_updated = conversations
            .update_message(
                Uuid::new_v4(),
                MessageUpdate {
                    body: entry(id, None, "settled", at(1)).body,
                    status: MessageStatus::Done,
                    error: None,
                },
            )
            .await;
        let all_messages = conversations.all_messages(id).await;
        let leaf_updated = conversations.update_leaf(ada, id, Uuid::new_v4()).await;
        let model_updated = conversations.update_last_model(ada, id, &last_model).await;
        Migrator::up(&db, None).await?;

        for (operation, failed) in [
            ("list conversations", listed.err()),
            ("find", found.err()),
            ("rename", renamed.err()),
            ("create", created.err()),
            ("delete", deleted.err()),
            ("initial message page", page.err()),
            ("append message", appended.err()),
            ("update message", message_updated.err()),
            ("all messages", all_messages.err()),
            ("update leaf", leaf_updated.err()),
            ("update last model", model_updated.err()),
        ] {
            assert!(
                matches!(failed, Some(ConversationError::Store(_))),
                "{operation} without tables: {failed:?}"
            );
        }
        let ada = sign_up(&db, "ada").await?;
        assert!(
            conversations.list_conversations(ada).await?.is_empty(),
            "rolled back rows are gone"
        );
        let id = conversations.create(ada).await?.id;
        db.execute_unprepared("DROP TABLE messages").await?;
        let first_page = conversations.list_messages(ada, id, None, 2).await;
        let cursor_page = conversations
            .list_messages(ada, id, Some(Uuid::new_v4()), 2)
            .await;

        for (operation, failed) in [
            ("first page", first_page.err()),
            ("cursor lookup", cursor_page.err()),
        ] {
            assert!(
                matches!(failed, Some(ConversationError::Store(_))),
                "{operation} without the messages table: {failed:?}"
            );
        }
        Ok(())
    })
    .await
}
