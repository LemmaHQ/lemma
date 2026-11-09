use chrono::Local;
use gpui_kit::assets::IconName;
use gpui_kit::component::button::{Button, ButtonVariants};
use gpui_kit::component::{ActiveTheme, Selectable, v_flex};
use gpui_kit::prelude::FluentBuilder;
use gpui_kit::{
    AnyElement, Context, EventEmitter, InteractiveElement, IntoElement, ParentElement, Render,
    SharedString, StatefulInteractiveElement, Styled, Task, Window, div,
};
use lemma_client::{SessionPeriod, group_sessions};
use lemma_proto::lemma::v1::Session;

use crate::engine_runtime::EngineRuntime;
use crate::error_text::error_text;
use crate::interface_language::InterfaceLanguage;
use crate::lemma_app::DesktopClient;
use crate::strings::{Language, session, sidebar};

/// Requests the session list makes of the workspace.
pub(crate) enum SessionListEvent {
    Open(String),
    StartNew,
    SignedOut,
}

/// The sidebar: the user's sessions grouped by the day they were last updated.
pub(crate) struct SessionList {
    client: DesktopClient,
    sessions: Vec<Session>,
    selected: Option<String>,
    load_error: Option<SharedString>,
    _load: Task<()>,
}

impl EventEmitter<SessionListEvent> for SessionList {}

impl SessionList {
    pub(crate) fn new(client: DesktopClient, cx: &mut Context<Self>) -> Self {
        let listing = {
            let client = client.clone();
            EngineRuntime::spawn(async move { client.list_sessions().await }, cx)
        };
        let load = cx.spawn(async move |this, cx| {
            let result = listing.await;
            this.update(cx, |list, cx| {
                match result {
                    Ok(sessions) => list.sessions = sessions,
                    Err(error) => {
                        let language = InterfaceLanguage::current(cx);
                        list.load_error = Some(error_text(&error, language).into());
                    }
                }
                cx.notify();
            })
            .ok();
        });
        Self {
            client,
            sessions: Vec::new(),
            selected: None,
            load_error: None,
            _load: load,
        }
    }

    /// Lists `session` first and marks it as the open one.
    pub(crate) fn add(&mut self, session: Session, cx: &mut Context<Self>) {
        self.selected = Some(session.id.clone());
        self.sessions.retain(|listed| listed.id != session.id);
        self.sessions.insert(0, session);
        cx.notify();
    }

    fn open(&mut self, id: &str, cx: &mut Context<Self>) {
        self.selected = Some(id.to_owned());
        cx.emit(SessionListEvent::Open(id.to_owned()));
        cx.notify();
    }

    fn start_new(&mut self, cx: &mut Context<Self>) {
        self.selected = None;
        cx.emit(SessionListEvent::StartNew);
        cx.notify();
    }

    fn sign_out(&mut self, cx: &mut Context<Self>) {
        let client = self.client.clone();
        let signing_out = EngineRuntime::spawn(async move { client.sign_out().await }, cx);
        cx.spawn(async move |this, cx| {
            signing_out.await.ok();
            this.update(cx, |_, cx| cx.emit(SessionListEvent::SignedOut))
                .ok();
        })
        .detach();
    }

    fn render_groups(&self, language: Language, cx: &mut Context<Self>) -> AnyElement {
        let now = Local::now();
        let groups = group_sessions(&self.sessions, &now);
        let mut list = v_flex().gap_3();
        for group in groups {
            let mut rows = v_flex().gap_0p5().child(
                div()
                    .px_2()
                    .text_xs()
                    .text_color(cx.theme().muted_foreground)
                    .child(period_label(group.period, language)),
            );
            for listed in group.sessions {
                let title: SharedString = if listed.title.is_empty() {
                    sidebar::new_session(language).into()
                } else {
                    listed.title.clone().into()
                };
                let id = listed.id.clone();
                rows = rows.child(
                    Button::new(SharedString::from(format!("session-{id}")))
                        .ghost()
                        .w_full()
                        .justify_start()
                        .label(title)
                        .selected(self.selected.as_deref() == Some(id.as_str()))
                        .on_click(cx.listener(move |list, _, _, cx| list.open(&id, cx))),
                );
            }
            list = list.child(rows);
        }
        list.into_any_element()
    }
}

impl Render for SessionList {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let language = InterfaceLanguage::current(cx);
        v_flex()
            .size_full()
            .p_2()
            .gap_2()
            .bg(cx.theme().sidebar)
            .child(
                Button::new("new-session")
                    .ghost()
                    .w_full()
                    .justify_start()
                    .icon(IconName::SquarePen)
                    .label(sidebar::new_session(language))
                    .on_click(cx.listener(|list, _, _, cx| list.start_new(cx))),
            )
            .child(
                div()
                    .id("sessions")
                    .flex_1()
                    .min_h_0()
                    .overflow_y_scroll()
                    .child(self.render_groups(language, cx))
                    .when_some(self.load_error.clone(), |this, error| {
                        this.child(
                            div()
                                .px_2()
                                .text_sm()
                                .text_color(cx.theme().danger)
                                .child(error),
                        )
                    }),
            )
            .child(
                Button::new("sign-out")
                    .ghost()
                    .w_full()
                    .justify_start()
                    .icon(IconName::LogOut)
                    .label(sidebar::sign_out(language))
                    .on_click(cx.listener(|list, _, _, cx| list.sign_out(cx))),
            )
    }
}

fn period_label(period: SessionPeriod, language: Language) -> &'static str {
    match period {
        SessionPeriod::Today => session::today(language),
        SessionPeriod::Yesterday => session::yesterday(language),
        SessionPeriod::PreviousSevenDays => session::last7_days(language),
        SessionPeriod::Earlier => session::earlier(language),
    }
}

#[cfg(test)]
mod tests {
    use gpui_kit::{AppContext, TestAppContext};

    use super::*;
    use crate::tests::fixture::Fixture;

    #[test]
    fn periods_read_as_day_labels() {
        let labels = [
            SessionPeriod::Today,
            SessionPeriod::Yesterday,
            SessionPeriod::PreviousSevenDays,
            SessionPeriod::Earlier,
        ]
        .map(|period| period_label(period, Language::En));
        assert_eq!(
            labels,
            ["Today", "Yesterday", "Last 7 days", "Earlier"],
            "English labels"
        );
        assert_eq!(
            period_label(SessionPeriod::Yesterday, Language::Zh),
            "昨天",
            "Chinese label"
        );
    }

    #[gpui_kit::test]
    fn a_list_that_cannot_load_says_why(cx: &mut TestAppContext) {
        let fixture = Fixture::signed_out(cx);
        let client = fixture.client.clone();
        let (window, list) = fixture.open(cx, |_, cx| cx.new(|cx| SessionList::new(client, cx)));
        fixture.wait_until(cx, window, |_, cx| list.read(cx).load_error.is_some());
        cx.update(|cx| {
            assert_eq!(
                list.read(cx).load_error.as_deref(),
                Some("You've been signed out. Please sign in again."),
                "the failure is shown in the sidebar"
            );
        });
    }
}
