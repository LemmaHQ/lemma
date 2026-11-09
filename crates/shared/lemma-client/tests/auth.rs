//! Accounts and tokens against a local engine: signing up, in, and out,
//! and how a rejected access token is refreshed once per connection.

mod common;

use common::{Engine, MemoryStore, TestResult, refusing};
use futures::future;
use lemma_client::{Client, ClientError, Connection, TokenPair};
use lemma_proto::lemma::v1::ErrorReason;

fn expired(pair: &TokenPair) -> TokenPair {
    TokenPair {
        access_token: "expired".to_owned(),
        refresh_token: pair.refresh_token.clone(),
    }
}

#[tokio::test]
async fn signing_up_signs_in_and_stores_the_tokens() -> TestResult {
    let engine = Engine::open().await?;
    let store = MemoryStore::default();
    let client = engine.client(store.clone());
    assert!(!client.signed_in(), "no tokens before signing up");
    assert_eq!(client.connection(), &Connection::Local, "local connection");

    let user = client
        .sign_up(" ada ", "ada@example.com", "password1")
        .await?;
    assert_eq!(user.username, "ada", "username trimmed");
    assert!(client.signed_in(), "signed in after signing up");
    assert!(store.get(&Connection::Local).is_some(), "tokens stored");
    assert_eq!(client.me().await?.id, user.id, "me is the new user");
    Ok(())
}

#[tokio::test]
async fn signing_in_takes_two_steps() -> TestResult {
    let engine = Engine::open().await?;
    engine.signed_up("ada").await?;
    let client = engine.client(MemoryStore::default());

    assert!(
        client.check_account(" ada@example.com ").await?,
        "known email"
    );
    assert!(!client.check_account("bob").await?, "unknown username");
    let rejected = client.sign_in("ada", "wrong-password").await;
    assert!(
        matches!(
            rejected,
            Err(ClientError::Reason(ErrorReason::CredentialsInvalid))
        ),
        "wrong password rejected: {rejected:?}"
    );
    assert!(!client.signed_in(), "still signed out");
    assert_eq!(
        client.sign_in("ada", "password1").await?.username,
        "ada",
        "signed in"
    );
    assert!(client.signed_in(), "tokens kept");
    Ok(())
}

#[tokio::test]
async fn signing_out_forgets_and_revokes_the_tokens() -> TestResult {
    let engine = Engine::open().await?;
    let (client, pair) = engine.signed_up("ada").await?;

    client.sign_out().await?;
    assert!(!client.signed_in(), "signed out");
    assert!(
        matches!(client.me().await, Err(ClientError::SignedOut)),
        "calls need a new sign-in"
    );
    client.sign_out().await?;

    let revived = engine.client(MemoryStore::with(&Connection::Local, expired(&pair)));
    assert!(
        matches!(revived.me().await, Err(ClientError::SignedOut)),
        "the revoked refresh token no longer renews"
    );
    Ok(())
}

#[tokio::test]
async fn a_rejected_access_token_is_refreshed_once_for_concurrent_calls() -> TestResult {
    let engine = Engine::open().await?;
    let (_, pair) = engine.signed_up("ada").await?;
    let store = MemoryStore::with(&Connection::Local, expired(&pair));
    let client = engine.client(store.clone());

    let (first, second) = future::join(client.me(), client.list_sessions()).await;
    assert_eq!(first?.username, "ada", "first call retried");
    assert!(
        second?.is_empty(),
        "second call retried with the same refresh"
    );
    let Some(renewed) = store.get(&Connection::Local) else {
        return Err("renewed tokens not stored".into());
    };
    assert_ne!(
        renewed.refresh_token, pair.refresh_token,
        "refresh token rotated"
    );
    Ok(())
}

#[tokio::test]
async fn a_refresh_the_host_rejects_signs_out() -> TestResult {
    let engine = Engine::open().await?;
    let pair = TokenPair {
        access_token: "expired".to_owned(),
        refresh_token: "unknown".to_owned(),
    };
    let store = MemoryStore::with(&Connection::Local, pair);
    let client = engine.client(store.clone());

    let result = client.list_providers().await;
    assert!(
        matches!(result, Err(ClientError::SignedOut)),
        "signed out: {result:?}"
    );
    assert!(!client.signed_in(), "tokens forgotten");
    assert!(
        store.get(&Connection::Local).is_none(),
        "stored tokens removed"
    );
    Ok(())
}

#[tokio::test]
async fn a_refresh_that_fails_on_the_server_keeps_the_tokens() -> TestResult {
    let engine = Engine::open().await?;
    let (_, pair) = engine.signed_up("ada").await?;
    let router = refusing(engine.router(), "/Refresh");
    let store = MemoryStore::with(&Connection::Local, expired(&pair));
    let client = Client::local(router, store.clone());

    let result = client.me().await;
    assert!(
        matches!(result, Err(ClientError::Network)),
        "server failure surfaces: {result:?}"
    );
    assert!(client.signed_in(), "tokens kept for a later retry");
    assert!(
        store.get(&Connection::Local).is_some(),
        "stored tokens kept"
    );
    Ok(())
}

#[tokio::test]
async fn tokens_that_cannot_be_stored_fail_the_sign_in() -> TestResult {
    let engine = Engine::open().await?;
    let client = engine.client(MemoryStore::failing());
    let result = client.sign_up("ada", "ada@example.com", "password1").await;
    assert!(
        matches!(result, Err(ClientError::Storage(_))),
        "storage failure: {result:?}"
    );
    assert!(!client.signed_in(), "nothing kept");
    Ok(())
}
