//! Session calls against a local engine: create, rename, page, and delete.

mod common;

use common::{Engine, TestResult};
use lemma_client::ClientError;
use lemma_proto::lemma::v1::ErrorReason;

#[tokio::test]
async fn sessions_are_created_renamed_and_deleted() -> TestResult {
    let engine = Engine::open().await?;
    let (client, _) = engine.signed_up("ada").await?;

    let session = client.create_session().await?;
    let renamed = client.rename_session(&session.id, " Plans ").await?;
    assert_eq!(renamed.title, "Plans", "title trimmed");
    let listed = client.list_sessions().await?;
    assert_eq!(
        listed.iter().map(|s| s.title.as_str()).collect::<Vec<_>>(),
        ["Plans"],
        "renamed session listed"
    );

    let page = client.list_messages(&session.id, None).await?;
    assert!(
        page.messages.is_empty() && !page.has_more,
        "a new session has no messages"
    );
    let older = client.list_messages(&session.id, Some(&session.id)).await?;
    assert!(
        older.messages.is_empty(),
        "no messages before an unknown cursor"
    );

    client.delete_session(&session.id).await?;
    assert!(client.list_sessions().await?.is_empty(), "deleted");
    let result = client.rename_session(&session.id, "Gone").await;
    assert!(
        matches!(
            result,
            Err(ClientError::Reason(ErrorReason::SessionNotFound))
        ),
        "renaming a deleted session: {result:?}"
    );
    Ok(())
}
