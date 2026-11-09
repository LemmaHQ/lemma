//! Connections to a server over HTTP: the URL check, the version gate, and
//! calls with per-connection tokens.

mod common;

use axum::Router;
use axum::response::IntoResponse;
use axum::routing::post;
use buffa::Message;
use common::{Engine, MemoryStore, TestResult, serve};
use lemma_client::{Client, ClientError, Connection};
use lemma_proto::lemma::v1::GetVersionResponse;

#[tokio::test]
async fn a_server_of_the_same_version_serves_the_calls() -> TestResult {
    let engine = Engine::open().await?;
    let url = serve(engine.router()).await?;
    let store = MemoryStore::default();
    let client = Client::remote(&format!(" {url}/ "), store.clone()).await?;

    let connection = Connection::Remote(url);
    assert_eq!(client.connection(), &connection, "normalized URL");
    assert_eq!(
        client.server_version().await?,
        env!("CARGO_PKG_VERSION"),
        "same version"
    );
    client
        .sign_up("ada", "ada@example.com", "password1")
        .await?;
    assert!(
        store.get(&connection).is_some(),
        "tokens kept under the remote connection"
    );
    assert!(
        store.get(&Connection::Local).is_none(),
        "local tokens untouched"
    );
    assert!(
        client.list_sessions().await?.is_empty(),
        "authorized over HTTP"
    );
    Ok(())
}

#[tokio::test]
async fn a_server_of_another_version_is_refused() -> TestResult {
    let version = GetVersionResponse {
        version: "0.0.1".to_owned(),
        ..Default::default()
    };
    let body = version.encode_to_vec();
    let router = Router::new().route(
        "/lemma.v1.SystemService/GetVersion",
        post(
            move || async move { ([("content-type", "application/proto")], body).into_response() },
        ),
    );
    let url = serve(router).await?;

    let result = Client::remote(&url, MemoryStore::default()).await;
    assert!(
        matches!(&result, Err(ClientError::VersionMismatch { server, client }) if server == "0.0.1" && client == env!("CARGO_PKG_VERSION")),
        "versions reported: {result:?}"
    );
    Ok(())
}

#[tokio::test]
async fn unreachable_and_invalid_servers_are_reported() -> TestResult {
    for url in ["http://127.0.0.1:1", "https://127.0.0.1:1"] {
        let result = Client::remote(url, MemoryStore::default()).await;
        assert!(
            matches!(result, Err(ClientError::Network)),
            "{url} unreachable: {result:?}"
        );
    }
    let result = Client::remote("lemma.example", MemoryStore::default()).await;
    assert!(
        matches!(result, Err(ClientError::UrlInvalid)),
        "no scheme: {result:?}"
    );
    Ok(())
}
