use gpui_kit::component::set_locale;
use gpui_kit::{App, Global};

use crate::strings::Language;

/// The language of the interface text, held as a GPUI global.
#[derive(Debug, Clone, Copy)]
pub struct InterfaceLanguage(Language);

impl Global for InterfaceLanguage {}

impl InterfaceLanguage {
    /// Shows the interface, the components' own text included, in `language`.
    pub fn set(language: Language, cx: &mut App) {
        set_locale(match language {
            Language::En => "en",
            Language::Zh => "zh-CN",
        });
        cx.set_global(Self(language));
    }

    /// The language the interface is shown in.
    #[must_use]
    pub fn current(cx: &App) -> Language {
        cx.global::<Self>().0
    }
}
