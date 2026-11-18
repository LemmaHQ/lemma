//! Serves the web build embedded at compile time.

use axum::{
    body::Body,
    http::{Response, StatusCode, Uri, header},
    response::IntoResponse,
};

use crate::web_dist::WebDist;

pub async fn handler(uri: Uri) -> Response<Body> {
    let path = uri.path().trim_start_matches('/');
    serve(if path.is_empty() { "index.html" } else { path })
}

fn serve(path: &str) -> Response<Body> {
    match WebDist::get(path) {
        Some(file) => (
            [
                (header::CONTENT_TYPE, file.metadata.mimetype()),
                (
                    header::CACHE_CONTROL,
                    if path.starts_with("assets/") {
                        "public, max-age=31536000, immutable"
                    } else {
                        "no-cache"
                    },
                ),
            ],
            Body::from(file.data),
        )
            .into_response(),
        None if !path.contains('.') => serve("index.html"),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}
