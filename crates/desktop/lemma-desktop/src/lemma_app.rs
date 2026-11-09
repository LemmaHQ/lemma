use std::path::PathBuf;

use gpui_kit::assets::IconName;
use gpui_kit::component::spinner::Spinner;
use gpui_kit::component::{ActiveTheme, Icon, Sizable, StyledExt, v_flex};
use gpui_kit::prelude::FluentBuilder;
use gpui_kit::{
    AnyElement, App, AppContext, Context, Div, Entity, InteractiveElement, IntoElement,
    ParentElement, Render, Role, SharedString, StatefulInteractiveElement, Styled, Subscription,
    Task, TestSupportExt, Window, div,
};
use lemma_client::Client;
use lemma_host::{LocalEngine, LocalEngineError};

use crate::engine_runtime::EngineRuntime;
use crate::interface_language::InterfaceLanguage;
use crate::memory_token_store::MemoryTokenStore;
use crate::sign_in_view::{SignInEvent, SignInView};
use crate::strings;
use crate::window_header::window_header;
use crate::workspace_view::{WorkspaceEvent, WorkspaceView};

/// The client of the connection the window works with.
pub(crate) type DesktopClient = Client<MemoryTokenStore>;

/// The window's root view: the startup, sign-in, or workspace screen, each reaching up into the window's title area.
#[derive(Debug)]
pub struct LemmaApp {
    screen: Screen,
    engine: Option<LocalEngine>,
    _screen_events: Option<Subscription>,
    _startup: Task<()>,
}

#[derive(Debug)]
enum Screen {
    Starting,
    EngineFailed(SharedString),
    SignIn(Entity<SignInView>),
    Workspace(Entity<WorkspaceView>),
}

impl LemmaApp {
    /// Starts the local engine over `data_dir` and shows sign-in once it is open.
    pub fn new(data_dir: PathBuf, window: &mut Window, cx: &mut Context<Self>) -> Self {
        let opening = EngineRuntime::spawn(async move { LocalEngine::open(&data_dir).await }, cx);
        let startup = cx.spawn_in(window, async move |this, cx| {
            let result = opening.await;
            this.update_in(cx, |app, window, cx| app.engine_opened(result, window, cx))
                .ok();
        });
        Self {
            screen: Screen::Starting,
            engine: None,
            _screen_events: None,
            _startup: startup,
        }
    }

    fn engine_opened(
        &mut self,
        result: Result<LocalEngine, LocalEngineError>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        match result {
            Ok(engine) => {
                let client = Client::local(engine.router(), MemoryTokenStore::default());
                self.engine = Some(engine);
                self.show_sign_in(client, window, cx);
            }
            Err(error) => {
                self.screen = Screen::EngineFailed(error.to_string().into());
                cx.notify();
            }
        }
    }

    fn show_sign_in(&mut self, client: DesktopClient, window: &mut Window, cx: &mut Context<Self>) {
        let view = cx.new(|cx| SignInView::new(client.clone(), window, cx));
        self._screen_events = Some(cx.subscribe_in(
            &view,
            window,
            move |app, _, event: &SignInEvent, window, cx| match event {
                SignInEvent::SignedIn => app.show_workspace(client.clone(), window, cx),
            },
        ));
        self.screen = Screen::SignIn(view);
        cx.notify();
    }

    fn show_workspace(
        &mut self,
        client: DesktopClient,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let view = cx.new(|cx| WorkspaceView::new(client.clone(), window, cx));
        self._screen_events = Some(cx.subscribe_in(
            &view,
            window,
            move |app, _, event: &WorkspaceEvent, window, cx| match event {
                WorkspaceEvent::SignedOut => app.show_sign_in(client.clone(), window, cx),
            },
        ));
        self.screen = Screen::Workspace(view);
        cx.notify();
    }

    fn render_screen(&self, cx: &App) -> AnyElement {
        match &self.screen {
            Screen::Starting => centered().child(Spinner::new().large()).into_any_element(),
            Screen::EngineFailed(detail) => render_engine_failure(detail, cx),
            Screen::SignIn(view) => view.clone().into_any_element(),
            Screen::Workspace(view) => view.clone().into_any_element(),
        }
    }
}

impl Render for LemmaApp {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let workspace = matches!(self.screen, Screen::Workspace(_));
        v_flex()
            .size_full()
            .bg(cx.theme().background)
            .text_color(cx.theme().foreground)
            .when(!workspace, |app| app.child(window_header(None, cx)))
            .child(div().flex_1().min_h_0().child(self.render_screen(cx)))
    }
}

fn centered() -> Div {
    v_flex().size_full().items_center().justify_center().gap_3()
}

fn render_engine_failure(detail: &SharedString, cx: &App) -> AnyElement {
    let language = InterfaceLanguage::current(cx);
    centered()
        .px_8()
        .child(
            Icon::new(IconName::CircleAlert)
                .large()
                .text_color(cx.theme().danger),
        )
        .child(
            div()
                .text_lg()
                .font_semibold()
                .child(strings::startup::engine_failed(language)),
        )
        .child(
            div()
                .id("engine-failure")
                .role(Role::Alert)
                .test_support()
                .aria_label(detail.clone())
                .max_w_128()
                .text_sm()
                .text_color(cx.theme().muted_foreground)
                .child(detail.clone()),
        )
        .into_any_element()
}
