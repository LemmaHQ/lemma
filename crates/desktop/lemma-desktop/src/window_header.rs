use gpui_kit::component::{ActiveTheme, StyledExt, TitleBar};
use gpui_kit::prelude::FluentBuilder;
use gpui_kit::{App, ParentElement, SharedString, Styled, div};

/// The top band of a content pane: it drags the window, double-clicking it maximizes the window, and it ends with the window controls.
pub(crate) fn window_header(title: Option<SharedString>, cx: &App) -> TitleBar {
    TitleBar::new()
        .h_12()
        .pl_4()
        .bg(cx.theme().background)
        .when(title.is_none(), |header| header.border_b_0())
        .border_color(cx.theme().border)
        .when_some(title, |header, title| {
            header.child(
                div()
                    .min_w_0()
                    .truncate()
                    .text_sm()
                    .font_medium()
                    .child(title),
            )
        })
}
