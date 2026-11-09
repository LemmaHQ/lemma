//! A local engine over a temporary data directory, an OpenAI-compatible
//! vendor on the loopback interface, and an in-memory token store.

#![allow(dead_code)]

use std::collections::HashMap;
use std::env;
use std::error::Error;
use std::fs;
use std::io;
use std::mem;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use axum::Router;
use axum::body::{Body, BodyDataStream, Bytes};
use axum::extract::Request;
use axum::http::StatusCode;
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use futures::{Stream, StreamExt, stream};
use lemma_client::{Client, Connection, TokenPair, TokenStore};
use lemma_host::LocalEngine;
use lemma_proto::lemma::v1::{CreateProviderRequest, ProviderKind};
use serde_json::{Value, json};
use tokio::net::TcpListener;
use uuid::Uuid;

#[cfg(windows)]
const WAIT_FOR_GO: &str = "for /L %i in (1,1,60) do @if not exist go ping -n 2 127.0.0.1 >nul";
#[cfg(not(windows))]
const WAIT_FOR_GO: &str =
    "i=0; while [ ! -e go ] && [ $i -lt 600 ]; do sleep 0.1; i=$((i+1)); done";

pub type TestResult = Result<(), Box<dyn Error>>;

/// Token storage in memory; `failing` stores make every write fail.
#[derive(Clone, Default)]
pub struct MemoryStore {
    pairs: Arc<Mutex<HashMap<Connection, TokenPair>>>,
    failing: bool,
}

impl MemoryStore {
    pub fn failing() -> Self {
        Self {
            failing: true,
            ..Self::default()
        }
    }

    pub fn with(connection: &Connection, pair: TokenPair) -> Self {
        let store = Self::default();
        store.lock().insert(connection.clone(), pair);
        store
    }

    pub fn get(&self, connection: &Connection) -> Option<TokenPair> {
        self.lock().get(connection).cloned()
    }

    fn lock(&self) -> MutexGuard<'_, HashMap<Connection, TokenPair>> {
        self.pairs.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn check(&self) -> io::Result<()> {
        if self.failing {
            return Err(io::Error::other("disk full"));
        }
        Ok(())
    }
}

impl TokenStore for MemoryStore {
    fn load(&self, connection: &Connection) -> Option<TokenPair> {
        self.get(connection)
    }

    fn save(&self, connection: &Connection, tokens: &TokenPair) -> io::Result<()> {
        self.check()?;
        self.lock().insert(connection.clone(), tokens.clone());
        Ok(())
    }

    fn clear(&self, connection: &Connection) -> io::Result<()> {
        self.check()?;
        self.lock().remove(connection);
        Ok(())
    }
}

/// A local engine over a data directory removed on drop.
pub struct Engine {
    pub local: LocalEngine,
    pub dir: PathBuf,
}

impl Engine {
    pub async fn open() -> Result<Self, Box<dyn Error>> {
        let dir = env::temp_dir().join(format!("lemma-client-test-{}", Uuid::new_v4()));
        let local = LocalEngine::open(&dir).await?;
        Ok(Self { local, dir })
    }

    pub fn router(&self) -> Router {
        self.local.router()
    }

    pub fn client(&self, store: MemoryStore) -> Client<MemoryStore> {
        Client::local(self.router(), store)
    }

    /// Signs up `name` on a fresh client and returns it with the issued tokens.
    pub async fn signed_up(
        &self,
        name: &str,
    ) -> Result<(Client<MemoryStore>, TokenPair), Box<dyn Error>> {
        let store = MemoryStore::default();
        let client = self.client(store.clone());
        client
            .sign_up(name, &format!("{name}@example.com"), "password1")
            .await?;
        let pair = store
            .get(&Connection::Local)
            .ok_or("no tokens after sign-up")?;
        Ok((client, pair))
    }

    /// Lets the `wait` model's tool finish in the session's workspace.
    pub fn release(&self, session_id: &str) -> io::Result<()> {
        let workspace = self.dir.join("workspaces").join(session_id);
        fs::create_dir_all(&workspace)?;
        fs::write(workspace.join("go"), "")
    }
}

impl Drop for Engine {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.dir);
    }
}

pub async fn serve(router: Router) -> Result<String, Box<dyn Error>> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let address = listener.local_addr()?;
    tokio::spawn(async move { axum::serve(listener, router).await });
    Ok(format!("http://{address}"))
}

