//! A Lemma window over a local engine in a temporary data directory, and an
//! OpenAI-compatible vendor on the loopback interface.

#![allow(dead_code)]

use std::collections::HashMap;
use std::error::Error;
use std::fs;
use std::io;
use std::path::Path;
use std::sync::{Mutex, PoisonError};
use std::thread;
use std::time::Duration;

use axum::Router;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use gpui_kit::test::{TestQueryExt, TestWindowExt};
use gpui_kit::{
    AnyWindowHandle, App, AppContext, Bounds, Point, SharedString, TestAppContext, Window,
    WindowBounds, WindowOptions, px, size,
};
use lemma_client::{Client, Connection, TokenPair, TokenStore};
use lemma_desktop::{EngineRuntime, InterfaceLanguage, Language, LemmaApp};
use lemma_host::LocalEngine;
use lemma_proto::lemma::v1::{CreateProviderRequest, ProviderKind};
use serde_json::{Value, json};
use tempfile::TempDir;
use tokio::net::TcpListener;
use tokio::runtime::Runtime;
use tokio::time;

pub const USERNAME: &str = "ada";
pub const PASSWORD: &str = "password1";

/// What the data directory holds before the window opens.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Seed {
    /// A fresh engine.
    Empty,
    /// The account `ada` with a session titled `Plans` and an OpenAI-compatible provider of the model `answer`.
    Account,
    /// The account `ada` with a session titled `Plans` and no provider.
    AccountWithoutProvider,
}

/// An open Lemma window and the services behind it.
pub struct Desktop {
    pub window: AnyWindowHandle,
    pub dir: TempDir,
    _services: Runtime,
}

type Outcome<T> = Result<T, Box<dyn Error>>;

impl Desktop {
    /// A window in English over a data directory holding `seed`.
    pub fn open(cx: &mut TestAppContext, seed: Seed) -> Self {
        Self::open_in(cx, seed, Language::En)
    }

    /// A window in `language` over a data directory holding `seed`.
    pub fn open_in(cx: &mut TestAppContext, seed: Seed, language: Language) -> Self {
        let opened = TempDir::new().map_err(Box::from).and_then(|dir| {
            let services = Runtime::new()?;
            if seed != Seed::Empty {
                services.block_on(seed_account(dir.path(), seed == Seed::Account))?;
            }
            let window = open_window(cx, dir.path(), language)?;
            Ok(Self {
                window,
                dir,
                _services: services,
            })
        });
        opened.unwrap_or_else(|error: Box<dyn Error>| panic!("open the desktop: {error}"))
    }

    /// A window whose engine opens at `data_dir`.
    pub fn open_at(cx: &mut TestAppContext, data_dir: &Path) -> Self {
        let opened = open_window(cx, data_dir, Language::En).and_then(|window| {
            Ok(Self {
                window,
                dir: TempDir::new()?,
                _services: Runtime::new()?,
            })
        });
        opened.unwrap_or_else(|error| panic!("open the desktop: {error}"))
    }

    /// The ids of the sessions whose tools ran, from their workspace directories.
    pub fn session_ids(&self) -> Vec<String> {
        let entries = fs::read_dir(self.dir.path().join("workspaces"));
        entries
            .into_iter()
            .flatten()
            .flatten()
            .filter_map(|entry| entry.file_name().into_string().ok())
            .collect()
    }

    /// Runs `check` on fresh frames until it holds, letting the engine's real I/O progress.
    pub fn wait_until(
        &self,
        cx: &mut TestAppContext,
        what: &str,
        mut check: impl FnMut(&mut Window, &mut App) -> bool,
    ) {
        for _ in 0..1000 {
            cx.run_until_parked();
            let done = cx.update_window(self.window, |_, window, cx| {
                window.render_frame(cx);
                check(window, cx)
            });
            if done.unwrap_or(false) {
                return;
            }
            thread::sleep(Duration::from_millis(10));
        }
        panic!("timed out waiting for {what}");
    }

    /// Waits until the element `id` is shown.
    pub fn wait_for(&self, cx: &mut TestAppContext, id: &str) {
        let target = SharedString::from(id.to_owned());
        self.wait_until(cx, id, |window, _| {
            window.try_find(target.clone()).is_some()
        });
    }

    /// Waits until an element labelled `label` is shown.
    pub fn wait_for_label(&self, cx: &mut TestAppContext, label: &str) {
        self.wait_until(cx, label, |window, _| {
            window.try_find_by_label(label).is_some()
        });
    }

    /// Runs `act` on the window, then lets the effects it queued settle.
    pub fn act<R>(
        &self,
        cx: &mut TestAppContext,
        act: impl FnOnce(&mut Window, &mut App) -> R,
    ) -> R {
        let result = cx.update_window(self.window, |_, window, cx| {
            window.render_frame(cx);
            act(window, cx)
        });
        cx.run_until_parked();
        result.unwrap_or_else(|error| panic!("the window closed: {error}"))
    }

