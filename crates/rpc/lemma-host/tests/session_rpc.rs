//! `SessionService` over Connect on a local engine: session lifecycle and
//! the error reasons clients receive.
mod common;

use std::error::Error;
use std::fs;

use common::{DataDir, Engine, Reply, assert_internal, assert_reason};
use lemma_proto::lemma::v1::ErrorReason;
use serde_json::{Value, json};

const LIST: &str = "/lemma.v1.SessionService/ListSessions";
const CREATE: &str = "/lemma.v1.SessionService/CreateSession";
const RENAME: &str = "/lemma.v1.SessionService/RenameSession";
const MESSAGES: &str = "/lemma.v1.SessionService/ListMessages";
const DELETE: &str = "/lemma.v1.SessionService/DeleteSession";

fn session_id(reply: &Reply) -> Result<String, Box<dyn Error>> {
    reply.body["session"]["id"]
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| format!("no session id in {reply:?}").into())
}

#[tokio::test]
async fn sessions_are_created_renamed_listed_and_deleted() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;

    let created = engine.call(CREATE, &json!({})).await?;
    let id = session_id(&created)?;
    let renamed = engine
        .call(RENAME, &json!({ "id": id, "title": " Plans " }))
        .await?;
    let listed = engine.call(LIST, &json!({})).await?;
    let messages = engine.call(MESSAGES, &json!({ "sessionId": id })).await?;
    let paged = engine
        .call(
            MESSAGES,
            &json!({ "sessionId": id, "beforeId": "00000000-0000-4000-8000-000000000000" }),
        )
        .await?;
    let deleted = engine.call(DELETE, &json!({ "id": id })).await?;
    let after = engine.call(LIST, &json!({})).await?;

    assert_eq!(created.status, 200, "{created:?}");
    assert!(
        created.body["session"]["updatedAt"].is_string(),
        "creation time: {created:?}"
    );
    assert_eq!(
        (
            &renamed.body["session"]["id"],
            &renamed.body["session"]["title"]
        ),
        (&json!(id), &json!("Plans")),
        "renamed session"
    );
    assert_eq!(
        listed.body["sessions"],
        json!([renamed.body["session"]]),
        "listed sessions"
    );
    assert_eq!(messages.body, json!({}), "an empty session has no messages");
    assert_eq!(
        paged.body,
        json!({}),
        "a valid beforeId returns no messages"
    );
    assert_eq!(deleted.status, 200, "{deleted:?}");
    assert_eq!(after.body, json!({}), "no sessions left");
    engine.close().await;
    Ok(())
}

#[tokio::test]
async fn invalid_requests_carry_their_reasons() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let id = session_id(&engine.call(CREATE, &json!({})).await?)?;
    let unknown = "00000000-0000-4000-8000-000000000000";
    let calls: [(&str, Value, ErrorReason); 8] = [
        (
            RENAME,
            json!({ "id": id, "title": " " }),
            ErrorReason::TitleRequired,
        ),
        (
            RENAME,
            json!({ "id": "x", "title": "t" }),
            ErrorReason::IdInvalid,
        ),
        (
            RENAME,
            json!({ "id": unknown, "title": "t" }),
            ErrorReason::SessionNotFound,
        ),
        (
            MESSAGES,
            json!({ "sessionId": "x" }),
            ErrorReason::IdInvalid,
        ),
        (
            MESSAGES,
            json!({ "sessionId": id, "beforeId": "x" }),
            ErrorReason::IdInvalid,
        ),
        (
            MESSAGES,
            json!({ "sessionId": unknown }),
            ErrorReason::SessionNotFound,
        ),
        (DELETE, json!({ "id": "x" }), ErrorReason::IdInvalid),
        (
            DELETE,
            json!({ "id": unknown }),
            ErrorReason::SessionNotFound,
        ),
    ];

    for (path, body, reason) in calls {
        let reply = engine.call(path, &body).await?;
        assert_reason(&reply, reason);
    }
    let still_there = engine.call(LIST, &json!({})).await?;
    assert_eq!(
        still_there.body["sessions"][0]["id"],
        json!(id),
        "rejected calls change nothing"
    );
    engine.close().await;
    Ok(())
}

#[tokio::test]
async fn a_database_failure_is_an_internal_error() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    engine.close().await;

    let list = engine.call(LIST, &json!({})).await?;
    let create = engine.call(CREATE, &json!({})).await?;

    assert_internal(&list, "db: ");
    assert_internal(&create, "db: ");
    Ok(())
}

#[tokio::test]
async fn the_local_engine_binds_a_session_to_an_existing_directory() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let dir = DataDir::new();
    fs::create_dir_all(&dir.0)?;
    let canonical = dunce::canonicalize(&dir.0)?;
    let missing = DataDir::new();

    let created = engine.call(CREATE, &json!({ "directory": dir.0 })).await?;
    let listed = engine.call(LIST, &json!({})).await?;
    let rejected = engine
        .call(CREATE, &json!({ "directory": missing.0 }))
        .await?;

    let expected = Value::from(canonical.to_string_lossy().into_owned());
    assert_eq!(
        created.body["session"]["directory"], expected,
        "{created:?}"
    );
    assert_eq!(
        listed.body["sessions"][0]["directory"], expected,
        "{listed:?}"
    );
    assert_reason(&rejected, ErrorReason::DirectoryNotFound);
    engine.close().await;
    Ok(())
}
