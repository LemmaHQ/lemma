use std::mem;

use gpui_kit::component::input::{InputEvent, TextareaState};
use gpui_kit::component::message_scroller::{MessageScroller, MessageScrollerState};
use gpui_kit::component::text::TextViewState;
use gpui_kit::component::{StyledExt, h_flex, v_flex};
use gpui_kit::{
    AnyElement, App, AppContext, Context, Entity, EventEmitter, IntoElement, ParentElement, Render,
    Styled, Subscription, Task, Window, div, rems,
};
use lemma_client::{MessageRole, ModelChoice, OpenSession, model_choices, resolve_model};
use lemma_proto::lemma::v1::Session;

use crate::engine_runtime::EngineRuntime;
use crate::interface_language::InterfaceLanguage;
use crate::lemma_app::DesktopClient;
use crate::message_row::render_message;
use crate::strings::session;
use crate::text_role::TextRole;

/// What the conversation reports to the workspace.
pub(crate) enum ChatEvent {
    SessionCreated(Session),
}

/// The open conversation: its messages, following the running turn, and the composer.
pub(crate) struct ChatView {
    pub(super) client: DesktopClient,
    pub(super) open: Option<OpenSession>,
    pub(super) model: Option<ModelChoice>,
    pub(super) composer: Entity<TextareaState>,
    scroller: Entity<MessageScrollerState>,
    bodies: Vec<Option<(Entity<TextViewState>, usize)>>,
    pub(super) turn: Option<Task<()>>,
    pub(super) stopping: bool,
    _loading: Option<Task<()>>,
    _subscriptions: Vec<Subscription>,
}

impl EventEmitter<ChatEvent> for ChatView {}

impl ChatView {
    pub(crate) fn new(client: DesktopClient, window: &mut Window, cx: &mut Context<Self>) -> Self {
        let language = InterfaceLanguage::current(cx);
        let composer = cx.new(|cx| {
            TextareaState::new(window, cx)
                .auto_grow(1, 8)
                .submit_on_enter(true)
                .placeholder(session::input_placeholder(language))
        });
        composer.update(cx, |composer, cx| composer.focus(window, cx));
        let scroller = cx.new(|cx| MessageScrollerState::new(0, cx));
        let subscriptions = vec![
            cx.subscribe_in(
                &composer,
                window,
                |chat, _, event: &InputEvent, window, cx| {
                    if matches!(event, InputEvent::PressEnter { .. }) {
                        chat.send(window, cx);
                    }
                },
            ),
            cx.observe(&scroller, |_, _, cx| cx.notify()),
        ];
        let providers = {
            let client = client.clone();
            EngineRuntime::spawn(async move { client.list_providers().await }, cx)
        };
        let loading = cx.spawn(async move |this, cx| {
            let providers = providers.await.unwrap_or_default();
            this.update(cx, |chat, cx| {
                chat.model = resolve_model(None, &model_choices(&providers));
                cx.notify();
            })
            .ok();
        });
        Self {
            client,
            open: None,
            model: None,
            composer,
            scroller,
            bodies: Vec::new(),
            turn: None,
            stopping: false,
            _loading: Some(loading),
            _subscriptions: subscriptions,
        }
    }

    /// Shows the newest page of session `id`.
    pub(crate) fn open_session(&mut self, id: String, cx: &mut Context<Self>) {
        self.turn = None;
        let client = self.client.clone();
        let listing = EngineRuntime::spawn(
            async move {
                let page = client.list_messages(&id, None).await;
                (id, page)
            },
            cx,
        );
        self._loading = Some(cx.spawn(async move |this, cx| {
            let (id, page) = listing.await;
            this.update(cx, |chat, cx| {
                chat.show(Some(OpenSession::new(&id, page.unwrap_or_default())), cx);
            })
            .ok();
        }));
    }

    /// Clears the conversation so the next message starts a new session.
    pub(crate) fn start_new(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        self.turn = None;
        self.show(None, cx);
        self.composer
            .update(cx, |composer, cx| composer.focus(window, cx));
    }

    pub(super) fn show(&mut self, open: Option<OpenSession>, cx: &mut Context<Self>) {
        self.open = open;
        self.bodies.clear();
        self.sync_rows(cx);
        let count = self.bodies.len();
        self.scroller
            .update(cx, |scroller, cx| scroller.reset(count, cx));
        cx.notify();
    }

    pub(super) fn sync_rows(&mut self, cx: &mut Context<Self>) {
        let Some(open) = &self.open else {
            return;
        };
        let previous = self.bodies.len();
        let mut changed = previous;
        let mut bodies = mem::take(&mut self.bodies);
        bodies.resize(open.messages().count(), None);
        for (index, (item, body)) in open.messages().zip(bodies.iter_mut()).enumerate() {
            if item.role == MessageRole::User || item.content.is_empty() {
                continue;
            }
            match body {
                Some((_, length)) if *length == item.content.len() => {}
                Some((state, length)) => {
                    state.update(cx, |state, cx| state.set_text(&item.content, cx));
                    *length = item.content.len();
                    changed = changed.min(index);
                }
                None => {
                    *body = Some((
                        cx.new(|cx| TextViewState::markdown(&item.content, cx)),
                        item.content.len(),
                    ));
                    changed = changed.min(index);
                }
            }
        }
        let count = bodies.len();
        self.bodies = bodies;
        self.scroller.update(cx, |scroller, cx| {
            if count > previous {
                scroller.append(count - previous, cx);
            }
            if changed < count {
                scroller.remeasure_items(changed..count, cx);
            }
        });
    }

    fn render_row(&self, index: usize, cx: &App) -> Option<AnyElement> {
        let language = InterfaceLanguage::current(cx);
        let item = self.open.as_ref()?.messages().nth(index)?;
        let body = self
            .bodies
            .get(index)
            .and_then(Option::as_ref)
            .map(|(state, _)| state);
        let row = div()
            .w_full()
            .max_w(rems(48.))
            .child(render_message(item, body, language, cx));
        Some(row.into_any_element())
    }
}

impl Render for ChatView {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let language = InterfaceLanguage::current(cx);
        let chat = cx.entity().downgrade();
        let conversation = if self.bodies.is_empty() {
            v_flex()
                .flex_1()
                .items_center()
                .justify_center()
                .child(
                    div()
                        .text_display()
                        .font_normal()
                        .child(session::empty_title(language)),
                )
                .into_any_element()
        } else {
            MessageScroller::new("messages", self.scroller.clone(), move |index, _, cx| {
                let row = chat
                    .upgrade()
                    .and_then(|chat| chat.read(cx).render_row(index, cx));
                div().w_full().flex().justify_center().px_6().children(row)
            })
            .flex_1()
            .min_h_0()
            .into_any_element()
        };
        v_flex().size_full().child(conversation).child(
            h_flex()
                .w_full()
                .justify_center()
                .px_6()
                .pb_4()
                .child(self.render_composer(cx)),
        )
    }
}
