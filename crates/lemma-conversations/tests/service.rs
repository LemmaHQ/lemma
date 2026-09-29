#![allow(clippy::unwrap_used, missing_docs)]

use buffa::Message;
use connectrpc::{CodecFormat, Encodable, JsonSerialize};
use connectrpc::{ErrorCode, HasMessageView, RequestContext, ServiceRequest};
use http::HeaderMap;
use lemma_auth::{sign_access_token, users};
use lemma_conversations::ConversationService;
use lemma_proto::lemma::v1::ConversationService as ConversationServiceRpc;
use lemma_proto::lemma::v1::MessageStatus;
use sqlx::PgPool;
use uuid::Uuid;

type Svc = ConversationService;

fn svc(pool: &PgPool) -> Svc {
    ConversationService::new(pool.clone(), SECRET)
}

const SECRET: &str = "test-secret";

async fn new_user(pool: &PgPool) -> (Uuid, String) {
    let name = format!("u-{}", Uuid::new_v4());
    let id = users::insert(pool, &name, &format!("{name}@example.com"), "hash")
        .await
        .unwrap()
        .id;
    let token = sign_access_token(SECRET, id).unwrap();
    (id, token)
}

fn bearer_ctx(token: &str) -> RequestContext {
    let mut headers = HeaderMap::new();
    headers.insert(
        http::header::AUTHORIZATION,
        format!("Bearer {token}").parse().unwrap(),
    );
    RequestContext::new(headers)
}

fn owned_body<M>(body: &impl Encodable<M>) -> M
where
    M: Message + JsonSerialize,
{
    let bytes = body.encode(CodecFormat::Proto).unwrap();
    M::decode(&mut &bytes[..]).unwrap()
}

async fn create(svc: &Svc, token: &str) -> lemma_proto::lemma::v1::CreateConversationResponse {
    let msg = lemma_proto::lemma::v1::CreateConversationRequest::default();
    let bytes = msg.encode_to_bytes();
    let view = lemma_proto::lemma::v1::CreateConversationRequest::decode_view(&bytes).unwrap();
    let resp = svc
        .create_conversation(bearer_ctx(token), ServiceRequest::from_parts(&view, &bytes))
        .await
        .unwrap();
    owned_body(&resp.body)
}

async fn list_active_count(svc: &Svc, token: &str) -> usize {
    let msg = lemma_proto::lemma::v1::ListConversationsRequest::default();
    let bytes = msg.encode_to_bytes();
    let view = lemma_proto::lemma::v1::ListConversationsRequest::decode_view(&bytes).unwrap();
    svc.list_conversations(bearer_ctx(token), ServiceRequest::from_parts(&view, &bytes))
        .await
        .unwrap()
        .body
        .conversations
        .len()
}

async fn list_archived_count(svc: &Svc, token: &str) -> usize {
    let msg = lemma_proto::lemma::v1::ListArchivedRequest::default();
    let bytes = msg.encode_to_bytes();
    let view = lemma_proto::lemma::v1::ListArchivedRequest::decode_view(&bytes).unwrap();
    svc.list_archived(bearer_ctx(token), ServiceRequest::from_parts(&view, &bytes))
        .await
        .unwrap()
        .body
        .conversations
        .len()
}

async fn archive(
    svc: &Svc,
    token: &str,
    id: &str,
) -> Result<lemma_proto::lemma::v1::ArchiveConversationResponse, connectrpc::ConnectError> {
    let msg = lemma_proto::lemma::v1::ArchiveConversationRequest {
        id: id.into(),
        ..Default::default()
    };
    let bytes = msg.encode_to_bytes();
    let view = lemma_proto::lemma::v1::ArchiveConversationRequest::decode_view(&bytes).unwrap();
    match svc
        .archive_conversation(bearer_ctx(token), ServiceRequest::from_parts(&view, &bytes))
        .await
    {
        Ok(resp) => Ok(owned_body(&resp.body)),
        Err(e) => Err(e),
    }
}

async fn restore(
    svc: &Svc,
    token: &str,
    id: &str,
) -> Result<lemma_proto::lemma::v1::RestoreConversationResponse, connectrpc::ConnectError> {
    let msg = lemma_proto::lemma::v1::RestoreConversationRequest {
        id: id.into(),
        ..Default::default()
    };
    let bytes = msg.encode_to_bytes();
    let view = lemma_proto::lemma::v1::RestoreConversationRequest::decode_view(&bytes).unwrap();
    match svc
        .restore_conversation(bearer_ctx(token), ServiceRequest::from_parts(&view, &bytes))
        .await
    {
        Ok(resp) => Ok(owned_body(&resp.body)),
        Err(e) => Err(e),
    }
}

