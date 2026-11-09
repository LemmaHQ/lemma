use gpui_kit::{FontWeight, Styled, px};

/// The web client's type roles from `packages/ui`: text size and line height in pixels, plus the weight of the title and display roles.
pub(crate) trait TextRole: Styled + Sized {
    fn text_caption(self) -> Self {
        self.text_size(px(12.)).line_height(px(16.))
    }

    fn text_small(self) -> Self {
        self.text_size(px(13.)).line_height(px(20.))
    }

    fn text_body(self) -> Self {
        self.text_size(px(14.)).line_height(px(20.))
    }

    fn text_reading(self) -> Self {
        self.text_size(px(16.)).line_height(px(26.))
    }

    fn text_title(self) -> Self {
        self.text_size(px(16.))
            .line_height(px(24.))
            .font_weight(FontWeight::SEMIBOLD)
    }

    fn text_display(self) -> Self {
        self.text_size(px(24.))
            .line_height(px(32.))
            .font_weight(FontWeight::SEMIBOLD)
    }
}

impl<E: Styled> TextRole for E {}
