//! Session flows against a migrated database.

use std::env;
use std::error::Error;
use std::fs;
use std::path::Path;

use chrono::{DateTime, Utc};
use lemma_adapter::{HttpConnector, ReqwestTransport};
use lemma_core::{ContentBlock, Message as CoreMessage, StopReason, TextContent};
use lemma_model::ApiFormat;
use lemma_provider::{CreateCustomInput, ProviderModel, ProviderService};
use lemma_session::{
    BranchTarget, LastModel, Message, MessageBody, MessageStatus, MessageUpdate, SessionError,
    SessionService, SessionTree, build_context_path, is_valid_turn_boundary,
};
use uuid::Uuid;

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
        api_format: None,
        label: None,
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

fn assistant_entry(
    session_id: Uuid,
    parent_id: Option<Uuid>,
    text: &str,
    api_format: Option<ApiFormat>,
    created_at: DateTime<Utc>,
) -> Message {
    let mut message = entry(session_id, parent_id, text, created_at);
    message.body = MessageBody(CoreMessage::Assistant {
        content: vec![ContentBlock::Text(TextContent {
            text: text.to_owned(),
        })],
        stop_reason: StopReason::Stop,
        usage: None,
    });
    message.api_format = api_format;
    message
}

fn tool_result_entry(
    session_id: Uuid,
    parent_id: Option<Uuid>,
    tool_call_id: &str,
    tool_name: &str,
    created_at: DateTime<Utc>,
) -> Message {
    let mut message = entry(session_id, parent_id, "", created_at);
    message.body = MessageBody(CoreMessage::ToolResult {
        tool_call_id: tool_call_id.to_owned(),
        tool_name: tool_name.to_owned(),
        content: Vec::new(),
        is_error: false,
    });
    message
}

#[tokio::test]
async fn a_session_stores_the_canonical_path_of_its_directory() -> Result<(), Box<dyn Error>> {
    let dir = env::temp_dir().join(format!("lemma-session-dir-{}", Uuid::new_v4()));
    fs::create_dir_all(&dir)?;
    let canonical = dunce::canonicalize(&dir)?;
    let spelled = dir.join(".");
    let db = lemma_db::in_memory().await?;
    let sessions = SessionService::new(db);

    let bound = sessions.create(Some(&spelled)).await?;
    let unbound = sessions.create(None).await?;
    let found = sessions.find(bound.id).await?;

    assert_eq!(
        bound.directory.as_deref().map(Path::new),
        Some(canonical.as_path()),
        "canonical directory"
    );
    assert_eq!(unbound.directory, None, "no directory");
    assert_eq!(found, Some(bound.clone()), "find returns created session");
    fs::remove_dir_all(&dir)?;
    Ok(())
}

#[tokio::test]
async fn a_directory_must_be_an_absolute_path_to_an_existing_directory()
-> Result<(), Box<dyn Error>> {
    let file = env::temp_dir().join(format!("lemma-session-file-{}", Uuid::new_v4()));
    fs::write(&file, "x")?;
    let missing = env::temp_dir().join(format!("lemma-session-missing-{}", Uuid::new_v4()));
    let db = lemma_db::in_memory().await?;
    let sessions = SessionService::new(db);

    for path in [Path::new("relative"), missing.as_path(), file.as_path()] {
        let created = sessions.create(Some(path)).await;
        assert!(
            matches!(created, Err(SessionError::DirectoryNotFound(_))),
            "{path:?}: {created:?}"
        );
    }
    assert!(sessions.list_sessions().await?.is_empty(), "no session");
    fs::remove_file(&file)?;
    Ok(())
}

#[tokio::test]
async fn deleting_a_session_deletes_only_its_messages() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let sessions = SessionService::new(db);
    let doomed = sessions.create(None).await?;
    let kept = sessions.create(None).await?;
    append_chain(&sessions, doomed.id, 3).await?;
    append_chain(&sessions, kept.id, 2).await?;

    sessions.delete(doomed.id).await?;
    let again = sessions.delete(doomed.id).await;

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
        sessions.list_sessions().await?.len(),
        1,
        "remaining sessions"
    );
    assert!(
        matches!(again, Err(SessionError::NotFound)),
        "second delete: {again:?}"
    );
    Ok(())
}