async fn delete_archived(
    svc: &Svc,
    token: &str,
    id: &str,
) -> Result<lemma_proto::lemma::v1::DeleteArchivedResponse, connectrpc::ConnectError> {
    let msg = lemma_proto::lemma::v1::DeleteArchivedRequest {
        id: id.into(),
        ..Default::default()
    };
    let bytes = msg.encode_to_bytes();
    let view = lemma_proto::lemma::v1::DeleteArchivedRequest::decode_view(&bytes).unwrap();
    match svc
        .delete_archived(bearer_ctx(token), ServiceRequest::from_parts(&view, &bytes))
        .await
    {
        Ok(resp) => Ok(owned_body(&resp.body)),
        Err(e) => Err(e),
    }
}

async fn seed_messages(pool: &PgPool, conv: &str, contents: &[&str]) {
    let conv = Uuid::parse_str(conv).unwrap();
    for (i, content) in contents.iter().enumerate() {
        sqlx::query(
            "INSERT INTO messages (id, conversation_id, role, content_json, created_at)
             VALUES ($1, $2, 'user', $3::jsonb, now() - make_interval(secs => $4))",
        )
        .bind(Uuid::new_v4())
        .bind(conv)
        .bind(
            serde_json::json!({"role":"user","content":[{"type":"text","text":content}]})
                .to_string(),
        )
        .bind(contents.len() as i64 - i as i64)
        .execute(pool)
        .await
        .unwrap();
    }
}

async fn message_contents(pool: &PgPool, conv: &str) -> Vec<String> {
    let rows: Vec<serde_json::Value> = sqlx::query_scalar(
        "SELECT content_json FROM messages WHERE conversation_id = $1 ORDER BY created_at, id",
    )
    .bind(Uuid::parse_str(conv).unwrap())
    .fetch_all(pool)
    .await
    .unwrap();
    rows.into_iter()
        .map(|v| v["content"][0]["text"].as_str().unwrap().to_string())
        .collect()
}

async fn rename(
    svc: &Svc,
    token: &str,
    id: &str,
    title: &str,
) -> Result<lemma_proto::lemma::v1::RenameConversationResponse, connectrpc::ConnectError> {
    let msg = lemma_proto::lemma::v1::RenameConversationRequest {
        id: id.into(),
        title: title.into(),
        ..Default::default()
    };
    let bytes = msg.encode_to_bytes();
    let view = lemma_proto::lemma::v1::RenameConversationRequest::decode_view(&bytes).unwrap();
    match svc
        .rename_conversation(bearer_ctx(token), ServiceRequest::from_parts(&view, &bytes))
        .await
    {
        Ok(resp) => Ok(owned_body(&resp.body)),
        Err(e) => Err(e),
    }
}

async fn list_messages(
    svc: &Svc,
    token: &str,
    conv: &str,
) -> Result<lemma_proto::lemma::v1::ListMessagesResponse, connectrpc::ConnectError> {
    let msg = lemma_proto::lemma::v1::ListMessagesRequest {
        conversation_id: conv.into(),
        ..Default::default()
    };
    let bytes = msg.encode_to_bytes();
    let view = lemma_proto::lemma::v1::ListMessagesRequest::decode_view(&bytes).unwrap();
    match svc
        .list_messages(bearer_ctx(token), ServiceRequest::from_parts(&view, &bytes))
        .await
    {
        Ok(resp) => Ok(owned_body(&resp.body)),
        Err(e) => Err(e),
    }
}

#[allow(clippy::too_many_arguments)]
async fn insert_msg(pool: &PgPool, conv: Uuid, seq: i64, status: &str, model: Option<&str>) {
    sqlx::query(
        "INSERT INTO messages (id, conversation_id, role, content_json, status, model, created_at)
         VALUES ($1, $2, 'assistant', $3::jsonb, $4, $5, now() - make_interval(secs => $6))",
    )
    .bind(Uuid::new_v4())
    .bind(conv)
    .bind(
        serde_json::json!({"role":"assistant","content":[{"type":"text","text":format!("c{seq}")}],"stop_reason":"stop"})
            .to_string(),
    )
    .bind(status)
    .bind(model)
    .bind(10 - seq)
    .execute(pool)
    .await
    .unwrap();
}

#[sqlx::test(migrations = "../lemma-db-server/migrations")]
async fn create_and_list(pool: PgPool) {
    let svc = svc(&pool);
    let (_, token) = new_user(&pool).await;
    let created = create(&svc, &token).await;
    assert_eq!(created.conversation.title, "");
    assert_eq!(list_active_count(&svc, &token).await, 1);
}

