//! Serving the Connect router and the embedded web build.

use std::io;

use axum::Router;
use tokio::net::TcpListener;
use tokio::signal;
use tower_http::cors::{Any, CorsLayer};

use crate::web;

/// Serves `api` with the web build as fallback until `shutdown` completes.
pub async fn serve(
    listener: TcpListener,
    api: Router,
    shutdown: impl Future<Output = ()> + Send + 'static,
) -> io::Result<()> {
    let app = api.fallback(web::handler).layer(cors_layer());
    axum::serve(listener, app)
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

/// Completes on Ctrl-C, or on SIGTERM where signals exist.
#[cfg(unix)]
pub async fn shutdown_signal() -> io::Result<()> {
    use tokio::signal::unix::{self, SignalKind};

    let mut terminate = unix::signal(SignalKind::terminate())?;
    tokio::select! {
        result = signal::ctrl_c() => result,
        _ = terminate.recv() => Ok(()),
    }
}

/// Completes on Ctrl-C, or on SIGTERM where signals exist.
#[cfg(not(unix))]
pub async fn shutdown_signal() -> io::Result<()> {
    signal::ctrl_c().await
}