#[tokio::test]
async fn list_messages_returns_session_tree_oldest_first_with_active_leaf()
-> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let sessions = SessionService::new(db);
    let session = sessions.create(None).await?;
    let other = sessions.create(None).await?;

    let empty = sessions.list_messages(session.id).await?;
    assert_eq!(
        empty,
        SessionTree {
            leaf_id: None,
            messages: Vec::new(),
        },
        "empty session tree"
    );

    let mut m0 = entry(session.id, None, "m0", at(0));
    m0.label = Some("root".to_owned());
    let m1 = assistant_entry(session.id, Some(m0.id), "a1", None, at(10));
    let m2 = assistant_entry(session.id, Some(m0.id), "a2", None, at(10));
    let foreign = entry(other.id, None, "foreign", at(5));
    let mut tie_ids = [m1.id, m2.id];
    tie_ids.sort_unstable();
    for msg in [m0.clone(), m1.clone(), m2.clone(), foreign] {
        sessions.append_message(msg).await?;
    }
    sessions.set_leaf(session.id, Some(m2.id)).await?;

    let tree = sessions.list_messages(session.id).await?;
    let ids: Vec<Uuid> = tree.messages.iter().map(|m| m.id).collect();
    assert_eq!(tree.leaf_id, Some(m2.id), "active leaf");
    assert_eq!(
        ids,
        [m0.id, tie_ids[0], tie_ids[1]],
        "oldest first, timestamp ties ordered by id"
    );
    assert_eq!(
        tree.messages[0].label.as_deref(),
        Some("root"),
        "persisted label"
    );

    let missing = sessions.list_messages(Uuid::new_v4()).await;
    assert!(
        matches!(missing, Err(SessionError::NotFound)),
        "missing session: {missing:?}"
    );
    Ok(())
}

#[tokio::test]
async fn finalizing_a_placeholder_replaces_only_its_body_status_and_error()
-> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let sessions = SessionService::new(db);
    let session = sessions.create(None).await?;
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
    assert_eq!(*answer, answer.clone(), "message clone and eq");
    Ok(())
}

#[tokio::test]
async fn leaf_and_last_model_follow_the_turn_and_recent_sessions_come_first()
-> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let sessions = SessionService::new(db);
    let older = sessions.create(None).await?;
    let newer = sessions.create(None).await?;
    let leaf_id = Uuid::new_v4();
    let first_model = LastModel {
        provider_id: Uuid::new_v4(),
        model: "model-a".to_owned(),
    };
    let second_model = LastModel {
        provider_id: Uuid::new_v4(),
        model: "model-b".to_owned(),
    };

    sessions.update_leaf(older.id, leaf_id).await?;
    sessions
        .update_last_model(older.id, first_model.clone())
        .await?;
    let with_first = sessions.find(older.id).await?;
    sessions
        .update_last_model(older.id, second_model.clone())
        .await?;
    let with_second = sessions.find(older.id).await?;
    let renamed = sessions.rename(older.id, "  Renamed  ").await?;
    let listed = sessions.list_sessions().await?;
    let missing_rename = sessions.rename(Uuid::new_v4(), "Missing").await;

    let with_first = with_first.ok_or("session vanished")?;
    assert_eq!(with_first.leaf_id, Some(leaf_id), "leaf");
    assert_eq!(with_first.last_model, Some(first_model), "first model");
    let with_second = with_second.ok_or("session vanished")?;
    assert_eq!(with_second.last_model, Some(second_model), "second model");
    assert_eq!(renamed.title, "Renamed", "trimmed title");
    let order: Vec<Uuid> = listed.iter().map(|c| c.id).collect();
    assert_eq!(order, [older.id, newer.id], "most recently updated first");
    let blank = sessions.rename(older.id, "   ").await;
    assert!(
        matches!(blank, Err(SessionError::TitleRequired)),
        "blank title: {blank:?}"
    );
    assert!(
        matches!(missing_rename, Err(SessionError::NotFound)),
        "missing rename: {missing_rename:?}"
    );
    Ok(())
}

