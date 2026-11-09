use gpui_kit::component::{ActiveTheme, h_flex, v_flex};
use gpui_kit::{
    AppContext, Context, Entity, EventEmitter, IntoElement, ParentElement, Render, SharedString,
    Styled, Subscription, Window, div,
};

use crate::chat_view::{ChatEvent, ChatView};
use crate::interface_language::InterfaceLanguage;
use crate::lemma_app::DesktopClient;
use crate::session_list::{SessionList, SessionListEvent, session_title};
use crate::strings::sidebar;
use crate::window_header::window_header;

/// Reports that the user signed out.
pub(crate) enum WorkspaceEvent {
    SignedOut,
}

/// The signed-in window content: the session list beside the open conversation, both reaching up into the window's title area.
pub(crate) struct WorkspaceView {
    sessions: Entity<SessionList>,
    chat: Entity<ChatView>,
    title: Option<SharedString>,
    _subscriptions: Vec<Subscription>,
}

impl EventEmitter<WorkspaceEvent> for WorkspaceView {}

impl WorkspaceView {
    pub(crate) fn new(client: DesktopClient, window: &mut Window, cx: &mut Context<Self>) -> Self {
        let sessions = cx.new(|cx| SessionList::new(client.clone(), cx));
        let chat = cx.new(|cx| ChatView::new(client, window, cx));
        let subscriptions = vec![
            cx.subscribe_in(
                &sessions,
                window,
                |workspace, _, event: &SessionListEvent, window, cx| match event {
                    SessionListEvent::Open { id, title } => {
                        let id = id.clone();
                        workspace.title = Some(title.clone());
                        workspace
                            .chat
                            .update(cx, |chat, cx| chat.open_session(id, cx));
                        cx.notify();
                    }
                    SessionListEvent::StartNew => {
                        workspace.title = None;
                        workspace
                            .chat
                            .update(cx, |chat, cx| chat.start_new(window, cx));
                        cx.notify();
                    }
                    SessionListEvent::SignedOut => cx.emit(WorkspaceEvent::SignedOut),
                },
            ),
            cx.subscribe(&chat, |workspace, _, event: &ChatEvent, cx| match event {
                ChatEvent::SessionCreated(session) => {
                    let language = InterfaceLanguage::current(cx);
                    workspace.title = Some(session_title(session, language));
                    let session = session.clone();
                    workspace
                        .sessions
                        .update(cx, |list, cx| list.add(session, cx));
                    cx.notify();
                }
            }),
        ];
        Self {
            sessions,
            chat,
            title: None,
            _subscriptions: subscriptions,
        }
    }
}

impl Render for WorkspaceView {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let language = InterfaceLanguage::current(cx);
        let title = self
            .title
            .clone()
            .unwrap_or_else(|| sidebar::new_session(language).into());
        h_flex()
            .items_stretch()
            .size_full()
            .bg(cx.theme().sidebar)
            .child(div().w_64().h_full().child(self.sessions.clone()))
            .child(
                v_flex()
                    .flex_1()
                    .min_w_0()
                    .h_full()
                    .border_l_1()
                    .border_color(cx.theme().border)
                    .bg(cx.theme().background)
                    .child(window_header(Some(title), cx))
                    .child(div().flex_1().min_h_0().child(self.chat.clone())),
            )
    }
}
