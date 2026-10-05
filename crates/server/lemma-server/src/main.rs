//! The Lemma server binary: wires the domain services into a Connect
//! router. Serves the embedded web build; with `LEMMA_LOCAL_MODE` set it
//! runs as the embedded desktop engine over loopback instead.

mod config;
mod local;
mod routes;
mod state;
mod web;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    if std::env::var_os("LEMMA_LOCAL_MODE").is_some() {
        run_local().await
    } else {
        run_server().await
    }
}

/// Server mode: PostgreSQL or SQLite by `DATABASE_URL`, fixed port 1025.
async fn run_server() -> Result<(), Box<dyn std::error::Error>> {
    let config = config::Config::from_env()?;
    let state = state::AppState::new(config).await?;

    let app = routes::router(&state)
        .fallback(web::handler)
        .layer(cors_layer());

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
    state.close().await;
    Ok(())
}

/// Local engine mode: SQLite and engine-managed secrets under
/// `LEMMA_DATA_DIR`, loopback-only with an ephemeral port. Readiness and
/// the default account credentials are announced on stdout.
async fn run_local() -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = std::env::var("LEMMA_DATA_DIR")
        .map_err(|_| "LEMMA_DATA_DIR is required when LEMMA_LOCAL_MODE is set")?;
    let data_dir = std::path::PathBuf::from(data_dir);
    let state = state::AppState::local(&data_dir).await?;

    if let Some(store) = &state.local_auth_store {
        let secrets = state.local_secrets.as_ref().ok_or("local secrets missing")?;
        let service = lemma_auth::AuthService::new(store.clone(), secrets.jwt_secret.as_str());
        local::ensure_default_account(store.as_ref(), &service).await?;
    }

    let app = routes::router(&state)
        .fallback(web::handler)
        .layer(cors_layer());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    local::print_ready(&local::ReadyPayload {
        port: listener.local_addr()?.port(),
        default_username: local::DEFAULT_USERNAME.to_owned(),
        default_password: local::DEFAULT_PASSWORD.to_owned(),
    });
    axum::serve(listener, app)
        .with_graceful_shutdown(local_shutdown())
        .await?;
    state.close().await;
    Ok(())
}

/// The desktop shell loads its UI from file://, so its API calls arrive
/// cross-origin (Origin: null). Auth is Bearer-only with no cookies, so
/// an open CORS policy does not weaken browser security.
fn cors_layer() -> tower_http::cors::CorsLayer {
    tower_http::cors::CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any)
}

/// The local engine lives exactly as long as its parent: it exits when
/// stdin closes (the parent died) or on Ctrl-C during development.
async fn local_shutdown() {
    let mut stdin = tokio::io::stdin();
    let mut sink = Vec::new();
    tokio::select! {
        _ = tokio::io::AsyncReadExt::read_to_end(&mut stdin, &mut sink) => {}
        _ = shutdown_signal() => {}
    }
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
        return Ok(());
    }

    #[cfg(not(unix))]
    ctrl_c.await
}
