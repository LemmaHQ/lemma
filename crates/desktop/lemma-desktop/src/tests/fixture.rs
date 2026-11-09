use std::thread;
use std::time::Duration;

use axum::Router;
use gpui_kit::test::TestWindowExt;
use gpui_kit::{
    AnyWindowHandle, App, AppContext, Bounds, Entity, Point, Render, TestAppContext, Window,
    WindowBounds, WindowOptions, px, size,
};
use lemma_client::Client;
use lemma_host::LocalEngine;
use tempfile::TempDir;
use tokio::runtime::Runtime;

use crate::engine_runtime::EngineRuntime;
use crate::interface_language::InterfaceLanguage;
use crate::lemma_app::DesktopClient;
use crate::memory_token_store::MemoryTokenStore;
use crate::strings::Language;

/// A client holding no tokens, of a local engine in a temporary directory or of a host that serves nothing, and the application globals.
pub(crate) struct Fixture {
    pub(crate) client: DesktopClient,
    _engine: Option<LocalEngine>,
    _runtime: Runtime,
    _dir: TempDir,
}

impl Fixture {
    pub(crate) fn signed_out(cx: &mut TestAppContext) -> Self {
        Self::new(cx, true)
    }

    pub(crate) fn unreachable(cx: &mut TestAppContext) -> Self {
        Self::new(cx, false)
    }

    fn new(cx: &mut TestAppContext, engine: bool) -> Self {
        cx.executor().allow_parking();
        let dir = TempDir::new().unwrap_or_else(|error| panic!("temporary directory: {error}"));
        let runtime = Runtime::new().unwrap_or_else(|error| panic!("runtime: {error}"));
        let engine = engine.then(|| {
            runtime
                .block_on(LocalEngine::open(dir.path()))
                .unwrap_or_else(|error| panic!("engine: {error}"))
        });
        let router = engine
            .as_ref()
            .map_or_else(Router::new, LocalEngine::router);
        let engine_runtime =
            EngineRuntime::new().unwrap_or_else(|error| panic!("engine runtime: {error}"));
        cx.update(|cx| {
            gpui_kit::init(cx);
            cx.set_global(engine_runtime);
            InterfaceLanguage::set(Language::En, cx);
        });
        Self {
            client: Client::local(router, MemoryTokenStore::default()),
            _engine: engine,
            _runtime: runtime,
            _dir: dir,
        }
    }

    /// Opens a window over the view `build` makes.
    pub(crate) fn open<V: Render>(
        &self,
        cx: &mut TestAppContext,
        build: impl FnOnce(&mut Window, &mut App) -> Entity<V>,
    ) -> (AnyWindowHandle, Entity<V>) {
        let options = WindowOptions {
            window_bounds: Some(WindowBounds::Windowed(Bounds::new(
                Point::default(),
                size(px(900.), px(700.)),
            ))),
            ..Default::default()
        };
        cx.update(|cx| gpui_kit::open_window(options, cx, build))
            .unwrap_or_else(|error| panic!("open window: {error}"))
    }

    /// Renders `window` until `check` holds, letting the engine's real I/O progress.
    pub(crate) fn wait_until(
        &self,
        cx: &mut TestAppContext,
        window: AnyWindowHandle,
        mut check: impl FnMut(&mut Window, &mut App) -> bool,
    ) {
        for _ in 0..1000 {
            cx.run_until_parked();
            let done = cx.update_window(window, |_, window, cx| {
                window.render_frame(cx);
                check(window, cx)
            });
            if done.unwrap_or(false) {
                return;
            }
            thread::sleep(Duration::from_millis(10));
        }
        panic!("timed out");
    }
}
