use futures::StreamExt;
use futures::channel::mpsc;
use gpui_kit::{Context, Window};
use lemma_client::{ClientError, MessageRole, ModelChoice, OpenSession, TurnUpdate};
use lemma_proto::lemma::v1::{ListMessagesResponse, Session};

use super::messages::{ChatEvent, ChatView};
use crate::engine_runtime::EngineRuntime;

impl ChatView {
    pub(super) fn send(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let content = self.composer.read(cx).value().trim().to_owned();
        let running = self.open.as_ref().is_some_and(OpenSession::turn_running);
        let Some(model) = self.model.clone() else {
            return;
        };
        if content.is_empty() || running {
            return;
        }
        self.composer
            .update(cx, |composer, cx| composer.set_value("", window, cx));
        if let Some(open) = &mut self.open {
            open.begin_turn(&content, &model.provider_id, &model.model);
            let session_id = open.session_id().to_owned();
            self.follow_turn(session_id, content, model, cx);
            return;
        }
        let client = self.client.clone();
        let creating = EngineRuntime::spawn(async move { client.create_session().await }, cx);
        self.turn = Some(cx.spawn(async move |this, cx| {
            let created = creating.await;
            this.update(cx, |chat, cx| {
                chat.session_created(created, content, model, cx)
            })
            .ok();
        }));
    }

    fn session_created(
        &mut self,
        created: Result<Session, ClientError>,
        content: String,
        model: ModelChoice,
        cx: &mut Context<Self>,
    ) {
        let id = created
            .as_ref()
            .map(|session| session.id.clone())
            .unwrap_or_default();
        let mut open = OpenSession::new(&id, ListMessagesResponse::default());
        open.begin_turn(&content, &model.provider_id, &model.model);
        match created {
            Ok(session) => {
                self.show(Some(open), cx);
                cx.emit(ChatEvent::SessionCreated(session));
                self.follow_turn(id, content, model, cx);
            }
            Err(error) => {
                open.fail(error);
                self.show(Some(open), cx);
            }
        }
    }

    fn follow_turn(
        &mut self,
        session_id: String,
        content: String,
        model: ModelChoice,
        cx: &mut Context<Self>,
    ) {
        self.stopping = false;
        self.sync_rows(cx);
        let (sender, mut updates) = mpsc::unbounded();
        let client = self.client.clone();
        let driving = EngineRuntime::spawn(
            async move {
                let opened = client
                    .send_message(&session_id, &model.provider_id, &model.model, &content)
                    .await;
                let mut turn = match opened {
                    Ok(turn) => turn,
                    Err(error) => {
                        sender.unbounded_send(TurnUpdate::Failed(error)).ok();
                        return;
                    }
                };
                while let Some(update) = turn.next().await {
                    sender.unbounded_send(update).ok();
                }
            },
            cx,
        );
        self.turn = Some(cx.spawn(async move |this, cx| {
            while let Some(update) = updates.next().await {
                this.update(cx, |chat, cx| chat.receive(update, cx)).ok();
            }
            driving.await;
        }));
        cx.notify();
    }

    pub(super) fn receive(&mut self, update: TurnUpdate, cx: &mut Context<Self>) {
        let Some(open) = &mut self.open else {
            return;
        };
        match update {
            TurnUpdate::Event(event) => open.apply(&event),
            TurnUpdate::Failed(error) => open.fail(error),
            TurnUpdate::Settled => {
                let id = open.session_id().to_owned();
                self.open_session(id, cx);
                return;
            }
        }
        self.abort_once_started(cx);
        self.sync_rows(cx);
        cx.notify();
    }

    /// Asks the host to stop the running turn, as soon as the host has started it.
    pub(super) fn stop(&mut self, cx: &mut Context<Self>) {
        self.stopping = true;
        self.abort_once_started(cx);
    }

    fn abort_once_started(&mut self, cx: &mut Context<Self>) {
        let started = self
            .open
            .as_ref()
            .and_then(|open| {
                open.messages()
                    .filter(|item| item.role == MessageRole::User)
                    .last()
            })
            .map(|item| item.id.clone())
            .filter(|id| self.stopping && !id.starts_with("local-"));
        let Some(message_id) = started else {
            return;
        };
        self.stopping = false;
        let client = self.client.clone();
        EngineRuntime::spawn(async move { client.abort_message(&message_id).await }, cx).detach();
    }
}