#[tokio::test]
async fn deleting_a_provider_keeps_the_messages_and_sessions_that_used_it()
-> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = ProviderService::new(
        db.clone(),
        "test-secret-key",
        HttpConnector::new(ReqwestTransport::new()),
    );
    let sessions = SessionService::new(db);
    let provider = providers
        .create_custom(CreateCustomInput {
            api_format: ApiFormat::OpenAiCompatible,
            identifier: "main".to_owned(),
            name: "Main".to_owned(),
            base_url: "https://api.example.com/v1".to_owned(),
            api_key: "sk-original".to_owned(),
            api_path: String::new(),
            models_path: String::new(),
            models: vec![ProviderModel {
                id: "model-a".to_owned(),
                tool_calling: true,
            }],
        })
        .await?;
    let session = sessions.create(None).await?;
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
        .update_last_model(session.id, last_model.clone())
        .await?;

    providers.delete_custom(provider.id).await?;

    let tree = sessions.list_messages(session.id).await?;
    let [kept] = tree.messages.as_slice() else {
        return Err(format!("expected one message: {tree:?}").into());
    };
    assert_eq!(kept.id, answer_id, "message survives");
    assert_eq!(kept.provider_id, Some(provider.id), "message provider id");
    assert_eq!(kept.model.as_deref(), Some("model-a"), "message model");
    let reread = sessions.find(session.id).await?;
    assert_eq!(
        reread.and_then(|c| c.last_model),
        Some(last_model),
        "session last model"
    );
    Ok(())
}

#[tokio::test]
async fn the_context_path_runs_from_the_root_to_the_leaf() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let sessions = SessionService::new(db);
    let session_id = sessions.create(None).await?.id;
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
}

#[tokio::test]
async fn session_methods_report_database_failures() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let sessions = SessionService::new(db.clone());
    let id = sessions.create(None).await?.id;
    let last_model = LastModel {
        provider_id: Uuid::new_v4(),
        model: "model-a".to_owned(),
    };

    sqlx::query("DROP TABLE messages").execute(&db).await?;
    let listed_tree_no_messages = sessions.list_messages(id).await;
    let resolved_no_messages = sessions
        .resolve_branch_parent(id, BranchTarget::ActiveLeaf)
        .await;
    let leaf_set_no_messages = sessions.set_leaf(id, Some(Uuid::new_v4())).await;
    let label_set_no_messages = sessions
        .set_message_label(id, Uuid::new_v4(), "branch")
        .await;
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

    sqlx::query("DROP TABLE sessions").execute(&db).await?;
    let listed = sessions.list_sessions().await;
    let found = sessions.find(id).await;
    let renamed = sessions.rename(id, "Plans").await;
    let created = sessions.create(None).await;
    let deleted = sessions.delete(id).await;
    let leaf_updated = sessions.update_leaf(id, Uuid::new_v4()).await;
    let leaf_set_no_sessions = sessions.set_leaf(id, None).await;
    let model_updated = sessions.update_last_model(id, last_model).await;
    let listed_tree_no_sessions = sessions.list_messages(id).await;
    let resolved_no_sessions = sessions
        .resolve_branch_parent(id, BranchTarget::ActiveLeaf)
        .await;

    for (operation, failed) in [
        (
            "list messages without messages",
            listed_tree_no_messages.err(),
        ),
        (
            "resolve branch parent without messages",
            resolved_no_messages.err(),
        ),
        ("set leaf without messages", leaf_set_no_messages.err()),
        ("set label without messages", label_set_no_messages.err()),
        ("append message", appended.err()),
        ("update message", message_updated.err()),
        ("all messages", all_messages.err()),
        ("list sessions", listed.err()),
        ("find", found.err()),
        ("rename", renamed.err()),
        ("create", created.err()),
        ("delete", deleted.err()),
        ("update leaf", leaf_updated.err()),
        ("set leaf without sessions", leaf_set_no_sessions.err()),
        ("update last model", model_updated.err()),
        (
            "list messages without sessions",
            listed_tree_no_sessions.err(),
        ),
        (
            "resolve branch parent without sessions",
            resolved_no_sessions.err(),
        ),
    ] {
        assert!(
            matches!(failed, Some(SessionError::Store(_))),
            "{operation} without tables: {failed:?}"
        );
    }
    Ok(())
}

