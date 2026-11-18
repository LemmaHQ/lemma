//! Serving the Connect router and the embedded web build.

use std::io;

use axum::Router;
use tokio::net::TcpListener;

use crate::web;

/// Wraps `api` with the web build as fallback.
pub fn app(api: Router) -> Router {
    api.fallback(web::handler)
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
