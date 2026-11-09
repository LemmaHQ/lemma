use gpui_kit::component::{ActiveTheme, h_flex};
use gpui_kit::{
    AppContext, Context, Entity, EventEmitter, IntoElement, ParentElement, Render, Styled,
    Subscription, Window, div,
};

use crate::chat_view::{ChatEvent, ChatView};
use crate::lemma_app::DesktopClient;
use crate::session_list::{SessionList, SessionListEvent};

/// Reports that the user signed out.
pub(crate) enum WorkspaceEvent {
    SignedOut,
}

/// The signed-in window content: the session list beside the open conversation.
pub(crate) struct WorkspaceView {
    sessions: Entity<SessionList>,
    chat: Entity<ChatView>,
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
                    SessionListEvent::Open(id) => {
                        let id = id.clone();
                        workspace
                            .chat
                            .update(cx, |chat, cx| chat.open_session(id, cx));
                    }
                    SessionListEvent::StartNew => {
                        workspace
                            .chat
                            .update(cx, |chat, cx| chat.start_new(window, cx));
                    }
                    SessionListEvent::SignedOut => cx.emit(WorkspaceEvent::SignedOut),
                },
            ),
            cx.subscribe(&chat, |workspace, _, event: &ChatEvent, cx| match event {
                ChatEvent::SessionCreated(session) => {
                    let session = session.clone();
                    workspace
                        .sessions
                        .update(cx, |list, cx| list.add(session, cx));
                }
            }),
        ];
        Self {
            sessions,
            chat,
            _subscriptions: subscriptions,
        }
    }
}

impl Render for WorkspaceView {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        h_flex()
            .items_stretch()
            .size_full()
            .child(
                div()
                    .w_64()
                    .h_full()
                    .border_r_1()
                    .border_color(cx.theme().border)
                    .child(self.sessions.clone()),
            )
            .child(div().flex_1().min_w_0().h_full().child(self.chat.clone()))
    }
}