#[tokio::test]
async fn resolve_branch_parent_covers_active_leaf_root_and_message_targets()
-> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let sessions = SessionService::new(db);
    let empty = sessions.create(None).await?;
    let session = sessions.create(None).await?;

    let (empty_session, empty_parent, empty_fmt) = sessions
        .resolve_branch_parent(empty.id, BranchTarget::ActiveLeaf)
        .await?;
    assert_eq!(empty_session.id, empty.id, "empty session returned");
    assert_eq!(empty_parent, None, "empty active leaf parent");
    assert_eq!(empty_fmt, None, "empty active leaf format");

    let root_user = entry(session.id, None, "question", at(0));
    let assistant_base = assistant_entry(
        session.id,
        Some(root_user.id),
        "base",
        Some(ApiFormat::OpenAiCompatible),
        at(1),
    );
    let branch_a_user = entry(session.id, Some(assistant_base.id), "branch a", at(2));
    let branch_a_assistant = assistant_entry(
        session.id,
        Some(branch_a_user.id),
        "a answer",
        Some(ApiFormat::Anthropic),
        at(3),
    );
    let branch_b_user = entry(session.id, Some(assistant_base.id), "branch b", at(4));
    let branch_b_assistant = assistant_entry(
        session.id,
        Some(branch_b_user.id),
        "b answer",
        Some(ApiFormat::Gemini),
        at(5),
    );
    let branch_b_tool = tool_result_entry(
        session.id,
        Some(branch_b_assistant.id),
        "call-1",
        "read_file",
        at(6),
    );
    let legacy_user = entry(session.id, Some(branch_a_assistant.id), "follow-up", at(7));
    let legacy_assistant = assistant_entry(session.id, Some(legacy_user.id), "legacy", None, at(8));
    for msg in [
        root_user.clone(),
        assistant_base.clone(),
        branch_a_user.clone(),
        branch_a_assistant.clone(),
        branch_b_user.clone(),
        branch_b_assistant.clone(),
        branch_b_tool.clone(),
        legacy_user.clone(),
        legacy_assistant.clone(),
    ] {
        sessions.append_message(msg).await?;
    }

    sessions.update_leaf(session.id, branch_a_user.id).await?;
    let (_, active_parent, active_fmt) = sessions
        .resolve_branch_parent(session.id, BranchTarget::ActiveLeaf)
        .await?;
    assert_eq!(active_parent, Some(branch_a_user.id), "active leaf parent");
    assert_eq!(
        active_fmt,
        Some(ApiFormat::OpenAiCompatible),
        "active leaf inherits ancestor assistant format"
    );

    let (_, root_parent, root_fmt) = sessions
        .resolve_branch_parent(session.id, BranchTarget::Root)
        .await?;
    assert_eq!(root_parent, None, "root branch has no parent");
    assert_eq!(root_fmt, None, "root branch has no inherited format");

    let (_, msg_a_parent, msg_a_fmt) = sessions
        .resolve_branch_parent(session.id, BranchTarget::Message(branch_a_assistant.id))
        .await?;
    assert_eq!(msg_a_parent, Some(branch_a_assistant.id), "branch a parent");
    assert_eq!(msg_a_fmt, Some(ApiFormat::Anthropic), "branch a format");

    let (_, msg_b_parent, msg_b_fmt) = sessions
        .resolve_branch_parent(session.id, BranchTarget::Message(branch_b_tool.id))
        .await?;
    assert_eq!(msg_b_parent, Some(branch_b_tool.id), "branch b tool parent");
    assert_eq!(msg_b_fmt, Some(ApiFormat::Gemini), "branch b format");

    let (_, base_parent, base_fmt) = sessions
        .resolve_branch_parent(session.id, BranchTarget::Message(assistant_base.id))
        .await?;
    assert_eq!(
        base_parent,
        Some(assistant_base.id),
        "base assistant parent"
    );
    assert_eq!(
        base_fmt,
        Some(ApiFormat::OpenAiCompatible),
        "base assistant format"
    );

    sessions
        .update_leaf(session.id, legacy_assistant.id)
        .await?;
    let (_, _, legacy_fmt) = sessions
        .resolve_branch_parent(session.id, BranchTarget::ActiveLeaf)
        .await?;
    assert_eq!(legacy_fmt, None, "legacy assistant has no format");

    let mut streaming = assistant_entry(session.id, Some(root_user.id), "", None, at(9));
    streaming.status = MessageStatus::Streaming;
    sessions.append_message(streaming.clone()).await?;
    sessions.update_leaf(session.id, streaming.id).await?;
    assert!(
        matches!(
            sessions
                .resolve_branch_parent(session.id, BranchTarget::ActiveLeaf)
                .await,
            Err(SessionError::InvalidBranchPoint)
        ),
        "streaming active leaf rejected"
    );
    assert!(
        matches!(
            sessions
                .resolve_branch_parent(session.id, BranchTarget::Message(root_user.id))
                .await,
            Err(SessionError::InvalidBranchPoint)
        ),
        "user message branch target rejected"
    );
    assert!(
        matches!(
            sessions
                .resolve_branch_parent(session.id, BranchTarget::Message(Uuid::new_v4()))
                .await,
            Err(SessionError::MessageNotFound)
        ),
        "missing message branch target rejected"
    );

    let broken_user = entry(session.id, Some(Uuid::new_v4()), "orphan", at(10));
    let broken_tool = tool_result_entry(
        session.id,
        Some(broken_user.id),
        "call-2",
        "read_file",
        at(11),
    );
    sessions.append_message(broken_user).await?;
    sessions.append_message(broken_tool.clone()).await?;
    assert!(
        matches!(
            sessions
                .resolve_branch_parent(session.id, BranchTarget::Message(broken_tool.id))
                .await,
            Err(SessionError::Missing(_))
        ),
        "broken ancestor chain rejected"
    );

    sessions.update_leaf(empty.id, Uuid::new_v4()).await?;
    assert!(
        matches!(
            sessions
                .resolve_branch_parent(empty.id, BranchTarget::ActiveLeaf)
                .await,
            Err(SessionError::Missing(_))
        ),
        "missing active leaf node"
    );
    assert!(
        matches!(
            sessions
                .resolve_branch_parent(Uuid::new_v4(), BranchTarget::Root)
                .await,
            Err(SessionError::NotFound)
        ),
        "missing session"
    );
    Ok(())
}

