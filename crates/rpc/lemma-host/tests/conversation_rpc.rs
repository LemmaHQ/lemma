//! `ConversationService` over Connect on a local engine: conversation
//! lifecycle, ownership, and the error reasons clients receive.

mod common;

use std::error::Error;

use common::{Engine, Reply, assert_internal, assert_reason};
use lemma_proto::lemma::v1::ErrorReason;
use serde_json::{Value, json};

const LIST: &str = "/lemma.v1.ConversationService/ListConversations";
const CREATE: &str = "/lemma.v1.ConversationService/CreateConversation";
const RENAME: &str = "/lemma.v1.ConversationService/RenameConversation";
const MESSAGES: &str = "/lemma.v1.ConversationService/ListMessages";
const DELETE: &str = "/lemma.v1.ConversationService/DeleteConversation";

fn conversation_id(reply: &Reply) -> Result<String, Box<dyn Error>> {
    reply.body["conversation"]["id"]
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| format!("no conversation id in {reply:?}").into())
}

#[tokio::test]
async fn conversations_are_created_renamed_listed_and_deleted() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let token = engine.token("ada").await?;

    let created = engine.call_as(&token, CREATE, &json!({})).await?;
    let id = conversation_id(&created)?;
    let renamed = engine
        .call_as(&token, RENAME, &json!({ "id": id, "title": " Plans " }))
        .await?;
    let listed = engine.call_as(&token, LIST, &json!({})).await?;
    let messages = engine
        .call_as(&token, MESSAGES, &json!({ "conversationId": id }))
        .await?;
    let deleted = engine.call_as(&token, DELETE, &json!({ "id": id })).await?;
    let after = engine.call_as(&token, LIST, &json!({})).await?;

    assert_eq!(created.status, 200, "{created:?}");
    assert!(
        created.body["conversation"]["updatedAt"].is_string(),
        "creation time: {created:?}"
    );
    assert_eq!(
        (
            &renamed.body["conversation"]["id"],
            &renamed.body["conversation"]["title"]
        ),
        (&json!(id), &json!("Plans")),
        "renamed conversation"
    );
    assert_eq!(
        listed.body["conversations"],
        json!([renamed.body["conversation"]]),
        "listed conversations"
    );
    assert_eq!(
        messages.body,
        json!({}),
        "an empty conversation has no messages"
    );
    assert_eq!(deleted.status, 200, "{deleted:?}");
    assert_eq!(after.body, json!({}), "no conversations left");
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn invalid_requests_carry_their_reasons() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let ada = engine.token("ada").await?;
    let bob = engine.token("bob").await?;
    let id = conversation_id(&engine.call_as(&ada, CREATE, &json!({})).await?)?;
    let calls: [(&str, &str, Value, ErrorReason); 13] = [
        ("", LIST, json!({}), ErrorReason::TokenInvalid),
        ("", CREATE, json!({}), ErrorReason::TokenInvalid),
        (
            &ada,
            RENAME,
            json!({ "id": id, "title": " " }),
            ErrorReason::TitleRequired,
        ),
        (
            &ada,
            RENAME,
            json!({ "id": "x", "title": "t" }),
            ErrorReason::IdInvalid,
        ),
        (
            &bob,
            RENAME,
            json!({ "id": id, "title": "t" }),
            ErrorReason::ConversationNotFound,
        ),
        (
            &ada,
            MESSAGES,
            json!({ "conversationId": "x" }),
            ErrorReason::IdInvalid,
        ),
        (
            &ada,
            MESSAGES,
            json!({ "conversationId": id, "beforeId": "x" }),
            ErrorReason::IdInvalid,
        ),
        (
            &bob,
            MESSAGES,
            json!({ "conversationId": id }),
            ErrorReason::ConversationNotFound,
        ),
        (&ada, DELETE, json!({ "id": "x" }), ErrorReason::IdInvalid),
        (
            &bob,
            DELETE,
            json!({ "id": id }),
            ErrorReason::ConversationNotFound,
        ),
        ("", DELETE, json!({ "id": id }), ErrorReason::TokenInvalid),
        (
            "",
            RENAME,
            json!({ "id": id, "title": "t" }),
            ErrorReason::TokenInvalid,
        ),
        (
            "",
            MESSAGES,
            json!({ "conversationId": id }),
            ErrorReason::TokenInvalid,
        ),
    ];

    for (token, path, body, reason) in calls {
        let reply = if token.is_empty() {
            engine.call(path, &body).await?
        } else {
            engine.call_as(token, path, &body).await?
        };
        assert_reason(&reply, reason);
    }
    let still_there = engine.call_as(&ada, LIST, &json!({})).await?;
    assert_eq!(
        still_there.body["conversations"][0]["id"],
        json!(id),
        "rejected calls change nothing"
    );
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn a_database_failure_is_an_internal_error() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let token = engine.token("ada").await?;
    engine.close().await?;

    let list = engine.call_as(&token, LIST, &json!({})).await?;
    let create = engine.call_as(&token, CREATE, &json!({})).await?;

    assert_internal(&list, "db: ");
    assert_internal(&create, "db: ");
    Ok(())
}
