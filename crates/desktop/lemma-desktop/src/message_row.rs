use gpui_kit::component::text::{TextView, TextViewState};
use gpui_kit::component::{ActiveTheme, StyledExt, h_flex, v_flex};
use gpui_kit::prelude::FluentBuilder;
use gpui_kit::{
    AnyElement, App, Entity, InteractiveElement, IntoElement, ParentElement, Role, SharedString,
    StatefulInteractiveElement, Styled, TestSupportExt, div, relative,
};
use lemma_client::{MessageError, MessageItem, MessageRole, MessageStatus, ToolCallItem};

use crate::error_text::error_text;
use crate::reading_text::ReadingText;
use crate::strings::{Language, agent};

/// One row of the conversation: a user bubble, or an assistant reply with its thinking, tool calls, text, and outcome.
pub(crate) fn render_message(
    item: &MessageItem,
    body: Option<&Entity<TextViewState>>,
    language: Language,
    cx: &App,
) -> AnyElement {
    let row = div()
        .id(SharedString::from(format!("message-{}", item.id)))
        .test_support()
        .aria_label(SharedString::from(item.content.clone()))
        .w_full()
        .py_3();
    if item.role == MessageRole::User {
        return row
            .child(
                h_flex().justify_end().child(
                    div()
                        .max_w(relative(0.8))
                        .px_4()
                        .py_2()
                        .rounded_xl()
                        .bg(cx.theme().muted)
                        .text_reading()
                        .child(item.content.clone()),
                ),
            )
            .into_any_element();
    }
    row.child(
        v_flex()
            .gap_3()
            .when(!item.thinking.is_empty(), |this| {
                this.child(render_thinking(item, language, cx))
            })
            .children(
                item.tool_calls
                    .iter()
                    .map(|call| render_tool_call(call, language, cx)),
            )
            .when_some(body, |this, body| {
                this.child(TextView::new(body).text_reading().stream_fade(true))
            })
            .when_some(item.error.as_ref(), |this, error| {
                let text: SharedString = match error {
                    MessageError::Server(text) => text.clone().into(),
                    MessageError::Client(error) => error_text(error, language).into(),
                };
                this.child(
                    div()
                        .id(SharedString::from(format!("error-{}", item.id)))
                        .role(Role::Alert)
                        .test_support()
                        .aria_label(text.clone())
                        .text_sm()
                        .text_color(cx.theme().danger)
                        .child(text),
                )
            })
            .when(item.status == MessageStatus::Aborted, |this| {
                this.child(
                    div()
                        .id(SharedString::from(format!("aborted-{}", item.id)))
                        .test_support()
                        .aria_label(agent::aborted_notice(language))
                        .text_sm()
                        .text_color(cx.theme().muted_foreground)
                        .child(agent::aborted_notice(language)),
                )
            }),
    )
    .into_any_element()
}

fn render_thinking(item: &MessageItem, language: Language, cx: &App) -> AnyElement {
    let label = if item.status == MessageStatus::Streaming && item.content.is_empty() {
        agent::thinking_in_progress(language)
    } else {
        agent::thinking(language)
    };
    v_flex()
        .gap_1()
        .text_sm()
        .text_color(cx.theme().muted_foreground)
        .child(div().font_medium().child(label))
        .child(
            div()
                .pl_3()
                .border_l_2()
                .border_color(cx.theme().border)
                .child(item.thinking.clone()),
        )
        .into_any_element()
}

fn render_tool_call(call: &ToolCallItem, language: Language, cx: &App) -> AnyElement {
    let (text, color) = if call.running {
        (
            agent::tool_call::announce::running(language, &call.name),
            cx.theme().muted_foreground,
        )
    } else if call.is_error {
        (
            agent::tool_call::announce::error(language, &call.name, &call.output),
            cx.theme().danger,
        )
    } else {
        (
            agent::tool_call::announce::success(language, &call.name),
            cx.theme().muted_foreground,
        )
    };
    div()
        .id(SharedString::from(format!("tool-call-{}", call.id)))
        .test_support()
        .aria_label(text.clone())
        .text_sm()
        .text_color(color)
        .child(text)
        .into_any_element()
}
