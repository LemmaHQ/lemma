use std::sync::{Arc, LazyLock};

use gpui_kit::component::text::{TextView, TextViewState, TextViewStyle};
use gpui_kit::component::{ActiveTheme, h_flex, v_flex};
use gpui_kit::prelude::FluentBuilder;
use gpui_kit::{
    AnyElement, App, Entity, InteractiveElement, IntoElement, ParentElement, Role, SharedString,
    StatefulInteractiveElement, StyleRefinement, Styled, TestSupportExt, div, px, relative,
};
use lemma_client::{MessageError, MessageItem, MessageRole, MessageStatus, ToolCallItem};

use crate::error_text::error_text;
use crate::strings::{Language, agent};
use crate::text_role::TextRole;

static MESSAGE_STYLE: LazyLock<TextViewStyle> = LazyLock::new(|| TextViewStyle {
    heading_font_size: Some(Arc::new(|level, _| match level {
        1 => px(24.),
        2 => px(20.),
        4 => px(18.),
        6 => px(14.),
        _ => px(16.),
    })),
    table_cell: StyleRefinement::default()
        .text_size(px(13.))
        .line_height(px(20.)),
    ..TextViewStyle::default()
});

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
                this.child(
                    TextView::new(body)
                        .style(MESSAGE_STYLE.clone())
                        .text_reading()
                        .stream_fade(true),
                )
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
                        .text_small()
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
                        .text_caption()
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
        .text_small()
        .text_color(cx.theme().muted_foreground)
        .child(label)
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
        .text_small()
        .text_color(color)
        .child(text)
        .into_any_element()
}
