//! `ReqwestTransport` against a real HTTP server on the loopback interface.

use std::error::Error;

use axum::Router;
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use futures::StreamExt;
use lemma_adapter::{HttpTransport, ReqwestTransport};
use serde_json::{Value, json};
use tokio::net::TcpListener;

async fn serve(router: Router) -> Result<String, Box<dyn Error>> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let address = listener.local_addr()?;
    tokio::spawn(async move { axum::serve(listener, router).await });
    Ok(format!("http://{address}"))
}

async fn echo_stream(headers: HeaderMap, body: String) -> (StatusCode, String) {
    if headers.get("x-api-key").is_none_or(|key| key != "key") {
        return (StatusCode::UNAUTHORIZED, "missing key".to_owned());
    }
    (StatusCode::OK, format!("data: {body}\n\n"))
}

fn key() -> Vec<(String, String)> {
    vec![("x-api-key".to_owned(), "key".to_owned())]
}

#[tokio::test]
async fn a_post_streams_the_response_body_of_a_success() -> Result<(), Box<dyn Error>> {
    let base = serve(Router::new().route("/stream", post(echo_stream))).await?;

    let mut stream = ReqwestTransport::new()
        .post_stream(format!("{base}/stream"), key(), json!({ "model": "m" }))
        .await?;
    let mut body = Vec::new();
    while let Some(chunk) = stream.next().await {
        body.extend(chunk?);
    }

    assert_eq!(
        String::from_utf8(body)?,
        "data: {\"model\":\"m\"}\n\n",
        "streamed body, echoing the JSON request with its headers accepted"
    );
    Ok(())
}

#[tokio::test]
async fn an_error_status_fails_with_the_status_and_body() -> Result<(), Box<dyn Error>> {
    let base = serve(Router::new().route("/stream", post(echo_stream))).await?;

    let result = ReqwestTransport::new()
        .post_stream(format!("{base}/stream"), Vec::new(), json!({}))
        .await;

    let Err(error) = result else {
        return Err("a rejected request streamed".into());
    };
    assert_eq!(error.message, "upstream 401: missing key", "error");
    Ok(())
}

#[tokio::test]
async fn a_get_returns_the_json_body() -> Result<(), Box<dyn Error>> {
    let router = Router::new().route(
        "/models",
        get(|headers: HeaderMap| async move {
            let key = headers
                .get("x-api-key")
                .and_then(|v| v.to_str().ok())
                .unwrap_or_default()
                .to_owned();
            axum::Json(json!({ "key": key }))
        }),
    );
    let base = serve(router).await?;

    let body: Value = ReqwestTransport::new()
        .get_json(format!("{base}/models"), key())
        .await?;

    assert_eq!(body, json!({ "key": "key" }), "body");
    Ok(())
}

#[tokio::test]
async fn a_get_of_a_body_that_is_not_json_fails() -> Result<(), Box<dyn Error>> {
    let base = serve(Router::new().route("/models", get(|| async { "<html>" }))).await?;

    let result = ReqwestTransport::new()
        .get_json(format!("{base}/models"), Vec::new())
        .await;

    let Err(error) = result else {
        return Err("an HTML body parsed as JSON".into());
    };
    assert!(error.message.starts_with("transport: "), "{error}");
    Ok(())
}

#[tokio::test]
async fn an_unreachable_server_fails_as_a_transport_error() -> Result<(), Box<dyn Error>> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let address = listener.local_addr()?;
    drop(listener);

    let result = ReqwestTransport::new()
        .post_stream(format!("http://{address}/stream"), Vec::new(), json!({}))
        .await;

    let Err(error) = result else {
        return Err("a closed port accepted the request".into());
    };
    assert!(error.message.starts_with("transport: "), "{error}");
    Ok(())
}