#[sqlx::test(migrations = "../lemma-db-server/migrations")]
async fn rename_not_found_and_cross_user(pool: PgPool) {
    let svc = svc(&pool);
    let (_, alice) = new_user(&pool).await;
    let (_, erin) = new_user(&pool).await;
    let id = create(&svc, &alice).await.conversation.id.clone();

    let err = rename(&svc, &alice, &Uuid::new_v4().to_string(), "x")
        .await
        .err()
        .unwrap();
    assert_eq!(err.code, ErrorCode::NotFound);

    let err = rename(&svc, &erin, &id, "hack").await.err().unwrap();
    assert_eq!(err.code, ErrorCode::NotFound);

    let ok = rename(&svc, &alice, &id, "我的会话").await.unwrap();
    assert_eq!(ok.conversation.title, "我的会话");
}

#[sqlx::test(migrations = "../lemma-db-server/migrations")]
async fn archive_restore_flow(pool: PgPool) {
    let svc = svc(&pool);
    let (_, token) = new_user(&pool).await;
    let id = create(&svc, &token).await.conversation.id.clone();

    let msg = lemma_proto::lemma::v1::ArchiveConversationRequest {
        id: id.clone(),
        ..Default::default()
    };
    let bytes = msg.encode_to_bytes();
    let view = lemma_proto::lemma::v1::ArchiveConversationRequest::decode_view(&bytes).unwrap();
    svc.archive_conversation(
        bearer_ctx(&token),
        ServiceRequest::from_parts(&view, &bytes),
    )
    .await
    .unwrap();

    assert_eq!(list_active_count(&svc, &token).await, 0);
    assert_eq!(list_archived_count(&svc, &token).await, 1);

    let msg = lemma_proto::lemma::v1::RestoreConversationRequest {
        id,
        ..Default::default()
    };
    let bytes = msg.encode_to_bytes();
    let view = lemma_proto::lemma::v1::RestoreConversationRequest::decode_view(&bytes).unwrap();
    svc.restore_conversation(
        bearer_ctx(&token),
        ServiceRequest::from_parts(&view, &bytes),
    )
    .await
    .unwrap();

    assert_eq!(list_active_count(&svc, &token).await, 1);
    assert_eq!(list_archived_count(&svc, &token).await, 0);
}

#[sqlx::test(migrations = "../lemma-db-server/migrations")]
async fn list_messages_isolated(pool: PgPool) {
    let svc = svc(&pool);
    let (_, alice) = new_user(&pool).await;
    let (_, erin) = new_user(&pool).await;
    let id = create(&svc, &alice).await.conversation.id.clone();

    let msg = lemma_proto::lemma::v1::ListMessagesRequest {
        conversation_id: id,
        ..Default::default()
    };
    let bytes = msg.encode_to_bytes();
    let view = lemma_proto::lemma::v1::ListMessagesRequest::decode_view(&bytes).unwrap();

    let r = svc
        .list_messages(
            bearer_ctx(&alice),
            ServiceRequest::from_parts(&view, &bytes),
        )
        .await
        .unwrap()
        .body;
    assert!(r.messages.is_empty());
    assert!(!r.has_more);

    let err = svc
        .list_messages(bearer_ctx(&erin), ServiceRequest::from_parts(&view, &bytes))
        .await
        .err()
        .unwrap();
    assert_eq!(err.code, ErrorCode::NotFound);
}

#[sqlx::test(migrations = "../lemma-db-server/migrations")]
async fn archive_keeps_content_in_pg(pool: PgPool) {
    let svc = svc(&pool);
    let (_, token) = new_user(&pool).await;
    let id = create(&svc, &token).await.conversation.id.clone();
    seed_messages(&pool, &id, &["留"]).await;

    archive(&svc, &token, &id).await.unwrap();

    assert_eq!(message_contents(&pool, &id).await, ["留"]);
}

