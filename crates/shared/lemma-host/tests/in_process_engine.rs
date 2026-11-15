//! `InProcessEngine` lifecycle, request/read/cancel forwarding, and
//! idempotent close.

mod common;

use std::error::Error;
use std::fs;

use common::DataDir;
use lemma_host::{InProcessEngine, InProcessTransportError, LocalEngineError};
use serde_json::Value;

fn json_headers() -> Vec<(String, String)> {
    vec![("content-type".to_owned(), "application/json".to_owned())]
}

async fn read_to_end(
    engine: &InProcessEngine,
    body: u32,
) -> Result<Vec<u8>, InProcessTransportError> {
    let mut out = Vec::new();
    while let Some(chunk) = engine.read(body).await? {
        out.extend_from_slice(&chunk);
    }
    Ok(out)
}

#[tokio::test]
async fn in_process_engine_opens_serves_cancels_and_closes_idempotently()
-> Result<(), Box<dyn Error>> {
    let dir = DataDir::new();
    let engine = InProcessEngine::open(&dir.0).await?;

    let created = engine
        .request(
            "POST",
            "/lemma.v1.SessionService/CreateSession",
            &json_headers(),
            b"{}".to_vec(),
        )
        .await?;
    assert_eq!(created.status, 200, "create status: {created:?}");
    let bytes = read_to_end(&engine, created.body).await?;
    let body: Value = serde_json::from_slice(&bytes)?;
    assert!(
        body["session"]["id"].is_string(),
        "created session id in {body:?}"
    );

    let to_cancel = engine
        .request(
            "POST",
            "/lemma.v1.SessionService/ListSessions",
            &json_headers(),
            b"{}".to_vec(),
        )
        .await?;
    engine.cancel(to_cancel.body);
    let cancelled = engine.read(to_cancel.body).await;
    assert!(
        matches!(cancelled, Err(InProcessTransportError::UnknownBody(id)) if id == to_cancel.body),
        "cancelled body read: {cancelled:?}"
    );

    let bad_request = engine
        .request("GET ", "/lemma.v1.SessionService/ListSessions", &[], vec![])
        .await;
    assert!(
        matches!(bad_request, Err(InProcessTransportError::InvalidRequest(_))),
        "invalid method: {bad_request:?}"
    );

    let unknown_body = engine.read(99_999).await;
    assert!(
        matches!(
            unknown_body,
            Err(InProcessTransportError::UnknownBody(99_999))
        ),
        "unknown body: {unknown_body:?}"
    );

    engine.close().await;
    engine.close().await;

    let after_close = engine
        .request(
            "POST",
            "/lemma.v1.SessionService/ListSessions",
            &json_headers(),
            b"{}".to_vec(),
        )
        .await?;
    assert_eq!(after_close.status, 500, "closed db returns 500");
    Ok(())
}

#[tokio::test]
async fn in_process_engine_open_surfaces_startup_errors() -> Result<(), Box<dyn Error>> {
    let dir = DataDir::new();
    fs::write(&dir.0, "")?;

    let err = InProcessEngine::open(&dir.0).await.err();
    fs::remove_file(&dir.0)?;

    assert!(
        matches!(err, Some(LocalEngineError::Secrets(_))),
        "expected secrets error, got {err:?}"
    );
    Ok(())
}