#[tokio::test]
async fn set_leaf_validates_turn_boundaries_and_rewinds() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let sessions = SessionService::new(db);
    let session = sessions.create(None).await?;
    let other = sessions.create(None).await?;

    let user = entry(session.id, None, "run tools", at(0));
    let assistant_tool_call = assistant_entry(
        session.id,
        Some(user.id),
        "calling",
        Some(ApiFormat::Anthropic),
        at(1),
    );
    let tool_res_1 = tool_result_entry(
        session.id,
        Some(assistant_tool_call.id),
        "call-1",
        "read_file",
        at(2),
    );
    let tool_res_2 = tool_result_entry(
        session.id,
        Some(tool_res_1.id),
        "call-2",
        "write_file",
        at(3),
    );
    let mut assistant_final = assistant_entry(
        session.id,
        Some(tool_res_2.id),
        "done",
        Some(ApiFormat::Anthropic),
        at(4),
    );
    assistant_final.status = MessageStatus::Aborted;
    let mut streaming = assistant_entry(session.id, Some(user.id), "", None, at(5));
    streaming.status = MessageStatus::Streaming;
    let other_assistant = assistant_entry(other.id, None, "other", None, at(6));

    for msg in [
        user.clone(),
        assistant_tool_call.clone(),
        tool_res_1.clone(),
        tool_res_2.clone(),
        assistant_final.clone(),
        streaming.clone(),
        other_assistant.clone(),
    ] {
        sessions.append_message(msg).await?;
    }

    let entries = sessions.all_messages(session.id).await?;
    assert!(
        is_valid_turn_boundary(assistant_final.id, &entries).is_ok(),
        "aborted assistant without tool children is valid"
    );

    let updated = sessions
        .set_leaf(session.id, Some(assistant_final.id))
        .await?;
    assert_eq!(
        updated.leaf_id,
        Some(assistant_final.id),
        "set leaf to assistant"
    );

    let updated = sessions.set_leaf(session.id, Some(tool_res_2.id)).await?;
    assert_eq!(
        updated.leaf_id,
        Some(tool_res_2.id),
        "set leaf to terminal tool result"
    );

    let rewound = sessions.set_leaf(session.id, None).await?;
    assert_eq!(rewound.leaf_id, None, "rewind leaf to root");

    assert!(
        matches!(
            sessions.set_leaf(Uuid::new_v4(), None).await,
            Err(SessionError::NotFound)
        ),
        "missing session"
    );
    for invalid_id in [Uuid::new_v4(), other_assistant.id] {
        assert!(
            matches!(
                sessions.set_leaf(session.id, Some(invalid_id)).await,
                Err(SessionError::MessageNotFound)
            ),
            "unknown or foreign message {invalid_id}"
        );
    }
    for bad_boundary in [streaming.id, user.id, assistant_tool_call.id, tool_res_1.id] {
        assert!(
            matches!(
                sessions.set_leaf(session.id, Some(bad_boundary)).await,
                Err(SessionError::InvalidBranchPoint)
            ),
            "invalid boundary {bad_boundary}"
        );
    }
    Ok(())
}

