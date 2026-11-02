//! Serving the Connect router and the embedded web build.

use std::io;

use axum::Router;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};

use crate::web;

/// Wraps `api` with the web build as fallback and an open CORS policy.
pub fn app(api: Router) -> Router {
    api.fallback(web::handler).layer(cors_layer())
}

/// Serves [`app`] of `api` on `listener` until `shutdown` completes.
///
/// # Errors
///
/// The I/O error that ends the server.
pub async fn serve(
    listener: TcpListener,
    api: Router,
    shutdown: impl Future<Output = ()> + Send + 'static,
) -> io::Result<()> {
    axum::serve(listener, app(api))
        .with_graceful_shutdown(shutdown)
        .await
}

/// Browser clients may load the web build from another origin and point
/// it at this server. Auth relies on Bearer tokens there, preserving
/// browser security under an open CORS policy.
fn cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
}