#[sqlx::test(migrations = "../lemma-db-server/migrations")]
async fn list_messages_maps_statuses_and_fields(pool: PgPool) {
    let svc = svc(&pool);
    let (_, token) = new_user(&pool).await;
    let id = create(&svc, &token).await.conversation.id.clone();
    let conv = Uuid::parse_str(&id).unwrap();
    insert_msg(&pool, conv, 1, "done", None).await;
    insert_msg(&pool, conv, 2, "streaming", Some("gpt-x")).await;
    insert_msg(&pool, conv, 3, "aborted", None).await;
    insert_msg(&pool, conv, 4, "error", None).await;

    let r = list_messages(&svc, &token, &id).await.unwrap();
    assert_eq!(r.messages[0].status, MessageStatus::Error);
    assert_eq!(r.messages[1].status, MessageStatus::Aborted);
    assert_eq!(r.messages[2].status, MessageStatus::Streaming);
    assert_eq!(r.messages[3].status, MessageStatus::Done);
    assert_eq!(r.messages[2].model, "gpt-x");
    assert_eq!(r.messages[0].model, "");
    assert_eq!(r.messages[0].content, "c4");
    assert_eq!(r.messages[3].content, "c1");
    assert!(!r.has_more);

    let msg = lemma_proto::lemma::v1::ListMessagesRequest {
        conversation_id: id.clone(),
        before_id: "not-a-uuid".into(),
        ..Default::default()
    };
    let bytes = msg.encode_to_bytes();
    let view = lemma_proto::lemma::v1::ListMessagesRequest::decode_view(&bytes).unwrap();
    let err = svc
        .list_messages(
            bearer_ctx(&token),
            ServiceRequest::from_parts(&view, &bytes),
        )
        .await
        .err()
        .unwrap();
    assert_eq!(err.code, ErrorCode::InvalidArgument);
}

#[sqlx::test(migrations = "../lemma-db-server/migrations")]
async fn archive_and_restore_require_matching_status(pool: PgPool) {
    let (_uid, token) = new_user(&pool).await;
    let svc = svc(&pool);
    let active = create(&svc, &token).await.conversation.id.clone();

    let err = restore(&svc, &token, &active).await.err().unwrap();
    assert_eq!(
        lemma_proto::error_reason(&err),
        Some(lemma_proto::lemma::v1::ErrorReason::ConversationNotArchived)
    );
    let err = delete_archived(&svc, &token, &active).await.err().unwrap();
    assert_eq!(
        lemma_proto::error_reason(&err),
        Some(lemma_proto::lemma::v1::ErrorReason::ArchivedConversationNotFound)
    );

    archive(&svc, &token, &active).await.unwrap();
    let err = archive(&svc, &token, &active).await.err().unwrap();
    assert_eq!(
        lemma_proto::error_reason(&err),
        Some(lemma_proto::lemma::v1::ErrorReason::ConversationNotActive)
    );
}

#[sqlx::test(migrations = "../lemma-db-server/migrations")]
async fn malformed_ids_rejected(pool: PgPool) {
    let (_uid, token) = new_user(&pool).await;
    let svc = svc(&pool);

    for err in [
        rename(&svc, &token, "nope", "t").await.err().unwrap(),
        archive(&svc, &token, "nope").await.err().unwrap(),
        restore(&svc, &token, "nope").await.err().unwrap(),
        delete_archived(&svc, &token, "nope").await.err().unwrap(),
    ] {
        assert_eq!(err.code, ErrorCode::InvalidArgument);
        assert_eq!(
            lemma_proto::error_reason(&err),
            Some(lemma_proto::lemma::v1::ErrorReason::IdInvalid)
        );
    }
}

#[sqlx::test(migrations = "../lemma-db-server/migrations")]
async fn handlers_require_bearer(pool: PgPool) {
    let svc = svc(&pool);
    use lemma_proto::lemma::v1;

    macro_rules! unauth {
        ($method:ident, $ty:ty, $msg:expr) => {{
            let bytes = $msg.encode_to_bytes();
            let view = <$ty>::decode_view(&bytes).unwrap();
            let err = svc
                .$method(
                    RequestContext::new(HeaderMap::new()),
                    ServiceRequest::from_parts(&view, &bytes),
                )
                .await
                .err()
                .unwrap();
            assert_eq!(err.code, ErrorCode::Unauthenticated);
        }};
    }

    unauth!(
        list_conversations,
        v1::ListConversationsRequest,
        v1::ListConversationsRequest::default()
    );
    unauth!(
        create_conversation,
        v1::CreateConversationRequest,
        v1::CreateConversationRequest::default()
    );
    unauth!(
        rename_conversation,
        v1::RenameConversationRequest,
        v1::RenameConversationRequest::default()
    );
    unauth!(
        list_messages,
        v1::ListMessagesRequest,
        v1::ListMessagesRequest::default()
    );
    unauth!(
        archive_conversation,
        v1::ArchiveConversationRequest,
        v1::ArchiveConversationRequest::default()
    );
    unauth!(
        restore_conversation,
        v1::RestoreConversationRequest,
        v1::RestoreConversationRequest::default()
    );
    unauth!(
        delete_archived,
        v1::DeleteArchivedRequest,
        v1::DeleteArchivedRequest::default()
    );
    unauth!(
        list_archived,
        v1::ListArchivedRequest,
        v1::ListArchivedRequest::default()
    );
}
