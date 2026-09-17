//! The Lemma server binary: wires the domain services into a Connect
//! router and serves the embedded web build.

mod config;
mod routes;
mod state;
mod web;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let config = config::Config::from_env()?;
    let state = state::AppState::new(config).await?;

    // The desktop shell loads its UI from file://, so its API calls arrive
    // cross-origin (Origin: null). Auth is Bearer-only with no cookies, so
    // an open CORS policy does not weaken browser security.
    let app = routes::router(&state).fallback(web::handler).layer(
        tower_http::cors::CorsLayer::new()
            .allow_origin(tower_http::cors::Any)
            .allow_methods(tower_http::cors::Any)
            .allow_headers(tower_http::cors::Any),
    );

    let listener = tokio::net::TcpListener::bind("0.0.0.0:1025").await?;
    println!("listening on {}", listener.local_addr()?);
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            match shutdown_signal().await {
                Ok(()) => println!("shutting down"),
                Err(e) => eprintln!("shutdown signal error: {e}"),
            }
        })
        .await?;
    state.pool.close().await;
    Ok(())
}

async fn shutdown_signal() -> std::io::Result<()> {
    let ctrl_c = tokio::signal::ctrl_c();

    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
        tokio::select! {
            result = ctrl_c => result?,
            _ = terminate.recv() => {},
        }
        Ok(())
    }

    #[cfg(not(unix))]
    ctrl_c.await
}