#[tokio::test]
async fn set_message_label_sets_trims_clears_and_rejects_foreign_messages()
-> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let sessions = SessionService::new(db);
    let session = sessions.create(None).await?;
    let other = sessions.create(None).await?;
    let msg = entry(session.id, None, "hello", at(0));
    let other_msg = entry(other.id, None, "other", at(1));
    sessions.append_message(msg.clone()).await?;
    sessions.append_message(other_msg.clone()).await?;

    let labeled = sessions
        .set_message_label(session.id, msg.id, "  main branch  ")
        .await?;
    assert_eq!(
        labeled.label.as_deref(),
        Some("main branch"),
        "trimmed label stored"
    );

    let cleared_ws = sessions
        .set_message_label(session.id, msg.id, "   \t ")
        .await?;
    assert_eq!(cleared_ws.label, None, "whitespace clears label");

    sessions
        .set_message_label(session.id, msg.id, "retry")
        .await?;
    let cleared_empty = sessions.set_message_label(session.id, msg.id, "").await?;
    assert_eq!(cleared_empty.label, None, "empty string clears label");

    let stored = sessions.list_messages(session.id).await?;
    assert_eq!(stored.messages[0].label, None, "persisted cleared label");

    for (sid, mid) in [
        (session.id, Uuid::new_v4()),
        (session.id, other_msg.id),
        (other.id, msg.id),
        (Uuid::new_v4(), msg.id),
    ] {
        assert!(
            matches!(
                sessions.set_message_label(sid, mid, "nope").await,
                Err(SessionError::MessageNotFound)
            ),
            "reject ({sid}, {mid})"
        );
    }
    Ok(())
}

#[tokio::test]
async fn unknown_stored_api_format_fails_as_store_error() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let sessions = SessionService::new(db.clone());
    let session = sessions.create(None).await?;
    let msg = entry(session.id, None, "hello", at(0));
    sessions.append_message(msg.clone()).await?;
    sqlx::query("UPDATE messages SET api_format = 'bogus' WHERE id = ?")
        .bind(msg.id)
        .execute(&db)
        .await?;

    let err = sessions.list_messages(session.id).await.err();
    assert!(
        matches!(err, Some(SessionError::Store(_))),
        "expected store error, got {err:?}"
    );
    Ok(())
}
