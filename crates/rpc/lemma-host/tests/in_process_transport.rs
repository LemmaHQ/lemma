//! Requests through `InProcessTransport` against a real local engine, and
//! response bodies that fail while streaming.

use std::env;
use std::error::Error;
use std::fs;
use std::io;
use std::path::PathBuf;

use axum::Router;
use axum::body::{Body, Bytes};
use axum::http::Method;
use axum::routing::get;
use futures::stream;
use lemma_host::{InProcessTransport, InProcessTransportError, LocalEngine};
use uuid::Uuid;

struct DataDir(PathBuf);

impl DataDir {
    fn new() -> Self {
        Self(env::temp_dir().join(format!("lemma-host-test-{}", Uuid::new_v4())))
    }
}

impl Drop for DataDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn json_headers() -> Vec<(String, String)> {
    vec![("content-type".to_owned(), "application/json".to_owned())]
}

async fn read_to_end(
    transport: &InProcessTransport,
    body: u32,
) -> Result<Vec<u8>, InProcessTransportError> {
    let mut out = Vec::new();
    while let Some(chunk) = transport.read(body).await? {
        out.extend_from_slice(&chunk);
    }
    Ok(out)
}

#[tokio::test]
async fn sign_up_returns_the_response_and_closes_the_body_at_its_end() -> Result<(), Box<dyn Error>>
{
    let dir = DataDir::new();
    let engine = LocalEngine::open(&dir.0).await?;
    let transport = InProcessTransport::new(engine.router());

    let head = transport
        .request(
            "POST",
            "/lemma.v1.AuthService/SignUp",
            &json_headers(),
            br#"{"username":"ada","email":"ada@example.com","password":"correct-horse"}"#.to_vec(),
        )
        .await?;
    let body: serde_json::Value =
        serde_json::from_slice(&read_to_end(&transport, head.body).await?)?;

    assert_eq!(head.status, 200, "sign-up status");
    assert!(
        head.headers
            .iter()
            .any(|(name, value)| name == "content-type" && value == "application/json"),
        "content type in {:?}",
        head.headers
    );
    assert_eq!(body["user"]["username"], "ada", "signed-up user");
    let closed = transport.read(head.body).await;
    assert_eq!(
        closed,
        Err(InProcessTransportError::UnknownBody(head.body)),
        "a finished body is closed"
    );
    assert!(
        closed.is_err_and(|e| e.to_string().contains(&head.body.to_string())),
        "the error names the body id"
    );
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn cancel_closes_an_unread_body() -> Result<(), Box<dyn Error>> {
    let dir = DataDir::new();
    let engine = LocalEngine::open(&dir.0).await?;
    let transport = InProcessTransport::new(engine.router());

    let head = transport
        .request(
            "POST",
            "/lemma.v1.ProviderService/ListProviders",
            &json_headers(),
            b"{}".to_vec(),
        )
        .await?;
    transport.cancel(head.body);

    assert_eq!(head.status, 401, "unauthenticated status");
    assert_eq!(
        transport.read(head.body).await,
        Err(InProcessTransportError::UnknownBody(head.body)),
        "a cancelled body is closed"
    );
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn an_invalid_method_fails_before_reaching_the_router() -> Result<(), Box<dyn Error>> {
    let dir = DataDir::new();
    let engine = LocalEngine::open(&dir.0).await?;
    let transport = InProcessTransport::new(engine.router());

    let result = transport
        .request(
            "NOT A METHOD",
            "/lemma.v1.AuthService/Login",
            &[],
            Vec::new(),
        )
        .await;

    let method_error = Method::from_bytes(b"NOT A METHOD")
        .err()
        .ok_or("the method parses")?
        .to_string();
    assert!(
        matches!(&result, Err(e @ InProcessTransportError::InvalidRequest(_)) if e.to_string().contains(&method_error)),
        "{result:?}"
    );
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn a_failing_body_reports_its_error_and_closes() -> Result<(), Box<dyn Error>> {
    let router = Router::new().route(
        "/",
        get(|| async {
            Body::from_stream(stream::iter([
                Ok(Bytes::from_static(b"first")),
                Err(io::Error::other("connection reset")),
            ]))
        }),
    );
    let transport = InProcessTransport::new(router);

    let head = transport.request("GET", "/", &[], Vec::new()).await?;
    let first = transport.read(head.body).await?;
    let failed = transport.read(head.body).await;

    assert_eq!(
        first,
        Some(Bytes::from_static(b"first")),
        "chunk before the failure"
    );
    assert!(
        matches!(&failed, Err(e @ InProcessTransportError::Body(_)) if e.to_string().contains("connection reset")),
        "{failed:?}"
    );
    assert_eq!(
        transport.read(head.body).await,
        Err(InProcessTransportError::UnknownBody(head.body)),
        "a failed body is closed"
    );
    Ok(())
}
