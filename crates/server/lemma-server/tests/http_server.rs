//! The HTTP application over a stub API and the web build in `web/dist`.

use std::error::Error;
use std::fs;
use std::path::Path;

use axum::Router;
use axum::body::{Body, to_bytes};
use axum::http::{HeaderName, Request, Response, StatusCode, header};
use axum::routing::post;
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tower::ServiceExt;

const API: &str = "/lemma.v1.SystemService/GetVersion";

fn api() -> Router {
    Router::new().route(API, post(|| async { "api" }))
}

async fn send(request: Request<Body>) -> Result<Response<Body>, Box<dyn Error>> {
    Ok(lemma_server::app(api()).oneshot(request).await?)
}

async fn get(uri: &str) -> Result<Response<Body>, Box<dyn Error>> {
    send(Request::get(uri).body(Body::empty())?).await
}

fn header_of(response: &Response<Body>, name: HeaderName) -> Option<&str> {
    response
        .headers()
        .get(name)
        .and_then(|value| value.to_str().ok())
}

#[tokio::test]
async fn the_root_serves_the_index_without_caching() -> Result<(), Box<dyn Error>> {
    let response = get("/").await?;

    assert_eq!(response.status(), StatusCode::OK, "status");
    assert_eq!(
        header_of(&response, header::CACHE_CONTROL),
        Some("no-cache"),
        "cache-control"
    );
    assert!(
        header_of(&response, header::CONTENT_TYPE).is_some_and(|t| t.starts_with("text/html")),
        "{:?}",
        response.headers()
    );
    Ok(())
}

#[tokio::test]
async fn hashed_assets_are_cached_as_immutable() -> Result<(), Box<dyn Error>> {
    let assets = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../web/dist/assets");
    let asset = fs::read_dir(assets)?
        .next()
        .ok_or("web/dist/assets is empty")??
        .file_name();
    let asset = asset.to_str().ok_or("the asset name is not UTF-8")?;

    let response = get(&format!("/assets/{asset}")).await?;

    assert_eq!(response.status(), StatusCode::OK, "status");
    assert_eq!(
        header_of(&response, header::CACHE_CONTROL),
        Some("public, max-age=31536000, immutable"),
        "cache-control"
    );
    Ok(())
}

#[tokio::test]
async fn a_client_route_falls_back_to_the_index() -> Result<(), Box<dyn Error>> {
    let index = to_bytes(get("/").await?.into_body(), usize::MAX).await?;

    let route = get("/conversations/42").await?;

    assert_eq!(route.status(), StatusCode::OK, "status");
    assert_eq!(
        to_bytes(route.into_body(), usize::MAX).await?,
        index,
        "body"
    );
    Ok(())
}

#[tokio::test]
async fn a_missing_file_is_not_found() -> Result<(), Box<dyn Error>> {
    let response = get("/missing.png").await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND, "status");
    Ok(())
}

#[tokio::test]
async fn api_routes_answer_before_the_web_build_for_any_origin() -> Result<(), Box<dyn Error>> {
    let response = send(
        Request::post(API)
            .header(header::ORIGIN, "https://app.example.com")
            .body(Body::empty())?,
    )
    .await?;

    assert_eq!(
        header_of(&response, header::ACCESS_CONTROL_ALLOW_ORIGIN),
        Some("*"),
        "allow-origin"
    );
    assert_eq!(
        to_bytes(response.into_body(), usize::MAX).await?,
        "api",
        "body"
    );
    Ok(())
}

#[tokio::test]
async fn serve_answers_until_shutdown() -> Result<(), Box<dyn Error>> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let address = listener.local_addr()?;
    let (stop, stopped) = oneshot::channel::<()>();
    let server = tokio::spawn(lemma_server::serve(listener, api(), async {
        stopped.await.ok();
    }));

    let body = reqwest::Client::new()
        .post(format!("http://{address}{API}"))
        .send()
        .await?
        .text()
        .await?;
    stop.send(()).map_err(|()| "the server stopped early")?;

    assert_eq!(body, "api", "body");
    server.await??;
    Ok(())
}