#[cfg(test)]
mod tests {
    use gpui_kit::{AppContext, TestAppContext};
    use lemma_client::{MessageError, MessageStatus};
    use lemma_proto::lemma::v1::AgentEvent;

    use super::*;
    use crate::tests::fixture::Fixture;

    fn model() -> ModelChoice {
        ModelChoice {
            provider_id: "vendor".to_owned(),
            model: "answer".to_owned(),
        }
    }

    #[gpui_kit::test]
    fn a_session_that_cannot_be_created_shows_the_failure(cx: &mut TestAppContext) {
        let fixture = Fixture::signed_out(cx);
        let client = fixture.client.clone();
        let (window, chat) = fixture.open(cx, |window, cx| {
            cx.new(|cx| ChatView::new(client, window, cx))
        });
        let sent = cx.update_window(window, |_, window, cx| {
            chat.update(cx, |chat, cx| {
                chat.model = Some(model());
                chat.composer
                    .update(cx, |composer, cx| composer.set_value("hi", window, cx));
                chat.send(window, cx);
            });
        });
        assert!(sent.is_ok(), "window open: {sent:?}");
        fixture.wait_until(cx, window, |_, cx| chat.read(cx).open.is_some());
        let failed = cx.update(|cx| {
            let open = chat.read(cx).open.as_ref();
            let messages: Vec<_> = open
                .map(|open| open.messages().collect())
                .unwrap_or_default();
            let signed_out = matches!(
                messages.last().and_then(|reply| reply.error.as_ref()),
                Some(MessageError::Client(ClientError::SignedOut))
            );
            (messages.len(), signed_out)
        });
        assert_eq!(
            failed,
            (2, true),
            "the message and its reply carrying the failure"
        );
    }

    #[gpui_kit::test]
    fn updates_fail_settle_or_drop_with_the_conversation(cx: &mut TestAppContext) {
        let fixture = Fixture::signed_out(cx);
        let client = fixture.client.clone();
        let (window, chat) = fixture.open(cx, |window, cx| {
            cx.new(|cx| ChatView::new(client, window, cx))
        });
        cx.update(|cx| {
            chat.update(cx, |chat, cx| {
                let mut open = OpenSession::new("s1", ListMessagesResponse::default());
                open.begin_turn("hi", "vendor", "answer");
                chat.show(Some(open), cx);
                chat.receive(TurnUpdate::Failed(ClientError::Network), cx);
                let reply = chat.open.as_ref().and_then(|open| open.messages().last());
                assert_eq!(
                    reply.map(|reply| reply.status),
                    Some(MessageStatus::Error),
                    "a broken stream fails the reply"
                );
                chat.receive(TurnUpdate::Settled, cx);
            });
        });
        fixture.wait_until(cx, window, |_, cx| {
            chat.read(cx)
                .open
                .as_ref()
                .is_some_and(|open| open.messages().count() == 0)
        });
        let cleared = cx.update_window(window, |_, window, cx| {
            chat.update(cx, |chat, cx| {
                chat.start_new(window, cx);
                chat.receive(TurnUpdate::Event(AgentEvent::default()), cx);
                chat.open.is_none()
            })
        });
        assert!(
            matches!(cleared, Ok(true)),
            "a late update does not reopen a cleared conversation"
        );
    }

    #[gpui_kit::test]
    fn a_turn_whose_stream_cannot_open_fails_its_reply(cx: &mut TestAppContext) {
        let fixture = Fixture::unreachable(cx);
        let client = fixture.client.clone();
        let (window, chat) = fixture.open(cx, |window, cx| {
            cx.new(|cx| ChatView::new(client, window, cx))
        });
        let sent = cx.update_window(window, |_, window, cx| {
            chat.update(cx, |chat, cx| {
                chat.model = Some(model());
                chat.show(
                    Some(OpenSession::new("s1", ListMessagesResponse::default())),
                    cx,
                );
                chat.composer
                    .update(cx, |composer, cx| composer.set_value("hi", window, cx));
                chat.send(window, cx);
            });
        });
        assert!(sent.is_ok(), "window open: {sent:?}");
        fixture.wait_until(cx, window, |_, cx| {
            chat.read(cx)
                .open
                .as_ref()
                .is_some_and(|open| !open.turn_running())
        });
        let reply = cx.update(|cx| {
            let open = chat.read(cx).open.as_ref();
            open.and_then(|open| open.messages().last())
                .map(|reply| reply.status)
        });
        assert_eq!(reply, Some(MessageStatus::Error), "the reply fails");
    }
}
