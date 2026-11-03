//! Session flows against a migrated database.

use std::error::Error;

use chrono::{DateTime, Utc};
use lemma_adapter::{HttpConnector, ReqwestTransport};
use lemma_auth::AuthService;
use lemma_core::{ContentBlock, Message as CoreMessage, StopReason, TextContent};
use lemma_model::ProviderKind;
use lemma_provider::{CreateInput, ProviderService};
use lemma_session::{
    LastModel, Message, MessageBody, MessagePage, MessageStatus, MessageUpdate, SessionError,
    SessionService, build_context_path,
};
use lemma_test_db::on_each_database;
use sea_orm::{ConnectionTrait, DatabaseConnection};
use sea_orm_migration::{MigrationTrait, MigratorTrait};
use uuid::Uuid;

struct Migrator;

impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        let mut all: Vec<_> = [
            lemma_auth::migrations(),
            lemma_session::migrations(),
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
    session_id: Uuid,
    parent_id: Option<Uuid>,
    text: &str,
    created_at: DateTime<Utc>,
) -> Message {
    Message {
        id: Uuid::new_v4(),
        session_id,
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
    sessions: &SessionService,
    session_id: Uuid,
    count: i64,
) -> Result<Vec<Uuid>, Box<dyn Error>> {
    let mut ids = Vec::new();
    let mut parent_id = None;
    for n in 0..count {
        let message = entry(session_id, parent_id, &format!("m{n}"), at(n));
        parent_id = Some(message.id);
        ids.push(message.id);
        sessions.append_message(message).await?;
    }
    Ok(ids)
}

#[tokio::test]
async fn a_user_cannot_see_or_change_another_users_session() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let bob = sign_up(&db, "bob").await?;
        let sessions = SessionService::new(db);
        let created = sessions.create(ada).await?;
        let ids = append_chain(&sessions, created.id, 1).await?;
        let model = LastModel {
            provider_id: Uuid::new_v4(),
            model: "m".to_owned(),
        };

        let listed = sessions.list_sessions(bob).await?;
        let found = sessions.find(bob, created.id).await?;
        let renamed = sessions.rename(bob, created.id, "Hijacked").await;
        let page = sessions.list_messages(bob, created.id, None, 10).await;
        let deleted = sessions.delete(bob, created.id).await;
        sessions
            .update_leaf(bob, created.id, Uuid::new_v4())
            .await?;
        sessions.update_last_model(bob, created.id, &model).await?;
        let own = sessions.find(ada, created.id).await?;

        assert!(listed.is_empty(), "bob's sessions: {listed:?}");
        assert!(found.is_none(), "bob's find: {found:?}");
        assert!(
            matches!(renamed, Err(SessionError::NotFound)),
            "bob's rename: {renamed:?}"
        );
        assert!(
            matches!(page, Err(SessionError::NotFound)),
            "bob's message page: {page:?}"
        );
        assert!(
            matches!(deleted, Err(SessionError::NotFound)),
            "bob's delete: {deleted:?}"
        );
        let own = own.ok_or("ada lost her session")?;
        assert_eq!(own.title, "", "title survives bob's rename");
        assert_eq!(own.leaf_id, None, "leaf survives bob's update");
        assert_eq!(own.last_model, None, "last model survives bob's update");
        assert_eq!(
            sessions.all_messages(created.id).await?.len(),
            ids.len(),
            "ada's messages"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn deleting_a_session_deletes_only_its_messages() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let sessions = SessionService::new(db);
        let doomed = sessions.create(ada).await?;
        let kept = sessions.create(ada).await?;
        append_chain(&sessions, doomed.id, 3).await?;
        append_chain(&sessions, kept.id, 2).await?;

        sessions.delete(ada, doomed.id).await?;
        let again = sessions.delete(ada, doomed.id).await;

        assert!(
            sessions.all_messages(doomed.id).await?.is_empty(),
            "deleted session's messages"
        );
        assert_eq!(
            sessions.all_messages(kept.id).await?.len(),
            2,
            "other session's messages"
        );
        assert_eq!(
            sessions.list_sessions(ada).await?.len(),
            1,
            "remaining sessions"
        );
        assert!(
            matches!(again, Err(SessionError::NotFound)),
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
        let sessions = SessionService::new(db);
        let session = sessions.create(ada).await?;
        let other = sessions.create(ada).await?;
        let ids = append_chain(&sessions, session.id, 5).await?;
        let foreign = append_chain(&sessions, other.id, 1).await?;

        let first = sessions.list_messages(ada, session.id, None, 2).await?;
        let second = sessions
            .list_messages(ada, session.id, Some(ids[3]), 2)
            .await?;
        let last = sessions
            .list_messages(ada, session.id, Some(ids[1]), 2)
            .await?;
        let exact = sessions
            .list_messages(ada, session.id, Some(ids[2]), 2)
            .await?;
        let unknown = sessions
            .list_messages(ada, session.id, Some(Uuid::new_v4()), 2)
            .await?;
        let foreign_cursor = sessions
            .list_messages(ada, session.id, Some(foreign[0]), 2)
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
            "another session's cursor: {foreign_cursor:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn messages_sharing_a_timestamp_page_without_gaps_or_repeats() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let sessions = SessionService::new(db);
        let session = sessions.create(ada).await?;
        let mut expected = Vec::new();
        for n in 0..4 {
            let message = entry(session.id, None, &format!("m{n}"), at(0));
            expected.push(message.id);
            sessions.append_message(message).await?;
        }
        expected.sort_unstable_by(|a, b| b.cmp(a));

        let mut seen = Vec::new();
        let mut before_id = None;
        let mut has_more = true;
        for _ in &expected {
            let page = sessions
                .list_messages(ada, session.id, before_id, 1)
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
        let sessions = SessionService::new(db);
        let session = sessions.create(ada).await?;
        append_chain(&sessions, session.id, 60).await?;

        let mut pages = Vec::new();
        for limit in [0, -5, i32::MAX] {
            let page = sessions.list_messages(ada, session.id, None, limit).await?;
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
        let sessions = SessionService::new(db);
        let session = sessions.create(ada).await?;
        let provider_id = Uuid::new_v4();
        let parent = entry(session.id, None, "question", at(0));
        let mut placeholder = entry(session.id, Some(parent.id), "", at(1));
        placeholder.body = MessageBody(CoreMessage::Assistant {
            content: Vec::new(),
            stop_reason: StopReason::Stop,
            usage: None,
        });
        placeholder.status = MessageStatus::Streaming;
        placeholder.provider_id = Some(provider_id);
        placeholder.model = Some("m".to_owned());
        let (parent_id, placeholder_id) = (parent.id, placeholder.id);
        sessions.append_message(parent).await?;
        sessions.append_message(placeholder).await?;

        let settled = MessageBody(CoreMessage::Assistant {
            content: vec![ContentBlock::Text(TextContent {
                text: "partial".to_owned(),
            })],
            stop_reason: StopReason::Aborted,
            usage: None,
        });
        sessions
            .update_message(
                placeholder_id,
                MessageUpdate {
                    body: settled.clone(),
                    status: MessageStatus::Error,
                    error: Some("upstream closed".to_owned()),
                },
            )
            .await?;

        let messages = sessions.all_messages(session.id).await?;
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
async fn leaf_and_last_model_follow_the_turn_and_recent_sessions_come_first()
-> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let sessions = SessionService::new(db);
        let older = sessions.create(ada).await?;
        let newer = sessions.create(ada).await?;
        let leaf_id = Uuid::new_v4();
        let first_model = LastModel {
            provider_id: Uuid::new_v4(),
            model: "model-a".to_owned(),
        };
        let second_model = LastModel {
            provider_id: Uuid::new_v4(),
            model: "model-b".to_owned(),
        };

        sessions.update_leaf(ada, older.id, leaf_id).await?;
        sessions
            .update_last_model(ada, older.id, &first_model)
            .await?;
        let with_first = sessions.find(ada, older.id).await?;
        sessions
            .update_last_model(ada, older.id, &second_model)
            .await?;
        let with_second = sessions.find(ada, older.id).await?;
        let renamed = sessions.rename(ada, older.id, "  Renamed  ").await?;
        let listed = sessions.list_sessions(ada).await?;

        let with_first = with_first.ok_or("session vanished")?;
        assert_eq!(with_first.leaf_id, Some(leaf_id), "leaf");
        assert_eq!(with_first.last_model, Some(first_model), "first model");
        let with_second = with_second.ok_or("session vanished")?;
        assert_eq!(with_second.last_model, Some(second_model), "second model");
        assert_eq!(renamed.title, "Renamed", "trimmed title");
        let order: Vec<Uuid> = listed.iter().map(|c| c.id).collect();
        assert_eq!(order, [older.id, newer.id], "most recently updated first");
        let blank = sessions.rename(ada, older.id, "   ").await;
        assert!(
            matches!(blank, Err(SessionError::TitleRequired)),
            "blank title: {blank:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn deleting_a_provider_keeps_the_messages_and_sessions_that_used_it()
-> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = ProviderService::new(
            db.clone(),
            "test-secret-key".to_owned(),
            HttpConnector::new(ReqwestTransport::new()),
        );
        let sessions = SessionService::new(db);
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
        let session = sessions.create(ada).await?;
        let mut answer = entry(session.id, None, "", at(0));
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
        sessions.append_message(answer).await?;
        let last_model = LastModel {
            provider_id: provider.id,
            model: "model-a".to_owned(),
        };
        sessions
            .update_last_model(ada, session.id, &last_model)
            .await?;

        providers.delete(ada, provider.id).await?;

        let page = sessions.list_messages(ada, session.id, None, 10).await?;
        let [kept] = page.messages.as_slice() else {
            return Err(format!("expected one message: {page:?}").into());
        };
        assert_eq!(kept.id, answer_id, "message survives");
        assert_eq!(kept.provider_id, Some(provider.id), "message provider id");
        assert_eq!(kept.model.as_deref(), Some("model-a"), "message model");
        let reread = sessions.find(ada, session.id).await?;
        assert_eq!(
            reread.and_then(|c| c.last_model),
            Some(last_model),
            "session last model"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn the_context_path_runs_from_the_root_to_the_leaf() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let sessions = SessionService::new(db);
        let session_id = sessions.create(ada).await?.id;
        let ids = append_chain(&sessions, session_id, 3).await?;
        let stored = sessions.all_messages(session_id).await?;
        let Some(&leaf) = ids.last() else {
            return Err("no messages appended".into());
        };

        let path = build_context_path(&stored, leaf)?;
        let without_root = build_context_path(&stored[1..], leaf);

        let texts: Vec<String> = path.iter().map(CoreMessage::visible_text).collect();
        assert_eq!(texts, ["m0", "m1", "m2"], "root-first path");
        assert!(
            matches!(&without_root, Err(SessionError::Missing(m)) if m == &format!("node {} missing in tree", ids[0])),
            "path through an absent node: {without_root:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn the_session_tables_roll_back_and_reapply() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let sessions = SessionService::new(db.clone());
        let id = sessions.create(ada).await?.id;
        let last_model = LastModel {
            provider_id: Uuid::new_v4(),
            model: "model-a".to_owned(),
        };

        Migrator::down(&db, None).await?;
        let listed = sessions.list_sessions(ada).await;
        let found = sessions.find(ada, id).await;
        let renamed = sessions.rename(ada, id, "Plans").await;
        let created = sessions.create(ada).await;
        let deleted = sessions.delete(ada, id).await;
        let page = sessions.list_messages(ada, id, None, 2).await;
        let appended = sessions
            .append_message(entry(id, None, "message", at(0)))
            .await;
        let message_updated = sessions
            .update_message(
                Uuid::new_v4(),
                MessageUpdate {
                    body: entry(id, None, "settled", at(1)).body,
                    status: MessageStatus::Done,
                    error: None,
                },
            )
            .await;
        let all_messages = sessions.all_messages(id).await;
        let leaf_updated = sessions.update_leaf(ada, id, Uuid::new_v4()).await;
        let model_updated = sessions.update_last_model(ada, id, &last_model).await;
        Migrator::up(&db, None).await?;

        for (operation, failed) in [
            ("list sessions", listed.err()),
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
                matches!(failed, Some(SessionError::Store(_))),
                "{operation} without tables: {failed:?}"
            );
        }
        let ada = sign_up(&db, "ada").await?;
        assert!(
            sessions.list_sessions(ada).await?.is_empty(),
            "rolled back rows are gone"
        );
        let id = sessions.create(ada).await?.id;
        db.execute_unprepared("DROP TABLE messages").await?;
        let first_page = sessions.list_messages(ada, id, None, 2).await;
        let cursor_page = sessions
            .list_messages(ada, id, Some(Uuid::new_v4()), 2)
            .await;

        for (operation, failed) in [
            ("first page", first_page.err()),
            ("cursor lookup", cursor_page.err()),
        ] {
            assert!(
                matches!(failed, Some(SessionError::Store(_))),
                "{operation} without the messages table: {failed:?}"
            );
        }
        Ok(())
    })
    .await
}
