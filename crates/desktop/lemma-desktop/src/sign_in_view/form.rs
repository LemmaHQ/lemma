use gpui_kit::component::button::{Button, ButtonVariants};
use gpui_kit::component::form::{Field, Form};
use gpui_kit::component::input::{Input, InputState};
use gpui_kit::component::{ActiveTheme, StyledExt, h_flex, v_flex};
use gpui_kit::prelude::FluentBuilder;
use gpui_kit::{
    AnyElement, Context, Entity, InteractiveElement, IntoElement, ParentElement, Render, Role,
    StatefulInteractiveElement, Styled, TestSupportExt, Window, div,
};

use super::steps::{SignInView, Step};
use crate::interface_language::InterfaceLanguage;
use crate::strings::{Language, auth};
use crate::text_role::TextRole;

impl SignInView {
    fn render_fields(&self, language: Language, cx: &mut Context<Self>) -> AnyElement {
        let field = |label: &'static str, input: &Entity<InputState>, id: &'static str| {
            Field::new().label(label).child(Input::new(input).id(id))
        };
        let form = Form::new();
        match self.step {
            Step::Account => form.child(field(
                auth::identifier(language),
                &self.identifier,
                "identifier",
            )),
            Step::Password => form
                .child(
                    Field::new().child(
                        h_flex()
                            .justify_between()
                            .text_body()
                            .font_medium()
                            .child(self.identifier.read(cx).value())
                            .child(
                                Button::new("change-account")
                                    .ghost()
                                    .label(auth::change_account(language))
                                    .on_click(cx.listener(|view, _, window, cx| {
                                        view.show(Step::Account, window, cx);
                                    })),
                            ),
                    ),
                )
                .child(field(auth::password(language), &self.password, "password")),
            Step::SignUp => form
                .child(field(auth::username(language), &self.username, "username"))
                .child(field(auth::email(language), &self.email, "email"))
                .child(field(
                    auth::password(language),
                    &self.new_password,
                    "new-password",
                ))
                .child(field(
                    auth::confirm_password(language),
                    &self.confirm_password,
                    "confirm-password",
                )),
        }
        .into_any_element()
    }
}

impl Render for SignInView {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let language = InterfaceLanguage::current(cx);
        let (title, description, submit) = match self.step {
            Step::Account => (
                auth::sign_in_title(language),
                auth::sign_in_description(language),
                auth::r#continue(language),
            ),
            Step::Password => (
                auth::password_title(language),
                auth::password_description(language),
                auth::sign_in(language),
            ),
            Step::SignUp => (
                auth::sign_up_title(language),
                auth::sign_up_description(language),
                auth::sign_up(language),
            ),
        };
        let switch = match self.step {
            Step::Account => Some((
                auth::no_account(language),
                auth::sign_up(language),
                Step::SignUp,
            )),
            Step::Password => None,
            Step::SignUp => Some((
                auth::have_account(language),
                auth::sign_in(language),
                Step::Account,
            )),
        };
        v_flex().size_full().items_center().justify_center().child(
            v_flex()
                .w_96()
                .gap_6()
                .child(
                    v_flex()
                        .gap_1()
                        .child(div().text_display().child(title))
                        .child(
                            div()
                                .text_body()
                                .text_color(cx.theme().muted_foreground)
                                .child(description),
                        ),
                )
                .child(self.render_fields(language, cx))
                .when_some(self.error.clone(), |this, error| {
                    this.child(
                        div()
                            .id("auth-error")
                            .role(Role::Alert)
                            .test_support()
                            .aria_label(error.clone())
                            .text_small()
                            .text_color(cx.theme().danger)
                            .child(error),
                    )
                })
                .child(
                    Button::new("submit")
                        .primary()
                        .font_medium()
                        .w_full()
                        .label(submit)
                        .loading(self.busy)
                        .on_click(cx.listener(|view, _, window, cx| view.submit(window, cx))),
                )
                .when_some(switch, |this, (prompt, label, step)| {
                    this.child(
                        h_flex()
                            .justify_center()
                            .gap_1()
                            .text_body()
                            .text_color(cx.theme().muted_foreground)
                            .child(prompt)
                            .child(
                                Button::new("switch-step")
                                    .ghost()
                                    .font_medium()
                                    .label(label)
                                    .on_click(cx.listener(move |view, _, window, cx| {
                                        view.show(step, window, cx);
                                    })),
                            ),
                    )
                }),
        )
    }
}