    /// Signs in as the seeded account through the sign-in screen.
    pub fn sign_in(&self, cx: &mut TestAppContext) {
        self.wait_for(cx, "identifier");
        self.act(cx, |window, cx| {
            window.click("identifier", cx);
            window.input(USERNAME, cx);
            window.click("submit", cx);
        });
        self.wait_for(cx, "password");
        self.act(cx, |window, cx| {
            window.click("password", cx);
            window.input(PASSWORD, cx);
            window.press("enter", cx);
        });
        self.wait_for(cx, "new-session");
    }
}

fn open_window(
    cx: &mut TestAppContext,
    data_dir: &Path,
    language: Language,
) -> Outcome<AnyWindowHandle> {
    cx.executor().allow_parking();
    let runtime = EngineRuntime::new()?;
    let data_dir = data_dir.to_path_buf();
    let opened = cx.update(|cx| {
        gpui_kit::init(cx);
        cx.set_global(runtime);
        InterfaceLanguage::set(language, cx);
        let options = WindowOptions {
            window_bounds: Some(WindowBounds::Windowed(Bounds::new(
                Point::default(),
                size(px(1100.), px(760.)),
            ))),
            ..Default::default()
        };
        gpui_kit::open_window(options, cx, |window, cx| {
            cx.new(|cx| LemmaApp::new(data_dir, window, cx))
        })
    })?;
    Ok(opened.0)
}

async fn seed_account(dir: &Path, provider: bool) -> Outcome<()> {
    let engine = LocalEngine::open(dir).await?;
    let client = Client::local(engine.router(), SeedStore::default());
    client
        .sign_up(USERNAME, "ada@example.com", PASSWORD)
        .await?;
    let plans = client.create_session().await?;
    client.rename_session(&plans.id, "Plans").await?;
    if provider {
        client.create_provider(vendor().await?).await?;
    }
    engine.close().await?;
    Ok(())
}

/// Serves an OpenAI-compatible vendor and returns a provider request for it.
async fn vendor() -> Outcome<CreateProviderRequest> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let address = listener.local_addr()?;
    let router = Router::new().route("/v1/chat/completions", post(completions));
    tokio::spawn(async move { axum::serve(listener, router).await });
    Ok(CreateProviderRequest {
        kind: ProviderKind::Openai.into(),
        identifier: "vendor".to_owned(),
        name: "Vendor".to_owned(),
        base_url: format!("http://{address}/v1"),
        api_key: "sk-1".to_owned(),
        models: vec!["answer".to_owned()],
        ..Default::default()
    })
}

/// Answers by the last user message: `slow` waits 30 s, `fail` errors, `tool-fails` calls an unknown tool,
/// and anything else thinks, runs `echo ok`, then answers `**pong**` in two pieces.
async fn completions(axum::Json(request): axum::Json<Value>) -> Response {
    let messages = request["messages"].as_array().cloned().unwrap_or_default();
    let prompt = messages
        .iter()
        .rev()
        .find(|message| message["role"] == "user")
        .and_then(|message| message["content"].as_str())
        .unwrap_or_default()
        .to_owned();
    let answered = messages
        .last()
        .is_some_and(|message| message["role"] == "tool");
    let tool = match prompt.as_str() {
        "slow" => {
            time::sleep(Duration::from_secs(30)).await;
            "bash"
        }
        "fail" => return (StatusCode::INTERNAL_SERVER_ERROR, "vendor down").into_response(),
        "tool-fails" => "missing",
        _ => "bash",
    };
    let chunks = if answered {
        vec![
            delta(&json!({ "content": "**po" })),
            delta(&json!({ "content": "ng**" })),
            finish("stop"),
        ]
    } else {
        vec![
            delta(&json!({ "reasoning_content": "thinking it over" })),
            delta(&json!({ "tool_calls": [{
                "index": 0,
                "id": "t1",
                "function": { "name": tool, "arguments": json!({ "command": "echo ok" }).to_string() },
            }] })),
            finish("tool_calls"),
        ]
    };
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

#[derive(Default)]
struct SeedStore {
    pairs: Mutex<HashMap<Connection, TokenPair>>,
}

impl TokenStore for SeedStore {
    fn load(&self, connection: &Connection) -> Option<TokenPair> {
        let pairs = self.pairs.lock().unwrap_or_else(PoisonError::into_inner);
        pairs.get(connection).cloned()
    }

    fn save(&self, connection: &Connection, tokens: &TokenPair) -> io::Result<()> {
        let mut pairs = self.pairs.lock().unwrap_or_else(PoisonError::into_inner);
        pairs.insert(connection.clone(), tokens.clone());
        Ok(())
    }

    fn clear(&self, connection: &Connection) -> io::Result<()> {
        let mut pairs = self.pairs.lock().unwrap_or_else(PoisonError::into_inner);
        pairs.remove(connection);
        Ok(())
    }
}
