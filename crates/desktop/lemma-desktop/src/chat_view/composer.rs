use gpui_kit::assets::IconName;
use gpui_kit::component::button::{Button, ButtonVariants};
use gpui_kit::component::input::Textarea;
use gpui_kit::component::{ActiveTheme, Disableable, h_flex, v_flex};
use gpui_kit::{
    AnyElement, Context, InteractiveElement, IntoElement, ParentElement, SharedString,
    StatefulInteractiveElement, Styled, TestSupportExt, div, rems,
};
use lemma_client::OpenSession;

use super::messages::ChatView;
use crate::interface_language::InterfaceLanguage;
use crate::reading_text::ReadingText;
use crate::strings::{agent, session};

impl ChatView {
    pub(super) fn render_composer(&self, cx: &mut Context<Self>) -> AnyElement {
        let language = InterfaceLanguage::current(cx);
        let running = self.open.as_ref().is_some_and(OpenSession::turn_running);
        let model_label: SharedString = self.model.as_ref().map_or_else(
            || session::no_provider(language).into(),
            |model| model.model.clone().into(),
        );
        let action = if running {
            Button::new("stop")
                .icon(IconName::Square)
                .tooltip(agent::stop(language))
                .on_click(cx.listener(|chat, _, _, cx| chat.stop(cx)))
        } else {
            Button::new("send")
                .primary()
                .icon(IconName::ArrowUp)
                .tooltip(session::send(language))
                .disabled(self.model.is_none())
                .on_click(cx.listener(|chat, _, window, cx| chat.send(window, cx)))
        };
        v_flex()
            .w_full()
            .max_w(rems(48.))
            .gap_2()
            .p_3()
            .rounded_xl()
            .border_1()
            .border_color(cx.theme().border)
            .bg(cx.theme().background)
            .child(
                Textarea::new(&self.composer)
                    .aria_label(session::input_placeholder(language))
                    .appearance(false)
                    .text_reading(),
            )
            .child(
                h_flex()
                    .justify_between()
                    .child(
                        div()
                            .id("model")
                            .test_support()
                            .aria_label(model_label.clone())
                            .text_sm()
                            .text_color(cx.theme().muted_foreground)
                            .child(model_label),
                    )
                    .child(action),
            )
            .into_any_element()
    }
}
