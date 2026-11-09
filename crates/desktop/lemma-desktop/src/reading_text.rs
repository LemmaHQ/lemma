use gpui_kit::{Styled, px};

/// The reading text role the web client also uses: 16 px text on 26 px lines, for message text and the composer.
pub(crate) trait ReadingText: Styled + Sized {
    fn text_reading(self) -> Self {
        self.text_size(px(16.)).line_height(px(26.))
    }
}

impl<E: Styled> ReadingText for E {}
