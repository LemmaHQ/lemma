use gpui_kit::component::input::{InputEvent, InputState};
use gpui_kit::{AppContext, Context, Entity, EventEmitter, SharedString, Subscription, Window};
use lemma_client::ClientError;

use crate::engine_runtime::EngineRuntime;
use crate::error_text::error_text;
use crate::interface_language::InterfaceLanguage;
use crate::lemma_app::DesktopClient;
use crate::strings::auth;

/// Reports that the user signed in or signed up.
pub(crate) enum SignInEvent {
    SignedIn,
}

/// Two-step sign-in, the account first and then its password, with sign-up for an unknown account.
pub(crate) struct SignInView {
    pub(super) client: DesktopClient,
    pub(super) step: Step,
    pub(super) identifier: Entity<InputState>,
    pub(super) password: Entity<InputState>,
    pub(super) username: Entity<InputState>,
    pub(super) email: Entity<InputState>,
    pub(super) new_password: Entity<InputState>,
    pub(super) confirm_password: Entity<InputState>,
    pub(super) busy: bool,
    pub(super) error: Option<SharedString>,
    _input_events: Vec<Subscription>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Step {
    Account,
    Password,
    SignUp,
}

impl EventEmitter<SignInEvent> for SignInView {}

impl SignInView {
    pub(crate) fn new(client: DesktopClient, window: &mut Window, cx: &mut Context<Self>) -> Self {
        let language = InterfaceLanguage::current(cx);
        let text =
            |window: &mut Window, cx: &mut Context<Self>| cx.new(|cx| InputState::new(window, cx));
        let secret = |window: &mut Window, cx: &mut Context<Self>| {
            cx.new(|cx| InputState::new(window, cx).masked(true))
        };
        let identifier =
            cx.new(|cx| InputState::new(window, cx).placeholder(auth::identifier(language)));
        let inputs = [
            identifier.clone(),
            secret(window, cx),
            text(window, cx),
            text(window, cx),
            secret(window, cx),
            secret(window, cx),
        ];
        let input_events = inputs
            .iter()
            .map(|input| {
                cx.subscribe_in(input, window, |view, _, event: &InputEvent, window, cx| {
                    if matches!(event, InputEvent::PressEnter { .. }) {
                        view.submit(window, cx);
                    }
                })
            })
            .collect();
        let [_, password, username, email, new_password, confirm_password] = inputs;
        identifier.update(cx, |input, cx| input.focus(window, cx));
        Self {
            client,
            step: Step::Account,
            identifier,
            password,
            username,
            email,
            new_password,
            confirm_password,
            busy: false,
            error: None,
            _input_events: input_events,
        }
    }

    pub(super) fn submit(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        if self.busy {
            return;
        }
        let client = self.client.clone();
        let identifier = self.identifier.read(cx).value().trim().to_owned();
        match self.step {
            Step::Account if !identifier.is_empty() => self.request(
                async move { client.check_account(&identifier).await },
                Self::account_checked,
                window,
                cx,
            ),
            Step::Account => {}
            Step::Password => {
                let password = self.password.read(cx).value().to_string();
                self.request(
                    async move { client.sign_in(&identifier, &password).await },
                    Self::signed_in,
                    window,
                    cx,
                );
            }
            Step::SignUp => self.sign_up(client, window, cx),
        }
    }

    fn sign_up(&mut self, client: DesktopClient, window: &mut Window, cx: &mut Context<Self>) {
        let password = self.new_password.read(cx).value().to_string();
        if password != self.confirm_password.read(cx).value().as_ref() {
            self.error = Some(auth::password_mismatch(InterfaceLanguage::current(cx)).into());
            cx.notify();
            return;
        }
        let username = self.username.read(cx).value().to_string();
        let email = self.email.read(cx).value().to_string();
        self.request(
            async move { client.sign_up(&username, &email, &password).await },
            Self::signed_in,
            window,
            cx,
        );
    }

    fn request<T, F>(
        &mut self,
        call: F,
        done: fn(&mut Self, T, &mut Window, &mut Context<Self>),
        window: &mut Window,
        cx: &mut Context<Self>,
    ) where
        T: Send + 'static,
        F: Future<Output = Result<T, ClientError>> + Send + 'static,
    {
        self.busy = true;
        self.error = None;
        cx.notify();
        let call = EngineRuntime::spawn(call, cx);
        cx.spawn_in(window, async move |this, cx| {
            let result = call.await;
            this.update_in(cx, |view, window, cx| {
                view.busy = false;
                match result {
                    Ok(value) => done(view, value, window, cx),
                    Err(error) => {
                        let language = InterfaceLanguage::current(cx);
                        view.error = Some(error_text(&error, language).into());
                    }
                }
                cx.notify();
            })
            .ok();
        })
        .detach();
    }

    fn account_checked(&mut self, exists: bool, window: &mut Window, cx: &mut Context<Self>) {
        if exists {
            self.show(Step::Password, window, cx);
            return;
        }
        let identifier = self.identifier.read(cx).value().trim().to_owned();
        let prefilled = if identifier.contains('@') {
            &self.email
        } else {
            &self.username
        };
        prefilled.update(cx, |input, cx| input.set_value(identifier, window, cx));
        self.show(Step::SignUp, window, cx);
    }

    fn signed_in<T>(&mut self, _: T, _: &mut Window, cx: &mut Context<Self>) {
        cx.emit(SignInEvent::SignedIn);
    }

    pub(super) fn show(&mut self, step: Step, window: &mut Window, cx: &mut Context<Self>) {
        self.step = step;
        self.error = None;
        if step == Step::Account {
            self.password
                .update(cx, |input, cx| input.set_value("", window, cx));
        }
        let focused = match step {
            Step::Account => &self.identifier,
            Step::Password => &self.password,
            Step::SignUp if self.username.read(cx).value().is_empty() => &self.username,
            Step::SignUp if self.email.read(cx).value().is_empty() => &self.email,
            Step::SignUp => &self.new_password,
        };
        focused.update(cx, |input, cx| input.focus(window, cx));
        cx.notify();
    }
}