/// Serves an OpenAI-compatible vendor and returns a provider request for it.
pub async fn vendor() -> Result<CreateProviderRequest, Box<dyn Error>> {
    let router = Router::new()
        .route("/v1/chat/completions", post(completions))
        .route(
            "/v1/models",
            get(|| async { axum::Json(json!({ "data": [{ "id": "answer" }, { "id": "wait" }] })) }),
        );
    let base_url = serve(router).await?;
    Ok(CreateProviderRequest {
        kind: ProviderKind::Openai.into(),
        identifier: "vendor".to_owned(),
        name: "Vendor".to_owned(),
        base_url: format!("{base_url}/v1"),
        api_key: "sk-1".to_owned(),
        models: vec!["answer".to_owned(), "wait".to_owned()],
        ..Default::default()
    })
}

async fn completions(axum::Json(request): axum::Json<Value>) -> Response {
    let answered = request["messages"]
        .as_array()
        .is_some_and(|messages| messages.iter().any(|m| m["role"] == "tool"));
    match request["model"].as_str().unwrap_or_default() {
        "answer" => sse(&[
            delta(&json!({ "reasoning_content": "thinking it over" })),
            delta(&json!({ "content": "pong" })),
            finish("stop"),
        ]),
        "wait" if answered => sse(&[delta(&json!({ "content": "released" })), finish("stop")]),
        "wait" => sse(&[
            delta(&json!({ "tool_calls": [{
                "index": 0,
                "id": "w1",
                "function": { "name": "bash", "arguments": json!({ "command": WAIT_FOR_GO }).to_string() },
            }] })),
            finish("tool_calls"),
        ]),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, "boom").into_response(),
    }
}

fn sse(chunks: &[Value]) -> Response {
    let mut body: String = chunks
        .iter()
        .map(|chunk| format!("data: {chunk}\n\n"))
        .collect();
    body.push_str("data: [DONE]\n\n");
    body.into_response()
}

fn delta(delta: &Value) -> Value {
    json!({ "choices": [{ "delta": delta }] })
}

fn finish(reason: &str) -> Value {
    json!({ "choices": [{ "delta": {}, "finish_reason": reason }] })
}

/// Wraps `router` so responses of the RPC whose path ends with `path` break after their first `keep` messages.
pub fn breaking(router: Router, path: &'static str, keep: usize) -> Router {
    router.layer(middleware::from_fn(
        move |request: Request, next: Next| async move {
            let cut = request.uri().path().ends_with(path);
            let response = next.run(request).await;
            if !cut {
                return response;
            }
            let (parts, body) = response.into_parts();
            let cut = envelopes(body.into_data_stream())
                .take(keep)
                .map(Ok)
                .chain(stream::once(async {
                    Err(axum::Error::new(io::Error::other("cut")))
                }));
            Response::from_parts(parts, Body::from_stream(cut))
        },
    ))
}

/// Splits a Connect streaming body into its envelopes, each a flag byte, a big-endian length, and that many bytes.
fn envelopes(body: BodyDataStream) -> impl Stream<Item = Bytes> {
    stream::unfold((body, Vec::new()), |(mut body, mut buffer)| async move {
        loop {
            let end = buffer
                .get(1..5)
                .and_then(|length| <[u8; 4]>::try_from(length).ok())
                .and_then(|length| usize::try_from(u32::from_be_bytes(length)).ok())
                .map(|length| 5 + length);
            if let Some(end) = end
                && buffer.len() >= end
            {
                let rest = buffer.split_off(end);
                let envelope = Bytes::from(mem::replace(&mut buffer, rest));
                return Some((envelope, (body, buffer)));
            }
            match body.next().await {
                Some(Ok(chunk)) => buffer.extend_from_slice(&chunk),
                Some(Err(_)) | None => return None,
            }
        }
    })
}

/// Wraps `router` so the RPC whose path ends with `path` fails with HTTP 503 before reaching the host.
pub fn refusing(router: Router, path: &'static str) -> Router {
    router.layer(middleware::from_fn(
        move |request: Request, next: Next| async move {
            if !request.uri().path().ends_with(path) {
                return next.run(request).await;
            }
            (
                StatusCode::SERVICE_UNAVAILABLE,
                [("content-type", "application/json")],
                r#"{"code":"unavailable","message":"down"}"#,
            )
                .into_response()
        },
    ))
}
